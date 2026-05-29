# BULA AUDIT - Apply the production-ready update.
#
# Installs new deps (R2 SDK, Resend), runs Prisma migration for refresh tokens
# + tokenVersion, restarts the backend dev server.
#
# Run from project root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\apply-production-ready.ps1

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

# --- 2. Install new server deps -------------------------------------
Step 2 "Installing server deps (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner, resend)"
Set-Location (Join-Path $root 'server')
& npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
OK "deps installed"

# --- 3. Migrate -----------------------------------------------------
Step 3 "Running prisma migrate dev (refresh tokens + tokenVersion)"
& npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Error "prisma generate failed"; exit 1 }
& npx prisma migrate dev --name production-ready
if ($LASTEXITCODE -ne 0) { Write-Error "prisma migrate failed"; exit 1 }
OK "schema migrated"

# --- 4. Restart -----------------------------------------------------
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
  if ($r.status -eq 'ok' -and $r.db -eq 'up') {
    OK "/api/health returned db:up"
  } else {
    Warn "unexpected: $($r | ConvertTo-Json -Compress)"
  }
} catch { Warn "health check failed: $($_.Exception.Message)" }

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "  Production-ready update applied."                         -ForegroundColor Green
Write-Host "  - refresh tokens (15-min access + 30-day rotating refresh)" -ForegroundColor Green
Write-Host "  - logout / logout-everywhere"                              -ForegroundColor Green
Write-Host "  - email verification on signup"                            -ForegroundColor Green
Write-Host "  - storage abstraction (local + s3/R2 ready)"               -ForegroundColor Green
Write-Host "  - email abstraction (console + Resend ready)"              -ForegroundColor Green
Write-Host "  - /privacy + /terms placeholder pages"                     -ForegroundColor Green
Write-Host "  - production env validator"                                -ForegroundColor Green
Write-Host ""
Write-Host "  Next:"                                                     -ForegroundColor Yellow
Write-Host "    .\scripts\configure-resend.ps1   # enable real emails"   -ForegroundColor Yellow
Write-Host "    .\scripts\configure-r2.ps1       # move uploads to R2"   -ForegroundColor Yellow
Write-Host "    DEPLOY.md                        # ship to production"   -ForegroundColor Yellow
Write-Host "===========================================================" -ForegroundColor Green
