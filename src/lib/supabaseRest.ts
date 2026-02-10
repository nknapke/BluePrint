// src/lib/supabaseRest.ts
type SupabaseRestClientOptions = {
  supabaseUrl: string;
  anonKey: string;
  getCacheMs?: number;
};

type CacheEntry = { ts: number; data: any };

type GetOptions = {
  cacheKey?: string;
  cacheTag?: string;
  cacheMs?: number;
  bypassCache?: boolean;
  headers?: Record<string, string>;
};

type WriteOptions = {
  headers?: Record<string, string>;
  prefer?: string;
};

export function createSupabaseRestClient({
  supabaseUrl,
  anonKey,
  getCacheMs = 30000,
}: SupabaseRestClientOptions) {
  const getCache = new Map<string, CacheEntry>();

  function baseHeaders(extra: Record<string, string> = {}) {
    return {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      ...extra,
    };
  }

  async function readBody(res: Response) {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function writeJson(
    method: "POST" | "PATCH",
    path: string,
    bodyObj: any,
    opts: WriteOptions
  ) {
    const { headers = {}, prefer = "return=representation" } = opts;

    const res = await fetch(`${supabaseUrl}${path}`, {
      method,
      headers: baseHeaders({
        "Content-Type": "application/json",
        Prefer: prefer,
        ...headers,
      }),
      body: JSON.stringify(bodyObj),
    });

    if (!res.ok) throw new Error((await res.text()) || "Request failed");

    return readBody(res);
  }

  async function supabaseGet(path: string, opts: GetOptions = {}) {
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

  async function supabasePatch(
    path: string,
    bodyObj: any,
    opts: WriteOptions = {}
  ) {
    const data = await writeJson("PATCH", path, bodyObj, opts);
    if (Array.isArray(data)) return data[0] ?? null;
    return data;
  }

  async function supabasePost(
    path: string,
    bodyObj: any,
    opts: WriteOptions = {}
  ) {
    const data = await writeJson("POST", path, bodyObj, opts);

    if (Array.isArray(data)) {
      return Array.isArray(bodyObj) ? data : data[0] ?? null;
    }
    return data;
  }

  async function supabaseDelete(path: string, opts: WriteOptions = {}) {
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

  function invalidateGetCache(prefix: string) {
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
