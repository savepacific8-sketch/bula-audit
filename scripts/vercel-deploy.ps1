# Deploy BULA AUDIT frontend to Vercel (reads Supabase keys from repo root .env).
#
# Prerequisites:
#   npx vercel login   (once)
#   .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\vercel-deploy.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Read-EnvKey([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return $null }
  foreach ($line in Get-Content $path) {
    if ($line -match "^$key=(.*)$") {
      return $matches[1].Trim('"')
    }
  }
  return $null
}

$supabaseUrl = Read-EnvKey (Join-Path $root '.env') 'VITE_SUPABASE_URL'
$supabaseKey = Read-EnvKey (Join-Path $root '.env') 'VITE_SUPABASE_ANON_KEY'
if (-not $supabaseUrl -or -not $supabaseKey) {
  Write-Error 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env — run configure-supabase.ps1 first.'
}

Write-Host 'Building frontend...' -ForegroundColor Cyan
$env:VITE_SUPABASE_URL = $supabaseUrl
$env:VITE_SUPABASE_ANON_KEY = $supabaseKey
npm run build
if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }

Write-Host 'Deploying to Vercel...' -ForegroundColor Cyan
npx --yes vercel deploy --prod `
  --env "VITE_SUPABASE_URL=$supabaseUrl" `
  --env "VITE_SUPABASE_ANON_KEY=$supabaseKey" `
  --yes

Write-Host ''
Write-Host 'Done. Copy the production URL above.' -ForegroundColor Green
Write-Host 'Then Supabase -> Authentication -> URL configuration:' -ForegroundColor Yellow
Write-Host '  Site URL = your vercel.app URL'
Write-Host '  Redirect URLs = https://YOUR-APP.vercel.app/**'
