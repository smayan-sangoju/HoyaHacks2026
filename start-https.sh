#!/bin/bash
# Start ClearCycle (HTTPS). Single server: API + frontend on port 3000. No proxy.

set -e
cd "$(dirname "$0")"
if [ ! -f "backend/server.js" ] || [ ! -d "public" ]; then
  echo "❌ Run from project root."
  exit 1
fi

echo "🔐 Generating self-signed cert..."
chmod +x scripts/gen-cert.sh 2>/dev/null || true
./scripts/gen-cert.sh
echo ""

echo "📦 Starting ClearCycle (API + frontend on :3000)..."
echo "⚠️  If port 3000 is in use, kill existing processes first:"
echo "   lsof -ti:3000 | xargs kill -9"
echo ""
cd backend
USE_HTTPS=1 FRONTEND_PORT=3000 npm start &
PID=$!
cd ..

echo "⏳ Waiting for server..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -ks -o /dev/null -w "%{http_code}" https://localhost:3000/api/health 2>/dev/null | grep -q 200; then
    echo "✅ Ready."
    break
  fi
  [ "$i" -eq 15 ] && echo "⚠️  Slow start; try opening anyway."
  sleep 2
done

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null) || \
  LAN_IP=$(ipconfig getifaddr en1 2>/dev/null) || \
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || \
  LAN_IP=""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ ClearCycle — https://localhost:3000"
if [ -n "$LAN_IP" ]; then
  echo "📱 Phone:  https://${LAN_IP}:3000  (same Wi‑Fi, accept cert once)"
fi
echo "📝 Stop:  pkill -f 'npm start'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
wait
