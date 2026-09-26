// @ts-check
// Impact feedback: particles, screen shake, flash, floating text, phone vibration.
// Motion effects are skipped when the device asks for reduced motion.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const MAX_PARTICLES = 300;

/** @typedef {{ x: number, y: number, vx: number, vy: number, life: number, max: number, size: number, color: string }} Particle */
/** @typedef {{ x: number, y: number, text: string, color: string, life: number, max: number }} Label */

export function createEffects() {
  /** @type {Particle[]} */
  let particles = [];
  /** @type {Label[]} */
  let labels = [];
  let shakeTime = 0;
  let shakeDuration = 0;
  let shakeMagnitude = 0;
  let flashTime = 0;
  let flashDuration = 0;
  let flashColor = '255, 255, 255';

  return {
    /**
     * @param {number} x @param {number} y
     * @param {{ color: string, count?: number, speed?: number, life?: number, size?: number }} spec
     */
    burst(x, y, { color, count = 18, speed = 140, life = 0.55, size = 3 }) {
      if (reducedMotion.matches) return;
      for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = speed * (0.35 + Math.random() * 0.65);
        const max = life * (0.6 + Math.random() * 0.4);
        particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: max, max, size, color });
      }
    },
    /** @param {number} magnitude @param {number} [duration] */
    shake(magnitude, duration = 0.25) {
      if (reducedMotion.matches) return;
      shakeMagnitude = magnitude;
      shakeDuration = duration;
      shakeTime = duration;
    },
    /** @param {string} rgb e.g. '255, 255, 255' @param {number} [duration] */
    flash(rgb, duration = 0.12) {
      if (reducedMotion.matches) return;
      flashColor = rgb;
      flashDuration = duration;
      flashTime = duration;
    },
    /** Floating text is information, so it stays on even with reduced motion. */
    label(/** @type {number} */ x, /** @type {number} */ y, /** @type {string} */ text, color = '#22d3ee', life = 0.9) {
      labels.push({ x, y, text, color, life, max: life });
    },
    /** @param {number} dt */
    update(dt) {
      for (const p of particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
      particles = particles.filter(p => p.life > 0);
      for (const l of labels) {
        l.life -= dt;
        l.y -= 28 * dt;
      }
      labels = labels.filter(l => l.life > 0);
      shakeTime = Math.max(0, shakeTime - dt);
      flashTime = Math.max(0, flashTime - dt);
    },
    /** Translates the context for the current shake; call inside save/restore. @param {CanvasRenderingContext2D} ctx */
    applyShake(ctx) {
      if (shakeTime <= 0) return;
      const k = shakeMagnitude * (shakeTime / shakeDuration);
      ctx.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k);
    },
    /** @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} height */
    draw(ctx, width, height) {
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
      for (const l of labels) {
        ctx.globalAlpha = Math.min(1, (l.life / l.max) * 2);
        ctx.fillStyle = l.color;
        ctx.fillText(l.text, l.x, l.y);
      }
      ctx.globalAlpha = 1;
      if (flashTime > 0) {
        ctx.fillStyle = `rgba(${flashColor}, ${0.5 * (flashTime / flashDuration)})`;
        ctx.fillRect(-20, -20, width + 40, height + 40);
      }
    },
    clear() {
      particles = [];
      labels = [];
      shakeTime = 0;
      flashTime = 0;
    },
  };
}

/** @param {number | number[]} pattern milliseconds */
export function vibrate(pattern) {
  if (!reducedMotion.matches && 'vibrate' in navigator) navigator.vibrate(pattern);
}
