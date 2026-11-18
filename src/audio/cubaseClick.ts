import { Mp3Encoder } from '@breezystack/lamejs';
import type {
  BalanceSide,
  BeatUnit,
  ExportAudioMixMode,
  MetronomeSettings,
  Song,
  TimelineBar,
} from '../types';
import { buildSongTimeline, chordToMidiNotes, hasBeatSplits } from '../utils/chords';
import {
  getCustomVoiceCue,
  resolveBundledCueUrl,
  resolveCountCueUrl,
} from '../utils/voiceCues';

export function balanceToPan(side: BalanceSide): number {
  if (side === 'Left') return -0.85;
  if (side === 'Right') return 0.85;
  return 0;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Shared Cubase-style wooden/digital metronome click synthesizer.
 * Works identically on both live AudioContext and OfflineAudioContext.
 */
export function scheduleCubaseClick(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  isDownbeat: boolean,
  isSubdivision: boolean,
  clickVolume: number,
  clickBalance: BalanceSide
): void {
  if (clickVolume <= 0) return;

  const baseLevel = clickVolume / 100;
  const vol = baseLevel * (isSubdivision ? 0.36 : isDownbeat ? 0.96 : 0.68);

  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(balanceToPan(clickBalance), time);
  panner.connect(destination);

  // Primary woody/digital body oscillator
  const bodyOsc = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  bodyOsc.type = isSubdivision ? 'sine' : 'triangle';

  const startFreq = isSubdivision ? 880 : isDownbeat ? 1760 : 1175;
  const endFreq = isSubdivision ? 600 : isDownbeat ? 1160 : 780;
  const decaySec = isSubdivision ? 0.018 : isDownbeat ? 0.028 : 0.023;

  bodyOsc.frequency.setValueAtTime(startFreq, time);
  bodyOsc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.015);

  bodyGain.gain.setValueAtTime(0.0001, time);
  bodyGain.gain.linearRampToValueAtTime(vol, time + 0.0006);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + decaySec);

  bodyOsc.connect(bodyGain);
  bodyGain.connect(panner);

  bodyOsc.start(time);
  bodyOsc.stop(time + decaySec + 0.005);

  // Crisp Cubase high-transient snap on main beats
  if (!isSubdivision) {
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'sine';
    const snapStart = isDownbeat ? 3350 : 2350;
    const snapEnd = isDownbeat ? 1850 : 1320;
    snapOsc.frequency.setValueAtTime(snapStart, time);
    snapOsc.frequency.exponentialRampToValueAtTime(snapEnd, time + 0.007);

    snapGain.gain.setValueAtTime(0.0001, time);
    snapGain.gain.linearRampToValueAtTime(vol * (isDownbeat ? 0.45 : 0.32), time + 0.0004);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.009);

    snapOsc.connect(snapGain);
    snapGain.connect(panner);

    snapOsc.start(time);
    snapOsc.stop(time + 0.012);
  }
}

export function scheduleSubdivisionClicks(
  ctx: BaseAudioContext,
  destination: AudioNode,
  beatStartTime: number,
  beatDurationSec: number,
  unit: BeatUnit,
  clickVolume: number,
  clickBalance: BalanceSide
): void {
  if (unit === 'Eighth') {
    scheduleCubaseClick(
      ctx,
      destination,
      beatStartTime + beatDurationSec * 0.5,
      false,
      true,
      clickVolume,
      clickBalance
    );
  } else if (unit === 'Dotted') {
    scheduleCubaseClick(
      ctx,
      destination,
      beatStartTime + beatDurationSec * 0.75,
      false,
      true,
      clickVolume,
      clickBalance
    );
  } else if (unit === 'Triplet') {
    scheduleCubaseClick(
      ctx,
      destination,
      beatStartTime + beatDurationSec / 3,
      false,
      true,
      clickVolume,
      clickBalance
    );
    scheduleCubaseClick(
      ctx,
      destination,
      beatStartTime + (beatDurationSec * 2) / 3,
      false,
      true,
      clickVolume,
      clickBalance
    );
  }
}

