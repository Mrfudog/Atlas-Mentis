/* window.storage-Polyfill: Server-API zuerst, localStorage als Fallback. */
const BASIS = "api/state/";
async function apiGet(key) { const r = await fetch(BASIS + encodeURIComponent(key)); if (r.status === 404) return null; if (!r.ok) throw new Error("API " + r.status); return await r.json(); }
async function apiSet(key, value) { const r = await fetch(BASIS + encodeURIComponent(key), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) }); if (!r.ok) throw new Error("API " + r.status); return { key, value }; }
window.storage = {
  async get(key) { try { return await apiGet(key); } catch { const v = localStorage.getItem("kv:" + key); return v == null ? null : { key, value: v }; } },
  async set(key, value) { try { const r = await apiSet(key, value); try { localStorage.setItem("kv:" + key, value); } catch {} return r; } catch { localStorage.setItem("kv:" + key, value); return { key, value }; } },
  async delete(key) { try { await fetch(BASIS + encodeURIComponent(key), { method: "DELETE" }); } catch {} localStorage.removeItem("kv:" + key); return { key, deleted: true }; },
  async list() { try { const r = await fetch(BASIS); if (r.ok) return await r.json(); } catch {} return { keys: Object.keys(localStorage).filter((k) => k.startsWith("kv:")).map((k) => k.slice(3)) }; },
};
