// Loads API keys/config from (in priority order):
//   1. process.env
//   2. SECRETS_FILE (default ~/.secrets) — dotenv-style KEY=VALUE lines
//   3. VAULT_FILE (default /opt/itechsmart/vault/secrets.json) — flat JSON map
// On the OVH box both locations exist; locally you can just export env vars.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SECRETS_FILE = process.env.SECRETS_FILE || path.join(os.homedir(), ".secrets");
const VAULT_FILE = process.env.VAULT_FILE || "/opt/itechsmart/vault/secrets.json";

function parseDotenv(text) {
  const out = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let fileSecrets = null;
function loadFiles() {
  if (fileSecrets) return fileSecrets;
  fileSecrets = {};
  try {
    if (fs.existsSync(VAULT_FILE)) {
      Object.assign(fileSecrets, JSON.parse(fs.readFileSync(VAULT_FILE, "utf8")));
    }
  } catch (e) {
    console.warn(`[secrets] could not read vault file ${VAULT_FILE}: ${e.message}`);
  }
  try {
    if (fs.existsSync(SECRETS_FILE)) {
      Object.assign(fileSecrets, parseDotenv(fs.readFileSync(SECRETS_FILE, "utf8")));
    }
  } catch (e) {
    console.warn(`[secrets] could not read secrets file ${SECRETS_FILE}: ${e.message}`);
  }
  return fileSecrets;
}

export function getSecret(...names) {
  const files = loadFiles();
  for (const name of names) {
    if (process.env[name]) return process.env[name];
    if (files[name]) return files[name];
  }
  return null;
}

export function reloadSecrets() {
  fileSecrets = null;
  loadFiles();
}

// Which providers have credentials configured (never returns the keys themselves).
export function providerKeyStatus() {
  return {
    claude: !!getSecret("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"),
    codex: !!getSecret("OPENAI_API_KEY"),
    gemini: !!getSecret("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    nemotron: !!getSecret("NVIDIA_API_KEY", "NEMOTRON_API_KEY"),
    octoai: !!getSecret("OCTOAI_API_KEY", "OCTOAI_TOKEN"),
    hermes: true, // local service, no key needed
  };
}
