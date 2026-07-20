# refresh-and-publish.ps1 - fully automatic daily snapshot refresh + publish.
#
# Pipeline: pull main -> export-snapshot (reads local RTK history.db) ->
# apply-snapshot -> verify.mjs gate -> commit the regenerated files -> push
# origin/main. Vercel's git integration deploys prod on the push.
#
# Designed to be driven unattended by Windows Task Scheduler. Every exit path is
# logged to $LOCALAPPDATA\savetokens-refresh\refresh.log. Safe by construction:
# it refuses to run unless the checkout is on main with no tracked changes, and
# it discards the regenerated files if the verify gate fails, so a bad snapshot
# never publishes.

$ErrorActionPreference = 'Stop'

# --- paths (derived from this script's location; portable across checkouts) ---
$SpecimenDir = Split-Path -Parent $PSScriptRoot          # design/specimen
$RepoRoot    = Split-Path -Parent (Split-Path -Parent $SpecimenDir)  # repo root
$LogDir      = Join-Path $env:LOCALAPPDATA 'savetokens-refresh'
$LogFile     = Join-Path $LogDir 'refresh.log'

# Files the pipeline regenerates - the exact, complete commit set.
$Generated = @(
  'design/specimen/index.html',
  'design/specimen/guide.html',
  'design/specimen/llms.txt',
  'design/specimen/data/snapshot.json',
  'README.md'
)

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
function Log($msg) {
  $line = ('{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg)
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

# Invoke a native exe and return its combined stdout+stderr as text. Native
# stderr (git prints normal progress there) would raise a terminating
# NativeCommandError under ErrorActionPreference 'Stop', so scope to Continue and
# let callers gate on $LASTEXITCODE instead.
function Exec($exe, [string[]]$argv) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { return (& $exe @argv 2>&1) } finally { $ErrorActionPreference = $prev }
}

# Exec + log output + throw on non-zero exit (for steps that must succeed).
function Run($exe, [string[]]$argv) {
  $out = Exec $exe $argv
  if ($out) { $out | ForEach-Object { Log ("    | " + $_) } }
  if ($LASTEXITCODE -ne 0) { throw ("$exe $($argv -join ' ') exited $LASTEXITCODE") }
}

try {
  Log "=== refresh start ==="

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Log "SKIP: node not on PATH"; exit 0 }
  if (-not (Get-Command git  -ErrorAction SilentlyContinue)) { Log "SKIP: git not on PATH";  exit 0 }

  Set-Location $RepoRoot

  # Guard 1: only ever touch main. If the checkout is parked on a feature branch,
  # skip rather than switch branches under the user.
  $branch = (Exec git @('rev-parse','--abbrev-ref','HEAD')).Trim()
  if ($branch -ne 'main') { Log "SKIP: on branch '$branch', not main"; exit 0 }

  # Guard 2: no uncommitted *tracked* changes. Untracked files are ignored - the
  # commit only ever stages the explicit generated paths, so stray untracked files
  # (e.g. local .codex config) can never be swept into the auto-commit. Tracked
  # edits, though, could collide with pull --ff-only or the regen, so block on them.
  $dirty = Exec git @('status','--porcelain','--untracked-files=no')
  if ($dirty) { Log "SKIP: uncommitted tracked changes present"; ($dirty | ForEach-Object { Log "    ? $_" }); exit 0 }

  # Fast-forward main to origin.
  Run git @('pull','--ff-only','origin','main')

  # Regenerate: export reads the local RTK history.db, apply injects into the site.
  Push-Location $SpecimenDir
  try {
    Run node @('scripts/export-snapshot.mjs')
    Run node @('scripts/apply-snapshot.mjs')

    # Release gate. If it fails, discard the regenerated files and abort - nothing
    # broken ever reaches main.
    $verify = Exec node @('verify.mjs')
    $verify | ForEach-Object { Log ("    | " + $_) }
    if ($LASTEXITCODE -ne 0) {
      Pop-Location
      Exec git (@('checkout','--') + $Generated) | Out-Null
      Log "ERROR: verify.mjs failed (exit $LASTEXITCODE); regenerated files discarded, nothing published"
      exit 1
    }
  } finally {
    if ((Get-Location).Path -eq $SpecimenDir) { Pop-Location }
  }

  # Nothing changed (e.g. already refreshed today) -> no commit.
  Exec git (@('diff','--quiet','--') + $Generated) | Out-Null
  if ($LASTEXITCODE -eq 0) { Log "no change since last run; nothing to publish"; Log "=== refresh done ==="; exit 0 }

  # Commit exactly the generated set and push. Vercel deploys on the push.
  $date = (Get-Content (Join-Path $SpecimenDir 'data/snapshot.json') -Raw | ConvertFrom-Json).snapshotDate
  $msgFile = Join-Path $env:TEMP 'savetokens-refresh-msg.txt'
  @(
    "site: refresh measured snapshot $date",
    '',
    'Automated daily regen from RTK history.db via refresh-and-publish.ps1.',
    '',
    'Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>'
  ) -join "`n" | Set-Content -Path $msgFile -Encoding utf8 -NoNewline

  Run git (@('add','--') + $Generated)
  Run git @('commit','-F',$msgFile)
  Run git @('push','origin','main')

  Log "PUBLISHED snapshot $date"
  Log "=== refresh done ==="
  exit 0
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  exit 1
}
