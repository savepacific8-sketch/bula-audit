# Expose local Vite (port 5173) as a public HTTPS link for phones/managers.
# Requires: backend + frontend already running (START_HERE.md Part 2).
# Install once: winget install Cloudflare.cloudflared

$ErrorActionPreference = 'Stop'

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host ''
  Write-Host 'cloudflared is not installed.' -ForegroundColor Yellow
  Write-Host 'Install: winget install Cloudflare.cloudflared' -ForegroundColor Cyan
  Write-Host 'Then run this script again.' -ForegroundColor Cyan
  exit 1
}

Write-Host ''
Write-Host 'BULA AUDIT — public share link' -ForegroundColor Green
Write-Host 'Prerequisites: server on :4000 and Vite on :5173 (npm run dev in root + server).' -ForegroundColor DarkGray
Write-Host ''
Write-Host 'Starting tunnel to http://127.0.0.1:5173 ...' -ForegroundColor Cyan
Write-Host 'Copy the https://....trycloudflare.com URL and send it to phones/managers.' -ForegroundColor Cyan
Write-Host 'Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host ''

cloudflared tunnel --url http://127.0.0.1:5173
