// src/lib/supabaseRest.js
export function createSupabaseRestClient({
  supabaseUrl,
  anonKey,
  getCacheMs = 30000,
}) {
  const getCache = new Map();

  function baseHeaders(extra = {}) {
    return {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      ...extra,
    };
  }

  async function readBody(res) {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function supabaseGet(path, opts = {}) {
    const {
      cacheKey,
      cacheTag = "",
      cacheMs = getCacheMs,
      bypassCache = false,
      headers = {},
    } = opts;

    const key = cacheKey ?? `${cacheTag}::${path}`;

    if (!bypassCache) {
      const cached = getCache.get(key);
      if (cached && Date.now() - cached.ts < cacheMs) return cached.data;
    }

    const res = await fetch(`${supabaseUrl}${path}`, {
      headers: baseHeaders(headers),
    });

    if (!res.ok) throw new Error((await res.text()) || "Request failed");

    const data = await readBody(res);
    getCache.set(key, { ts: Date.now(), data });
    return data;
  }

  async function supabasePatch(path, bodyObj, opts = {}) {
    const { headers = {}, prefer = "return=representation" } = opts;

    const res = await fetch(`${supabaseUrl}${path}`, {
      method: "PATCH",
      headers: baseHeaders({
        "Content-Type": "application/json",
        Prefer: prefer,
        ...headers,
      }),
      body: JSON.stringify(bodyObj),
    });

    if (!res.ok) throw new Error((await res.text()) || "Request failed");

    const data = await readBody(res);
    if (Array.isArray(data)) return data[0] ?? null;
    return data;
  }

  async function supabasePost(path, bodyObj, opts = {}) {
    const { headers = {}, prefer = "return=representation" } = opts;

    const res = await fetch(`${supabaseUrl}${path}`, {
      method: "POST",
      headers: baseHeaders({
        "Content-Type": "application/json",
        Prefer: prefer,
        ...headers,
      }),
      body: JSON.stringify(bodyObj),
    });

    if (!res.ok) throw new Error((await res.text()) || "Request failed");

    const data = await readBody(res);

    if (Array.isArray(data)) {
      return Array.isArray(bodyObj) ? data : data[0] ?? null;
    }
    return data;
  }

  async function supabaseDelete(path, opts = {}) {
    const { headers = {}, prefer = "return=minimal" } = opts;

    const res = await fetch(`${supabaseUrl}${path}`, {
      method: "DELETE",
      headers: baseHeaders({
        Prefer: prefer,
        ...headers,
      }),
    });

    if (!res.ok) throw new Error((await res.text()) || "Request failed");
    return true;
  }

  function invalidateGetCache(prefix) {
    const keys = Array.from(getCache.keys());
    for (const k of keys) {
      if (k.startsWith(prefix)) getCache.delete(k);
    }
  }

  return {
    supabaseGet,
    supabasePatch,
    supabasePost,
    supabaseDelete,
    invalidateGetCache,
  };
}
