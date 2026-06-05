# BULA AUDIT — Railway setup helper (run on your PC after code is pushed to GitHub).
#   powershell -ExecutionPolicy Bypass -File .\scripts\railway-do-everything.ps1
#
# You must complete `railway login` in the browser when prompted (one time).

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$varsFile = Join-Path $PSScriptRoot 'railway-variables-PASTE-IN-RAILWAY.txt'

Write-Host ""
Write-Host "=== BULA AUDIT Railway setup ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Railway CLI..." -ForegroundColor Yellow
  npm install -g @railway/cli
}

Write-Host "[1] Railway login (browser opens)..." -ForegroundColor Yellow
railway login

Write-Host "[2] Link this folder to your Railway project..." -ForegroundColor Yellow
Set-Location $root
railway link

Write-Host "[3] Open variables file — paste into APP service RAW editor:" -ForegroundColor Yellow
Write-Host "    $varsFile" -ForegroundColor Green
Start-Process notepad.exe $varsFile
Start-Process "https://railway.app/dashboard"

Write-Host ""
Write-Host "In Railway dashboard:" -ForegroundColor Cyan
Write-Host "  A. Confirm MySQL service is Online"
Write-Host "  B. Click APP service (bula-audit) -> Variables -> RAW Editor"
Write-Host "  C. Paste lines from the notepad file (skip # comments)"
Write-Host "  D. Update Variables"
Write-Host "  E. Settings -> Networking -> Generate Domain (if not done)"
Write-Host "  F. Deployments -> Redeploy"
Write-Host ""
Write-Host "After green deploy, open:" -ForegroundColor Green
Write-Host "  https://YOUR-DOMAIN.up.railway.app/api/health"
Write-Host ""

$go = Read-Host "Press Enter after you pasted variables and redeployed (or type deploy to trigger railway up)"
if ($go -eq 'deploy') {
  railway up
}
