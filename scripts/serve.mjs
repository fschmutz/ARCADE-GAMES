// Zero-dependency static server for local play and the Playwright suite.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', 'site');
const PORT = Number(process.env.PORT ?? 4173);

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = resolve(ROOT, `.${decodeURIComponent(url.pathname)}`);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { location: `${url.pathname}/` }).end();
        return;
      }
      file = join(file, 'index.html');
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Arcade on http://127.0.0.1:${PORT}/`);
});
