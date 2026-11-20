#!/usr/bin/env node
/*
 * Mobile Aspect Preview server (no dependencies, Node 18+).
 *
 *   node playground/aspects-mobile/serve.mjs [--aspect <folder>]... [--port 4310] [--strict-port]
 *
 * An aspect folder holds what goes into the FI repo plus the submission metadata:
 *   <name>/<name>.js        aspect extension (the file committed under aspects/mobile/<name>/)
 *   <name>/metadata.json    the "Metadata:" JSON from the pull request
 *   <name>/*.js             static loader(s), matched to ASPECT_SCRIPT_<key>_URL by file name
 * Without --aspect, every folder in samples/mobile/aspects and aspects/mobile (your own, from
 * `pnpm run create-aspect:mobile`) is served.
 *
 * POST /demo/chat is a stand-in chat backend ({message} -> {reply}) for testing a chatbot's apiUrl locally.
 * POST /api/aspects/<id>/settings saves edited template settings to that aspect's metadata.json, and
 * POST /api/aspects/<id>/copy creates your own aspect from a template; both only answer the preview page
 * itself on this machine, and samples are never written.
 *
 * Also usable from code (Forge CLI): import { startPreviewServer } from './serve.mjs'.
 */
import { createServer } from 'node:http';
import {
  readFileSync,
  readdirSync,
  existsSync,
  statSync,
  watch,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  EXTENSION_FILE,
  validateAnswers,
  withAnswers,
} from './src/metadata-builder.mjs';
import { scaffoldAspect } from '../../tools/scripts/create-aspect.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');
const DEFAULT_ASPECT_ROOTS = [
  join(REPO_ROOT, 'aspects/mobile'),
  join(REPO_ROOT, 'samples/mobile/aspects'),
];
const SAMPLES_ROOT = join(REPO_ROOT, 'samples/mobile/aspects');
const MAX_BODY = 1024 * 1024;
const DEFAULT_PORT = 4310;
// Tried in turn when the default port is taken (another preview, another checkout).
const FALLBACK_PORTS = 10;
// The address the templates' UI pages default to (template.json, metadata.json). The page is shown
// the address this preview really runs on, and saves write the default back, so any port works.
const DEFAULT_PREVIEW_ORIGIN = `http://127.0.0.1:${DEFAULT_PORT}`;
const MAX_SETTINGS_BODY = 64 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function isInside(root, file) {
  const r = resolve(root);
  const f = resolve(file);
  return f === r || f.startsWith(r + sep);
}

/**
 * How the page may edit an aspect's template settings: 'save' writes your own aspect's metadata.json,
 * 'copy' creates your own aspect from a template (templates stay read-only), null means not editable.
 */
export function editMode(aspect) {
  if (!aspect?.template?.fields) return null;
  if (!isInside(SAMPLES_ROOT, aspect.dir)) return 'save';
  const t = aspect.template;
  return aspect.files.includes(EXTENSION_FILE) &&
    aspect.files.includes(t.loaderFile)
    ? 'copy'
    : null;
}

/**
 * Writes are only for the preview page on this machine: a loopback Host (no LAN clients, no DNS
 * rebinding), the page's own Origin (no other site posting here) and a JSON body (forces a CORS
 * preflight, which this server never answers).
 */
/** `value` (any JSON) with every `from` origin replaced by `to`; a longer port such as :43100 is kept. */
export function swapOrigin(value, from, to) {
  if (from === to) return value;
  // Plain string search: an origin followed by another digit (4310 in 43101) is a different port.
  const text = JSON.stringify(value);
  let out = '';
  let at = 0;
  for (let i = text.indexOf(from); i !== -1; i = text.indexOf(from, i + 1)) {
    const next = text[i + from.length];
    if (next >= '0' && next <= '9') continue;
    out += text.slice(at, i) + to;
    at = i + from.length;
    i = at - 1;
  }
  return JSON.parse(out + text.slice(at));
}

