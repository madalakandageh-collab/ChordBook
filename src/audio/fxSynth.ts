import type { FxCategory, FxLayerEntry, FxTypeId } from '../types';

export interface FxCatalogItem {
  id: FxTypeId;
  category: FxCategory;
  description: string;
  defaultDurationBars: number;
}

export const FX_CATALOG: FxCatalogItem[] = [
  // Risers & Sweeps
  {
    id: 'White Noise Riser',
    category: 'Risers & Sweeps',
    description: 'Bright bandpass-swept white noise lifting energy into the drop',
    defaultDurationBars: 2,
  },
  {
    id: 'Pink Noise Sweep',
    category: 'Risers & Sweeps',
    description: 'Warm analog pink-noise filter sweep with smooth resonance',
    defaultDurationBars: 2,
  },
  {
    id: 'Pitch-Up Synth Riser',
    category: 'Risers & Sweeps',
    description: 'Dual detuned saw oscillators gliding up two octaves with shimmer',
    defaultDurationBars: 2,
  },
  {
    id: 'Filtered Sawtooth Sweep',
    category: 'Risers & Sweeps',
    description: 'Rich stereo saw cluster opening through a resonant 24dB filter',
    defaultDurationBars: 4,
  },
  {
    id: 'Tension Drone Riser',
    category: 'Risers & Sweeps',
    description: 'Suspenseful fifth & octave harmonic drone building upward',
    defaultDurationBars: 4,
  },
  {
    id: 'Snare/Percussion Roll Riser',
    category: 'Risers & Sweeps',
    description: 'Accelerating quarter-to-32nd percussion roll synced to BPM',
    defaultDurationBars: 1,
  },

  // Reverse & Swells
  {
    id: 'Reverse Cymbal',
    category: 'Reverse & Swells',
    description: 'Metallic cymbal wash curving exponentially up to a crisp cut',
    defaultDurationBars: 1,
  },
  {
    id: 'Reverse Reverb Swell',
    category: 'Reverse & Swells',
    description: 'Backwards harmonic hall swell blooming cleanly into Beat 1',
    defaultDurationBars: 1,
  },
  {
    id: 'Ambient Pad Swell',
    category: 'Reverse & Swells',
    description: 'Warm lush fifth/ninth chord bloom for smooth section entries',
    defaultDurationBars: 2,
  },
  {
    id: 'Sub Swell',
    category: 'Reverse & Swells',
    description: 'Deep warm low-end sub foundation swelling upward cleanly',
    defaultDurationBars: 2,
  },

  // Impacts & Drops
  {
    id: 'Sub Bass Drop',
    category: 'Impacts & Drops',
    description: 'Chest-thumping 808 sub pitch drop for dramatic chorus entries',
    defaultDurationBars: 1,
  },
  {
    id: 'Boom/Cinematic Impact',
    category: 'Impacts & Drops',
    description: 'Layered sub boom, warm noise burst & dark brass transient hit',
    defaultDurationBars: 1,
  },
  {
    id: 'Crash/Noise Hit',
    category: 'Impacts & Drops',
    description: 'Crisp studio crash cymbal + wide bright air burst on impact',
    defaultDurationBars: 1,
  },
  {
    id: 'Downlifter / Tape Stop Effect',
    category: 'Impacts & Drops',
    description: 'Resonant analog pitch-down & tape-brake stop transition',
    defaultDurationBars: 1,
  },

  // Atmosphere / Textures
  {
    id: 'Vinyl Crackle',
    category: 'Atmosphere / Textures',
    description: 'Warm lo-fi analog vinyl dust & subtle room floor texture',
    defaultDurationBars: 4,
  },
  {
    id: 'Subtle Wind/Air Texture',
    category: 'Atmosphere / Textures',
    description: 'Gentle sweeping stereo breeze & airy ambient wash',
    defaultDurationBars: 4,
  },
];

export const FX_DURATION_BAR_OPTIONS: { value: number; label: string }[] = [
  { value: 0.25, label: '0.25 Bar' },
  { value: 0.5, label: '0.5 Bar' },
  { value: 1, label: '1 Bar' },
  { value: 2, label: '2 Bars' },
  { value: 4, label: '4 Bars' },
  { value: 8, label: '8 Bars' },
];

