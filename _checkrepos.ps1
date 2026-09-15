$ErrorActionPreference = 'SilentlyContinue'
foreach ($n in @('ShadyShaun', 'shady-shaun', 'Shady-Shaun')) {
    try {
        $r = Invoke-WebRequest -Uri "https://github.com/belshie1/$n" -Method Head -ErrorAction Stop
        Write-Output "$n : EXISTS ($($r.StatusCode))"
    }
    catch {
        Write-Output "$n : $($_.Exception.Response.StatusCode.value__)"
    }
}
