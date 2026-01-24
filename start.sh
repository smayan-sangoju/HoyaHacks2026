#!/bin/bash

# ClearCycle Startup Script
# Run this file to start both backend and frontend servers

echo "🚀 Starting ClearCycle..."
echo ""

# Check if we're in the right directory
if [ ! -f "backend/server.js" ] || [ ! -f "public/server.js" ]; then
  echo "❌ Error: Please run this from the HoyaHacks directory"
  echo "   cd /Users/akshathchity/HoyaHacks"
  echo "   ./start.sh"
  exit 1
fi

echo "📦 Starting Backend Server (Port 4000)..."
cd backend
npm start &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
echo ""

# Wait for backend to start
sleep 3

echo "📦 Starting Frontend Server (Port 3000)..."
cd ../public
npm start &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ ClearCycle is Running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Frontend:  http://localhost:3000"
echo "🔌 Backend:   http://localhost:4000"
echo ""
echo "📝 To stop both servers, run: pkill -f 'npm start'"
echo ""
echo "Ready to go! 🎉"
echo ""

# Keep script running
wait
