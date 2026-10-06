// x.dom AI backend: /api/status /api/chat /api/image /api/video
// Keys live only in Worker secrets (env.*). Nothing secret reaches the browser.
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const TOOLS = {
  summarize: "Summarize the user's text concisely in the same language.",
  translate: "Translate the user's text. If it is Arabic translate to English, otherwise to Arabic. Output only the translation.",
  rewrite: "Rewrite the user's text to be clearer and better written, same language and meaning. Output only the result.",
  explain: "Explain the user's text or topic simply, step by step, in the same language.",
  brainstorm: "Give 8 distinct, concrete ideas for the user's topic, in the same language.",
  code: "You are a careful coding helper. Answer with short explanations and correct code in fenced blocks.",
};
const SYS = "You are x.dom AI. Reply in the user's language (Arabic, English or French). Be direct and concise. Use Markdown when useful.";
// Best-effort per-isolate limiter. For hard limits add a Cloudflare Rate Limiting rule (see README).
const hits = new Map();
function limited(ip, kind, max, windowMs) {
  const k = kind + ip, now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < windowMs);
  if (a.length >= max) { hits.set(k, a); return true; }
  a.push(now); hits.set(k, a);
  if (hits.size > 5000) hits.clear();
  return false;
}
const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8-fast", IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const hasChat = e => !!(e.ANTHROPIC_API_KEY || e.AI);
const hasImage = e => !!e.AI;

async function chat(env, system, messages) {
  if (env.ANTHROPIC_API_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 1000, system, messages }),
    });
    if (!r.ok) throw new Error("provider " + r.status);
    const d = await r.json();
    return (d.content || []).map(c => c.text || "").join("");
  }
  const d = await env.AI.run(env.CHAT_MODEL || CHAT_MODEL, { messages: [{ role: "system", content: system }, ...messages], max_tokens: 800 });
  // Older models return {response}; newer ones may return OpenAI-style choices.
  return d.response || (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
}
async function image(env, prompt) {
  const d = await env.AI.run(env.IMAGE_MODEL || IMAGE_MODEL, { prompt, steps: 4 });
  if (!d.image) throw new Error("no image");
  return "data:image/jpeg;base64," + d.image;
}
// Video: no provider is wired. Add one here (Replicate, fal, Veo, Runway...) plus its secret.
async function video(env, prompt) { return null; }

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    const ip = req.headers.get("cf-connecting-ip") || "x";
    if (url.pathname === "/api/status") return J({ chat: hasChat(env), image: hasImage(env), video: false });
    if (req.method !== "POST") return J({ error: "method" }, 405);
    if (+(req.headers.get("content-length") || 0) > 32768) return J({ error: "الطلب كبير جداً" }, 413);
    let b; try { b = await req.json(); } catch { return J({ error: "طلب غير صالح" }, 400); }
    const s = x => typeof x === "string" ? x.trim() : "";
    try {
      if (url.pathname === "/api/chat") {
        if (limited(ip, "c", 20, 60000)) return J({ error: "طلبات كثيرة، انتظر دقيقة." }, 429);
        let m = Array.isArray(b.messages) ? b.messages.slice(-20) : [];
        m = m.filter(x => x && (x.role === "user" || x.role === "assistant") && s(x.content)).map(x => ({ role: x.role, content: s(x.content).slice(0, 4000) }));
        if (!m.length || m[m.length - 1].role !== "user") return J({ error: "رسالة فارغة" }, 400);
        if (!hasChat(env)) return J({ demo: true });
        return J({ reply: await chat(env, TOOLS[b.tool] || SYS, m) });
      }
      if (url.pathname === "/api/image") {
        if (limited(ip, "i", 5, 3600000)) return J({ error: "وصلت حد الصور لهذه الساعة." }, 429);
        const p = s(b.prompt).slice(0, 500);
        if (p.length < 3) return J({ error: "اكتب وصفاً أطول" }, 400);
        if (!hasImage(env)) return J({ demo: true });
        return J({ image: await image(env, p) });
      }
      if (url.pathname === "/api/video") {
        if (limited(ip, "v", 2, 3600000)) return J({ error: "وصلت حد الفيديو لهذه الساعة." }, 429);
        const p = s(b.prompt).slice(0, 500);
        if (p.length < 3) return J({ error: "اكتب وصفاً أطول" }, 400);
        const v = await video(env, p);
        return v ? J({ video: v }) : J({ demo: true });
      }
    } catch (e) { console.error(String(e)); return J({ error: "تعذر تنفيذ الطلب. قد يكون الحد المجاني اليومي انتهى، حاول لاحقاً." }, 502); }
    return J({ error: "not found" }, 404);
  },
};
