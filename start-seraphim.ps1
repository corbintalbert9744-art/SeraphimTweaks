# Seraphim IQ — one-command local start (Windows PowerShell)
# Usage: right-click → Run with PowerShell, OR from project root:
#   powershell -ExecutionPolicy Bypass -File .\start-seraphim.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".\package.json")) {
  Write-Host "ERROR: Run this from the SeraphimTweaks project root (where package.json lives)." -ForegroundColor Red
  exit 1
}

Write-Host "`n=== Seraphim IQ ===" -ForegroundColor Yellow
Write-Host "Project: $PWD`n"

function Assert-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: '$name' not found on PATH." -ForegroundColor Red
    exit 1
  }
}

Assert-Cmd node
Assert-Cmd npm

$python = $null
foreach ($c in @("python", "py")) {
  if (Get-Command $c -ErrorAction SilentlyContinue) { $python = $c; break }
}
if (-not $python) {
  Write-Host "ERROR: Python not found. Install Python 3, then retry." -ForegroundColor Red
  exit 1
}

Write-Host "npm install..."
npm install

Push-Location data-platform
if (-not (Test-Path ".venv")) {
  Write-Host "Creating Python venv..."
  & $python -m venv .venv
}
& .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt | Out-Null
Pop-Location

Write-Host "Starting data platform (:8000)..."
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$PWD\data-platform'; .\.venv\Scripts\Activate.ps1; `$env:PYTHONPATH='.'; `$env:ENABLE_SCHEDULER='true'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
)

Start-Sleep -Seconds 3

Write-Host "Starting app (:5000)..."
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$PWD'; npm run dev"
)

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5000"

Write-Host "`nOpen http://127.0.0.1:5000" -ForegroundColor Green
Write-Host "Sign up + Stripe checkout creates members. Optional local owner:"
Write-Host "  set OWNER_EMAIL / OWNER_PASSWORD in .env (dev only; never commit)."
Write-Host "Keep both processes running (or use: npm run dev:all)."
Write-Host "Health: http://127.0.0.1:5000/api/health  (data-platform must be ok).`n"
