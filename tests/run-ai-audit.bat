@echo off
REM AI Functionality Audit Runner for Windows
REM Runs comprehensive validation of all Entomate AI features

echo.
echo ========================================================
echo  Entomate AI Functionality Audit
echo ========================================================
echo.

REM Check if backend is running
echo [1/4] Checking if backend server is running...
curl -s http://localhost:3000/api/health > nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Backend server not running on http://localhost:3000
    echo Please start the backend server first:
    echo   cd backend
    echo   npm start
    echo.
    pause
    exit /b 1
)
echo Backend server is running!
echo.

REM Check if node_modules exist
echo [2/4] Checking dependencies...
if not exist node_modules\axios (
    echo Installing required dependencies...
    call npm install axios
    echo.
)
echo Dependencies OK!
echo.

REM Run the audit
echo [3/4] Running AI functionality audit...
echo This may take 30-60 seconds...
echo.
node ai-functionality-audit.js
set AUDIT_RESULT=%errorlevel%
echo.

REM Show results
echo [4/4] Audit complete!
echo.

if %AUDIT_RESULT% equ 0 (
    echo ========================================================
    echo  Status: PASS
    echo ========================================================
) else (
    echo ========================================================
    echo  Status: FAIL - Review report for details
    echo ========================================================
)
echo.

REM Open report
echo Opening audit report...
for %%f in (ai-audit-report-*.md) do (
    start "" "%%f"
    goto :found
)
:found

echo.
echo Results saved to:
dir ai-audit-* /b /o-d
echo.
pause
