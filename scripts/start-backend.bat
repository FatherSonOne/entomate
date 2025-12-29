@echo off
echo ========================================
echo Entomate Backend Startup Script
echo ========================================
echo.

REM Check if port 3000 is in use
echo Checking port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo WARNING: Port 3000 is already in use by PID %%a
    echo.
    set /p KILL="Kill this process? (y/n): "
    if /i "%KILL%"=="y" (
        echo Killing process %%a...
        taskkill /PID %%a /F
        timeout /t 2 /nobreak > nul
    ) else (
        echo Cannot start backend - port 3000 is occupied.
        echo Please manually stop the process or use a different port.
        pause
        exit /b 1
    )
)

echo.
echo Starting Entomate Backend...
echo.

cd /d F:\entomate\backend

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    npm install
)

REM Start the server
echo.
echo Starting server on port 3000...
echo Backend will be available at: http://localhost:3000
echo API Health check: http://localhost:3000/api/health
echo.
echo Press Ctrl+C to stop the server.
echo.

npm run dev
