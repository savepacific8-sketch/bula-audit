# One-shot Railway MySQL setup helper (run on your PC).
# You must complete Railway login in the browser when prompted.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\do-railway-mysql.ps1
#
# Optional — import local data after MySQL exists on Railway:
#   $env:RAILWAY_DATABASE_URL = "mysql://..."   # MySQL service -> Connect
#   powershell -ExecutionPolicy Bypass -File .\scripts\do-railway-mysql.ps1 -Import

param([switch]$Import)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dumpPath = Join-Path $PSScriptRoot 'backups\bula_audit_for_railway.sql'
$varsFile = Join-Path $PSScriptRoot 'railway-variables-PASTE-IN-RAILWAY.txt'
$mysqlDump = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe'
$mysqlCli = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
if (-not (Test-Path $mysqlDump)) {
  $mysqlDump = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe'
  $mysqlCli = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe'
}

function Read-DatabaseUrlFromEnvFile {
  $envPath = Join-Path $root 'server\.env'
  if (-not (Test-Path $envPath)) { return $null }
  $line = Get-Content $envPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if ($line -match 'mysql://') {
    return ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
  }
  return $null
}

function Parse-MysqlUrl([string]$Url) {
  $u = [Uri]$Url
  $userInfo = $u.UserInfo -split ':', 2
  $user = [Uri]::UnescapeDataString($userInfo[0])
  $pass = if ($userInfo.Length -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
  $db = $u.AbsolutePath.TrimStart('/')
  @{
    Host = $u.Host; Port = if ($u.Port -gt 0) { $u.Port } else { 3306 }
    User = $user; Pass = $pass; Database = $db
  }
}

Write-Host ""
Write-Host "=== BULA AUDIT - Railway MySQL setup ===" -ForegroundColor Cyan
Write-Host ""

# --- 1. Fresh local export ---
Write-Host "[1] Exporting local MySQL -> backups\bula_audit_for_railway.sql" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path (Split-Path $dumpPath) | Out-Null
$localUrl = Read-DatabaseUrlFromEnvFile
if (-not $localUrl) { Write-Error "server\.env needs DATABASE_URL=mysql://..." }
$local = Parse-MysqlUrl $localUrl
$env:MYSQL_PWD = $local.Pass
& $mysqlDump --host=$($local.Host) --port=$($local.Port) --user=$($local.User) `
  --single-transaction --routines --triggers --set-gtid-purged=OFF $($local.Database) `
  | Set-Content -Path $dumpPath -Encoding UTF8
Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
$dumpBytes = (Get-Item $dumpPath).Length
Write-Host ('    OK ({0} bytes)' -f $dumpBytes) -ForegroundColor Green

# --- 2. Railway variables file ---
Write-Host "[2] Writing Railway variables template" -ForegroundColor Yellow
$jwtLine = Get-Content (Join-Path $root 'server\.env') | Where-Object { $_ -match '^\s*JWT_SECRET\s*=' } | Select-Object -First 1
$jwt = if ($jwtLine) { ($jwtLine -split '=', 2)[1].Trim().Trim('"').Trim("'") } else { 'GENERATE_WITH_node_crypto' }

$varsText = @'
Paste into Railway -> APP service -> Variables -> RAW editor:

NODE_ENV=production
DATABASE_URL=__RAILWAY_MYSQL_REF__
JWT_SECRET=PLACEHOLDER_JWT
JWT_EXPIRES_IN=15m
APP_NAME=BULA AUDIT
CLIENT_ORIGIN=https://REPLACE_AFTER_GENERATE_DOMAIN.up.railway.app
RECEIPT_SCAN_DRIVER=ocr
EMAIL_DRIVER=console

After deploy:
1. App service -> Settings -> Networking -> Generate Domain
2. Set CLIENT_ORIGIN to that exact https URL (no trailing slash)
3. Redeploy
4. Open https://YOUR-DOMAIN.up.railway.app/api/health  (expect db: up)

MySQL plugin: Project -> + New -> Database -> MySQL (if not added yet)
'@
$mysqlRef = [char]36 + '{{' + 'MySQL.DATABASE_URL' + '}}'
$varsText = $varsText.Replace('PLACEHOLDER_JWT', $jwt).Replace('__RAILWAY_MYSQL_REF__', $mysqlRef)
$varsText | Set-Content -Path $varsFile -Encoding UTF8
Write-Host "    -> $varsFile" -ForegroundColor Green

# --- 3. Railway CLI ---
Write-Host "[3] Railway CLI" -ForegroundColor Yellow
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  Write-Host "    Installing @railway/cli..." -ForegroundColor DarkGray
  npm install -g @railway/cli | Out-Null
}
try {
  railway whoami 2>&1 | Out-Host
} catch {
  Write-Host "    Login required - run: railway login" -ForegroundColor Yellow
}

# --- 4. Optional import ---
if ($Import) {
  $railwayUrl = $env:RAILWAY_DATABASE_URL
  if (-not $railwayUrl) {
    Write-Host "Set RAILWAY_DATABASE_URL from Railway MySQL -> Connect, then re-run with -Import" -ForegroundColor Red
    exit 1
  }
  Write-Host "[4] Importing dump into Railway MySQL..." -ForegroundColor Yellow
  $remote = Parse-MysqlUrl $railwayUrl
  $env:MYSQL_PWD = $remote.Pass
  Get-Content $dumpPath -Raw | & $mysqlCli --host=$($remote.Host) --port=$($remote.Port) --user=$($remote.User) $remote.Database
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
  Push-Location (Join-Path $root 'server')
  $prev = $env:DATABASE_URL
  $env:DATABASE_URL = $railwayUrl
  npx prisma db push --skip-generate | Out-Host
  $env:DATABASE_URL = $prev
  Pop-Location
  Write-Host "    Import done." -ForegroundColor Green
} else {
  Write-Host "[4] Skip import (use -Import after you copy Railway MYSQL URL)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== Your steps in Railway (browser) ===" -ForegroundColor Cyan
Write-Host "  1. railway.app -> project -> + MySQL"
Write-Host "  2. App service -> Variables -> paste $varsFile"
Write-Host "  3. Link GitHub repo bula-audit (root = empty) -> Deploy"
Write-Host "  4. Generate Domain -> fix CLIENT_ORIGIN -> Redeploy"
Write-Host "  5. Import data:"
Write-Host "     `$env:RAILWAY_DATABASE_URL='mysql://...'"
Write-Host "     powershell -File .\scripts\do-railway-mysql.ps1 -Import"
Write-Host ""
Write-Host "  Or open: https://railway.app/new" -ForegroundColor DarkGray
Start-Process "https://railway.app/dashboard"
Start-Process $varsFile
