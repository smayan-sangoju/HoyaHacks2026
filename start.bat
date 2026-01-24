@echo off
REM ClearCycle Startup Script for Windows

echo.
echo 🚀 Starting ClearCycle...
echo.

REM Check if we're in the right directory
if not exist "backend\server.js" (
  echo ❌ Error: Please run this from the HoyaHacks directory
  echo    cd C:\path\to\HoyaHacks
  echo    start.bat
  pause
  exit /b 1
)

echo 📦 Starting Backend Server (Port 4000)...
start cmd /k "cd backend && npm start"
echo ✅ Backend started
echo.

timeout /t 3 /nobreak

echo 📦 Starting Frontend Server (Port 3000)...
start cmd /k "cd public && npm start"
echo ✅ Frontend started
echo.

echo ================================================================================
echo ✨ ClearCycle is Running!
echo ================================================================================
echo.
echo 🌐 Frontend:  http://localhost:3000
echo 🔌 Backend:   http://localhost:4000
echo.
echo 📝 To stop, close the terminal windows or press Ctrl+C in each
echo.
echo Ready to go! 🎉
echo.
pause