export const DEFAULT_FX_ENTRY: FxLayerEntry = {
  id: 'fx-layer-1',
  enabled: true,
  effectType: 'White Noise Riser',
  startBar: 1,
  startBeat: 1,
  durationBars: 2,
  volumeDb: 0,
};

function dbToLinearGain(db: number): number {
  return Math.pow(10, db / 20);
}

function createPrng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createWhiteNoiseBuffer(ctx: BaseAudioContext, durationSec: number, seed = 101): AudioBuffer {
  const sr = ctx.sampleRate || 44100;
  const len = Math.max(Math.floor(sr * Math.max(0.2, durationSec)), 2048);
  const buf = ctx.createBuffer(2, len, sr);
  const rand = createPrng(seed);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = rand() * 2 - 1;
    }
  }
  return buf;
}

function createPinkNoiseBuffer(ctx: BaseAudioContext, durationSec: number, seed = 202): AudioBuffer {
  const sr = ctx.sampleRate || 44100;
  const len = Math.max(Math.floor(sr * Math.max(0.2, durationSec)), 2048);
  const buf = ctx.createBuffer(2, len, sr);
  const rand = createPrng(seed);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = rand() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      data[i] = Math.max(-1, Math.min(1, pink));
    }
  }
  return buf;
}

function createReverseCymbalBuffer(ctx: BaseAudioContext, durationSec: number, seed = 303): AudioBuffer {
  const sr = ctx.sampleRate || 44100;
  const dur = Math.max(0.25, durationSec);
  const len = Math.max(Math.floor(sr * dur), 2048);
  const buf = ctx.createBuffer(2, len, sr);
  const rand = createPrng(seed);
  const partials = [2820, 3910, 5140, 6720, 8450];

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    const phaseShift = ch * 0.7;
    for (let i = 0; i < len; i++) {
      const progress = i / (len - 1); // 0 -> 1
      const t = i / sr;
      // Exponential reverse swell ending crisply just before 1.0
      const env =
        progress > 0.985
          ? Math.pow(progress, 3.8) * ((1 - progress) / 0.015)
          : Math.pow(progress, 3.8);
      let metallic = 0;
      for (let p = 0; p < partials.length; p++) {
        metallic += Math.sin(2 * Math.PI * partials[p] * t + phaseShift + p * 0.4) * 0.18;
      }
      const noise = (rand() * 2 - 1) * 0.72;
      data[i] = Math.max(-1, Math.min(1, (metallic * 0.45 + noise * 0.65) * env));
    }
  }
  return buf;
}

function createReverseReverbBuffer(ctx: BaseAudioContext, durationSec: number, seed = 404): AudioBuffer {
  const sr = ctx.sampleRate || 44100;
  const dur = Math.max(0.25, durationSec);
  const len = Math.max(Math.floor(sr * dur), 2048);
  const buf = ctx.createBuffer(2, len, sr);
  const rand = createPrng(seed);
  // Warm lush major9 chord harmonics smeared with diffused noise
  const freqs = [261.63, 392.0, 493.88, 587.33, 783.99];

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const progress = i / (len - 1);
      const t = i / sr;
      const env =
        progress > 0.98
          ? Math.pow(progress, 3.1) * ((1 - progress) / 0.02)
          : Math.pow(progress, 3.1);
      let harmonic = 0;
      for (let f = 0; f < freqs.length; f++) {
        const detune = ch === 0 ? 1 - f * 0.0012 : 1 + f * 0.0012;
        harmonic += Math.sin(2 * Math.PI * freqs[f] * detune * t + f) * 0.18;
      }
      const rawNoise = rand() * 2 - 1;
      lp = lp * 0.88 + rawNoise * 0.12;
      data[i] = Math.max(-1, Math.min(1, (harmonic * 0.55 + lp * 0.9) * env));
    }
  }
  return buf;
}