function isLocalPageRequest(req) {
  const host = req.headers.host ?? '';
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return (
    ['127.0.0.1', 'localhost', '::1'].includes(hostname) &&
    req.headers.origin === `http://${host}` &&
    /^application\/json\b/.test(req.headers['content-type'] ?? '')
  );
}

/**
 * The template an aspect you created was made from, as { id, title }: the `from` that
 * create-aspect records, else (older aspects) the template with the same title or type.
 */
export function templateOf(aspect, aspects) {
  if (isInside(SAMPLES_ROOT, aspect.dir)) return null;
  const templates = aspects.filter((t) => isInside(SAMPLES_ROOT, t.dir));
  const own = aspect.template;
  const sameType = templates.filter((t) => t.template?.type === own?.type);
  const t =
    templates.find((t) => t.id === own?.from) ??
    templates.find((t) => own?.title && t.template?.title === own.title) ??
    (sameType.length === 1 ? sameType[0] : null);
  return t ? { id: t.id, title: t.template?.title || t.id } : null;
}

/** Keeps only the template's own fields, as strings. */
function cleanAnswers(template, answers) {
  return Object.fromEntries(
    template.fields.map((f) => [f.key, String(answers?.[f.key] ?? '')]),
  );
}

/** Reads one aspect folder. Returns null (with a reason) when it is not usable. */
export function readAspectFolder(dir) {
  const id = basename(dir);
  const metadataPath = join(dir, 'metadata.json');
  if (!existsSync(metadataPath)) return { error: `${dir}: no metadata.json` };
  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch (e) {
    return { error: `${metadataPath}: ${e.message}` };
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  // Partner UI pages a template ships (for example support-chat-ui.html): served so the preview can
  // frame them, never treated as an aspect extension or loader.
  const assets = readdirSync(dir).filter((f) => f.endsWith('.html'));
  const localLoaders = {};
  const unmatched = [];
  for (const p of metadata.properties ?? []) {
    const m = /^ASPECT_SCRIPT_(.+)_URL$/.exec(p?.propertyName ?? '');
    if (!m) continue;
    let file = '';
    try {
      file = basename(new URL(p.propertyValue).pathname);
    } catch {
      /* invalid URL: reported by the conformance check */
    }
    if (files.includes(file)) localLoaders[m[1]] = file;
    else unmatched.push(m[1]);
  }
  let template = null;
  const templatePath = join(dir, 'template.json');
  if (existsSync(templatePath)) {
    try {
      template = JSON.parse(readFileSync(templatePath, 'utf8'));
    } catch (e) {
      return { error: `${templatePath}: ${e.message}` };
    }
  }
  // A hosted file may be named differently (CDN path); fall back to the template's loader file
  // so the code scans still see the loader source.
  if (
    unmatched.length === 1 &&
    template?.loaderFile &&
    files.includes(template.loaderFile) &&
    !Object.values(localLoaders).includes(template.loaderFile)
  )
    localLoaders[unmatched[0]] = template.loaderFile;
  const loaderFiles = new Set(Object.values(localLoaders));
  // Aspects created before the role names have <name>.js instead.
  const bootstrap =
    [EXTENSION_FILE, `${id}.js`].find((f) => files.includes(f)) ??
    files.find((f) => !loaderFiles.has(f));
  if (!bootstrap)
    return { error: `${dir}: no aspect extension (${EXTENSION_FILE})` };
  return {
    id,
    dir,
    metadata,
    template,
    bootstrap,
    localLoaders,
    files,
    assets,
  };
}

function discover(aspectDirs) {
  const dirs = aspectDirs.length
    ? aspectDirs
    : DEFAULT_ASPECT_ROOTS.filter((root) => existsSync(root)).flatMap((root) =>
        readdirSync(root)
          .map((d) => join(root, d))
          .filter((d) => statSync(d).isDirectory()),
      );
  const aspects = [];
  const problems = [];
  for (const d of dirs) {
    const a = readAspectFolder(resolve(d));
    if (a.error) problems.push(a.error);
    else if (aspects.some((x) => x.id === a.id))
      problems.push(`${d}: duplicate aspect name ${a.id}`);
    else aspects.push(a);
  }
  return { aspects, problems };
}

/**
 * Starts the preview. Options: { aspects: string[], port, host, strictPort, launcher, onReady(url), onError(err) }.
 * onError gets a start-up failure (for example a taken port with strictPort); without it the
 * error is printed and the process exits with code 1.
 * `launcher: 'forge'` is for the Forge CLI only: it makes the page show forge commands.
 * Returns { url, server, stop(), problems }.
 */
export function startPreviewServer(options = {}) {
  const host = options.host ?? '127.0.0.1';
  // A taken port moves on to the next free one, unless `strictPort` is set.
  let port = options.port ?? DEFAULT_PORT;
  // Where "Create my aspect" puts new folders (create-aspect's target).
  const newAspectRoot =
    options.newAspectRoot ?? join(REPO_ROOT, 'aspects/mobile');
  // 'forge' when the Forge CLI starts the preview; the page then shows forge commands.
  const launcher = options.launcher === 'forge' ? 'forge' : 'repo';
  const aspectDirs = [...(options.aspects ?? [])];
  let found = discover(aspectDirs);
  const scratch = new Map();
  const issuedCodes = new Map();
  const clients = new Set();

  const send = (res, status, body, type = 'text/plain; charset=utf-8') => {
    res.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  };
  const sendFile = (res, file) =>
    send(
      res,
      200,
      readFileSync(file),
      TYPES[extname(file)] ?? 'application/octet-stream',
    );

  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);

    // Identity handoff stand-ins for the sample aspects (oidcClientId / redirectUrl aspect properties).
    // GET <FI>/feng-bff/live/v1/aspect/token?clientId= plays the FI aspect token endpoint: a one-time code,
    // or its error bodies. These client ids return an error, to try the aspect's handling:
    //   preview-no-session      401 SessionUnauthorizedException (no or expired bank session)
    //   preview-unauthorized    401 ClientUnauthorizedException, details.code CMN_90007 (client id unknown)
    //   preview-upstream-error  401 ClientUnauthorizedException without CMN_90007 (code service failed)
    //   preview-server-error    500 ServerErrorException
    //   preview-no-answer       an HTML body: the app sends nothing back, so the aspect times out
    if (req.method === 'GET' && pathname === '/feng-bff/live/v1/aspect/token') {
      const clientId = new URL(req.url, 'http://localhost').searchParams.get(
        'clientId',
      );
      const bffError = (statusCode, error, message, details) =>
        send(
          res,
          statusCode,
          JSON.stringify({
            statusCode,
            error,
            message,
            details,
            timestamp: new Date().toISOString(),
            path: req.url,
          }),
          TYPES['.json'],
        );
      if (!clientId)
        return bffError(
          400,
          'ValidationException',
          'Client executed a bad request',
          [
            {
              path: '/query/clientId',
              message: "must have required property 'clientId'",
            },
          ],
        );
      if (clientId === 'preview-no-session')
        return bffError(
          401,
          'SessionUnauthorizedException',
          'Session is invalid and is therefore unauthorized',
          'Auth is invalid',
        );
      if (clientId === 'preview-unauthorized')
        return bffError(
          401,
          'ClientUnauthorizedException',
          'Client request was not authorized',
          {
            code: 'CMN_90007',
            message: 'Invalid grant type',
          },
        );
      if (clientId === 'preview-upstream-error')
        return bffError(
          401,
          'ClientUnauthorizedException',
          'Client request was not authorized',
          'timeout of 5000ms exceeded',
        );
      if (clientId === 'preview-server-error')
        return bffError(
          500,
          'ServerErrorException',
          'Server ran into an error',
        );
      if (clientId === 'preview-no-answer')
        return send(
          res,
          502,
          '<html><body>Bad Gateway</body></html>',
          'text/html',
        );
      const code = `preview-code-${randomUUID()}`;
      issuedCodes.set(code, Date.now() + 120000);
      if (issuedCodes.size > 100)
        issuedCodes.delete(issuedCodes.keys().next().value);
      return send(
        res,
        200,
        JSON.stringify({ token: code, token_type: 'authorization_code' }),
        TYPES['.json'],
      );
    }
    // POST /demo/session {code} plays the partner backend: accepts each preview code once, unexpired.
    // A real backend exchanges the code at the Candescent token endpoint with its client secret and
    // validates the ID token before it issues its own session.
    if (pathname === '/demo/session') {
      const cors = {
        'Access-Control-Allow-Origin': req.headers.origin ?? '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      };
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        return res.end();
      }
      if (req.method !== 'POST') {
        res.writeHead(405, cors);
        return res.end();
      }
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 4096) req.destroy();
      });
      req.on('end', () => {
        let code = '';
        try {
          code = String(JSON.parse(body).code ?? '');
        } catch {
          // fall through to 401
        }
        const expires = issuedCodes.get(code);
        issuedCodes.delete(code);
        const ok = expires && expires > Date.now();
        res.writeHead(ok ? 200 : 401, {
          ...cors,
          'Content-Type': TYPES['.json'],
          'Cache-Control': 'no-store',
        });
        res.end(
          JSON.stringify(
            ok
              ? {
                  sessionToken: `preview-session-${randomUUID()}`,
                  expiresIn: 900,
                }
              : { error: 'invalid_grant' },
          ),
        );
      });
      return;
    }
    if (req.method === 'POST' && pathname === '/demo/chat') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 16384) req.destroy();
      });
      req.on('end', () => {
        let message = '';
        try {
          message = String(JSON.parse(body).message ?? '');
        } catch {
          return send(
            res,
            400,
            JSON.stringify({ error: 'expected JSON' }),
            TYPES['.json'],
          );
        }
        send(
          res,
          200,
          JSON.stringify({
            reply: `Demo backend received: "${message.slice(0, 200)}"`,
          }),
          TYPES['.json'],
        );
      });
      return;
    }
    if (req.method === 'POST' && pathname === '/api/scratch') {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) req.destroy();
        else chunks.push(c);
      });
      req.on('end', () => {
        const id = randomUUID();
        scratch.set(id, Buffer.concat(chunks));
        if (scratch.size > 50) scratch.delete(scratch.keys().next().value);
        send(
          res,
          200,
          JSON.stringify({ url: `/scratch/${id}.js` }),
          TYPES['.json'],
        );
      });
      return;
    }
    const write = /^\/api\/aspects\/([^/]+)\/(settings|copy)$/.exec(pathname);
    if (req.method === 'POST' && write) {
      if (!isLocalPageRequest(req))
        return send(
          res,
          403,
          'Only the preview page on this machine can save.',
        );
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > MAX_SETTINGS_BODY) req.destroy();
      });
      req.on('end', () => {
        const json = (status, value) =>
          send(res, status, JSON.stringify(value), TYPES['.json']);
        let input;
        try {
          input = JSON.parse(body);
        } catch {
          return json(400, { error: 'expected JSON' });
        }
        found = discover(aspectDirs);
        const a = found.aspects.find(
          (x) => x.id === decodeURIComponent(write[1]),
        );
        const mode = editMode(a);
        if (!mode)
          return json(404, { error: 'No editable aspect with that name.' });
        const answers = swapOrigin(
          cleanAnswers(a.template, input?.answers),
          `http://${req.headers.host}`,
          DEFAULT_PREVIEW_ORIGIN,
        );
        const errors = validateAnswers(a.template, answers);
        if (Object.keys(errors).length) return json(422, { errors });
        // Sector is a submission value, not a template field.
        const sector = ['RETAIL', 'BUSINESS'].includes(input?.sector)
          ? input.sector
          : undefined;

        if (write[2] === 'settings') {
          if (mode !== 'save')
            return json(403, {
              error:
                'Templates are read-only. Create your own aspect from it instead.',
            });
          const metadata = withAnswers(a.template, a.metadata, answers);
          if (sector) metadata.sector = sector;
          writeFileSync(
            join(a.dir, 'metadata.json'),
            `${JSON.stringify(metadata, null, 2)}\n`,
          );
          return json(200, { id: a.id });
        }

        if (mode !== 'copy')
          return json(403, { error: 'Only templates can be copied.' });
        const name = String(input?.name ?? '');
        if (found.aspects.some((x) => x.id === name))
          return json(409, {
            error: `An aspect named ${name} already exists.`,
          });
        try {
          const { dir } = scaffoldAspect({
            template: { ...a.template, dir: a.dir },
            name,
            answers,
            sector,
            targetRoot: newAspectRoot,
          });
          if (aspectDirs.length) aspectDirs.push(dir);
          found = discover(aspectDirs);
          syncWatchers();
          return json(200, { id: name });
        } catch (e) {
          return json(400, { error: e.message });
        }
      });
      return;
    }
    if (req.method !== 'GET') return send(res, 405, 'Method not allowed');

    if (pathname === '/' || pathname === '/index.html')
      return sendFile(res, join(HERE, 'index.html'));
    if (pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      res.on('error', () => clients.delete(res));
      return;
    }
    if (pathname === '/api/config') {
      // Rescan so aspects created or removed while the server runs show up on reload.
      found = discover(aspectDirs);
      syncWatchers();
      const here = `http://${req.headers.host}`;
      const aspects = found.aspects.map((a) => ({
        id: a.id,
        // Shown in "Use this aspect"; repo-relative when the folder is inside this repo.
        path: isInside(REPO_ROOT, a.dir) ? relative(REPO_ROOT, a.dir) : a.dir,
        metadata: swapOrigin(a.metadata, DEFAULT_PREVIEW_ORIGIN, here),
        template: swapOrigin(a.template, DEFAULT_PREVIEW_ORIGIN, here),
        editable: editMode(a),
        // Templates (samples/mobile/aspects) are listed apart from the aspects you created.
        isTemplate: isInside(SAMPLES_ROOT, a.dir),
        templateOf: templateOf(a, found.aspects),
        bootstrapUrl: `/aspects/${encodeURIComponent(
          a.id,
        )}/${encodeURIComponent(a.bootstrap)}`,
        localLoaders: Object.fromEntries(
          Object.entries(a.localLoaders).map(([k, f]) => [
            k,
            `/aspects/${encodeURIComponent(a.id)}/${encodeURIComponent(f)}`,
          ]),
        ),
      }));
      return send(
        res,
        200,
        JSON.stringify({
          launcher,
          aspects,
          problems: found.problems,
        }),
        TYPES['.json'],
      );
    }
    if (parts[0] === 'src' && parts.length === 2) {
      const file = join(HERE, 'src', parts[1]);
      if (isInside(join(HERE, 'src'), file) && existsSync(file))
        return sendFile(res, file);
    }
    if (parts[0] === 'aspects' && parts.length === 3) {
      const a = found.aspects.find((x) => x.id === parts[1]);
      const file = a && join(a.dir, parts[2]);
      if (
        a &&
        (a.files.includes(parts[2]) || a.assets.includes(parts[2])) &&
        isInside(a.dir, file) &&
        existsSync(file)
      )
        return sendFile(res, file);
    }
    if (parts[0] === 'scratch' && parts.length === 2) {
      const body = scratch.get(parts[1].replace(/\.js$/, ''));
      if (body) return send(res, 200, body, TYPES['.js']);
    }
    return send(res, 404, 'Not found');
  });

  // Live reload when an aspect file changes. Roots are watched too, so folders created later
  // (pnpm run create-aspect:mobile) get a watcher after the next rescan.
  let timer;
  const watchers = new Map();
  const onChange = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      found = discover(aspectDirs);
      syncWatchers();
      for (const c of clients) {
        // A page that just closed may still be listed: skip it rather than write to a dead socket.
        if (c.destroyed || c.writableEnded) clients.delete(c);
        else c.write('data: reload\n\n');
      }
    }, 150);
  };
  const syncWatchers = () => {
    const dirs = new Set(found.aspects.map((a) => a.dir));
    if (!aspectDirs.length)
      DEFAULT_ASPECT_ROOTS.filter((root) => existsSync(root)).forEach((root) =>
        dirs.add(root),
      );
    for (const [dir, w] of watchers)
      if (!dirs.has(dir)) {
        w.close();
        watchers.delete(dir);
      }
    for (const dir of dirs)
      if (!watchers.has(dir)) {
        try {
          watchers.set(dir, watch(dir, onChange));
        } catch {
          /* folder removed between scan and watch */
        }
      }
  };
  syncWatchers();

  const urlFor = (p) =>
    `http://${host === '0.0.0.0' ? 'localhost' : host}:${p}`;
  let url = urlFor(port);
  const lastPort = port + FALLBACK_PORTS;
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && !options.strictPort && port < lastPort) {
      port += 1;
      server.listen(port, host);
      return;
    }
    const err =
      e.code === 'EADDRINUSE'
        ? Object.assign(
            new Error(
              options.strictPort
                ? `Port ${port} is already in use (is another preview running?). Stop it, pick another --port, or drop --strict-port.`
                : `Ports ${options.port ?? DEFAULT_PORT}-${lastPort} are all in use. Stop another preview or pick a --port.`,
            ),
            { code: e.code },
          )
        : e;
    for (const w of watchers.values()) w.close();
    watchers.clear();
    if (options.onError) options.onError(err);
    else {
      console.error(err.message);
      process.exit(1);
    }
  });
  server.on('listening', () => {
    url = urlFor(server.address().port);
    options.onReady?.(url);
  });
  server.listen(port, host);
  return {
    get url() {
      return url;
    },
    server,
    problems: found.problems,
    stop() {
      clearTimeout(timer);
      watchers.forEach((w) => w.close());
      for (const c of clients) c.end();
      server.close();
    },
  };
}

