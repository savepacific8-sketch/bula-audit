# One command: sync env, verify Supabase, start app + OCR backend.
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\finish-production.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ''
Write-Host 'BULA AUDIT — production readiness' -ForegroundColor Green
Write-Host ''

# 1. Sync Supabase keys to server (OCR)
if (Test-Path (Join-Path $root '.env')) {
  node scripts/sync-supabase-to-server.mjs
} else {
  Write-Host 'WARN: root .env missing — run configure-supabase.ps1' -ForegroundColor Yellow
}

# 2. Storage buckets (needs SUPABASE_SERVICE_ROLE_KEY in .env)
if (Test-Path (Join-Path $root '.env')) {
  node scripts/ensure-storage-buckets.mjs
  if ($LASTEXITCODE -ne 0) { $storageManual = $true }
}

# 3. Automated checks
Write-Host ''
Write-Host 'Running checks...' -ForegroundColor Cyan
node scripts/verify-supabase-setup.mjs
$verifyOk = $LASTEXITCODE -eq 0

# 4. Kill stale node on 4000/5173 if needed (optional gentle)
foreach ($p in 4000, 5173) {
  $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { Write-Host "Port $p already in use (server may be running)" -ForegroundColor DarkGray }
}

# 5. Start backend + frontend
Write-Host ''
Write-Host 'Starting backend (OCR) + frontend...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\server'; npm run dev"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root'; npm run dev"
Start-Sleep -Seconds 4

# 6. Open app
$url = 'http://localhost:5173'
try {
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
} catch {
  $url = 'http://localhost:5174'
}
Start-Process $url

Write-Host ''
Write-Host "App opening: $url" -ForegroundColor Green
Write-Host ''
Write-Host 'MANUAL (only if verify failed on storage):' -ForegroundColor Yellow
Write-Host '  Supabase SQL Editor -> run supabase/migrations/20250629000003_storage.sql'
Write-Host ''
Write-Host 'DEFERRED (when ready):' -ForegroundColor DarkGray
Write-Host '  Vercel: vercel.com -> Import GitHub repo (when you can sign in)'
Write-Host '  MySQL import: scripts/migrate-mysql-to-supabase.ps1 (needs SUPABASE_SERVICE_ROLE_KEY)'
Write-Host ''
Write-Host 'Test: Receipts -> Upload -> photo -> Save' -ForegroundColor Cyan
