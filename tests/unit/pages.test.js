// @ts-check
// Page contract: every page ships the metadata, security headers and links the site promises.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const SITE = resolve(import.meta.dirname, '..', '..', 'site');
const BASE = 'https://fschmutz.github.io/ARCADE-GAMES/';
const CREDIT = 'Lino from Marrakech';
const INDEXABLE = ['', 'snake/', 'pacman/', 'car/'];

/** @param {string} rel */
const read = rel => readFileSync(join(SITE, rel), 'utf8');
/** @param {string} html @param {string} prop */
const meta = (html, prop) => html.match(new RegExp(`<meta (?:name|property)="${prop}" content="([^"]*)"`))?.[1];

/** Resolves a local reference from a page the way the browser would, directories to index.html. */
function localTarget(/** @type {string} */ fromDir, /** @type {string} */ ref) {
  const clean = ref.split('#')[0].split('?')[0];
  const target = join(fromDir, clean);
  return existsSync(target) && statSync(target).isDirectory() ? join(target, 'index.html') : target;
}

const pages = [...INDEXABLE.map(p => `${p}index.html`), '404.html'];

describe('page contract', () => {
  for (const page of pages) {
    const html = read(page);
    const indexable = page !== '404.html';

    it(`${page}: language, title, description, viewport, one h1, credit`, () => {
      assert.match(html, /<html lang="fr"/);
      assert.match(html, /<title>[^<]{3,}<\/title>/);
      assert.ok((meta(html, 'description') ?? '').length >= 50, 'meta description of 50+ characters');
      assert.match(html, /<meta name="viewport" content="width=device-width/);
      assert.equal(html.match(/<h1[\s>]/g)?.length, 1, 'exactly one h1');
      assert.match(html, new RegExp(`<footer class="credit">${CREDIT}</footer>`));
    });

    it(`${page}: strict Content Security Policy, no insecure or third-party resource`, () => {
      const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /script-src 'self';/);
      assert.match(csp, /object-src 'none'/);
      assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
      assert.doesNotMatch(html, /\s(?:src|href)="http:\/\//);
      assert.doesNotMatch(html, /<script(?![^>]*application\/ld\+json)[^>]*>[^<\s]/, 'no inline executable script');
      assert.doesNotMatch(html, /\sstyle="/, 'no inline style attribute');
      assert.doesNotMatch(html, /\son[a-z]+="/, 'no inline event handler');
    });

    it(`${page}: every local link, script, stylesheet and icon exists`, () => {
      const fromDir = indexable ? dirname(join(SITE, page)) : SITE;
      const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map(m => m[1])
        .filter(ref => !/^(?:https?:|data:|mailto:|#)/.test(ref) && ref !== '/ARCADE-GAMES/');
      assert.ok(refs.length > 3);
      for (const ref of refs) assert.ok(existsSync(localTarget(fromDir, ref)), `${page} -> ${ref}`);
    });

    if (indexable) {
      it(`${page}: canonical, Open Graph, Twitter card and JSON-LD agree on the URL`, () => {
        const url = BASE + page.replace('index.html', '');
        assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`));
        assert.equal(meta(html, 'og:url'), url);
        assert.equal(meta(html, 'og:image'), `${BASE}assets/og.png`);
        assert.ok(meta(html, 'og:title'));
        assert.ok(meta(html, 'og:description'));
        assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
        const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
        assert.ok(ld, 'JSON-LD block');
        const data = JSON.parse(ld);
        assert.equal(data['@context'], 'https://schema.org');
        assert.equal(data.url, url);
      });
    } else {
      it('404.html: not indexed, links resolve from the site root at any depth', () => {
        assert.equal(meta(html, 'robots'), 'noindex');
        assert.match(html, /<base href="\/ARCADE-GAMES\/">/);
        assert.match(html, /base-uri 'self'/);
      });
    }
  }
});

describe('site files', () => {
  it('sitemap lists exactly the indexable pages', () => {
    const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    assert.deepEqual(locs, INDEXABLE.map(p => BASE + p));
  });

  it('social preview image exists', () => {
    assert.ok(statSync(join(SITE, 'assets', 'og.png')).size > 10_000);
  });

  it('manifest is valid and its icons exist', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    assert.equal(manifest.start_url, './');
    for (const icon of manifest.icons) assert.ok(existsSync(join(SITE, icon.src)), icon.src);
  });

  it('every file the service worker precaches exists', () => {
    const sw = read('sw.js');
    const list = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] ?? '';
    const entries = [...list.matchAll(/'([^']+)'/g)].map(m => m[1]);
    assert.ok(entries.length > 10);
    for (const entry of entries) assert.ok(existsSync(localTarget(SITE, entry)), entry);
  });
});
