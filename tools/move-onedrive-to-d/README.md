# Moving this PC's OneDrive (Labware, Inc) content to D

**This is a runbook. It is deliberately not automated.**

Status: **not yet run**. Nothing on this machine has been copied, moved or
unlinked by this folder. These are instructions plus two read-only helper
scripts, prepared so the operation is reversible and checked at every step.

---

## 1. What you are actually moving

Measured on this machine before anything was changed:

| | Files | Size |
| --- | --- | --- |
| Total in `OneDrive - Labware, Inc` | 15,445 | 13.14 GB |
| **Real content on this disk** | 10,958 | **7.07 GB** |
| Placeholders (cloud-only, 0 bytes local) | 4,487 | 6.08 GB |

The account is the **work tenant**:

- `UserEmail`: `elsje.bekker@labware.com`
- `ConfiguredTenantId`: `b5db0322-1aa0-4c0a-859c-ad0f96966f4c`
- OneDrive client: `C:\Program Files\Microsoft OneDrive\OneDrive.exe`
  (26.178.0913.0006), self-serve install — no Intune/GPO restriction found.

Folder redirection in effect (`HKCU\...\Explorer\User Shell Folders`):

| Shell folder | Current path | Redirected? |
| --- | --- | --- |
| Desktop | `...\OneDrive - Labware, Inc\Desktop` | **Yes** |
| Documents | `C:\Users\elsje.bekker\Documents` | No |
| Pictures | `C:\Users\elsje.bekker\Pictures` | No |
| Downloads | `C:\Users\elsje.bekker\Downloads` | No |

Only the **Desktop** is redirected, and it sits in that 7.07 GB of real
content.

Disk: D: has **44.46 GB free**; this needs about **14.5 GB** (7.07 GB of
real content, plus up to 6.08 GB if every placeholder is pulled down,
plus overhead). ~30 GB would remain free.

---

## 2. Read this before you start

1. **Check with Labware IT first.** This is company data on a company
   tenant. If policy says it lives in OneDrive/SharePoint, stop here —
   local copies are outside their backup and invisible to the business.
   This runbook cannot make that call for you.

2. **A "move" is really a copy, then a cut-over.** OneDrive has no
   "move the synced folder to D:" button. You copy the content out, then
   unlink. If you unlink first, the local cache is removed and any
   content that had not been copied down from the cloud is gone from
   this disk until it is re-downloaded.

3. **Pull the placeholders down first.** 4,487 of those files are
   cloud-only. A plain `Copy-Item` gives you 0-byte files or errors. Use
   the script in Step 3 — it uses a copy API that hydrates each file.

4. **Removing the Desktop redirect makes your desktop icons vanish.**
   They are not deleted; they reappear once the shell folder points back
   at a local path. Expect it to look wrong for a few minutes.

5. **Do not do this on a Friday afternoon** or with Teams/Outlook
   mid-anything. Sign out of Office apps before the cut-over is
   optional, but do close them if you can.

---

## 3. Step 1 — Back up (do not skip)

Target: `D:\OneDrive-Backup\Labware\`

Run:

```powershell
cd d:\GitHub\aps\tools\move-onedrive-to-d
powershell -NoProfile -ExecutionPolicy Bypass -File .\copy-onedrive.ps1 -Destination 'D:\OneDrive-Backup\Labware'
```

Use that form, or set an execution policy for the session
(`Set-ExecutionPolicy -Scope Process Bypass`) if you prefer to invoke
`& .\copy-onedrive.ps1` directly. Script execution is disabled on this
machine by default, which is itself worth knowing — see section 11.

- It hydrates cloud-only files as it goes (`FileStream` + `CopyFileEx`-
  style copy, which forces a download of placeholders).
- It never deletes or modifies anything in the source; it is read-only
  against OneDrive.
- It prints a per-file result and a summary at the end.
- It is **resumable**: files already present at the destination with the
  same length are skipped, so you can re-run it after an interruption.

This is the slowest step (14.5 GB, partly downloads). Run it in the
background and leave it.

**Before you run it on the real folder, prove it to yourself read-only.**
The same copy logic against a tiny throwaway folder, which is what was
done when these scripts were written:

```powershell
$t = Join-Path $env:TEMP 'od-try'
New-Item -ItemType Directory "$t\src\sub" -Force | Out-Null
'hello' | Set-Content "$t\src\a.txt"
('x' * 5000) | Set-Content "$t\src\sub\b.txt"

powershell -NoProfile -ExecutionPolicy Bypass -File .\copy-onedrive.ps1 -Source "$t\src" -Destination "$t\dest"
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify-copy.ps1 -Source "$t\src" -Destination "$t\dest"

