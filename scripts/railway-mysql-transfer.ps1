# Copy all tables from local MySQL to Railway MySQL (mysqldump).
# Run from repo root after setting env vars (see RAILWAY_MYSQL.md Path B).
#
#   $env:LOCAL_DATABASE_URL = "mysql://user:pass@localhost:3306/bula_audit"
#   $env:RAILWAY_DATABASE_URL = "mysql://..."   # from Railway MySQL Connect tab
#   powershell -ExecutionPolicy Bypass -File .\scripts\railway-mysql-transfer.ps1

$ErrorActionPreference = 'Stop'

function Parse-MysqlUrl([string]$Url) {
  if (-not $Url -or $Url -notmatch '^mysql://') {
    throw "Invalid MySQL URL (expected mysql://user:pass@host:port/db)"
  }
  $u = [Uri]$Url
  $userInfo = $u.UserInfo -split ':', 2
  $user = [Uri]::UnescapeDataString($userInfo[0])
  $pass = if ($userInfo.Length -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
  $db = $u.AbsolutePath.TrimStart('/')
  if (-not $db) { throw "Database name missing in URL path" }
  @{
    Host = $u.Host
    Port = if ($u.Port -gt 0) { $u.Port } else { 3306 }
    User = $user
    Pass = $pass
    Database = $db
  }
}

function Require-Cmd([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "Missing command: $Name" -ForegroundColor Red
    Write-Host "Install MySQL Server or MariaDB client and add mysqldump/mysql to PATH." -ForegroundColor Yellow
    exit 1
  }
}

$localUrl = $env:LOCAL_DATABASE_URL
$railwayUrl = $env:RAILWAY_DATABASE_URL

if (-not $localUrl) {
  $envPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'server\.env'
  if (Test-Path $envPath) {
    $line = Get-Content $envPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($line -match 'mysql://') {
      $localUrl = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
      Write-Host "Using DATABASE_URL from server\.env" -ForegroundColor DarkGray
    }
  }
}

if (-not $localUrl -or $localUrl -match '^file:') {
  Write-Host "LOCAL_DATABASE_URL is not set or is SQLite." -ForegroundColor Red
  Write-Host "Set `$env:LOCAL_DATABASE_URL to your local mysql://... URL, or use RAILWAY_MYSQL.md Path A (fresh Railway DB)." -ForegroundColor Yellow
  exit 1
}

if (-not $railwayUrl) {
  Write-Host "Set RAILWAY_DATABASE_URL to the MySQL URL from Railway (MySQL service -> Connect)." -ForegroundColor Red
  exit 1
}

Require-Cmd mysqldump
Require-Cmd mysql

$local = Parse-MysqlUrl $localUrl
$remote = Parse-MysqlUrl $railwayUrl

$root = Split-Path $PSScriptRoot -Parent
$dumpFile = Join-Path $env:TEMP "bula-audit-mysql-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"

Write-Host ""
Write-Host "BULA AUDIT — MySQL transfer to Railway" -ForegroundColor Cyan
Write-Host "  From: $($local.Database) @ $($local.Host):$($local.Port)"
Write-Host "  To:   $($remote.Database) @ $($remote.Host):$($remote.Port)"
Write-Host ""

$confirm = Read-Host "This OVERWRITES tables on Railway MySQL. Type yes to continue"
if ($confirm -ne 'yes') {
  Write-Host "Cancelled."
  exit 0
}

Write-Host "[1/3] Exporting local database..." -ForegroundColor Cyan
$dumpArgs = @(
  "-h$($local.Host)", "-P$($local.Port)", "-u$($local.User)",
  "--single-transaction", "--routines", "--triggers",
  "--set-gtid-purged=OFF", $local.Database
)
$env:MYSQL_PWD = $local.Pass
& mysqldump @dumpArgs | Set-Content -Path $dumpFile -Encoding UTF8
if ($LASTEXITCODE -ne 0) { Write-Error "mysqldump failed (exit $LASTEXITCODE)" }

Write-Host "[2/3] Importing into Railway..." -ForegroundColor Cyan
$env:MYSQL_PWD = $remote.Pass
Get-Content $dumpFile -Raw | & mysql -h$remote.Host -P$remote.Port -u$remote.User $remote.Database
if ($LASTEXITCODE -ne 0) { Write-Error "mysql import failed (exit $LASTEXITCODE)" }

Write-Host "[3/3] Syncing Prisma schema on Railway (optional)..." -ForegroundColor Cyan
$serverDir = Join-Path $root 'server'
Push-Location $serverDir
$prev = $env:DATABASE_URL
$env:DATABASE_URL = $railwayUrl
try {
  & npx prisma db push --skip-generate 2>&1 | Out-Host
} finally {
  $env:DATABASE_URL = $prev
  Pop-Location
}

Remove-Item $env:MYSQL_PWD -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "Done. Dump saved at: $dumpFile" -ForegroundColor Green
Write-Host "Set Railway app DATABASE_URL=`${{MySQL.DATABASE_URL}}, redeploy, then open your Railway URL and log in." -ForegroundColor Green
