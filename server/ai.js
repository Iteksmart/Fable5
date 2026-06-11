// Multi-provider AI orchestration router.
// Streams every provider back to the client as a unified SSE stream:
//   data: {"delta":"text chunk"}
//   data: {"done":true,"usage":{...}}
import { getSecret } from "./secrets.js";

export const PROVIDERS = {
  claude: {
    label: "Claude",
    vendor: "Anthropic",
    defaultModel: "claude-sonnet-4-6",
    models: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
  },
  codex: {
    label: "Codex",
    vendor: "OpenAI",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  },
  gemini: {
    label: "Gemini",
    vendor: "Google",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-1.5-pro"],
  },
  nemotron: {
    label: "Nemotron",
    vendor: "NVIDIA",
    defaultModel: "nvidia/llama-3.1-nemotron-70b-instruct",
    models: ["nvidia/llama-3.1-nemotron-70b-instruct", "nvidia/nemotron-4-340b-instruct"],
  },
  octoai: {
    label: "OctoAI",
    vendor: "iTechSmart OCTOAI",
    defaultModel: "meta-llama-3.1-70b-instruct",
    models: ["meta-llama-3.1-70b-instruct", "mixtral-8x22b-instruct"],
  },
  hermes: {
    label: "Hermes",
    vendor: "iTechSmart",
    defaultModel: "nvidia/nemotron-3-nano-30b-a3b",
    models: ["nvidia/nemotron-3-nano-30b-a3b", "nvidia/llama-3.1-nemotron-70b-instruct"],
  },
};

const HERMES_URL = process.env.HERMES_URL || "http://localhost:8089";

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// Generic OpenAI-compatible streaming (OpenAI, NVIDIA, OctoAI, Hermes).
async function streamOpenAICompatible(res, { url, key, model, messages, system }) {
  const body = {
    model,
    stream: true,
    messages: [...(system ? [{ role: "system", content: system }] : []), ...messages],
  };
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
  await pumpSSE(r, res, (json) => json.choices?.[0]?.delta?.content || "");
}

async function streamAnthropic(res, { key, model, messages, system }) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      ...(system ? { system } : {}),
      messages,
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
  await pumpSSE(r, res, (json) =>
    json.type === "content_block_delta" ? json.delta?.text || "" : ""
  );
}

async function streamGemini(res, { key, model, messages, system }) {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
  await pumpSSE(r, res, (json) => json.candidates?.[0]?.content?.parts?.[0]?.text || "");
}

// Reads an upstream SSE body and forwards extracted text deltas to our client.
async function pumpSSE(upstream, res, extract) {
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const delta = extract(JSON.parse(payload));
        if (delta) sse(res, { delta });
      } catch {
        /* partial JSON across chunks — ignored, next chunk completes it */
      }
    }
  }
}

export async function handleChat(req, res) {
  const { provider = "claude", model, messages = [], system } = req.body || {};
  const p = PROVIDERS[provider];
  if (!p) return res.status(400).json({ error: `unknown provider '${provider}'` });
  const m = model || p.defaultModel;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const started = Date.now();
  try {
    switch (provider) {
      case "claude": {
        const key = getSecret("ANTHROPIC_API_KEY", "CLAUDE_API_KEY");
        if (!key) throw new Error("ANTHROPIC_API_KEY not found in env/.secrets/vault");
        await streamAnthropic(res, { key, model: m, messages, system });
        break;
      }
      case "codex": {
        const key = getSecret("OPENAI_API_KEY");
        if (!key) throw new Error("OPENAI_API_KEY not found in env/.secrets/vault");
        await streamOpenAICompatible(res, {
          url: "https://api.openai.com/v1/chat/completions",
          key, model: m, messages, system,
        });
        break;
      }
      case "gemini": {
        const key = getSecret("GEMINI_API_KEY", "GOOGLE_API_KEY");
        if (!key) throw new Error("GEMINI_API_KEY not found in env/.secrets/vault");
        await streamGemini(res, { key, model: m, messages, system });
        break;
      }
      case "nemotron": {
        const key = getSecret("NVIDIA_API_KEY", "NEMOTRON_API_KEY");
        if (!key) throw new Error("NVIDIA_API_KEY not found in env/.secrets/vault");
        await streamOpenAICompatible(res, {
          url: "https://integrate.api.nvidia.com/v1/chat/completions",
          key, model: m, messages, system,
        });
        break;
      }
      case "octoai": {
        const key = getSecret("OCTOAI_API_KEY", "OCTOAI_TOKEN");
        if (!key) throw new Error("OCTOAI_API_KEY not found in env/.secrets/vault");
        await streamOpenAICompatible(res, {
          url: "https://text.octoai.run/v1/chat/completions",
          key, model: m, messages, system,
        });
        break;
      }
      case "hermes": {
        await streamOpenAICompatible(res, {
          url: `${HERMES_URL}/v1/chat/completions`,
          key: getSecret("HERMES_API_KEY"), model: m, messages, system,
        });
        break;
      }
    }
    sse(res, { done: true, ms: Date.now() - started });
  } catch (e) {
    sse(res, { error: e.message });
  }
  res.end();
}
