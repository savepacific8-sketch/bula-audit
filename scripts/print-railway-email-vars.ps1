# Prints Railway variable block for Resend (copy into Railway Variables tab).
$ErrorActionPreference = 'Stop'
Write-Host ""
Write-Host "Paste these into Railway -> app service -> Variables:" -ForegroundColor Cyan
Write-Host ""
Write-Host "EMAIL_DRIVER=resend"
Write-Host "RESEND_API_KEY=re_PASTE_YOUR_KEY"
Write-Host "EMAIL_FROM=BULA AUDIT <noreply@yourdomain.com>"
Write-Host "EMAIL_REPLY_TO=support@yourdomain.com"
Write-Host ""
Write-Host "Also confirm CLIENT_ORIGIN=https://your-live-url (no trailing slash)" -ForegroundColor Yellow
Write-Host "Redeploy after saving. Test: https://your-url/api/health" -ForegroundColor Yellow
Write-Host ""
