# Daily G0 demand readout — runs report:demand and appends to a local log.
# Registered as Windows scheduled task "SkillCrossroads Demand Readout" (daily 08:03 local).
# Log: %LOCALAPPDATA%\skillcrossroads\demand-daily.log
# Reads DATABASE_URL (and LAUNCH_DATE once set post-launch) from apps/web/.env.local.

$ErrorActionPreference = "Stop"
$webDir = Split-Path -Parent $PSScriptRoot   # apps/web
$logDir = Join-Path $env:LOCALAPPDATA "skillcrossroads"
$log = Join-Path $logDir "demand-daily.log"
New-Item -ItemType Directory -Force $logDir | Out-Null

foreach ($line in Get-Content (Join-Path $webDir ".env.local")) {
  if ($line -match "^(DATABASE_URL|LAUNCH_DATE|LAUNCH_POSTS)=(.+)$") {
    Set-Item -Path "env:$($Matches[1])" -Value $Matches[2]
  }
}
$env:OWNER_LOGINS = "sgharlow"

"`n===== $(Get-Date -Format 'yyyy-MM-dd HH:mm') =====" | Add-Content $log

# Rebuild @beacon/core first. report:demand imports it from packages/core/dist, which nothing else
# rebuilds — on 2026-10-19 dist was dated 2026-09-26, so a merged gate change would not have run.
# Fail-closed: a failed build writes a visible line and the readout does NOT run on a stale dist.
# Output is captured so a successful build leaves the log format unchanged.
$coreDir = Join-Path (Split-Path -Parent (Split-Path -Parent $webDir)) "packages\core"
try {
  Set-Location $coreDir
  $buildOut = npm run build --silent 2>&1
  $buildRc = $LASTEXITCODE
} catch {
  $buildOut = "$_"
  $buildRc = -1
}
if ($buildRc -ne 0) {
  "READOUT FAILED: build of packages/core exited $buildRc; readout skipped (dist may be stale)" | Add-Content $log
  $buildOut | ForEach-Object { "  $_" } | Add-Content $log
  exit 1
}

try {
  Set-Location $webDir
  npm run report:demand 2>&1 | Add-Content $log
} catch {
  # Fail-closed: a broken readout must be visible in the log, not silent.
  "READOUT FAILED: $_" | Add-Content $log
  exit 1
}
