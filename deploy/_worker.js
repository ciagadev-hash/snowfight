// Cloudflare Pages (advanced mode, dashboard drag-and-drop works): serves the Snowfight site and its small API.
//   GET  /api/feed -> coins launched on Snowfight (KV binding FEED, key "feed"); empty list until the first launch
//   POST /api/rpc  -> Solana mainnet RPC relay for the few calls a launch needs (mainnet-beta answers 403 to browser origins)
//   POST /api/ipfs -> pump.fun's IPFS upload (browsers can't call it: no CORS)
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const RPCS = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'], RPC_OK = new Set(['sendTransaction', 'getSignatureStatuses', 'getLatestBlockhash', 'getBalance']);
export default {
  async fetch(request, env) {
    const url = new URL(request.url), p = url.pathname;
    if (p === '/api/feed') return J(env.FEED ? (await env.FEED.get('feed', 'json')) || [] : []);
    if (p === '/api/rpc') {
      if (request.method !== 'POST') return J({ error: 'POST only' }, 405);
      let body; try { body = await request.json(); } catch (_) { return J({ error: 'JSON expected' }, 400); }
      if (!body || Array.isArray(body) || !RPC_OK.has(body.method)) return J({ error: 'Method not allowed' }, 400);
      const ups = env.RPC_URL ? [env.RPC_URL, ...RPCS] : RPCS, payload = JSON.stringify(body); let last = null;
      for (const u of ups) {
        try { const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload }); const t = await r.text();
          if (r.status === 403 || r.status === 429 || r.status >= 500) { last = t.slice(0, 200) || 'HTTP ' + r.status; continue; }
          return new Response(t, { status: r.status, headers: { 'content-type': 'application/json' } }); } catch (e) { last = String(e); }
      }
      return J({ jsonrpc: '2.0', id: body.id ?? null, error: { code: -32000, message: 'RPC unreachable: ' + (last || 'no upstream') } }, 502);
    }
    if (p === '/api/ipfs') {
      if (request.method !== 'POST') return J({ error: 'POST only' }, 405);
      const type = request.headers.get('content-type') || ''; if (!type.startsWith('multipart/form-data')) return J({ error: 'multipart/form-data expected' }, 400);
      const body = await request.arrayBuffer(); if (body.byteLength > 6 * 1024 * 1024) return J({ error: 'Image too large' }, 413);
      try { const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', headers: { 'content-type': type }, body }); return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' } }); }
      catch (_) { return J({ error: 'Upload to pump.fun failed' }, 502); }
    }
    if (p.startsWith('/api/') || p === '/_worker.js') return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
