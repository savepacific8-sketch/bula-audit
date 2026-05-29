# BULA AUDIT - Schedule the local DB backup to run every night at 02:00.
# Uses Windows Task Scheduler.
#
# Run from project root (will request admin privileges):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-backup-schedule.ps1
#
# To remove:
#   Unregister-ScheduledTask -TaskName "BulaAuditNightlyBackup" -Confirm:$false

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root 'server'

if (-not (Test-Path $serverDir)) {
  Write-Error "Server folder not found at $serverDir"
  exit 1
}

$taskName = 'BulaAuditNightlyBackup'

# Verify running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Warning "Task Scheduler requires admin. Re-launching elevated..."
  Start-Process powershell -ArgumentList "-ExecutionPolicy","Bypass","-File","$PSCommandPath" -Verb RunAs
  exit
}

# Remove existing task if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction `
  -Execute 'cmd.exe' `
  -Argument '/c npm run db:backup' `
  -WorkingDirectory $serverDir

$trigger = New-ScheduledTaskTrigger -Daily -At 02:00

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopIfGoingOnBatteries `
  -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

$principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType S4U `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Description 'BULA AUDIT - nightly database backup to configured storage' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal

Write-Host "OK: Scheduled task '$taskName' created. Runs daily at 02:00." -ForegroundColor Green
Write-Host "    Logs:   $serverDir\.dev.out.log" -ForegroundColor Gray
Write-Host "    Manual: cd $serverDir; npm run db:backup" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: in production, use the hosting provider's cron/scheduler instead." -ForegroundColor Yellow
Write-Host "      See DEPLOY.md for Railway/Render cron setup." -ForegroundColor Yellow
