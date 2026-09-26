// @ts-check
// Loaded synchronously in <head> so the first paint already uses the right theme.
(() => {
  'use strict';
  try {
    const stored = localStorage.getItem('arcade.theme');
    const light = stored ? stored === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches;
    document.documentElement.classList.toggle('dark', !light);
  } catch {
    document.documentElement.classList.add('dark');
  }
})();
