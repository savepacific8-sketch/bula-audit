# BULA AUDIT - Configure Cloudflare Turnstile CAPTCHA.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\configure-turnstile.ps1
#
# Writes TURNSTILE_SECRET_KEY to server/.env and VITE_TURNSTILE_SITE_KEY to repo root .env

param(
  [string]$SiteKey,
  [string]$SecretKey
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $SiteKey) { $SiteKey = Read-Host "Turnstile Site Key (public, for frontend)" }
if (-not $SecretKey) {
  $secure = Read-Host -AsSecureString "Turnstile Secret Key"
  $SecretKey = [System.Net.NetworkCredential]::new('', $secure).Password
}
if (-not $SiteKey -or -not $SecretKey) {
  Write-Error "Both site key and secret key are required."
  exit 1
}

$serverEnv = Join-Path $root 'server\.env'
if (-not (Test-Path $serverEnv)) { Write-Error "server/.env not found."; exit 1 }
$serverContent = Get-Content $serverEnv -Raw

function PatchOrAppend([string]$content, [string]$key, [string]$value) {
  $pattern = "(?m)^$key=.*$"
  if ($content -match $pattern) {
    return [regex]::Replace($content, $pattern, "$key=`"$value`"")
  }
  return $content + "`r`n$key=`"$value`""
}

$serverContent = PatchOrAppend $serverContent 'TURNSTILE_SECRET_KEY' $SecretKey
Set-Content -Path $serverEnv -Value $serverContent -NoNewline

$rootEnv = Join-Path $root '.env'
$rootContent = ''
if (Test-Path $rootEnv) { $rootContent = Get-Content $rootEnv -Raw }
$rootContent = PatchOrAppend $rootContent 'VITE_TURNSTILE_SITE_KEY' $SiteKey
Set-Content -Path $rootEnv -Value $rootContent -NoNewline

Write-Host "OK: Turnstile keys written to server/.env and .env" -ForegroundColor Green
Write-Host "Railway: add TURNSTILE_SECRET_KEY and VITE_TURNSTILE_SITE_KEY, then redeploy." -ForegroundColor Cyan
