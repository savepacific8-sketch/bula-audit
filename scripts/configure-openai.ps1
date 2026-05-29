# BULA AUDIT - Configure OpenAI.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\configure-openai.ps1 -ApiKey "sk-..."
#   powershell -ExecutionPolicy Bypass -File .\scripts\configure-openai.ps1 -ApiKey "sk-..." -Model "gpt-4o"
#
# Or run without -ApiKey to be prompted.
#
# Sets OPENAI_API_KEY in server/.env and restarts the backend dev server.

param(
  [string]$ApiKey,
  [string]$Model = 'gpt-4o-mini'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $ApiKey) {
  $secure = Read-Host -AsSecureString "Paste your OpenAI API key (sk-...)"
  $ApiKey = [System.Net.NetworkCredential]::new('', $secure).Password
}
if (-not $ApiKey -or $ApiKey -notmatch '^sk-') {
  Write-Error "Invalid API key (must start with 'sk-')."
  exit 1
}

$envPath = Join-Path $root 'server\.env'
if (-not (Test-Path $envPath)) { Write-Error "server/.env not found."; exit 1 }
$envContent = Get-Content $envPath -Raw

if ($envContent -match '(?m)^OPENAI_API_KEY=.*$') {
  $envContent = [regex]::Replace($envContent, '(?m)^OPENAI_API_KEY=.*$', "OPENAI_API_KEY=`"$ApiKey`"")
} else {
  $envContent += "`r`nOPENAI_API_KEY=`"$ApiKey`""
}
if ($envContent -match '(?m)^OPENAI_MODEL=.*$') {
  $envContent = [regex]::Replace($envContent, '(?m)^OPENAI_MODEL=.*$', "OPENAI_MODEL=`"$Model`"")
} else {
  $envContent += "`r`nOPENAI_MODEL=`"$Model`""
}
Set-Content -Path $envPath -Value $envContent -NoNewline
Write-Host "OK: OPENAI_API_KEY and OPENAI_MODEL=$Model written to server/.env" -ForegroundColor Green

# Restart backend
$pidFile = Join-Path $root 'server\.dev.pid'
if (Test-Path $pidFile) {
  $stored = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($stored) { Stop-Process -Id $stored -Force -ErrorAction SilentlyContinue }
}
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
  $_.Path -like "*bula-audit\server*"
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$proc = Start-Process -FilePath cmd.exe `
  -ArgumentList '/c','npm','run','dev' `
  -WorkingDirectory (Join-Path $root 'server') `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $root 'server\.dev.out.log') `
  -RedirectStandardError  (Join-Path $root 'server\.dev.err.log') `
  -PassThru
$proc.Id | Set-Content (Join-Path $root 'server\.dev.pid')
Start-Sleep -Seconds 4

try {
  $r = Invoke-RestMethod -Uri 'http://localhost:4000/api/health' -TimeoutSec 5
  if ($r.status -eq 'ok') { Write-Host "OK: backend restarted on :4000" -ForegroundColor Green }
} catch { Write-Warning "Health check failed: $($_.Exception.Message)" }

Write-Host ""
Write-Host "AI is now configured. Try uploading a receipt - it will use OpenAI Vision for OCR." -ForegroundColor Cyan
Write-Host "Agent chats (VAT advisor, spending trends) will also work."                         -ForegroundColor Cyan
