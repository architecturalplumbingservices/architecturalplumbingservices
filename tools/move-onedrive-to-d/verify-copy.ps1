<#
    verify-copy.ps1

    Read-only comparison of a OneDrive source against the copy made by
    copy-onedrive.ps1.

    Does not read file *contents* (which would hydrate every placeholder
    and cost 6 GB of downloads again); it compares relative paths and
    byte lengths, which is what catches the failure modes that actually
    happen here: a file that failed to copy, and a cloud-only placeholder
    that was copied as 0 bytes.

    Exits 0 when the copy is complete, 1 otherwise, so it is safe to gate
    the cut-over on it.
#>

[CmdletBinding()]
param(
    [string] $Source = 'C:\Users\elsje.bekker\OneDrive - Labware, Inc',
    [string] $Destination = 'D:\OneDrive-Backup\Labware'
)

$ErrorActionPreference = 'Stop'

foreach ($path in @($Source, $Destination)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Not found: $path"
    }
}

$sourceFull = [IO.Path]::GetFullPath($Source).TrimEnd('\')
$destFull = [IO.Path]::GetFullPath($Destination).TrimEnd('\')

# Resolve-Path can return an 8.3 short path (ELSJE~1.BEK); report the
# long form so the printed paths match what Explorer shows.
if ($sourceFull -match '~\d') {
    Write-Host "Note: source path looks like an 8.3 short name: $sourceFull"
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

Write-Host 'Indexing source...'
$sourceMap = @{}
foreach ($file in Get-ChildItem -LiteralPath $sourceFull -Recurse -File -Force -ErrorAction SilentlyContinue) {
    $sourceMap[(Get-RelativePath -Base $sourceFull -Full $file.FullName)] = $file
}

Write-Host 'Indexing destination...'
$destMap = @{}
foreach ($file in Get-ChildItem -LiteralPath $destFull -Recurse -File -Force -ErrorAction SilentlyContinue) {
    $destMap[(Get-RelativePath -Base $destFull -Full $file.FullName)] = $file
}

$sourceBytes = ($sourceMap.Values | Measure-Object Length -Sum).Sum
$destBytes = ($destMap.Values | Measure-Object Length -Sum).Sum

Write-Host ''
Write-Host '======================== RESULT ========================'
Write-Host ("Source files : {0,7}  {1,9} GB" -f $sourceMap.Count, [math]::Round($sourceBytes / 1GB, 2))
Write-Host ("Copied files : {0,7}  {1,9} GB" -f $destMap.Count, [math]::Round($destBytes / 1GB, 2))

$missing = New-Object System.Collections.Generic.List[string]
$mismatch = New-Object System.Collections.Generic.List[string]

foreach ($relative in $sourceMap.Keys) {
    if (-not $destMap.ContainsKey($relative)) {
        $missing.Add($relative)
        continue
    }

    $expected = $sourceMap[$relative].Length
    $actual = $destMap[$relative].Length

    if ($expected -ne $actual) {
        $mismatch.Add(("{0}  (source {1} bytes / copied {2} bytes)" -f $relative, $expected, $actual))
    }
}

Write-Host ("Missing      : {0}" -f $missing.Count)
Write-Host ("Size differs : {0}" -f $mismatch.Count)

if ($missing.Count -gt 0) {
    Write-Host ''
    Write-Host 'MISSING (first 40):'
    $missing | Select-Object -First 40 | ForEach-Object { Write-Host "  $_" }
}

if ($mismatch.Count -gt 0) {
    Write-Host ''
    Write-Host 'SIZE MISMATCH (first 40) - likely a cloud-only file copied as 0 bytes:'
    $mismatch | Select-Object -First 40 | ForEach-Object { Write-Host "  $_" }
}

Write-Host ''

if ($missing.Count -eq 0 -and $mismatch.Count -eq 0) {
    Write-Host 'IN SYNC - every source file has a same-length copy at the destination.'
    Write-Host 'You may proceed to the unlink step in the README.'
    exit 0
}

Write-Host 'NOT COMPLETE - do NOT unlink. Re-run copy-onedrive.ps1, then verify again.'
exit 1
