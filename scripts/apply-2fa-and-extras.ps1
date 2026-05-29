# BULA AUDIT - Apply 2FA, backup script, audit log UI, PWA.
#
# Run from project root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\apply-2fa-and-extras.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($n, $msg) { Write-Host ""; Write-Host "[$n] $msg" -ForegroundColor Cyan }
function OK($msg)       { Write-Host "    OK: $msg" -ForegroundColor Green }
function Warn($msg)     { Write-Host "    !! $msg"  -ForegroundColor Yellow }

# --- 1. Stop backend ------------------------------------------------
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

# --- 2. Install new server deps (otplib, qrcode, types) -------------
Step 2 "Installing new server deps (otplib, qrcode, @types/qrcode)"
Set-Location (Join-Path $root 'server')
& npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
OK "deps installed"

# --- 3. Prisma migrate (2FA + backup codes) -------------------------
Step 3 "Prisma migrate for 2FA + backup codes"
& npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Error "prisma generate failed"; exit 1 }
& npx prisma migrate dev --name two-factor-auth
if ($LASTEXITCODE -ne 0) { Write-Error "prisma migrate failed"; exit 1 }
OK "schema migrated"

# --- 4. Restart backend ---------------------------------------------
Step 4 "Restarting backend dev server"
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

# --- 5. Health check ------------------------------------------------
Step 5 "Health check"
try {
  $r = Invoke-RestMethod -Uri 'http://localhost:4000/api/health' -TimeoutSec 5
  if ($r.status -eq 'ok') { OK "/api/health returned db:up" } else { Warn "unexpected: $($r | ConvertTo-Json -Compress)" }
} catch { Warn "health check failed: $($_.Exception.Message)" }

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "  Update applied. New features:"                              -ForegroundColor Green
Write-Host "  - 2FA (TOTP) at /settings + login challenge"                -ForegroundColor Green
Write-Host "  - Audit log viewer at /audit-log (admin only)"              -ForegroundColor Green
Write-Host "  - PWA: manifest + service worker (production only)"        -ForegroundColor Green
Write-Host "  - DB backup: npm run db:backup (or schedule with"           -ForegroundColor Green
Write-Host "    .\scripts\setup-backup-schedule.ps1)"                     -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
