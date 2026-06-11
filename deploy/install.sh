#!/usr/bin/env bash
# iTechSmart Mission Control — production installer for the OVH server.
# Usage (from the repo root, as a sudo-capable user):
#   sudo bash deploy/install.sh
# Idempotent: safe to re-run for upgrades (git pull && sudo bash deploy/install.sh).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${SUDO_USER:-$(whoami)}"
PORT="${PORT:-8443}"
SERVICE=mission-control

echo "==> Installing Mission Control from $APP_DIR (user: $RUN_USER, port: $PORT)"

# --- prerequisites ---------------------------------------------------------
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "ERROR: Node.js >= 18 required. Install via: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs" >&2
  exit 1
fi
# build tools so node-pty compiles (real TTY for the web terminal)
if ! command -v make >/dev/null || ! command -v g++ >/dev/null; then
  echo "==> Installing build tools for node-pty"
  apt-get update -qq && apt-get install -y -qq build-essential python3
fi

# --- build -----------------------------------------------------------------
cd "$APP_DIR"
sudo -u "$RUN_USER" npm install --no-audit --no-fund
sudo -u "$RUN_USER" npm run build

# --- systemd unit ----------------------------------------------------------
cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=iTechSmart Mission Control dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
ExecStart=$(command -v node) ${APP_DIR}/server/index.js
Restart=always
RestartSec=3
# keys are read from ~/.secrets or /opt/itechsmart/vault/secrets.json at runtime

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"
sleep 2

# --- verify ----------------------------------------------------------------
echo "==> Running production audit"
if sudo -u "$RUN_USER" env PORT="$PORT" npm run --silent doctor; then
  echo ""
  echo "==> DONE. Now route the tunnel hostname (one-time):"
  echo "    cloudflared tunnel route dns 3525b90f mission.itechsmart.dev"
  echo "    # and add to /etc/cloudflared/config.yml ingress (BEFORE the catch-all):"
  echo "    #   - hostname: mission.itechsmart.dev"
  echo "    #     service: http://localhost:${PORT}"
  echo "    sudo systemctl restart cloudflared"
  echo ""
  echo "    Protect it: dash.teams.cloudflare.com -> Access -> Applications -> add"
  echo "    mission.itechsmart.dev with an Access policy (the dashboard includes a"
  echo "    full shell — never expose it without Access)."
else
  echo "Audit failed — see output above. Logs: journalctl -u ${SERVICE} -n 50" >&2
  exit 1
fi
