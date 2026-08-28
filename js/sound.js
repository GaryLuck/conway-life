/**
 * Tiny WebAudio blips (REQUIREMENTS U7) — no audio files, nothing to download.
 * The context is created lazily on the first gesture, which is what iOS wants.
 */

export function createSound(initialEnabled = false) {
  let enabled = initialEnabled;
  let ctx = null;

  const context = () => {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const tone = (freq, duration, type, gainPeak) => {
    if (!enabled) return;
    const audio = context();
    if (!audio) return;
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  };

  return {
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = !!value;
      if (enabled) context();
    },
    tap() { tone(660, 0.07, 'sine', 0.08); },
    draw() { tone(880, 0.035, 'sine', 0.045); },
    chime() {
      tone(784, 0.16, 'sine', 0.09);
      setTimeout(() => tone(1175, 0.2, 'sine', 0.07), 90);
    },
    thud() { tone(180, 0.14, 'triangle', 0.09); },
  };
}
