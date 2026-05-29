# BULA AUDIT - Apply the express-async-errors patch.
#
# Run from project root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-async-errors.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($n, $msg) { Write-Host ""; Write-Host "[$n] $msg" -ForegroundColor Cyan }
function OK($msg)       { Write-Host "    OK: $msg" -ForegroundColor Green }
function Warn($msg)     { Write-Host "    !! $msg"  -ForegroundColor Yellow }

# 1. Stop backend
Step 1 "Stopping any running backend"
$pidFile = Join-Path $root 'server\.dev.pid'
if (Test-Path $pidFile) {
  $stored = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($stored) { Stop-Process -Id $stored -Force -ErrorAction SilentlyContinue }
}
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
  $_.Path -like "*bula-audit\server*"
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
OK "processes stopped"

# 2. Install
Step 2 "Installing express-async-errors"
Set-Location (Join-Path $root 'server')
& npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
OK "deps installed"

# 3. Restart
Step 3 "Restarting backend dev server"
$proc = Start-Process -FilePath cmd.exe `
  -ArgumentList '/c','npm','run','dev' `
  -WorkingDirectory (Join-Path $root 'server') `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $root 'server\.dev.out.log') `
  -RedirectStandardError  (Join-Path $root 'server\.dev.err.log') `
  -PassThru
$proc.Id | Set-Content (Join-Path $root 'server\.dev.pid')
Start-Sleep -Seconds 5
OK "server started (pid $($proc.Id))"

# 4. Health check
Step 4 "Health check"
try {
  $r = Invoke-RestMethod -Uri 'http://localhost:4000/api/health' -TimeoutSec 5
  if ($r.status -eq 'ok') { OK "/api/health returned db:up" } else { Warn "unexpected: $($r | ConvertTo-Json -Compress)" }
} catch { Warn "health check failed: $($_.Exception.Message)" }

Write-Host ""
Write-Host "Fix applied. Async route errors no longer crash the server." -ForegroundColor Green
Write-Host "Retry the 2FA setup at http://localhost:5173/settings"        -ForegroundColor Cyan
