# BULA AUDIT - Configure Google OAuth.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\configure-google-oauth.ps1 -ClientId "..." -ClientSecret "..."
#
# Or run without args to be prompted.
#
# Sets GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in server/.env and restarts the backend.

param(
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$RedirectUri = 'http://localhost:4000/api/auth/google/callback'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $ClientId) {
  $ClientId = Read-Host "Paste your Google OAuth Client ID"
}
if (-not $ClientSecret) {
  $secure = Read-Host -AsSecureString "Paste your Google OAuth Client Secret"
  $ClientSecret = [System.Net.NetworkCredential]::new('', $secure).Password
}
if (-not $ClientId -or -not $ClientSecret) {
  Write-Error "Both Client ID and Client Secret are required."
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

$envContent = PatchOrAppend $envContent 'GOOGLE_CLIENT_ID'     $ClientId
$envContent = PatchOrAppend $envContent 'GOOGLE_CLIENT_SECRET' $ClientSecret
$envContent = PatchOrAppend $envContent 'GOOGLE_REDIRECT_URI'  $RedirectUri
Set-Content -Path $envPath -Value $envContent -NoNewline

Write-Host "OK: Google OAuth credentials written to server/.env"            -ForegroundColor Green
Write-Host "    Redirect URI: $RedirectUri"                                 -ForegroundColor Gray
Write-Host "    Make sure this redirect URI is registered in Google Cloud Console." -ForegroundColor Yellow

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
  $r = Invoke-RestMethod -Uri 'http://localhost:4000/api/auth/google/status' -TimeoutSec 5
  if ($r.configured) { Write-Host "OK: Google OAuth status: configured" -ForegroundColor Green }
  else                { Write-Warning "Status says not configured. Check server/.env values." }
} catch { Write-Warning "Status check failed: $($_.Exception.Message)" }

Write-Host ""
Write-Host "Refresh http://localhost:5173/login - the 'Continue with Google' button should appear." -ForegroundColor Cyan
