# ⚡ iTechSmart Mission Control

A glassmorphism MSP / IT-business **AI Mission Control** dashboard: orchestrate your AI fleet
(Claude · Codex/OpenAI · Gemini · Nemotron · Hermes SEMI_AUTO · OctoAI), remote into the OVH
server from an in-browser terminal, watch your NOC, and run the whole MSP business — clients,
tickets, invoices — from one pane of glass.

![stack](https://img.shields.io/badge/stack-React%2019%20·%20Vite%20·%20Tailwind%204%20·%20Framer%20Motion%20·%20Express%20·%20xterm.js-22d3ee)

## Modules

| Route | What it does |
|---|---|
| `/` | **Mission Control** — live host telemetry (CPU/mem charts), MRR & ticket KPIs, AI fleet status, service mesh, activity feed, client health |
| `/orchestrator` | **AI Orchestrator** — streaming multi-provider chat with model picker, side-by-side **Compare** mode, quick MSP prompts, editable system prompt |
| `/terminal` | **Remote Console** — real xterm.js terminal over WebSocket. *SSH mode* spawns `ssh ssh.itechsmart.dev` (your Cloudflare Zero Trust config does transport — port 22 is never touched). *VM Shell mode* opens a PTY on the host running the dashboard. One-click command snippets (`claude`, tunnel health, hermes ping, …) |
| `/noc` | **NOC** — animated gauges, Cloudflare tunnel `3525b90f` systemd status, probes for `api.itechsmart.dev`, legacy dashboard `:8210`, `/noc`, Hermes `:8089` |
| `/business` | **MSP Business** — tickets / clients / invoices with full create / advance / delete, all persisted server-side |
| `/vault` | **Vault & Settings** — provider key status (read from `~/.secrets` or vault, never exposed to the browser), hot-reload keys, access runbook, env reference |

Keyboard: `⌘K` command palette · `⌘1–6` switch modules.

## Run it

```bash
npm install
npm run dev        # dev: Vite on :5173 + API on :8443
# — or production —
npm run build
PORT=8443 npm start
```

## Deploy on the OVH server (one command)

```bash
ssh ssh.itechsmart.dev          # via CF Zero Trust tunnel
git clone -b claude/funny-tesla-533clw https://github.com/Iteksmart/Fable5.git mission-control
cd mission-control
sudo bash deploy/install.sh     # builds, installs systemd unit, starts, audits
```

The installer ends by running `npm run doctor`, a full production audit (build, API,
SPA routes, WebSocket terminal round-trip, keys, tunnel, adjacent services). It refuses
to declare success unless every hard check passes. Re-run any time with `npm run doctor`.

Then route the hostname through the existing tunnel `3525b90f` — see
[`deploy/cloudflared-ingress.example.yml`](deploy/cloudflared-ingress.example.yml):

```bash
cloudflared tunnel route dns 3525b90f mission.itechsmart.dev
# add to /etc/cloudflared/config.yml BEFORE the catch-all:
#   - hostname: mission.itechsmart.dev
#     service: http://localhost:8443
sudo systemctl restart cloudflared
```

> ⚠️ The terminal bridge and AI endpoints give full shell/API access. Put
> `mission.itechsmart.dev` behind a **Cloudflare Access** policy, and optionally set
> `MC_AUTH_TOKEN` in `~/.secrets` for an extra in-app token gate (the UI will prompt).

### If a page like `/orchestrator` doesn't load

1. `npm run doctor` on the server — it pinpoints the failure.
2. `systemctl status mission-control` / `journalctl -u mission-control -n 50`.
3. Confirm the tunnel ingress points at `http://localhost:8443` (not the legacy `:8210`
   dashboard — that service has no `/orchestrator` route).
4. Cloudflare error 530/502 = tunnel can't reach the service; 404 from another app =
   wrong ingress target; Access login page = expected, authenticate.

## API keys

Resolved server-side, in order: env vars → `~/.secrets` (dotenv format) → `/opt/itechsmart/vault/secrets.json`.

| Provider | Variable |
|---|---|
| Claude (Anthropic) | `ANTHROPIC_API_KEY` |
| Codex (OpenAI) | `OPENAI_API_KEY` |
| Gemini (Google) | `GEMINI_API_KEY` |
| Nemotron (NVIDIA) | `NVIDIA_API_KEY` |
| OctoAI | `OCTOAI_API_KEY` |
| Hermes SEMI_AUTO | none — local `http://localhost:8089` (`HERMES_URL` to override) |

## Config (env)

`PORT` (8443) · `SECRETS_FILE` · `VAULT_FILE` · `SSH_TARGET` (ssh.itechsmart.dev) · `SSH_USER` ·
`HERMES_URL` · `CF_TUNNEL_ID` · `SERVICES_JSON` (override NOC probe list) · `DATA_DIR`
