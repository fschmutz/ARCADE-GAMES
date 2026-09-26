// Zero-dependency static server for local play and the Playwright suite.
// Mirrors GitHub Pages: the site answers under /ARCADE-GAMES/ (and at / for convenience),
// and a missing path returns 404.html with a 404 status.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', 'site');
const PORT = Number(process.env.PORT ?? 4173);
const PREFIX = '/ARCADE-GAMES';

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** @param {import('node:http').ServerResponse} res @param {string} file @param {number} status */
async function send(res, file, status) {
  const body = await readFile(file);
  res.writeHead(status, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(body);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname === PREFIX ? `${PREFIX}/` : url.pathname;
  const local = pathname.startsWith(`${PREFIX}/`) ? pathname.slice(PREFIX.length) : pathname;
  let file = resolve(ROOT, `.${decodeURIComponent(local)}`);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { location: `${pathname}/` }).end();
        return;
      }
      file = join(file, 'index.html');
    }
    await send(res, file, 200);
  } catch {
    await send(res, join(ROOT, '404.html'), 404).catch(() => res.writeHead(404).end('Not found'));
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Arcade on http://127.0.0.1:${PORT}${PREFIX}/`);
});
