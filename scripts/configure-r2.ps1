# BULA AUDIT - Configure Cloudflare R2 (or any S3-compatible) storage.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\configure-r2.ps1 `
#     -AccountId "abc123" -Bucket "bula-audit" `
#     -AccessKeyId "..." -SecretAccessKey "..." `
#     -PublicBaseUrl "https://files.bulaaudit.com.fj"
#
# Or run without args to be prompted.

param(
  [string]$AccountId,
  [string]$Bucket,
  [string]$AccessKeyId,
  [string]$SecretAccessKey,
  [string]$PublicBaseUrl,
  [string]$Endpoint  # optional override (e.g. AWS S3, Backblaze)
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $Endpoint -and -not $AccountId) {
  $AccountId = Read-Host "Cloudflare Account ID"
}
if (-not $Endpoint -and -not $AccountId) { Write-Error "Account ID required."; exit 1 }
if (-not $Endpoint) { $Endpoint = "https://$AccountId.r2.cloudflarestorage.com" }

if (-not $Bucket)          { $Bucket          = Read-Host "Bucket name (e.g. bula-audit)" }
if (-not $AccessKeyId)     { $AccessKeyId     = Read-Host "R2 Access Key ID" }
if (-not $SecretAccessKey) {
  $secure = Read-Host -AsSecureString "R2 Secret Access Key"
  $SecretAccessKey = [System.Net.NetworkCredential]::new('', $secure).Password
}
if (-not $PublicBaseUrl) {
  $PublicBaseUrl = Read-Host "Public base URL (optional, blank = use signed URLs)"
}

if (-not $Bucket -or -not $AccessKeyId -or -not $SecretAccessKey) {
  Write-Error "Bucket / access key / secret are all required."
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

$envContent = PatchOrAppend $envContent 'STORAGE_DRIVER'      's3'
$envContent = PatchOrAppend $envContent 'S3_ENDPOINT'         $Endpoint
$envContent = PatchOrAppend $envContent 'S3_REGION'           'auto'
$envContent = PatchOrAppend $envContent 'S3_BUCKET'           $Bucket
$envContent = PatchOrAppend $envContent 'S3_ACCESS_KEY_ID'    $AccessKeyId
$envContent = PatchOrAppend $envContent 'S3_SECRET_ACCESS_KEY' $SecretAccessKey
$envContent = PatchOrAppend $envContent 'S3_PUBLIC_BASE_URL'  $PublicBaseUrl
$envContent = PatchOrAppend $envContent 'S3_FORCE_PATH_STYLE' 'true'
Set-Content -Path $envPath -Value $envContent -NoNewline

Write-Host "OK: R2 configured in server/.env" -ForegroundColor Green
Write-Host "    Endpoint: $Endpoint"           -ForegroundColor Gray
Write-Host "    Bucket:   $Bucket"             -ForegroundColor Gray
if ($PublicBaseUrl) {
  Write-Host "    Public URL: $PublicBaseUrl" -ForegroundColor Gray
} else {
  Write-Host "    (using signed URLs, 1-hour expiry)" -ForegroundColor Gray
}

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
Write-Host "Now uploads go to R2 instead of local disk."   -ForegroundColor Cyan
Write-Host "Test it: upload a receipt at http://localhost:5173" -ForegroundColor Cyan
