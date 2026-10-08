<#
    copy-onedrive.ps1

    One-way copy of a OneDrive folder to a local destination.

    READ-ONLY AGAINST THE SOURCE. This script never deletes, moves,
    renames or unlinks anything in OneDrive. It only reads.

    Why not Copy-Item: files that are cloud-only ("free up space" /
    online-only) are reparse points with no local data, so a plain copy
    produces 0-byte files or errors. Opening a FileStream on them makes
    the OneDrive filter driver hydrate the real content first, which is
    what this script does.

    Resumable: a file is skipped when the destination already has it at
    the same length, so an interrupted run can simply be repeated.

    NOTE on enumeration: the source is walked WITHOUT -ErrorAction
    SilentlyContinue. Swallowing errors here would silently skip a file
    that OneDrive failed to hydrate, and the summary would still read
    "Failed: 0" - a silently incomplete backup. Directory-walk errors
    are collected into $walkErrors and reported instead.
#>

[CmdletBinding()]
param(
    [string] $Source = 'C:\Users\elsje.bekker\OneDrive - Labware, Inc',
    [string] $Destination = 'D:\OneDrive-Backup\Labware'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source)) {
    throw "Source not found: $Source"
}

# GetFullPath, not Resolve-Path: Resolve-Path can hand back an 8.3 short
# path (ELSJE~1.BEK), which does not share a prefix length with the long
# paths returned by Get-ChildItem.
$sourceFull = [IO.Path]::GetFullPath($Source).TrimEnd('\')
$destFull = [IO.Path]::GetFullPath($Destination).TrimEnd('\')

if ($destFull.StartsWith($sourceFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Destination is inside the source. Refusing to run.'
}

<#
   Relative path without [IO.Path]::GetRelativePath, which is .NET Core
   only and does not exist in Windows PowerShell 5.1.

   The prefix is compared with OrdinalIgnoreCase AND a trailing
   separator is required. Without the separator, a source of ...\aps
   would also match a sibling ...\aps-old\x.txt and yield a bogus
   relative path.
#>
function Get-RelativePath {
    param([string] $Base, [string] $Full)

    $prefix = $Base + '\'

    if ($Full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        return $Full.Substring($prefix.Length)
    }

    throw "Path is not under the base folder: $Full"
}

Write-Host "Source      : $sourceFull"
Write-Host "Destination : $destFull"
Write-Host ''

$walkErrors = New-Object System.Collections.Generic.List[string]
$walkProblem = $null
$files = @(Get-ChildItem -LiteralPath $sourceFull -Recurse -File -Force -ErrorVariable walkProblem -ErrorAction SilentlyContinue)

foreach ($problem in @($walkProblem)) {
    $walkErrors.Add([string]$problem.TargetObject)
}

Write-Host ("Files to consider: {0}" -f $files.Count)

if ($walkErrors.Count -gt 0) {
    Write-Host ("Unreadable items during the walk: {0}" -f $walkErrors.Count)
}

Write-Host ''

$copied = 0
$skipped = 0
$failed = @()
$bytes = 0L
$index = 0

foreach ($file in $files) {
    $index++
    $relative = Get-RelativePath -Base $sourceFull -Full $file.FullName
    $target = Join-Path $destFull $relative
    $targetDir = Split-Path -Parent $target

    if ($index % 500 -eq 0) {
        Write-Host ("  ... {0}/{1}  copied={2} skipped={3} failed={4}" -f $index, $files.Count, $copied, $skipped, $failed.Count)
    }

    try {
        if (-not (Test-Path -LiteralPath $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }

        if (Test-Path -LiteralPath $target) {
            $existing = Get-Item -LiteralPath $target -Force
            if ($existing.Length -eq $file.Length) {
                $skipped++
                continue
            }
        }

        # Opening a read stream hydrates a cloud-only placeholder.
        $inputStream = [IO.File]::Open($file.FullName, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
        try {
            $outputStream = [IO.File]::Create($target)
            try {
                $inputStream.CopyTo($outputStream, 1MB)
            }
            finally {
                $outputStream.Dispose()
            }
        }
        finally {
            $inputStream.Dispose()
        }

        # A hydrated cloud file that came down empty is a copy failure.
        $written = (Get-Item -LiteralPath $target -Force).Length
        if ($written -ne $file.Length) {
            throw "size mismatch after copy: expected $($file.Length) bytes, wrote $written (OneDrive may not have hydrated this file)"
        }

        $copied++
        $bytes += $file.Length
    }
    catch {
        $failed += [pscustomobject]@{ File = $relative; Error = $_.Exception.Message }
    }
}

Write-Host ''
Write-Host '======================== SUMMARY ========================'
Write-Host ("Copied  : {0}" -f $copied)
Write-Host ("Skipped : {0}  (already present, same size)" -f $skipped)
Write-Host ("Failed  : {0}" -f $failed.Count)
Write-Host ("Walk    : {0} unreadable item(s)" -f $walkErrors.Count)
Write-Host ("Bytes   : {0} ({1} GB)" -f $bytes, [math]::Round($bytes / 1GB, 2))
Write-Host ("Target  : {0}" -f $destFull)

if ($walkErrors.Count -gt 0) {
    Write-Host ''
    Write-Host 'UNREADABLE DURING WALK:'
    $walkErrors | Select-Object -First 40 | ForEach-Object { Write-Host "  $_" }
}

if ($failed.Count -gt 0) {
    Write-Host ''
    Write-Host 'FAILURES (these were NOT copied):'
    $failed | Format-Table -AutoSize
}

if ($failed.Count -gt 0 -or $walkErrors.Count -gt 0) {
    Write-Host ''
    Write-Host 'Re-run the script to retry, then re-check with verify-copy.ps1.'
    exit 1
}

Write-Host ''
Write-Host 'Next: run verify-copy.ps1, then follow the README.'
