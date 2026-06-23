# Create Supabase storage buckets (one-time). Needs secret key from dashboard.
# Run: powershell -ExecutionPolicy Bypass -File .\scripts\setup-storage.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$envPath = Join-Path $root '.env'
if (-not (Test-Path $envPath)) {
  Write-Host 'Missing .env — run configure-supabase.ps1 first.' -ForegroundColor Red
  exit 1
}

$content = Get-Content $envPath -Raw
$hasSecret = $content -match '(?m)^SUPABASE_SERVICE_ROLE_KEY=.+'

if (-not $hasSecret) {
  Write-Host ''
  Write-Host 'Supabase SECRET key (Settings -> API Keys -> Secret key, sb_secret_...)' -ForegroundColor Cyan
  Write-Host 'This stays in .env on your PC only — never commit it.' -ForegroundColor DarkGray
  $secret = Read-Host 'Paste secret key'
  $secret = $secret.Trim()
  if (-not $secret) { Write-Error 'Secret key required.' }
  if ($content -match '(?m)^SUPABASE_SERVICE_ROLE_KEY=') {
    $content = [regex]::Replace($content, '(?m)^SUPABASE_SERVICE_ROLE_KEY=.*', "SUPABASE_SERVICE_ROLE_KEY=$secret")
  } else {
    $content = $content.TrimEnd() + "`r`nSUPABASE_SERVICE_ROLE_KEY=$secret`r`n"
  }
  Set-Content -Path $envPath -Value $content -NoNewline
  Write-Host 'OK: saved SUPABASE_SERVICE_ROLE_KEY to .env' -ForegroundColor Green
}

Write-Host ''
Write-Host 'Creating storage buckets...' -ForegroundColor Cyan
node scripts/ensure-storage-buckets.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Verifying...' -ForegroundColor Cyan
npm run verify
exit $LASTEXITCODE
