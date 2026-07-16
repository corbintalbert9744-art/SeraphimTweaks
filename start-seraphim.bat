@echo off
REM Seraphim IQ — start data platform + app from the project folder
cd /d "%~dp0"

if not exist package.json (
  echo ERROR: package.json not found. Put this script in the SeraphimTweaks project root.
  pause
  exit /b 1
)

echo.
echo === Seraphim IQ ===
echo Project: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org then retry.
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3 from https://python.org then retry.
    pause
    exit /b 1
  )
)

echo Installing npm packages if needed...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo Installing Python packages for data-platform...
pushd data-platform
if exist .venv\Scripts\activate.bat (
  call .venv\Scripts\activate.bat
) else (
  python -m venv .venv 2>nul || py -3 -m venv .venv
  call .venv\Scripts\activate.bat
  pip install -r requirements.txt
)
popd

echo.
echo Starting data platform on http://127.0.0.1:8000 ...
start "Seraphim Data Platform" cmd /k "cd /d "%~dp0data-platform" && call .venv\Scripts\activate.bat && set PYTHONPATH=. && set ENABLE_SCHEDULER=true && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo Starting app on http://127.0.0.1:5000 ...
start "Seraphim App" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo Open: http://127.0.0.1:5000
echo Login Standard: standard@seraphim.iq / Standard123!
echo Login Pro/owner: corbintalbert@icloud.com / IamtheMaster1!
echo.
echo Two windows opened — leave them running. Close those windows to stop.
pause