Remove-Item $t -Recurse -Force
```

## 4. Step 2 — Verify the backup before you cut over

```powershell
.\verify-copy.ps1 -Source 'C:\Users\elsje.bekker\OneDrive - Labware, Inc' -Destination 'D:\OneDrive-Backup\Labware'
```

It compares file counts and total bytes and lists anything missing or
short. **Do not proceed past this step unless it reports zero missing,
zero size-mismatch, and `IN SYNC`.**

## 5. Step 3 — Unlink this PC (you do this by hand)

1. Click the OneDrive cloud icon in the notification area → **gear** →
   **Settings**.
2. **Account** tab → **Unlink this PC** → confirm.
3. If asked to keep or remove the local copy of files: **remove**, because
   they are already verified on D: from Step 2.

You should do this step yourself rather than have it scripted: it is a
credential/tenant action, and it is the one step that is hard to undo
casually.

## 6. Step 4 — Point your folders back at local paths

**Desktop.** Removing the redirect is what brings the icons back. Note
that once this PC is unlinked, this setting lives on the *local* OneDrive
client until you sign in again, so it is worth doing before you sign out
if the option is still offered:

1. Right-click the OneDrive icon → **Settings** → **Sync and backup** →
   **Manage backup** → turn **Desktop** off (and Documents/Pictures if
   they are listed as on — on this machine they are not).
2. Your Desktop should return to `C:\Users\elsje.bekker\Desktop`.
3. Confirm by signing out and back in; the shell reads this at logon.

Then copy your desktop files back from the backup:

```powershell
Copy-Item 'D:\OneDrive-Backup\Labware\Desktop\*' "$env:USERPROFILE\Desktop\" -Recurse -Force
```

**Everything else** (Projects, Upgrade Assessments, Meetings, Scans,
Notebooks, Recordings, Attachments, the .url shortcuts) has no shell
redirect to remove. It is now just files on D: under
`D:\OneDrive-Backup\Labware\`. Rename that folder to whatever you want
them to be, e.g.:

```powershell
Rename-Item 'D:\OneDrive-Backup\Labware' 'D:\Work'
```

## 7. Step 5 — Confirm nothing is left behind

```powershell
Get-Process OneDrive -ErrorAction SilentlyContinue            # expect: no output
Test-Path 'C:\Users\elsje.bekker\OneDrive - Labware, Inc'    # expect: False
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders' |
    Select-Object Desktop, Personal
```

The last command must show `Desktop : C:\Users\elsje.bekker\Desktop` and
`Personal : C:\Users\elsje.bekker\Documents`. If `Desktop` still points
into OneDrive, step 6.1 did not take — redo it in the OneDrive UI, do not
edit the registry.

Finally, delete the local OneDrive folder only after confirming it is
empty or holds nothing you need:

```powershell
Get-ChildItem -Force -Recurse 'C:\Users\elsje.bekker\OneDrive - Labware, Inc' |
    Measure-Object Length -Sum
```

---

## 8. Rolling back

- **Before the unlink:** delete `D:\OneDrive-Backup` and nothing else has
  changed.
- **After the unlink:** sign back into OneDrive with
  `elsje.bekker@labware.com` and re-enable the Desktop backup in the
  OneDrive UI. Your cloud content is untouched throughout —
  unlinking never deletes anything in SharePoint.

## 9. Consequences to accept

- Those files will no longer sync, version or back up to Labware's
  SharePoint, and will not be reachable from Teams or another device.
- **You become responsible for backups** of ~7 GB of company data on a
  laptop drive. Consider an external drive or your own backup tool.
- If IT later re-rolls Known Folder Move via Intune, the Desktop redirect
  can come back on its own.
- OneDrive free space on C: is not reclaimed by unlinking until you delete
  the local folder (Step 7).

---

## 10. What these scripts are

| File | Role |
| --- | --- |
| `copy-onedrive.ps1` | One-way, non-destructive, resumable copy that hydrates placeholders |
| `verify-copy.ps1` | Read-only comparison of counts, bytes and per-file lengths |

Neither script deletes, moves or unlinks anything. Both are safe to read
in full before you run them.

### Behaviour that was tested against a throwaway tree

| Test | Expected | Result |
| --- | --- | --- |
| Fresh copy of 3 files, one nested two levels | 3 copied | pass |
| Verify straight after that copy | `IN SYNC`, exit 0 | pass |
| Re-run the copy unchanged | 0 copied, 3 skipped | pass |
| Truncate a copied file, then verify | 1 size mismatch, exit 1 | pass |
| Source `\src` next to a sibling `\src2` | 3 files only; sibling not swept in | pass |
| Destination inside the source | refuse to run | pass |

Two bugs were found and fixed while writing these, both of which would
have caused a **silently incomplete backup**:

1. `Resolve-Path` returned the 8.3 short path (`ELSJE~1.BEK`) while
   `Get-ChildItem` returned long paths, so the length-based relative-path
   calculation cut the path wrongly (`c\one.txt` instead of `one.txt`).
   Both scripts now use a separator-aware prefix comparison.
2. `Get-ChildItem -ErrorAction SilentlyContinue` on the walk swallowed
   the OneDrive hydration errors too, so a cloud-only file that failed to
   download would be skipped while the summary still claimed
   `Failed: 0`. Errors are now captured and reported, and a copy is
   additionally checked for the expected byte count before it counts
   as a success.

## 11. Things noticed on this machine while preparing this

- **Script execution is disabled**: no `.ps1` runs by double-click. Not a
  blocker (use the `powershell -ExecutionPolicy Bypass -File` form in
  step 1), but it will surprise you.
- **`Get-Item 'C:\Users\elsje.bekker\OneDrive*'` returns two folders**:
  `OneDrive` (a plain, empty local folder, not a link) and
  `OneDrive - Labware, Inc` (the real synced one, a cloud reparse point).
  Only the second is involved here; leave `OneDrive` alone.
- **OneDrive is a per-user install** at
  `C:\Program Files\Microsoft OneDrive\OneDrive.exe`, no Intune/GPO
  policy found. That is why nothing blocks this, and also why nothing
  will stop a future policy from re-enabling it.
