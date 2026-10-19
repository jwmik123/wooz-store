import useLoadingStore from "./loadingStore";

/*
 * Byte-level loading progress. three's FileLoader (GLTFLoader, KTX2Loader)
 * streams every asset through window.fetch, so a thin wrapper that counts the
 * body bytes of /models/ and /basis/ responses gives a real progress signal
 * (drei's useProgress only counts finished files: 0 → 60 → 100 jumps).
 *
 * Installed once on the client while the loader is up; removed after the reveal
 * so later fetches (Shopify, Moos chat, product GLBs) are untouched.
 *
 * prefetchAssets(urls) starts those downloads right away (the loader's JS runs
 * well before the 3D chunk and WebGPU init are done) and hands the bytes to
 * three's own request for the same URL later, once.
 *
 * Dev only: `?slowload=1` throttles those responses (~0.6 MB/s per file, plus
 * a start delay) to watch the loader animate on a fast machine.
 */

const TRACKED = /\/(models|basis)\//;

let original = null;
/** absolute URL → Promise<{ buf, status, statusText, headers } | null> */
const prefetched = new Map();

const absolute = (url) => new URL(url, window.location.href).href;

function urlOf(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input?.url ?? "";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slowFactor() {
  if (process.env.NODE_ENV !== "development") return 0;
  const v = new URLSearchParams(window.location.search).get("slowload");
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function installFetchTracker() {
  if (typeof window === "undefined" || original) return;
  original = window.fetch;
  const slow = slowFactor();
  const { addBytes } = useLoadingStore.getState();

  window.fetch = async function trackedFetch(input, init) {
    const url = urlOf(input);
    if (!TRACKED.test(url) || (init?.method && init.method !== "GET"))
      return original.call(this, input, init);

    const key = absolute(url);
    const early = prefetched.get(key);
    if (early) {
      prefetched.delete(key);
      const hit = await early;
      if (hit)
        return new Response(hit.buf, {
          status: hit.status,
          statusText: hit.statusText,
          headers: hit.headers,
        });
    }
    return countedFetch(input, init);
  };

  async function countedFetch(input, init) {
    if (slow) await sleep(400 * slow);
    const res = await original.call(window, input, init);
    if (!res.ok || !res.body) return res;

    const total = Number(res.headers.get("content-length")) || 0;
    addBytes(0, total);
    const reader = res.body.getReader();
    // ~0.6 MB/s per file at slowload=1 (a few seconds for the 8 MB studio).
    const bytesPerMs = slow ? 600 / slow : 0;
    const body = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) return controller.close();
        if (bytesPerMs) await sleep(value.byteLength / bytesPerMs);
        addBytes(value.byteLength, 0);
        controller.enqueue(value);
      },
      cancel: (reason) => reader.cancel(reason),
    });
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  }

  prefetchImpl = (urls) => {
    for (const url of urls) {
      const key = absolute(url);
      if (prefetched.has(key)) continue;
      prefetched.set(
        key,
        countedFetch(key)
          .then(async (res) =>
            res.ok
              ? { buf: await res.arrayBuffer(), status: res.status, statusText: res.statusText, headers: new Headers(res.headers) }
              : null
          )
          // A failed prefetch falls back to a normal request.
          .catch(() => null)
      );
    }
  };
}

let prefetchImpl = null;

/** Start these /models/ + /basis/ downloads now (no-op before installFetchTracker). */
export function prefetchAssets(urls) {
  prefetchImpl?.(urls);
}

export function uninstallFetchTracker() {
  if (!original) return;
  window.fetch = original;
  original = null;
  prefetched.clear();
  prefetchImpl = null;
}
