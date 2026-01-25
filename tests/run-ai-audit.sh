#!/bin/bash

# AI Functionality Audit Runner for Linux/Mac
# Runs comprehensive validation of all Entomate AI features

echo ""
echo "========================================================"
echo "  Entomate AI Functionality Audit"
echo "========================================================"
echo ""

# Check if backend is running
echo "[1/4] Checking if backend server is running..."
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "❌ ERROR: Backend server not running on http://localhost:3000"
    echo "Please start the backend server first:"
    echo "  cd backend"
    echo "  npm start"
    echo ""
    exit 1
fi
echo "✅ Backend server is running!"
echo ""

# Check if node_modules exist
echo "[2/4] Checking dependencies..."
if [ ! -d "node_modules/axios" ]; then
    echo "Installing required dependencies..."
    npm install axios
    echo ""
fi
echo "✅ Dependencies OK!"
echo ""

# Run the audit
echo "[3/4] Running AI functionality audit..."
echo "This may take 30-60 seconds..."
echo ""
node ai-functionality-audit.js
AUDIT_RESULT=$?
echo ""

# Show results
echo "[4/4] Audit complete!"
echo ""

if [ $AUDIT_RESULT -eq 0 ]; then
    echo "========================================================"
    echo "  ✅ Status: PASS"
    echo "========================================================"
else
    echo "========================================================"
    echo "  ❌ Status: FAIL - Review report for details"
    echo "========================================================"
fi
echo ""

# Find and display report location
echo "Results saved to:"
ls -t ai-audit-* 2>/dev/null | head -2
echo ""

# Try to open report (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    REPORT=$(ls -t ai-audit-report-*.md 2>/dev/null | head -1)
    if [ ! -z "$REPORT" ]; then
        echo "Opening audit report..."
        open "$REPORT"
    fi
fi

# Try to open report (Linux with xdg-open)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    REPORT=$(ls -t ai-audit-report-*.md 2>/dev/null | head -1)
    if [ ! -z "$REPORT" ]; then
        echo "Opening audit report..."
        xdg-open "$REPORT" 2>/dev/null || cat "$REPORT"
    fi
fi

exit $AUDIT_RESULT
