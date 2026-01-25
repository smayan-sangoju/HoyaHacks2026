#!/bin/bash
# Generate self-signed cert for HTTPS (phone camera support).
# Writes backend/.cert/key.pem and cert.pem.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/backend/.cert"
mkdir -p "$CERT_DIR"

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null) || \
  LAN_IP=$(ipconfig getifaddr en1 2>/dev/null) || \
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || \
  LAN_IP=""

# SAN: localhost, 127.0.0.1, and LAN IP if we have it
SAN="DNS:localhost,IP:127.0.0.1"
[ -n "$LAN_IP" ] && SAN="$SAN,IP:$LAN_IP"

openssl req -x509 -newkey rsa:2048 \
  -keyout "$CERT_DIR/key.pem" \
  -out "$CERT_DIR/cert.pem" \
  -days 365 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=$SAN" 2>/dev/null

echo "Generated cert in $CERT_DIR (SAN: $SAN)"
