// @ts-check
// Shared runtime for every page: DOM lookup, storage, theme toggle, overlay,
// speed-level picker, keyboard and swipe input, offline caching.

/** @typedef {'up' | 'down' | 'left' | 'right'} Direction */
/** @typedef {{ x: number, y: number }} Point */

const THEME_KEY = 'arcade.theme';

/** @type {Record<string, Direction>} */
const DIRECTION_KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  z: 'up', w: 'up', s: 'down', q: 'left', a: 'left', d: 'right',
};

export const store = {
  /** @param {string} key @param {string} fallback */
  get(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  /** @param {string} key @param {string} value */
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage disabled (private mode): scores are simply not kept.
    }
  },
};

/**
 * @template {Element} T
 * @param {string} id
 * @param {{ new (): T, prototype: T }} type
 * @returns {T}
 */
export function el(id, type) {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`#${id} is missing or is not a ${type.name}`);
  return node;
}

/** @param {HTMLCanvasElement} canvas @param {number} width @param {number} height */
export function context2d(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Sizes the canvas so the whole page (header, options, board, help, credit) fits the
 * viewport height, whatever the device, and keeps doing so on resize and rotation.
 * @param {HTMLCanvasElement} canvas @param {{ aspect: number, maxWidth: number, minWidth?: number }} size
 */
export function fitCanvas(canvas, { aspect, maxWidth, minWidth = 180 }) {
  const fit = () => {
    const kids = [...document.body.children].filter(node => node instanceof HTMLElement && node.offsetParent !== null);
    const first = kids[0];
    const last = kids.at(-1);
    if (!first || !last) return;
    const body = getComputedStyle(document.body);
    const content = last.getBoundingClientRect().bottom - first.getBoundingClientRect().top
      + parseFloat(body.paddingTop) + parseFloat(body.paddingBottom);
    const others = content - canvas.getBoundingClientRect().height;
    const byHeight = (window.innerHeight - others) * aspect;
    const byWidth = document.documentElement.clientWidth * 0.92 - 18;
    canvas.style.width = `${Math.round(Math.max(minWidth, Math.min(maxWidth, byWidth, byHeight)))}px`;
  };
  fit();
  window.addEventListener('resize', fit);
  void document.fonts.ready.then(fit);
}

export const isDark = () => document.documentElement.classList.contains('dark');

/** @param {() => void} [onChange] */
export function initThemeToggle(onChange) {
  const button = el('theme', HTMLButtonElement);
  const sun = el('icon-sun', SVGSVGElement);
  const moon = el('icon-moon', SVGSVGElement);
  const sync = () => {
    const dark = isDark();
    sun.toggleAttribute('hidden', !dark);
    moon.toggleAttribute('hidden', dark);
    button.setAttribute('aria-pressed', String(dark));
  };
  button.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark', !isDark());
    store.set(THEME_KEY, isDark() ? 'dark' : 'light');
    sync();
    onChange?.();
  });
  sync();
}

export function overlay() {
  const root = el('overlay', HTMLElement);
  const title = el('ov-title', HTMLElement);
  const text = el('ov-text', HTMLElement);
  const button = el('ov-btn', HTMLButtonElement);
  return {
    /** @param {string} heading @param {string} body @param {string} action */
    show(heading, body, action) {
      title.textContent = heading;
      text.textContent = body;
      button.textContent = action;
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
    /** @param {() => void} handler */
    onAction(handler) {
      button.addEventListener('click', handler);
    },
  };
}

/**
 * Segmented control persisted in storage. With `hotkeys`, the digit keys 1..n select too.
 * @template {string} K
 * @param {{
 *   mountId: string,
 *   storageKey: string,
 *   options: Record<K, { label: string }>,
 *   fallback: NoInfer<K>,
 *   isLocked: () => boolean,
 *   onChange: (key: NoInfer<K>) => void,
 *   hotkeys?: boolean,
 * }} config
 */
export function picker({ mountId, storageKey, options, fallback, isLocked, onChange, hotkeys = false }) {
  const mount = el(mountId, HTMLElement);
  const keys = /** @type {K[]} */ (Object.keys(options));
  const stored = store.get(storageKey, fallback);
  let current = keys.find(key => key === stored) ?? fallback;

  const buttons = keys.map((key, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = options[key].label;
    if (hotkeys) button.title = `Touche ${i + 1}`;
    button.addEventListener('click', () => select(key));
    mount.append(button);
    return button;
  });

  function sync() {
    const locked = isLocked();
    buttons.forEach((button, i) => {
      const active = keys[i] === current;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = locked;
    });
  }

  /** @param {K} key */
  function select(key) {
    if (isLocked()) return;
    current = key;
    store.set(storageKey, key);
    sync();
    onChange(key);
  }

  if (hotkeys) {
    document.addEventListener('keydown', event => {
      const key = /^[1-9]$/.test(event.key) ? keys[Number(event.key) - 1] : undefined;
      if (key !== undefined) select(key);
    });
  }

  sync();
  return {
    get current() {
      return current;
    },
    sync,
  };
}

/**
 * Mirrors the game state on the board element so styles and tests can observe it.
 * @param {string} state
 */
export function publishState(state) {
  el('board', HTMLElement).dataset.state = state;
}

/** @param {number} seconds */
export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** @param {KeyboardEvent} event @returns {Direction | null} */
export function directionOf(event) {
  return DIRECTION_KEYS[event.key] ?? DIRECTION_KEYS[event.key.toLowerCase()] ?? null;
}

/** @param {HTMLElement} target @param {(direction: Direction) => void} handler */
export function onSwipe(target, handler) {
  /** @type {Point | null} */
  let start = null;
  target.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    if (touch) start = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  target.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    handler(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { passive: true });
}

function registerOffline() {
  if (!('serviceWorker' in navigator)) return;
  const root = document.documentElement.dataset.root ?? '.';
  navigator.serviceWorker
    .register(`${root}/sw.js`, { scope: `${root}/` })
    .catch(error => console.warn('Offline mode unavailable:', error));
}

registerOffline();