function createVinylCrackleBuffer(ctx: BaseAudioContext, durationSec: number, seed = 505): AudioBuffer {
  const sr = ctx.sampleRate || 44100;
  const dur = Math.max(0.5, durationSec);
  const len = Math.max(Math.floor(sr * dur), 4096);
  const buf = ctx.createBuffer(2, len, sr);
  const rand = createPrng(seed);

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    let popDecay = 0;
    let popAmp = 0;
    for (let i = 0; i < len; i++) {
      const r = rand();
      // Subtle low analog floor hiss
      const hiss = (rand() * 2 - 1) * 0.04;
      lp = lp * 0.93 + hiss * 0.07;

      // Occasional warm crackles & crisp needle ticks
      if (r > 0.9991) {
        popAmp = (rand() > 0.5 ? 1 : -1) * (0.35 + rand() * 0.55);
        popDecay = 1.0;
      } else if (r > 0.9965) {
        popAmp = (rand() * 2 - 1) * 0.16;
        popDecay = 0.7;
      }
      const tick = popAmp * popDecay;
      popDecay *= 0.86;
      data[i] = Math.max(-1, Math.min(1, lp + tick));
    }
  }
  return buf;
}

function createCrashBuffer(ctx: BaseAudioContext, durationSec: number, seed = 606): AudioBuffer {
  const sr = ctx.sampleRate || 44100;
  const dur = Math.max(0.4, Math.min(4.5, durationSec));
  const len = Math.max(Math.floor(sr * dur), 2048);
  const buf = ctx.createBuffer(2, len, sr);
  const rand = createPrng(seed);
  const partials = [2140, 3190, 4420, 5810, 7250, 9100];

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.004);
      const decay = Math.exp(-t / Math.max(0.28, dur * 0.34));
      let ring = 0;
      for (let p = 0; p < partials.length; p++) {
        ring += Math.sin(2 * Math.PI * partials[p] * t + ch * 0.9 + p) * 0.12;
      }
      const noise = (rand() * 2 - 1) * 0.7;
      data[i] = Math.max(-1, Math.min(1, (ring * 0.4 + noise * 0.7) * attack * decay));
    }
  }
  return buf;
}

/**
 * Pure Web Audio API offline-capable synthesizer for all 16 FX / Risers presets.
 * Works identically on live AudioContext and OfflineAudioContext.
 * Returns a cleanup callback that immediately stops all scheduled nodes if playback stops.
 */
