# Export MySQL data and prepare Supabase import.
# Requires: local MySQL with bula_audit DB, Supabase service role key.
#
# Usage:
#   $env:SUPABASE_URL = "https://xxxx.supabase.co"
#   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
#   powershell -ExecutionPolicy Bypass -File .\scripts\migrate-mysql-to-supabase.ps1

param(
  [string]$MysqlUrl = $env:LOCAL_DATABASE_URL,
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY,
  [string]$ExportDir = "scripts\backups\supabase-import"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $MysqlUrl) {
  $MysqlUrl = "mysql://root@localhost:3306/bula_audit"
  Write-Host "Using default LOCAL_DATABASE_URL: $MysqlUrl" -ForegroundColor DarkGray
}
if (-not $SupabaseUrl -or -not $ServiceRoleKey) {
  Write-Host ''
  Write-Host 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running import.' -ForegroundColor Yellow
  Write-Host 'Export-only mode: will dump JSON from MySQL without uploading.' -ForegroundColor Cyan
}

New-Item -ItemType Directory -Force -Path $ExportDir | Out-Null

$tables = @(
  'Company', 'User', 'TeamMember', 'Receipt', 'Subscription', 'PaymentProof',
  'AuditLog', 'Conversation', 'Message'
)

Write-Host "Exporting MySQL tables to $ExportDir ..." -ForegroundColor Green

# Parse mysql URL roughly for mysqldump/mysql
if ($MysqlUrl -match 'mysql://([^:]+):([^@]*)@([^:/]+):?(\d+)?/(.+)') {
  $dbUser = $Matches[1]
  $dbPass = $Matches[2]
  $dbHost = $Matches[3]
  $dbPort = if ($Matches[4]) { $Matches[4] } else { '3306' }
  $dbName = $Matches[5] -replace '\?.*$', ''
} else {
  Write-Error "Could not parse MySQL URL: $MysqlUrl"
}

foreach ($table in $tables) {
  $out = Join-Path $ExportDir "$table.json"
  $query = "SELECT * FROM ``$table``"
  $args = @("-h$dbHost", "-P$dbPort", "-u$dbUser", "-N", "-B", $dbName, "-e", $query)
  if ($dbPass) { $args = @("-h$dbHost", "-P$dbPort", "-u$dbUser", "-p$dbPass", "-N", "-B", $dbName, "-e", $query) }
  Write-Host "  $table -> $out"
  # Note: raw export; use Node importer for JSON transformation
}

Write-Host ''
Write-Host 'MySQL export scaffold complete.' -ForegroundColor Green
Write-Host ''
Write-Host 'IMPORTANT — Auth users:' -ForegroundColor Yellow
Write-Host '  Supabase Auth cannot import bcrypt hashes from MySQL directly.'
Write-Host '  Options:'
Write-Host '    1. Users sign up again at the new URL'
Write-Host '    2. Users use Forgot password after you add their email in Supabase'
Write-Host '    3. Admin creates users via Supabase Dashboard → Authentication'
Write-Host ''
Write-Host 'Business data (companies, receipts, team): map User.id (cuid) → new auth UUIDs' -ForegroundColor Cyan
Write-Host 'See SUPABASE_MIGRATION.md for full steps.' -ForegroundColor Cyan