export function scheduleChordSynth(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  chordStr: string,
  semitones: number,
  durationSec: number,
  chordVolume: number
): void {
  if (chordVolume <= 0) return;
  const notes = chordToMidiNotes(chordStr, semitones);
  if (!notes.length) return;

  const vol = (chordVolume / 100) * 0.14;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1650, time);

  const masterGain = ctx.createGain();
  const safeDur = Math.max(0.12, durationSec);
  const tailDur = Math.min(safeDur, 1.85);

  masterGain.gain.setValueAtTime(0.0001, time);
  masterGain.gain.linearRampToValueAtTime(vol, time + 0.025);
  masterGain.gain.exponentialRampToValueAtTime(vol * 0.45, time + Math.min(tailDur * 0.85, 1.5));
  masterGain.gain.exponentialRampToValueAtTime(0.0001, time + tailDur);

  filter.connect(masterGain);
  masterGain.connect(destination);

  for (const midi of notes) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(midiToFreq(midi), time);
    osc.connect(filter);
    osc.start(time);
    osc.stop(time + tailDur + 0.05);
  }
}

export function estimateSongDurationSeconds(song: Song, countInBar: boolean): number {
  const timeline = buildSongTimeline(song, {}, null);
  if (!timeline.length) return 0;

  let totalSec = 0;
  if (countInBar) {
    const first = timeline[0];
    const beatSec = 60 / Math.max(10, Math.min(300, first.effectiveBpm || song.bpm));
    totalSec += beatSec * first.beatsPerBar;
  }

  for (const step of timeline) {
    const bpm = Math.max(10, Math.min(300, step.effectiveBpm || song.bpm));
    const beatSec = 60 / bpm;
    totalSec += beatSec * step.beatsPerBar;
  }

  return totalSec;
}

interface ScheduledBeatEvent {
  time: number;
  beatDurationSec: number;
  beatNum: number;
  beatsInBar: number;
  isCountIn: boolean;
  step: TimelineBar;
}