export function scheduleWebAudioFx(params: {
  ctx: BaseAudioContext;
  destination: AudioNode;
  effectType: FxTypeId;
  startTime: number;
  durationSec: number;
  beatDurationSec: number;
  volumeDb?: number;
}): () => void {
  const { ctx, destination, effectType, startTime, durationSec, beatDurationSec, volumeDb = 0 } = params;
  const safeDur = Math.max(0.2, durationSec);
  const endTime = startTime + safeDur;
  const level = Math.max(0.02, Math.min(2.2, dbToLinearGain(volumeDb) * 0.42));

  const masterOut = ctx.createGain();
  masterOut.gain.setValueAtTime(1.0, startTime);
  masterOut.connect(destination);

  const stoppers: Array<() => void> = [];
  const trackOsc = (osc: OscillatorNode, stopAt: number) => {
    osc.start(startTime);
    osc.stop(stopAt);
    stoppers.push(() => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already stopped
      }
    });
  };
  const trackBuf = (src: AudioBufferSourceNode, stopAt: number, startAt = startTime) => {
    src.start(startAt);
    src.stop(stopAt);
    stoppers.push(() => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already stopped
      }
    });
  };

  switch (effectType) {
    case 'White Noise Riser': {
      const buf = createWhiteNoiseBuffer(ctx, safeDur + 0.1, 101);
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.Q.setValueAtTime(1.6, startTime);
      hp.frequency.setValueAtTime(240, startTime);
      hp.frequency.exponentialRampToValueAtTime(8800, Math.max(startTime + 0.05, endTime - 0.02));

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.exponentialRampToValueAtTime(level * 0.95, Math.max(startTime + 0.05, endTime - 0.025));
      g.gain.linearRampToValueAtTime(0.0001, endTime + 0.02);

      src.connect(hp);
      hp.connect(g);
      g.connect(masterOut);
      trackBuf(src, endTime + 0.05);
      break;
    }

    case 'Pink Noise Sweep': {
      const buf = createPinkNoiseBuffer(ctx, safeDur + 0.1, 202);
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.setValueAtTime(1.2, startTime);
      lp.Q.linearRampToValueAtTime(4.8, Math.max(startTime + 0.05, endTime - 0.03));
      lp.frequency.setValueAtTime(150, startTime);
      lp.frequency.exponentialRampToValueAtTime(6800, Math.max(startTime + 0.05, endTime - 0.02));

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.exponentialRampToValueAtTime(level * 1.05, Math.max(startTime + 0.05, endTime - 0.03));
      g.gain.linearRampToValueAtTime(0.0001, endTime + 0.02);

      src.connect(lp);
      lp.connect(g);
      g.connect(masterOut);
      trackBuf(src, endTime + 0.05);
      break;
    }

    case 'Pitch-Up Synth Riser': {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.setValueAtTime(3.2, startTime);
      lp.frequency.setValueAtTime(260, startTime);
      lp.frequency.exponentialRampToValueAtTime(6400, Math.max(startTime + 0.05, endTime - 0.02));

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.exponentialRampToValueAtTime(level * 0.65, Math.max(startTime + 0.05, endTime - 0.025));
      g.gain.linearRampToValueAtTime(0.0001, endTime + 0.02);

      lp.connect(g);
      g.connect(masterOut);

      [-7, 7].forEach((detuneCents, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.detune.setValueAtTime(detuneCents, startTime);
        osc.frequency.setValueAtTime(130.81, startTime); // C3
        osc.frequency.exponentialRampToValueAtTime(523.25, Math.max(startTime + 0.05, endTime - 0.015)); // C5
        osc.connect(lp);
        trackOsc(osc, endTime + 0.05);
      });
      break;
    }

    case 'Filtered Sawtooth Sweep': {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.setValueAtTime(4.5, startTime);
      lp.frequency.setValueAtTime(160, startTime);
      lp.frequency.exponentialRampToValueAtTime(7500, Math.max(startTime + 0.05, endTime - 0.025));

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.exponentialRampToValueAtTime(level * 0.55, Math.max(startTime + 0.05, endTime - 0.03));
      g.gain.linearRampToValueAtTime(0.0001, endTime + 0.02);

      lp.connect(g);
      g.connect(masterOut);

      const chordFreqs = [130.81, 196.0, 261.63];
      chordFreqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.detune.setValueAtTime((idx - 1) * 9, startTime);
        osc.frequency.setValueAtTime(f, startTime);
        osc.frequency.linearRampToValueAtTime(f * 1.02, endTime);
        osc.connect(lp);
        trackOsc(osc, endTime + 0.05);
      });
      break;
    }

    case 'Tension Drone Riser': {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.setValueAtTime(2.0, startTime);
      lp.frequency.setValueAtTime(360, startTime);
      lp.frequency.exponentialRampToValueAtTime(4200, Math.max(startTime + 0.05, endTime - 0.02));

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.exponentialRampToValueAtTime(level * 0.62, Math.max(startTime + 0.05, endTime - 0.03));
      g.gain.linearRampToValueAtTime(0.0001, endTime + 0.02);

      lp.connect(g);
      g.connect(masterOut);

      [110, 164.81, 220, 311.13].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(f, startTime);
        osc.frequency.exponentialRampToValueAtTime(f * 1.25, Math.max(startTime + 0.05, endTime - 0.015));
        osc.connect(lp);
        trackOsc(osc, endTime + 0.05);
      });
      break;
    }

    case 'Snare/Percussion Roll Riser': {
      const snareHitBuf = createWhiteNoiseBuffer(ctx, 0.14, 777);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(1.1, startTime);
      bp.frequency.setValueAtTime(850, startTime);
      bp.frequency.exponentialRampToValueAtTime(3400, Math.max(startTime + 0.05, endTime - 0.02));
      bp.connect(masterOut);

      // Subdivide into accelerating grid synced to beatDurationSec
      const stepBase = Math.max(0.06, beatDurationSec / 4); // 16th-note pulse
      const hitTimes: number[] = [];
      let cursor = startTime;
      while (cursor < endTime - 0.02) {
        const progress = (cursor - startTime) / safeDur;
        hitTimes.push(cursor);
        const dt =
          progress < 0.45
            ? stepBase * 2 // 8th notes first half
            : progress < 0.8
            ? stepBase // 16th notes
            : stepBase * 0.5; // 32nd roll finale
        cursor += Math.max(0.035, dt);
      }

      hitTimes.forEach((t, idx) => {
        const prog = idx / Math.max(1, hitTimes.length - 1);
        const vel = level * (0.25 + prog * 0.85);

        const nSrc = ctx.createBufferSource();
        nSrc.buffer = snareHitBuf;
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(vel * 0.85, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        nSrc.connect(nGain);
        nGain.connect(bp);
        trackBuf(nSrc, t + 0.1, t);

        const bodyOsc = ctx.createOscillator();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(210 + prog * 60, t);
        bodyOsc.frequency.exponentialRampToValueAtTime(115, t + 0.055);
        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(vel * 0.55, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
        bodyOsc.connect(bGain);
        bGain.connect(masterOut);
        bodyOsc.start(t);
        bodyOsc.stop(t + 0.075);
        stoppers.push(() => {
          try {
            bodyOsc.stop();
          } catch {
            // Ignore
          }
        });
      });
      break;
    }

    case 'Reverse Cymbal': {
      const buf = createReverseCymbalBuffer(ctx, safeDur, 303);
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(1200, startTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(level * 1.15, startTime);

      src.connect(hp);
      hp.connect(g);
      g.connect(masterOut);
      trackBuf(src, endTime + 0.02);
      break;
    }

    case 'Reverse Reverb Swell': {
      const buf = createReverseReverbBuffer(ctx, safeDur, 404);
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1200, startTime);
      lp.frequency.exponentialRampToValueAtTime(5200, Math.max(startTime + 0.05, endTime - 0.02));

      const g = ctx.createGain();
      g.gain.setValueAtTime(level * 1.05, startTime);

      src.connect(lp);
      lp.connect(g);
      g.connect(masterOut);
      trackBuf(src, endTime + 0.02);
      break;
    }

    case 'Ambient Pad Swell': {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(500, startTime);
      lp.frequency.exponentialRampToValueAtTime(3400, startTime + safeDur * 0.85);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.linearRampToValueAtTime(level * 0.65, startTime + safeDur * 0.82);
      g.gain.linearRampToValueAtTime(0.0001, endTime + 0.06);

      lp.connect(g);
      g.connect(masterOut);

      [261.63, 392.0, 523.25, 587.33].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.detune.setValueAtTime((idx - 1.5) * 6, startTime);
        osc.frequency.setValueAtTime(f, startTime);
        osc.connect(lp);
        trackOsc(osc, endTime + 0.08);
      });
      break;
    }

    case 'Sub Swell': {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(220, startTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.exponentialRampToValueAtTime(level * 1.05, Math.max(startTime + 0.05, endTime - 0.03));
      g.gain.linearRampToValueAtTime(0.0001, endTime + 0.04);

      lp.connect(g);
      g.connect(masterOut);

      [55, 110].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, startTime);
        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(idx === 0 ? 0.9 : 0.35, startTime);
        osc.connect(subGain);
        subGain.connect(lp);
        trackOsc(osc, endTime + 0.06);
      });
      break;
    }

    case 'Sub Bass Drop': {
      const tailDur = Math.min(Math.max(0.8, safeDur), 3.6);
      const dropEnd = startTime + tailDur;
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(135, startTime);
      subOsc.frequency.exponentialRampToValueAtTime(34, startTime + Math.min(tailDur * 0.72, 1.8));

      const harmonicOsc = ctx.createOscillator();
      harmonicOsc.type = 'triangle';
      harmonicOsc.frequency.setValueAtTime(270, startTime);
      harmonicOsc.frequency.exponentialRampToValueAtTime(68, startTime + Math.min(tailDur * 0.45, 0.9));

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.linearRampToValueAtTime(level * 1.2, startTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0008, dropEnd);

      const hGain = ctx.createGain();
      hGain.gain.setValueAtTime(0.28, startTime);
      hGain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.min(tailDur * 0.5, 0.9));

      subOsc.connect(g);
      harmonicOsc.connect(hGain);
      hGain.connect(g);
      g.connect(masterOut);

      trackOsc(subOsc, dropEnd + 0.04);
      trackOsc(harmonicOsc, dropEnd + 0.04);
      break;
    }

    case 'Boom/Cinematic Impact': {
      const tailDur = Math.min(Math.max(1.0, safeDur), 4.2);
      const boomEnd = startTime + tailDur;

      // Sub punch
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(145, startTime);
      subOsc.frequency.exponentialRampToValueAtTime(38, startTime + Math.min(0.95, tailDur * 0.55));
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.001, startTime);
      subGain.gain.linearRampToValueAtTime(level * 1.15, startTime + 0.006);
      subGain.gain.exponentialRampToValueAtTime(0.0008, boomEnd);
      subOsc.connect(subGain);
      subGain.connect(masterOut);
      trackOsc(subOsc, boomEnd + 0.04);

      // Dark lowpassed explosion noise tail
      const nBuf = createPinkNoiseBuffer(ctx, tailDur + 0.1, 707);
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = nBuf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, startTime);
      lp.frequency.exponentialRampToValueAtTime(220, boomEnd);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, startTime);
      nGain.gain.linearRampToValueAtTime(level * 1.05, startTime + 0.005);
      nGain.gain.exponentialRampToValueAtTime(0.0008, boomEnd);
      nSrc.connect(lp);
      lp.connect(nGain);
      nGain.connect(masterOut);
      trackBuf(nSrc, boomEnd + 0.05);
      break;
    }

    case 'Crash/Noise Hit': {
      const buf = createCrashBuffer(ctx, safeDur, 606);
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(900, startTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(level * 1.1, startTime);

      src.connect(hp);
      hp.connect(g);
      g.connect(masterOut);
      trackBuf(src, startTime + buf.duration + 0.02);
      break;
    }

    case 'Downlifter / Tape Stop Effect': {
      const tailDur = Math.min(Math.max(0.35, safeDur), 3.6);
      const stopEnd = startTime + tailDur;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.setValueAtTime(3.0, startTime);
      lp.frequency.setValueAtTime(4200, startTime);
      lp.frequency.exponentialRampToValueAtTime(75, stopEnd);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.linearRampToValueAtTime(level * 0.85, startTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, stopEnd);

      lp.connect(g);
      g.connect(masterOut);

      [392, 523.25].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(f, startTime);
        osc.frequency.exponentialRampToValueAtTime(42, stopEnd);
        osc.connect(lp);
        trackOsc(osc, stopEnd + 0.04);
      });

      const nBuf = createWhiteNoiseBuffer(ctx, tailDur + 0.05, 808);
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = nBuf;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.32, startTime);
      nGain.gain.exponentialRampToValueAtTime(0.001, stopEnd);
      nSrc.connect(nGain);
      nGain.connect(lp);
      trackBuf(nSrc, stopEnd + 0.04);
      break;
    }

    case 'Vinyl Crackle': {
      const buf = createVinylCrackleBuffer(ctx, safeDur, 505);
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2600, startTime);
      bp.Q.setValueAtTime(0.7, startTime);

      const fade = Math.min(0.18, safeDur * 0.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.linearRampToValueAtTime(level * 0.8, startTime + fade);
      g.gain.setValueAtTime(level * 0.8, Math.max(startTime + fade, endTime - fade));
      g.gain.linearRampToValueAtTime(0.0001, endTime);

      src.connect(bp);
      bp.connect(g);
      g.connect(masterOut);
      trackBuf(src, endTime + 0.03);
      break;
    }

    case 'Subtle Wind/Air Texture':
    default: {
      const buf = createPinkNoiseBuffer(ctx, safeDur + 0.1, 909);
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.setValueAtTime(1.8, startTime);
      bp.frequency.setValueAtTime(340, startTime);
      bp.frequency.linearRampToValueAtTime(1450, startTime + safeDur * 0.5);
      bp.frequency.linearRampToValueAtTime(420, endTime);

      const fade = Math.min(0.28, safeDur * 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, startTime);
      g.gain.linearRampToValueAtTime(level * 0.72, startTime + fade);
      g.gain.setValueAtTime(level * 0.72, Math.max(startTime + fade, endTime - fade));
      g.gain.linearRampToValueAtTime(0.0001, endTime);

      src.connect(bp);
      bp.connect(g);
      g.connect(masterOut);
      trackBuf(src, endTime + 0.04);
      break;
    }
  }

  return () => {
    try {
      masterOut.gain.setValueAtTime(0.0001, ctx.currentTime);
      masterOut.disconnect();
    } catch {
      // Ignore
    }
    for (const stop of stoppers) {
      stop();
    }
  };
}
