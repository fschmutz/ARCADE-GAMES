// @ts-check
// Every sound is synthesised with the Web Audio API: no audio files to download.
import { el, store } from './arcade.js';

const MUTE_KEY = 'arcade.muted';
const VOLUME = 0.45;

/** @type {AudioContext | null} */
let ctx = null;
/** @type {GainNode | null} */
let master = null;
let muted = store.get(MUTE_KEY, '0') === '1';

/** Browsers only start audio after a user gesture, so the context is created lazily. */
function context() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    const compressor = ctx.createDynamicsCompressor();
    master.connect(compressor).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

for (const type of ['pointerdown', 'keydown']) {
  document.addEventListener(type, () => context(), { once: true, capture: true });
}

const vary = () => 1 + (Math.random() - 0.5) * 0.06;

/**
 * One enveloped oscillator note.
 * @param {{ type?: OscillatorType, from: number, to?: number, duration?: number,
 *   volume?: number, delay?: number, steady?: boolean }} note
 */
export function tone({ type = 'square', from, to = from, duration = 0.1, volume = 0.25, delay = 0, steady = false }) {
  if (muted) return;
  const audio = context();
  if (!master) return;
  const pitch = steady ? 1 : vary();
  const t0 = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from * pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to * pitch), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/**
 * Filtered white-noise burst, for crashes and whooshes.
 * @param {{ duration?: number, volume?: number, from?: number, to?: number, delay?: number }} burst
 */
export function noise({ duration = 0.3, volume = 0.3, from = 4000, to = 200, delay = 0 }) {
  if (muted) return;
  const audio = context();
  if (!master) return;
  const t0 = audio.currentTime + delay;
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + duration);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  source.connect(filter).connect(gain).connect(master);
  source.start(t0);
}

/**
 * Plays notes one after another.
 * @param {number[]} notes frequencies in Hz
 * @param {{ step?: number, type?: OscillatorType, volume?: number }} [options]
 */
export function melody(notes, { step = 0.09, type = 'square', volume = 0.2 } = {}) {
  notes.forEach((from, i) => tone({ type, from, duration: step * 1.1, volume, delay: i * step, steady: true }));
}

/**
 * A continuous sound (engine, siren) whose pitch can be steered while it plays.
 * @param {{ type?: OscillatorType, frequency: number, volume?: number, wobble?: number, wobbleRate?: number }} spec
 */
export function drone({ type = 'sawtooth', frequency, volume = 0.06, wobble = 0, wobbleRate = 6 }) {
  /** @type {{ osc: OscillatorNode, gain: GainNode, lfo: OscillatorNode | null } | null} */
  let nodes = null;
  return {
    start() {
      if (nodes || muted) return;
      const audio = context();
      if (!master) return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.value = volume;
      /** @type {OscillatorNode | null} */
      let lfo = null;
      if (wobble > 0) {
        lfo = audio.createOscillator();
        const depth = audio.createGain();
        lfo.frequency.value = wobbleRate;
        depth.gain.value = wobble;
        lfo.connect(depth).connect(osc.frequency);
        lfo.start();
      }
      osc.connect(gain).connect(master);
      osc.start();
      nodes = { osc, gain, lfo };
    },
    /** @param {number} hz */
    pitch(hz) {
      if (nodes && ctx) nodes.osc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.05);
    },
    stop() {
      if (!nodes || !ctx) return;
      const { osc, gain, lfo } = nodes;
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
      osc.stop(ctx.currentTime + 0.15);
      lfo?.stop(ctx.currentTime + 0.15);
      nodes = null;
    },
  };
}

export const isMuted = () => muted;

/** Binds the header mute button; `onChange` lets a game stop its drones. @param {() => void} [onChange] */
export function initMuteToggle(onChange) {
  const button = el('mute', HTMLButtonElement);
  const on = el('icon-sound', SVGSVGElement);
  const off = el('icon-muted', SVGSVGElement);
  const sync = () => {
    on.toggleAttribute('hidden', muted);
    off.toggleAttribute('hidden', !muted);
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
  };
  const toggle = () => {
    muted = !muted;
    store.set(MUTE_KEY, muted ? '1' : '0');
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
    sync();
    onChange?.();
  };
  button.addEventListener('click', toggle);
  document.addEventListener('keydown', event => {
    if (event.key === 'm' || event.key === 'M') toggle();
  });
  sync();
}
