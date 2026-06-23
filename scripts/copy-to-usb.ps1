# Copy BULA AUDIT to a USB drive (or any folder) for handoff.
# Excludes secrets, node_modules, build artifacts, and large uploads.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\copy-to-usb.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\copy-to-usb.ps1 -DriveLetter E
#   powershell -ExecutionPolicy Bypass -File .\scripts\copy-to-usb.ps1 -Destination "D:\bula-audit"

param(
  [string]$DriveLetter,
  [string]$Destination
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$folderName = 'bula-audit'
$excludeDirs = @('node_modules', 'dist', 'dist-ssr', '.git', 'uploads', '.vite', 'logs', 'scripts\backups')
$excludeFiles = @('.env', '.env.local', '.env.production')

function Find-UsbDrive {
  Get-CimInstance Win32_LogicalDisk |
    Where-Object { $_.DriveType -eq 2 -and $_.Size -gt 0 -and (Test-Path "$($_.DeviceID)\") } |
    Select-Object -ExpandProperty DeviceID
}

if (-not $Destination) {
  if ($DriveLetter) {
    $Destination = Join-Path "${DriveLetter}:" $folderName
  } else {
    $drives = @(Find-UsbDrive)
    if ($drives.Count -eq 0) {
      Write-Host 'No USB drive detected (removable drive with free space).' -ForegroundColor Yellow
      Write-Host 'Plug in the USB, then run again — or use:' -ForegroundColor Cyan
      Write-Host '  -Destination "E:\bula-audit"' -ForegroundColor Cyan
      exit 1
    }
    if ($drives.Count -gt 1) {
      Write-Host "Multiple USB drives: $($drives -join ', ')" -ForegroundColor Yellow
      $Destination = Join-Path $drives[0] $folderName
    } else {
      $Destination = Join-Path $drives[0] $folderName
    }
  }
}

Write-Host "Copying BULA AUDIT to: $Destination" -ForegroundColor Green

if (Test-Path $Destination) {
  Write-Host "Removing old copy..." -ForegroundColor DarkGray
  Remove-Item $Destination -Recurse -Force
}
New-Item -ItemType Directory -Path $Destination -Force | Out-Null

$robocopyArgs = @(
  $root,
  $Destination,
  '/E',
  '/XD', 'node_modules', 'dist', 'dist-ssr', '.git', 'uploads', '.vite', 'logs',
  '/XF', '.env', '.env.local', '.env.production', '.env.*',
  '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS', '/NP'
)
& robocopy @robocopyArgs | Out-Null
# robocopy exit 0-7 = success
if ($LASTEXITCODE -gt 7) { throw "robocopy failed with code $LASTEXITCODE" }

# Handoff readme
$readme = @"
BULA AUDIT — project handoff
Copied: $(Get-Date -Format 'yyyy-MM-dd HH:mm')

WHAT IS ON THIS USB
- Full source code (frontend + server + Supabase migrations)
- NOT included: node_modules, .env secrets, receipt uploads, git history

SETUP ON A NEW PC
1. Install Node.js LTS: https://nodejs.org
2. Open PowerShell in this folder:
   npm install
   cd server && npm install
3. Copy .env.example to .env and add Supabase keys (see SUPABASE_MIGRATION.md)
4. Run:
   cd server && npm run dev    (window 1)
   npm run dev                 (window 2, from repo root)
5. Open http://localhost:5173

Supabase project URL: (add your keys in .env — not on USB for security)

Docs: START_HERE.md, SUPABASE_MIGRATION.md
"@
Set-Content -Path (Join-Path $Destination 'USB_HANDOFF_README.txt') -Value $readme -Encoding UTF8

Write-Host ''
Write-Host 'Done!' -ForegroundColor Green
Write-Host "  $Destination" -ForegroundColor Cyan
Write-Host '  Secrets (.env) were NOT copied — add Supabase keys on the new machine.' -ForegroundColor Yellow
