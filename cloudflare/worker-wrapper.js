// cloudflare/worker-wrapper.js
import generated from './worker.js';        // the file OpenNext generates
export * from './worker.js';                // re-export any named exports (DOs, etc.)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve Next static assets via the ASSETS KV by rewriting to the real path
    if (url.pathname.startsWith('/_next/')) {
      url.pathname = '/assets' + url.pathname;               // /_next/* -> /assets/_next/*
      return env.ASSETS.fetch(new Request(url.toString(), request));
    }

    // Everything else goes to the generated OpenNext worker
    return generated.fetch(request, env, ctx);
  },
};