export async function renderSongAudioOffline(options: {
  song: Song;
  settings: MetronomeSettings;
  mixMode: ExportAudioMixMode;
  onProgress?: (pct: number, stage: string) => void;
}): Promise<AudioBuffer> {
  const { song, settings, mixMode, onProgress } = options;
  const sampleRate = 44100;
  const timeline = buildSongTimeline(song, {}, null);
  if (!timeline.length) {
    throw new Error('This song has no bars to export.');
  }

  onProgress?.(5, 'Preparing timeline...');

  // Collect all unique audio URLs & custom cue IDs needed across the entire song
  const neededUrls = new Set<string>();
  const neededCustomIds = new Set<string>();

  if (settings.countInBar) {
    const firstBeats = timeline[0].beatsPerBar;
    for (let b = 1; b <= firstBeats; b++) {
      neededUrls.add(resolveCountCueUrl(b));
    }
  }

  for (const step of timeline) {
    if (step.bar.customCueId) {
      neededCustomIds.add(step.bar.customCueId);
    } else if (step.bar.cue) {
      const url = resolveBundledCueUrl(step.bar.cue);
      if (url) neededUrls.add(url);
    }

    if (step.bar.voiceCountLocked) {
      const pattern = (step.bar.countingSystem || '1 1 1 1')
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
      for (let b = 1; b <= step.beatsPerBar; b++) {
        const token = pattern[(b - 1) % Math.max(1, pattern.length)] || String(b);
        const parsed = parseInt(token, 10);
        if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 7) {
          neededUrls.add(resolveCountCueUrl(parsed));
        }
      }
    }
  }

  // Decode all required voice cue and count MP3 buffers
  const decodeCtx = new OfflineAudioContext(2, 1, sampleRate);
  const urlBuffers = new Map<string, AudioBuffer>();
  const customBuffers = new Map<string, AudioBuffer>();

  const totalAssets = neededUrls.size + neededCustomIds.size;
  let loadedAssets = 0;

  for (const url of neededUrls) {
    onProgress?.(
      10 + Math.round((loadedAssets / Math.max(1, totalAssets)) * 25),
      'Decoding studio voice cues...'
    );
    try {
      const res = await fetch(url);
      if (res.ok) {
        const arr = await res.arrayBuffer();
        const decoded = await decodeCtx.decodeAudioData(arr.slice(0));
        urlBuffers.set(url, decoded);
      }
    } catch {
      // Skip unavailable asset gracefully
    }
    loadedAssets += 1;
  }

  for (const cueId of neededCustomIds) {
    onProgress?.(
      10 + Math.round((loadedAssets / Math.max(1, totalAssets)) * 25),
      'Decoding custom voice cues...'
    );
    try {
      const cue = await getCustomVoiceCue(cueId);
      if (cue) {
        const decoded = await decodeCtx.decodeAudioData(cue.audioData.slice(0));
        customBuffers.set(cueId, decoded);
      }
    } catch {
      // Skip unreadable custom cue
    }
    loadedAssets += 1;
  }

  onProgress?.(40, 'Scheduling sample-accurate timeline...');

  // Build exact beat schedule from Count-in + Bar 1 to final bar
  let cursorTime = 0.04; // Tiny 40ms lead-in so first transient isn't clipped
  const events: ScheduledBeatEvent[] = [];

  if (settings.countInBar) {
    const first = timeline[0];
    const countBpm = Math.max(10, Math.min(300, first.effectiveBpm || song.bpm));
    const beatSec = 60 / countBpm;
    for (let b = 1; b <= first.beatsPerBar; b++) {
      events.push({
        time: cursorTime,
        beatDurationSec: beatSec,
        beatNum: b,
        beatsInBar: first.beatsPerBar,
        isCountIn: true,
        step: first,
      });
      cursorTime += beatSec;
    }
  }

  for (const step of timeline) {
    const bpm = Math.max(10, Math.min(300, step.effectiveBpm || song.bpm));
    const beatSec = 60 / bpm;
    for (let b = 1; b <= step.beatsPerBar; b++) {
      events.push({
        time: cursorTime,
        beatDurationSec: beatSec,
        beatNum: b,
        beatsInBar: step.beatsPerBar,
        isCountIn: false,
        step,
      });
      cursorTime += beatSec;
    }
  }

  const tailSec = 1.6;
  const totalSamples = Math.max(sampleRate, Math.ceil((cursorTime + tailSec) * sampleRate));
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  const scheduleVoiceBuffer = (buf: AudioBuffer | undefined, time: number) => {
    if (!buf || settings.voiceVolume <= 0) return;
    const src = offlineCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(1.0, time);

    const gain = offlineCtx.createGain();
    gain.gain.setValueAtTime(Math.max(0, Math.min(1.5, settings.voiceVolume / 100)), time);

    const panner = offlineCtx.createStereoPanner();
    panner.pan.setValueAtTime(balanceToPan(settings.voiceBalance), time);

    src.connect(gain);
    gain.connect(panner);
    panner.connect(offlineCtx.destination);
    src.start(time);
  };

  for (const ev of events) {
    const activeUnit = ev.isCountIn
      ? settings.subdivision
      : ev.step.bar.beatUnit || settings.subdivision;

    // 1. Cubase-style click + subdivisions
    scheduleCubaseClick(
      offlineCtx,
      offlineCtx.destination,
      ev.time,
      ev.beatNum === 1,
      false,
      settings.clickVolume,
      settings.clickBalance
    );
    scheduleSubdivisionClicks(
      offlineCtx,
      offlineCtx.destination,
      ev.time,
      ev.beatDurationSec,
      activeUnit,
      settings.clickVolume,
      settings.clickBalance
    );

    if (ev.isCountIn) {
      // Count-in 1..N voice MP3
      scheduleVoiceBuffer(urlBuffers.get(resolveCountCueUrl(ev.beatNum)), ev.time);
      continue;
    }

    // 2. Bar beat 1 voice cue (bundled or custom recorded/imported)
    if (ev.beatNum === 1) {
      if (ev.step.bar.customCueId) {
        scheduleVoiceBuffer(customBuffers.get(ev.step.bar.customCueId), ev.time);
      } else if (ev.step.bar.cue) {
        const url = resolveBundledCueUrl(ev.step.bar.cue);
        if (url) scheduleVoiceBuffer(urlBuffers.get(url), ev.time);
      }
    }

    // 3. Locked Bar Counting System 1..7 MP3
    if (ev.step.bar.voiceCountLocked) {
      const pattern = (ev.step.bar.countingSystem || '1 1 1 1')
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
      const token = pattern[(ev.beatNum - 1) % Math.max(1, pattern.length)] || String(ev.beatNum);
      const parsed = parseInt(token, 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 7) {
        scheduleVoiceBuffer(urlBuffers.get(resolveCountCueUrl(parsed)), ev.time);
      }
    }

    // 4. Optional Chords in Full Mix mode (supports beat split chords!)
    if (mixMode === 'full-mix' && settings.chordVolume > 0) {
      const totalTranspose = (song.transpose || 0) + ev.step.sectionTranspose;
      if (hasBeatSplits(ev.step.bar) && ev.step.bar.beatChords) {
        const beatChord = (ev.step.bar.beatChords[ev.beatNum - 1] || '').trim();
        if (beatChord && beatChord !== '-') {
          // Hold until next non-empty beat chord or end of bar
          let holdBeats = 1;
          for (let nb = ev.beatNum; nb < ev.beatsInBar; nb++) {
            const nextVal = (ev.step.bar.beatChords[nb] || '').trim();
            if (nextVal && nextVal !== '-') break;
            holdBeats += 1;
          }
          scheduleChordSynth(
            offlineCtx,
            offlineCtx.destination,
            ev.time,
            beatChord,
            totalTranspose,
            ev.beatDurationSec * holdBeats,
            settings.chordVolume
          );
        }
      } else if (ev.beatNum === 1) {
        scheduleChordSynth(
          offlineCtx,
          offlineCtx.destination,
          ev.time,
          ev.step.bar.chord,
          totalTranspose,
          ev.beatDurationSec * ev.beatsInBar,
          settings.chordVolume
        );
      }
    }
  }

  onProgress?.(60, 'Rendering offline audio mix...');
  const rendered = await offlineCtx.startRendering();
  onProgress?.(78, 'Audio rendered, preparing file...');
  return rendered;
}

