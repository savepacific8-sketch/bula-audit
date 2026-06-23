# BULA AUDIT — Supabase local config
# Run: powershell -ExecutionPolicy Bypass -File .\scripts\configure-supabase.ps1

param(
  [string]$ProjectRef,
  [string]$PublishableKey
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $ProjectRef) {
  Write-Host ''
  Write-Host 'Supabase Reference ID (Settings -> General -> Reference ID)' -ForegroundColor Cyan
  Write-Host 'Or the part after /project/ in your dashboard URL' -ForegroundColor DarkGray
  $ProjectRef = Read-Host 'Reference ID'
}
if (-not $PublishableKey) {
  Write-Host ''
  Write-Host 'Publishable key (Settings -> API Keys -> sb_publishable_...)' -ForegroundColor Cyan
  $PublishableKey = Read-Host 'Publishable key'
}

$ProjectRef = $ProjectRef.Trim()
$PublishableKey = $PublishableKey.Trim()
if (-not $ProjectRef -or -not $PublishableKey) {
  Write-Error 'Reference ID and publishable key are required.'
}

$supabaseUrl = if ($ProjectRef -match '^https?://') { $ProjectRef.TrimEnd('/') } else { "https://$ProjectRef.supabase.co" }

$envPath = Join-Path $root '.env'
$lines = @(
  "VITE_SUPABASE_URL=$supabaseUrl"
  "VITE_SUPABASE_ANON_KEY=$PublishableKey"
)

if (Test-Path $envPath) {
  $existing = Get-Content $envPath -Raw
  foreach ($key in @('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY')) {
    $pattern = "(?m)^$key=.*$"
    $val = if ($key -eq 'VITE_SUPABASE_URL') { $supabaseUrl } else { $PublishableKey }
    if ($existing -match $pattern) {
      $existing = [regex]::Replace($existing, $pattern, "$key=$val")
    } else {
      $existing = $existing.TrimEnd() + "`r`n$key=$val`r`n"
    }
  }
  Set-Content -Path $envPath -Value $existing -NoNewline
} else {
  Set-Content -Path $envPath -Value ($lines -join "`r`n") -NoNewline
}

Write-Host ''
Write-Host "OK: wrote $envPath" -ForegroundColor Green
Write-Host "  VITE_SUPABASE_URL=$supabaseUrl" -ForegroundColor DarkGray

$serverEnv = Join-Path $root 'server\.env'
if (Test-Path $serverEnv) {
  $serverContent = Get-Content $serverEnv -Raw
  function PatchOrAppend([string]$content, [string]$key, [string]$value) {
    $pattern = "(?m)^$key=.*$"
    if ($content -match $pattern) {
      return [regex]::Replace($content, $pattern, "$key=`"$value`"")
    }
    return $content.TrimEnd() + "`r`n$key=`"$value`"`r`n"
  }
  $serverContent = PatchOrAppend $serverContent 'SUPABASE_URL' $supabaseUrl
  $serverContent = PatchOrAppend $serverContent 'SUPABASE_ANON_KEY' $PublishableKey
  Set-Content -Path $serverEnv -Value $serverContent -NoNewline
  Write-Host 'OK: server/.env updated for OCR (SUPABASE_URL + SUPABASE_ANON_KEY)' -ForegroundColor DarkGray
}

Write-Host 'Restart: npm run dev (frontend) + server npm run dev (OCR)' -ForegroundColor Cyan
