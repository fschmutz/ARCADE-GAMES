// @ts-check
'use strict';

// Network first so a deploy is visible on the next load; the cache only serves when offline.
const worker = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
const CACHE = 'arcade-v2';
const PRECACHE = [
  './',
  './manifest.webmanifest',
  './assets/arcade.css',
  './assets/arcade.js',
  './assets/audio.js',
  './assets/fx.js',
  './assets/theme-boot.js',
  './assets/home.js',
  './assets/icons/arcade.svg',
  './assets/icons/snake.svg',
  './assets/icons/pacman.svg',
  './assets/icons/car.svg',
  './snake/',
  './snake/snake.js',
  './snake/rules.js',
  './pacman/',
  './pacman/pacman.js',
  './pacman/rules.js',
  './car/',
  './car/car.js',
  './car/rules.js',
];

worker.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => worker.skipWaiting()),
  );
});

worker.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => worker.clients.claim()),
  );
});

/** @param {Request} request */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) ?? Response.error();
  }
}

worker.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== worker.location.origin) return;
  event.respondWith(networkFirst(request));
});