/**
 * Encodes a Stereo AudioBuffer into standard 16-bit PCM RIFF WAV ready for Cubase.
 */
export function encodeAudioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;
  let offset = 44;

  for (let i = 0; i < length; i++) {
    const lSample = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(offset, lSample < 0 ? lSample * 0x8000 : lSample * 0x7fff, true);
    offset += 2;
    if (numChannels > 1) {
      const rSample = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(offset, rSample < 0 ? rSample * 0x8000 : rSample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function floatTo16BitIntArray(floatData: Float32Array): Int16Array {
  const out = new Int16Array(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    const s = Math.max(-1, Math.min(1, floatData[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/**
 * Encodes a Stereo AudioBuffer into a 192 kbps MP3 file using @breezystack/lamejs.
 */
export async function encodeAudioBufferToMp3Blob(
  buffer: AudioBuffer,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const encoder = new Mp3Encoder(numChannels, buffer.sampleRate, 192);

  const leftInt = floatTo16BitIntArray(buffer.getChannelData(0));
  const rightInt =
    numChannels > 1 ? floatTo16BitIntArray(buffer.getChannelData(1)) : leftInt;

  const blockSize = 1152 * 32;
  const mp3Parts: Uint8Array<ArrayBuffer>[] = [];

  for (let i = 0; i < leftInt.length; i += blockSize) {
    const leftChunk = leftInt.subarray(i, i + blockSize);
    const rightChunk = rightInt.subarray(i, i + blockSize);
    const encoded =
      numChannels > 1
        ? encoder.encodeBuffer(leftChunk, rightChunk)
        : encoder.encodeBuffer(leftChunk);
    if (encoded.length > 0) {
      mp3Parts.push(new Uint8Array(encoded));
    }
    const pct = Math.min(98, 78 + Math.round((i / Math.max(1, leftInt.length)) * 20));
    onProgress?.(pct);
    // Yield to UI thread so progress bar animates smoothly on mobile
    await new Promise((r) => setTimeout(r, 0));
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Parts.push(new Uint8Array(flushed));
  }

  onProgress?.(100);
  return new Blob(mp3Parts, { type: 'audio/mpeg' });
}
