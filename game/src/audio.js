// Night Mail Run — tiny synthesised sounds.
// One clear job: every sound the game makes, built with WebAudio alone.
// No audio files, no network: the engine hum, the ring chime, the
// landing thud and the crash are all oscillators shaped in code.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      ctx = new AudioContext();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, duration, type, volume) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume || 0.12, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch (e) {
      /* sound is decoration; a failure never stops the game */
    }
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    setEngine(throttle, flying) {
      if (muted) return;
      const ac = ensure();
      if (!ac || !engineOsc) return;
      const target = flying ? 0.018 + throttle * 0.035 : 0;
      engineGain.gain.setTargetAtTime(target, ac.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + throttle * 46, ac.currentTime, 0.1);
    },
    ring() {
      blip(880, 0.35, 'sine', 0.16);
      setTimeout(() => blip(1318, 0.4, 'sine', 0.12), 90);
    },
    land() {
      blip(180, 0.3, 'triangle', 0.2);
      setTimeout(() => blip(523, 0.5, 'sine', 0.12), 160);
    },
    crash() {
      blip(70, 0.7, 'sawtooth', 0.22);
    },
    click() {
      blip(660, 0.08, 'square', 0.06);
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
  };
}
