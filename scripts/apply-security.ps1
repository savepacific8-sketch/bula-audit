# BULA AUDIT - Apply the security hardening update.
#
# What it does:
#   1. Installs the new server deps (express-rate-limit, file-type).
#   2. Generates Prisma client + runs a new migration for the security tables.
#   3. Restarts the backend dev server.
#
# Run from project root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\apply-security.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($n, $msg) { Write-Host ""; Write-Host "[$n] $msg" -ForegroundColor Cyan }
function OK($msg)       { Write-Host "    OK: $msg" -ForegroundColor Green }
function Warn($msg)     { Write-Host "    !! $msg"  -ForegroundColor Yellow }

# --- 1. Stop running server -----------------------------------------
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

# --- 2. Install new server deps -------------------------------------
Step 2 "Installing server deps (express-rate-limit, file-type)"
Set-Location (Join-Path $root 'server')
& npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
OK "deps installed"

# --- 3. Run prisma generate + migrate -------------------------------
Step 3 "Running prisma migrate dev for security tables"
& npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Error "prisma generate failed"; exit 1 }
& npx prisma migrate dev --name security-hardening
if ($LASTEXITCODE -ne 0) { Write-Error "prisma migrate failed"; exit 1 }
OK "schema migrated"

# --- 4. Restart backend ---------------------------------------------
Step 4 "Starting backend dev server"
# Use cmd.exe to spawn npm (npm on Windows is npm.cmd, not directly Start-Process-able)
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
  if ($r.status -eq 'ok' -and $r.db -eq 'up') {
    OK "/api/health returned db:up"
  } else {
    Warn "unexpected response: $($r | ConvertTo-Json -Compress)"
  }
} catch { Warn "health check failed: $($_.Exception.Message)" }

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "  Security hardening applied."                                -ForegroundColor Green
Write-Host "  - rate limiting on /api/auth, /api/ai, /api/uploads"        -ForegroundColor Green
Write-Host "  - account lockout (5 fails / 15 min)"                       -ForegroundColor Green
Write-Host "  - password reset endpoints + frontend pages"                -ForegroundColor Green
Write-Host "  - audit log table"                                          -ForegroundColor Green
Write-Host "  - soft delete on receipts (FRCS)"                           -ForegroundColor Green
Write-Host "  - hardened helmet config + production CSP"                  -ForegroundColor Green
Write-Host "  - file upload magic-byte validation"                        -ForegroundColor Green
Write-Host ""
Write-Host "  See SECURITY.md for full posture + TODOs before launch."    -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Green
