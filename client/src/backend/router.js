// Minimal Express-style router so the backend route modules keep their shape
// (router.get('/:id', (req, res) => …)) while running in the browser. Requests
// are dispatched in-process — there is no network hop.

function compile(pattern) {
  const keys = [];
  const src = pattern
    .split('/')
    .map(seg => {
      if (seg.startsWith(':')) { keys.push(seg.slice(1)); return '([^/]+)'; }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { re: new RegExp(`^${src}/?$`), keys };
}

export function Router() {
  const routes = [];
  const add = method => (pattern, ...handlers) => {
    routes.push({ method, ...compile(pattern), handlers });
  };
  return {
    routes,
    get:    add('GET'),
    post:   add('POST'),
    patch:  add('PATCH'),
    delete: add('DELETE'),
  };
}

export class Response {
  constructor() {
    this.statusCode = 200;
    this.headers    = {};
    this.body       = undefined;
    this.finished   = false;
  }
  status(code)          { this.statusCode = code; return this; }
  setHeader(name, val)  { this.headers[name.toLowerCase()] = val; return this; }
  json(body)            { this.body = body ?? null; this.finished = true; return this; }
  send(body)            { this.body = body; this.finished = true; return this; }
}

// Find the handler chain for (method, path) across mounted routers, run it,
// and return the finished Response. Handlers follow Express' (req, res, next)
// convention so middleware like requireUser works unchanged.
export async function dispatch(mounts, { method, path, body, user }) {
  const url   = new URL(path, 'http://local');
  const query = Object.fromEntries(url.searchParams);
  const res   = new Response();

  for (const { prefix, router, middleware = [] } of mounts) {
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) continue;
    const sub = url.pathname.slice(prefix.length) || '/';
    for (const route of router.routes) {
      if (route.method !== method) continue;
      const m = route.re.exec(sub);
      if (!m) continue;
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const req = { method, path: url.pathname, params, query, body: body ?? {}, user };
      const chain = [...middleware, ...route.handlers];
      for (const handler of chain) {
        let advanced = false;
        await handler(req, res, () => { advanced = true; });
        if (res.finished || !advanced) break;
      }
      return res;
    }
  }
  return res.status(404).json({ error: 'Not found' });
}
