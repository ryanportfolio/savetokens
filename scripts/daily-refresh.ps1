# daily-refresh.ps1 - daily site figure refresh from the local RTK history database.
#
# Runs in a dedicated clone (%LOCALAPPDATA%\savetokens-refresh) so it never
# touches your working checkout or whatever branch you have open. Pipeline:
#   1. clone (first run) or fast-forward main in the dedicated clone
#   2. export data/snapshot.json from %LOCALAPPDATA%\rtk\history.db
#   3. apply the snapshot to index.html / guide.html / llms.txt
#   4. run verify.mjs (release gate; no commit on failure)
#   5. commit and push to main only if figures changed (Vercel deploys from main)
#
# Register once (adjust time to taste):
#   schtasks /Create /TN "savetokens-daily-refresh" /SC DAILY /ST 09:00 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Home\CoreWise\savetokens\scripts\daily-refresh.ps1"

# "Continue", not "Stop": git writes progress to stderr (Cloning into...,
# remote counters), and under Stop PowerShell 5.1 turns those stderr lines into
# terminating NativeCommandError. Failure detection is explicit $LASTEXITCODE
# checks after every step instead.
$ErrorActionPreference = "Continue"
$remote = "https://github.com/ryanportfolio/savetokens.git"
$work = Join-Path $env:LOCALAPPDATA "savetokens-refresh"
$log = Join-Path $env:LOCALAPPDATA "savetokens-refresh.log"

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $log -Value $line
    Write-Host $line
}

function Fail($msg) {
    Log "FAIL: $msg"
    exit 1
}

try {
    Log "start"

    if (-not (Test-Path (Join-Path $work ".git"))) {
        if (Test-Path $work) { Remove-Item -Recurse -Force $work }
        cmd /c "git clone --quiet `"$remote`" `"$work`" 2>&1" | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail "initial clone failed" }
        Log "cloned $remote"
    }
    Set-Location $work

    cmd /c "git checkout -q main 2>&1" | Out-Null
    cmd /c "git fetch --quiet origin 2>&1" | Out-Null
    cmd /c "git reset --hard --quiet origin/main 2>&1" | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "could not sync clone to origin/main" }

    $specimen = Join-Path $work "design\specimen"
    $out = cmd /c "node `"$(Join-Path $specimen 'scripts\export-snapshot.mjs')`" 2>&1"
    if ($LASTEXITCODE -ne 0) { Fail "export-snapshot.mjs failed: $out" }
    Log "$out"

    $out = cmd /c "node `"$(Join-Path $specimen 'scripts\apply-snapshot.mjs')`" 2>&1"
    if ($LASTEXITCODE -ne 0) { Fail "apply-snapshot.mjs failed: $out" }
    Log "$out"

    $out = cmd /c "node `"$(Join-Path $specimen 'verify.mjs')`" 2>&1" | Select-Object -First 1
    if ($LASTEXITCODE -ne 0) { Fail "verify.mjs failed; figures NOT published: $out" }
    Log "verify: $out"

    cmd /c "git add design/specimen 2>&1" | Out-Null
    cmd /c "git diff --cached --quiet 2>&1" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Log "no figure changes; nothing to publish"
        exit 0
    }

    $date = Get-Date -Format "yyyy-MM-dd"
    cmd /c "git commit --quiet -m `"chore: daily rtk gain snapshot $date`" 2>&1" | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "git commit failed" }

    cmd /c "git push --quiet origin main 2>&1" | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "git push failed; commit is local only" }

    Log "published snapshot $date"
}
catch {
    Log ("FAIL: unhandled: " + $_.Exception.Message)
    exit 1
}