// Nx's run-commands passes options as --name=value, and nx.json gives every serve target
// proxyConfig (used by the web playgrounds). Accept both forms; the preview needs no proxy.
const IGNORED_NX_OPTIONS = new Set(['--proxyConfig', '--proxy-config']);

export function parseArgs(input) {
  const argv = input.flatMap((a) => {
    const eq = a.startsWith('--') ? a.indexOf('=') : -1;
    return eq > 0 ? [a.slice(0, eq), a.slice(eq + 1)] : [a];
  });
  const out = { aspects: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (IGNORED_NX_OPTIONS.has(a)) {
      if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) i++;
      continue;
    }
    if (a === '--aspect') out.aspects.push(argv[++i]);
    else if (a === '--port') {
      const value = argv[++i];
      out.port = Number(value);
      if (!/^\d+$/.test(value ?? '') || out.port > 65535)
        throw new Error(
          `--port needs a number from 0 to 65535 (got "${value ?? ''}").`,
        );
    } else if (a === '--host') out.host = argv[++i];
    else if (a === '--strict-port' || a === '--strictPort') {
      // Nx may pass a flag as --strict-port=true.
      if (argv[i + 1] === 'true' || argv[i + 1] === 'false')
        out.strictPort = argv[++i] === 'true';
      else out.strictPort = true;
    }
    // No longer used: the preview can't know the app's domain allowlist. Accepted so old commands run.
    else if (a === '--fi-domain') {
      i++;
      console.warn('--fi-domain is no longer used; ignoring it.');
    } else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (args.help) {
    console.log(
      'Usage: node playground/aspects-mobile/serve.mjs [--aspect <folder>]... [--port 4310] [--strict-port] [--host 127.0.0.1]\nA taken port moves on to the next free one; --strict-port stops instead.',
    );
    process.exit(0);
  }
  const { problems, stop } = startPreviewServer({
    ...args,
    onReady: (url) =>
      console.log(`Mobile Aspect Preview: ${url}\nPress Ctrl+C to stop.`),
  });
  for (const p of problems) console.warn(`skipped ${p}`);
  process.on('SIGINT', () => {
    stop();
    process.exit(0);
  });
}
