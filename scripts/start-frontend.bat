@echo off
echo ========================================
echo Entomate Frontend Startup Script
echo ========================================
echo.

REM Check if port 5173 is in use
echo Checking port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo WARNING: Port 5173 is already in use by PID %%a
    echo.
    set /p KILL="Kill this process? (y/n): "
    if /i "%KILL%"=="y" (
        echo Killing process %%a...
        taskkill /PID %%a /F
        timeout /t 2 /nobreak > nul
    )
)

echo.
echo Starting Entomate Frontend...
echo.

cd /d F:\entomate\frontend

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    npm install
)

REM Start the dev server
echo.
echo Starting Vite dev server on port 5173...
echo Frontend will be available at: http://localhost:5173
echo.
echo Press Ctrl+C to stop the server.
echo.

npm run dev
