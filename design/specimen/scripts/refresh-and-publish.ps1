# refresh-and-publish.ps1 - fully automatic daily snapshot refresh + publish.
#
# Pipeline: pull main -> export-snapshot (reads local RTK history.db) ->
# apply-snapshot -> verify.mjs gate -> commit the regenerated files -> push
# origin/main. Vercel's git integration deploys prod on the push.
#
# Designed to be driven unattended by Windows Task Scheduler. Every exit path is
# logged to $LOCALAPPDATA\savetokens-refresh\refresh.log. Safe by construction:
# it refuses to run unless the checkout is on main and clean, and it discards the
# regenerated files if the verify gate fails, so a bad snapshot never publishes.

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

# Run a native command and throw on non-zero exit, capturing output to the log.
function Run($exe, [string[]]$argv, $cwd) {
  $out = & $exe @argv 2>&1
  if ($out) { $out | ForEach-Object { Log ("    | " + $_) } }
  if ($LASTEXITCODE -ne 0) { throw ("$exe $($argv -join ' ') exited $LASTEXITCODE") }
}

try {
  Log "=== refresh start ==="

  $node = (Get-Command node -ErrorAction SilentlyContinue)
  if (-not $node) { Log "SKIP: node not on PATH"; exit 0 }
  $git = (Get-Command git -ErrorAction SilentlyContinue)
  if (-not $git) { Log "SKIP: git not on PATH"; exit 0 }

  Set-Location $RepoRoot

  # Guard 1: only ever touch main. If the checkout is parked on a feature branch,
  # skip rather than switch branches under the user.
  $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -ne 'main') { Log "SKIP: on branch '$branch', not main"; exit 0 }

  # Guard 2: no uncommitted *tracked* changes. Untracked files are ignored - the
  # commit only ever stages the explicit generated paths, so stray untracked files
  # (e.g. local .codex config) can never be swept into the auto-commit. Tracked
  # edits, though, could collide with pull --ff-only or the regen, so block on them.
  $dirty = (& git status --porcelain --untracked-files=no)
  if ($dirty) { Log "SKIP: uncommitted tracked changes present"; ($dirty | ForEach-Object { Log "    ? $_" }); exit 0 }

  # Fast-forward main to origin.
  Run 'git' @('pull','--ff-only','origin','main') $RepoRoot

  # Regenerate: export reads the local RTK history.db, apply injects into the site.
  Run 'node' @('scripts/export-snapshot.mjs') $SpecimenDir
  Push-Location $SpecimenDir
  try {
    Run 'node' @('scripts/apply-snapshot.mjs') $SpecimenDir

    # Release gate. If it fails, discard the regenerated files and abort - nothing
    # broken ever reaches main.
    $verify = & node verify.mjs 2>&1
    $verify | ForEach-Object { Log ("    | " + $_) }
    if ($LASTEXITCODE -ne 0) {
      Pop-Location
      & git checkout -- $Generated 2>&1 | Out-Null
      Log "ERROR: verify.mjs failed (exit $LASTEXITCODE); regenerated files discarded, nothing published"
      exit 1
    }
  } finally {
    if ((Get-Location).Path -eq $SpecimenDir) { Pop-Location }
  }

  # Nothing changed (e.g. already refreshed today) -> no commit.
  & git diff --quiet -- $Generated
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

  Run 'git' (@('add','--') + $Generated) $RepoRoot
  Run 'git' @('commit','-F',$msgFile) $RepoRoot
  Run 'git' @('push','origin','main') $RepoRoot

  Log "PUBLISHED snapshot $date"
  Log "=== refresh done ==="
  exit 0
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  exit 1
}
