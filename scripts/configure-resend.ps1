# BULA AUDIT - Configure Resend email.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\configure-resend.ps1 -ApiKey "re_..." -From "BULA AUDIT <noreply@bulaaudit.com.fj>"
#
# Or run without args to be prompted.
#
# Sets EMAIL_DRIVER=resend, RESEND_API_KEY, EMAIL_FROM in server/.env and
# restarts the backend.

param(
  [string]$ApiKey,
  [string]$From,
  [string]$ReplyTo
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $ApiKey) {
  $secure = Read-Host -AsSecureString "Paste your Resend API key (re_...)"
  $ApiKey = [System.Net.NetworkCredential]::new('', $secure).Password
}
if (-not $ApiKey -or $ApiKey -notmatch '^re_') {
  Write-Error "Invalid API key (must start with 're_')."
  exit 1
}
if (-not $From) {
  $From = Read-Host "From address (e.g. 'BULA AUDIT <noreply@yourdomain.com>')"
}
if (-not $From) {
  Write-Error "EMAIL_FROM is required."
  exit 1
}

$envPath = Join-Path $root 'server\.env'
if (-not (Test-Path $envPath)) { Write-Error "server/.env not found."; exit 1 }
$envContent = Get-Content $envPath -Raw

function PatchOrAppend([string]$content, [string]$key, [string]$value) {
  $pattern = "(?m)^$key=.*$"
  if ($content -match $pattern) {
    return [regex]::Replace($content, $pattern, "$key=`"$value`"")
  } else {
    return $content + "`r`n$key=`"$value`""
  }
}

$envContent = PatchOrAppend $envContent 'EMAIL_DRIVER'   'resend'
$envContent = PatchOrAppend $envContent 'RESEND_API_KEY' $ApiKey
$envContent = PatchOrAppend $envContent 'EMAIL_FROM'     $From
if ($ReplyTo) {
  $envContent = PatchOrAppend $envContent 'EMAIL_REPLY_TO' $ReplyTo
}
Set-Content -Path $envPath -Value $envContent -NoNewline

Write-Host "OK: Resend configured in server/.env" -ForegroundColor Green
Write-Host "    From: $From"                       -ForegroundColor Gray

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
Start-Sleep -Seconds 5

try {
  $r = Invoke-RestMethod -Uri 'http://localhost:4000/api/health' -TimeoutSec 5
  if ($r.status -eq 'ok') { Write-Host "OK: backend restarted on :4000" -ForegroundColor Green }
} catch { Write-Warning "Health check failed: $($_.Exception.Message)" }

Write-Host ""
Write-Host "Now password reset and email verification will actually be emailed." -ForegroundColor Cyan
Write-Host "Make sure your sending domain is verified in Resend dashboard."      -ForegroundColor Yellow
