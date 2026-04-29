#!/usr/bin/env bash
# setup.sh — auto-configure .env for the CRM local Mac server
set -euo pipefail

ENV_FILE="$(dirname "$0")/.env"
ENV_EXAMPLE="$(dirname "$0")/.env.example"

# ── 1. Get local IP (Wi-Fi first, then Ethernet fallback) ──────────────────────
get_local_ip() {
  local ip
  # Try Wi-Fi (en0) first
  ip=$(ipconfig getifaddr en0 2>/dev/null || true)
  if [[ -z "$ip" ]]; then
    # Fallback: Ethernet (en1), then any active interface
    ip=$(ipconfig getifaddr en1 2>/dev/null || true)
  fi
  if [[ -z "$ip" ]]; then
    # Last resort: first non-loopback IPv4
    ip=$(ifconfig | awk '/inet / && !/127\.0\.0\.1/ {print $2; exit}')
  fi
  echo "$ip"
}

LOCAL_IP=$(get_local_ip)

if [[ -z "$LOCAL_IP" ]]; then
  echo "❌  Could not detect a local IP address. Are you connected to Wi-Fi?"
  exit 1
fi

# ── 2. Generate a 32-byte hex token ───────────────────────────────────────────
SERVER_TOKEN=$(openssl rand -hex 32)

# ── 3. Determine default FILES_DIR ────────────────────────────────────────────
FILES_DIR="$HOME/CRM-Files"

# ── 4. Get Netlify app URL (optional — CORS) ──────────────────────────────────
read -rp "Enter your Netlify app URL (e.g. https://yourapp.netlify.app) [skip=*]: " NETLIFY_URL
NETLIFY_URL="${NETLIFY_URL:-*}"

# ── 5. Write .env ──────────────────────────────────────────────────────────────
cat > "$ENV_FILE" <<EOF
PORT=4040
SERVER_TOKEN=${SERVER_TOKEN}
ALLOWED_ORIGINS=${NETLIFY_URL}
FILES_DIR=${FILES_DIR}
EOF

echo ""
echo "✅  .env written to: $ENV_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Paste these values into the Admin Panel"
echo "  (Admin Panel → 🖥️ Storage Settings)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  IP Address : $LOCAL_IP"
echo "  Port       : 4040"
echo "  Token      : $SERVER_TOKEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Start the server with:  npm run dev"
echo ""
