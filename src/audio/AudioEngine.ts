import type {
  BarMeter,
  CustomVoiceCue,
  MetronomeSettings,
  SectionArpConfig,
  SectionDrumsConfig,
  SectionFxConfig,
  SectionMultiPadConfig,
  SectionSynthConfig,
  TimelineBar,
} from '../types';
import { hasBeatSplits, shouldTriggerBarVoiceCueAndCount } from '../utils/chords';
import {
  BUNDLED_COUNT_CUES,
  BUNDLED_VOICE_CUES,
  getCustomVoiceCue,
  resolveBundledCueUrl,
  resolveCountCueUrl,
} from '../utils/voiceCues';
import {
  balanceToPan,
  scheduleChordSynth,
  scheduleCubaseClick,
  scheduleSubdivisionClicks,
} from './cubaseClick';

export interface ChordScheduleEvent {
  rawCtx: AudioContext;
  time: number;
  chordStr: string;
  semitones: number;
  durationSec: number;
  barDurationSec: number;
  beatDurationSec: number;
  beatsPerBar: number;
  effectiveMeter: BarMeter;
  effectiveBpm: number;
  isBarStart: boolean;
  sectionId: string;
  sectionBarNumber: number;
  sectionTotalBars: number;
  sectionMultiPad?: SectionMultiPadConfig;
  sectionSynth?: SectionSynthConfig;
  sectionArp?: SectionArpConfig;
  sectionDrums?: SectionDrumsConfig;
}

export interface BeatScheduleEvent {
  rawCtx: AudioContext;
  time: number;
  beatNum: number;
  beatsPerBar: number;
  beatDurationSec: number;
  barDurationSec: number;
  effectiveMeter: BarMeter;
  effectiveBpm: number;
  sectionId: string;
  sectionBarNumber: number;
  sectionTotalBars: number;
  sectionFx?: SectionFxConfig;
}

export interface PlaybackCallbacks {
  onBarChange: (timelineIndex: number, displayBarNumber: number, sectionId: string, beat: number, isCountIn: boolean) => void;
  onBeat: (beat: number, totalBeats: number, isCountIn: boolean) => void;
  onStop: () => void;
  onPlaybackStart?: (
    rawCtx: AudioContext,
    initialSeedChord?: { chordStr: string; semitones: number } | null
  ) => void;
  onChordSchedule?: (event: ChordScheduleEvent) => void;
  onBeatSchedule?: (event: BeatScheduleEvent) => void;
}

/**
 * Generates an in-memory 1-second silent PCM WAV Blob URL (0 audio samples).
 * Used on mobile (iOS Safari / Android Chrome) so the OS treats active playback
 * as an active media session and keeps background AudioContext + lock-screen controls alive.
 */
function createSilentWavBlobUrl(): string {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

export class ChordbookAudioEngine {
  private ctx: AudioContext | null = null;
  private timerId: number | null = null;
  private worker: Worker | null = null;
  private workerUrl: string | null = null;
  private isRunning = false;
  private timeline: TimelineBar[] = [];
  private currentStepIndex = 0;
  private currentBeatInBar = 0;
  private nextNoteTime = 0;
  private pendingStopAtTime: number | null = null;
  private speedPercent: 50 | 75 | 100 = 100;
  private globalTranspose = 0;
  private tempoOverride: number | null = null;
  private settings: MetronomeSettings;
  private callbacks: PlaybackCallbacks;
  private inCountIn = false;
  private countInBeat = 0;
  private countInTotalBeats = 4;
  private loopEnabled = false;
  private suppressBasicChord = false;
  private scheduledTimers: number[] = [];
  private lastUiBeatTime = 0;

  // Background Keep-Alive (Android & iOS)
  private keepAliveOsc: OscillatorNode | null = null;
  private keepAliveGain: GainNode | null = null;
  private silentAudioEl: HTMLAudioElement | null = null;
  private silentAudioUrl: string | null = null;

  // Decoded AudioBuffer caches for bundled MP3 cues, 1-7 count MP3s, and user cues
  private bundledBufferCache = new Map<string, AudioBuffer>();
  private bundledLoadPromises = new Map<string, Promise<AudioBuffer | null>>();
  private customBufferCache = new Map<string, AudioBuffer>();
  private activeVoiceSources = new Set<AudioBufferSourceNode>();

  constructor(settings: MetronomeSettings, callbacks: PlaybackCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange = (): void => {
    if (!this.isRunning) return;
    void this.resumeContextIfNeeded();
    // Pre-fill hardware lookahead buffer immediately on visibility transition
    this.scheduler();
  };

  private handleContextStateChange = (): void => {
    if (!this.isRunning || !this.ctx) return;
    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      void this.ctx.resume().catch(() => {});
    }
  };

  private async resumeContextIfNeeded(): Promise<void> {
    if (this.ctx) {
      const state = this.ctx.state as string;
      if (state === 'suspended' || state === 'interrupted') {
        try {
          await this.ctx.resume();
        } catch {
          // Ignore resume errors outside gesture
        }
      }
    }
    if (this.isRunning && this.silentAudioEl && this.silentAudioEl.paused) {
      void this.silentAudioEl.play().catch(() => {});
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.ctx.addEventListener('statechange', this.handleContextStateChange);
    }
    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private startBackgroundKeepAlive(ctx: AudioContext): void {
    // 1. Inaudible Web Audio oscillator keeps hardware audio clock running smoothly
    if (!this.keepAliveOsc) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(20, ctx.currentTime);
        gain.gain.setValueAtTime(0.00001, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        this.keepAliveOsc = osc;
        this.keepAliveGain = gain;
      } catch {
        // Ignore if oscillator creation fails
      }
    }

    // 2. Looping silent HTMLAudioElement keeps mobile OS media pipeline & MediaSession active
    if (typeof Audio !== 'undefined') {
      try {
        if (!this.silentAudioEl) {
          this.silentAudioUrl = createSilentWavBlobUrl();
          const audio = new Audio(this.silentAudioUrl);
          audio.loop = true;
          audio.volume = 0.01;
          audio.preload = 'auto';
          audio.setAttribute('playsinline', '');
          this.silentAudioEl = audio;
        }
        if (this.silentAudioEl.paused) {
          void this.silentAudioEl.play().catch(() => {});
        }
      } catch {
        // Ignore audio element errors
      }
    }
  }

  private stopBackgroundKeepAlive(): void {
    if (this.keepAliveOsc) {
      try {
        this.keepAliveOsc.stop();
        this.keepAliveOsc.disconnect();
      } catch {
        // Already stopped
      }
      this.keepAliveOsc = null;
    }
    if (this.keepAliveGain) {
      try {
        this.keepAliveGain.disconnect();
      } catch {
        // Ignore
      }
      this.keepAliveGain = null;
    }
    if (this.silentAudioEl) {
      try {
        this.silentAudioEl.pause();
        this.silentAudioEl.currentTime = 0;
      } catch {
        // Ignore
      }
    }
  }

  private startSchedulerTicker(): void {
    this.stopSchedulerTicker();

    // Prefer an inline Web Worker ticker so mobile background timer throttling doesn't stall lookahead
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
      try {
        const workerCode = `
          let id = null;
          self.onmessage = function(e) {
            if (e.data === 'start') {
              if (id !== null) clearInterval(id);
              id = setInterval(function() { self.postMessage('tick'); }, 25);
            } else if (e.data === 'stop') {
              if (id !== null) { clearInterval(id); id = null; }
            }
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(this.workerUrl);
        worker.onmessage = () => this.scheduler();
        worker.postMessage('start');
        this.worker = worker;
        return;
      } catch {
        // Fall back to window.setInterval
      }
    }

    this.timerId = window.setInterval(() => this.scheduler(), 25);
  }

  private stopSchedulerTicker(): void {
    if (this.worker) {
      try {
        this.worker.postMessage('stop');
        this.worker.terminate();
      } catch {
        // Ignore
      }
      this.worker = null;
    }
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = null;
    }
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private async loadBundledCueBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bundledBufferCache.has(url)) {
      return this.bundledBufferCache.get(url) || null;
    }
    const existingPromise = this.bundledLoadPromises.get(url);
    if (existingPromise) return existingPromise;

    const promise = (async () => {
      try {
        const ctx = this.ensureContext();
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
        this.bundledBufferCache.set(url, decoded);
        return decoded;
      } catch {
        return null;
      }
    })();

    this.bundledLoadPromises.set(url, promise);
    return promise;
  }

  private async loadCustomCueBuffer(cueId: string): Promise<AudioBuffer | null> {
    if (this.customBufferCache.has(cueId)) {
      return this.customBufferCache.get(cueId) || null;
    }
    try {
      const cue = await getCustomVoiceCue(cueId);
      if (!cue) return null;
      const ctx = this.ensureContext();
      const decoded = await ctx.decodeAudioData(cue.audioData.slice(0));
      this.customBufferCache.set(cueId, decoded);
      return decoded;
    } catch {
      return null;
    }
  }

  public invalidateCustomCueCache(cueId: string): void {
    this.customBufferCache.delete(cueId);
  }

  public preloadAllBundledCues(): void {
    for (const cue of BUNDLED_VOICE_CUES) {
      void this.loadBundledCueBuffer(cue.url);
    }
    for (const countCue of BUNDLED_COUNT_CUES) {
      void this.loadBundledCueBuffer(countCue.url);
    }
  }

  private playBufferWithVoiceMixer(buffer: AudioBuffer, time: number): void {
    if (!this.ctx || this.settings.voiceVolume <= 0) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(1.0, time); // Keep natural vocal pitch across 50%, 75%, 100%

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0, Math.min(1.5, this.settings.voiceVolume / 100)), time);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(balanceToPan(this.settings.voiceBalance), time);

    source.connect(gain);
    gain.connect(panner);
    panner.connect(this.ctx.destination);

    this.activeVoiceSources.add(source);
    source.onended = () => {
      this.activeVoiceSources.delete(source);
    };

    source.start(Math.max(this.ctx.currentTime, time));
  }

  private scheduleVoiceCue(time: number, cueLabel?: string, customCueId?: string): void {
    if (this.settings.voiceVolume <= 0) return;

    if (customCueId) {
      const cached = this.customBufferCache.get(customCueId);
      if (cached) {
        this.playBufferWithVoiceMixer(cached, time);
        return;
      }
      void this.loadCustomCueBuffer(customCueId).then((buf) => {
        if (buf && this.isRunning && this.ctx) {
          this.playBufferWithVoiceMixer(buf, Math.max(this.ctx.currentTime, time));
        }
      });
      return;
    }

    const url = resolveBundledCueUrl(cueLabel);
    if (!url) return;

    const cached = this.bundledBufferCache.get(url);
    if (cached) {
      this.playBufferWithVoiceMixer(cached, time);
      return;
    }

    void this.loadBundledCueBuffer(url).then((buf) => {
      if (buf && this.isRunning && this.ctx) {
        this.playBufferWithVoiceMixer(buf, Math.max(this.ctx.currentTime, time));
      }
    });
  }

  private scheduleCountNumber(time: number, countNumber: number): void {
    if (this.settings.voiceVolume <= 0) return;
    const url = resolveCountCueUrl(countNumber);
    const cached = this.bundledBufferCache.get(url);
    if (cached) {
      this.playBufferWithVoiceMixer(cached, time);
      return;
    }
    void this.loadBundledCueBuffer(url).then((buf) => {
      if (buf && this.isRunning && this.ctx) {
        this.playBufferWithVoiceMixer(buf, Math.max(this.ctx.currentTime, time));
      }
    });
  }

  public updateSettings(settings: MetronomeSettings): void {
    this.settings = settings;
  }

  public updateLiveParams(params: {
    speedPercent?: 50 | 75 | 100;
    globalTranspose?: number;
    tempoOverride?: number | null;
    timeline?: TimelineBar[];
    loopEnabled?: boolean;
    suppressBasicChord?: boolean;
  }): void {
    if (params.speedPercent !== undefined) this.speedPercent = params.speedPercent;
    if (params.globalTranspose !== undefined) this.globalTranspose = params.globalTranspose;
    if (params.tempoOverride !== undefined) this.tempoOverride = params.tempoOverride;
    if (params.timeline !== undefined) {
      this.timeline = params.timeline;
      if (this.currentStepIndex >= this.timeline.length) {
        this.currentStepIndex = 0;
      }
    }
    if (params.loopEnabled !== undefined) this.loopEnabled = params.loopEnabled;
    if (params.suppressBasicChord !== undefined) this.suppressBasicChord = params.suppressBasicChord;
  }

  public start(options: {
    timeline: TimelineBar[];
    startIndex: number;
    speedPercent: 50 | 75 | 100;
    globalTranspose: number;
    tempoOverride: number | null;
    loopEnabled: boolean;
    skipCountIn?: boolean;
  }): void {
    this.stop(false);
    if (!options.timeline.length) return;

    const ctx = this.ensureContext();
    this.timeline = options.timeline;
    this.currentStepIndex = Math.max(0, Math.min(options.startIndex, options.timeline.length - 1));
    this.currentBeatInBar = 0;
    this.pendingStopAtTime = null;
    this.speedPercent = options.speedPercent;
    this.globalTranspose = options.globalTranspose;
    this.tempoOverride = options.tempoOverride;
    this.loopEnabled = options.loopEnabled;

    // Preload all 16 voice cue MP3s, 1-7 count MP3s, and custom cues used in timeline
    this.preloadAllBundledCues();
    for (const step of this.timeline) {
      if (step.bar.customCueId) {
        void this.loadCustomCueBuffer(step.bar.customCueId);
      }
    }

    const firstBar = this.timeline[this.currentStepIndex];
    this.countInTotalBeats = firstBar?.beatsPerBar || 4;
    this.inCountIn = Boolean(this.settings.countInBar && !options.skipCountIn);
    this.countInBeat = 0;
    this.lastUiBeatTime = 0;

    this.isRunning = true;
    this.nextNoteTime = ctx.currentTime + 0.06;

    // Scan preceding bars so seeking directly to an empty bar still knows the preceding chord
    let initialSeedChord: { chordStr: string; semitones: number } | null = null;
    for (let i = this.currentStepIndex - 1; i >= 0; i--) {
      const prevStep = this.timeline[i];
      if (!prevStep) continue;
      const prevSemitones = this.globalTranspose + prevStep.sectionTranspose;
      if (hasBeatSplits(prevStep.bar) && prevStep.bar.beatChords) {
        let foundBeatChord: string | null = null;
        for (let b = prevStep.bar.beatChords.length - 1; b >= 0; b--) {
          const tok = (prevStep.bar.beatChords[b] || '').trim();
          if (tok && tok !== '-' && tok !== '—') {
            foundBeatChord = tok;
            break;
          }
        }
        if (foundBeatChord) {
          initialSeedChord = { chordStr: foundBeatChord, semitones: prevSemitones };
          break;
        }
      } else {
        const tok = (prevStep.bar.chord || '').trim();
        if (tok && tok !== '-' && tok !== '—') {
          initialSeedChord = { chordStr: tok, semitones: prevSemitones };
          break;
        }
      }
    }

    this.callbacks.onPlaybackStart?.(ctx, initialSeedChord);
    this.startBackgroundKeepAlive(ctx);
    this.scheduler();
    this.startSchedulerTicker();
  }

  public stop(notify = true): void {
    this.isRunning = false;
    this.currentStepIndex = 0;
    this.currentBeatInBar = 0;
    this.inCountIn = false;
    this.countInBeat = 0;
    this.pendingStopAtTime = null;
    this.lastUiBeatTime = 0;

    this.stopSchedulerTicker();
    this.stopBackgroundKeepAlive();

    for (const id of this.scheduledTimers) {
      clearTimeout(id);
    }
    this.scheduledTimers = [];
    for (const src of this.activeVoiceSources) {
      try {
        src.stop();
      } catch {
        // Already stopped
      }
    }
    this.activeVoiceSources.clear();

    if (notify) {
      this.callbacks.onStop();
    }
  }

  public destroy(): void {
    this.stop(false);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.ctx) {
      this.ctx.removeEventListener('statechange', this.handleContextStateChange);
    }
    if (this.silentAudioUrl) {
      URL.revokeObjectURL(this.silentAudioUrl);
      this.silentAudioUrl = null;
    }
    this.silentAudioEl = null;
  }

  public async testVoice(cueUrl = '/cues/chorus.mp3'): Promise<void> {
    const ctx = this.ensureContext();
    const buf = await this.loadBundledCueBuffer(cueUrl);
    if (buf) {
      this.playBufferWithVoiceMixer(buf, ctx.currentTime + 0.02);
    }
  }

  public async playCustomCue(cue: CustomVoiceCue): Promise<void> {
    const ctx = this.ensureContext();
    let buf = this.customBufferCache.get(cue.id);
    if (!buf) {
      try {
        buf = await ctx.decodeAudioData(cue.audioData.slice(0));
        this.customBufferCache.set(cue.id, buf);
      } catch {
        return;
      }
    }
    this.playBufferWithVoiceMixer(buf, ctx.currentTime + 0.02);
  }

  private playClick(time: number, isDownbeat: boolean, isSubdivision: boolean): void {
    if (!this.ctx || this.settings.clickVolume <= 0) return;
    scheduleCubaseClick(
      this.ctx,
      this.ctx.destination,
      time,
      isDownbeat,
      isSubdivision,
      this.settings.clickVolume,
      this.settings.clickBalance
    );
  }

  private playChord(
    time: number,
    chordStr: string,
    semitones: number,
    durationSec: number,
    beatDurationSec: number,
    effectiveBpm: number,
    step: TimelineBar,
    isBarStart: boolean
  ): void {
    if (!this.ctx) return;
    this.callbacks.onChordSchedule?.({
      rawCtx: this.ctx,
      time,
      chordStr,
      semitones,
      durationSec,
      barDurationSec: beatDurationSec * step.beatsPerBar,
      beatDurationSec,
      beatsPerBar: step.beatsPerBar,
      effectiveMeter: step.effectiveMeter,
      effectiveBpm,
      isBarStart,
      sectionId: step.sectionId,
      sectionBarNumber: step.sectionBarNumber,
      sectionTotalBars: step.sectionTotalBars,
      sectionMultiPad: step.sectionMultiPad,
      sectionSynth: step.sectionSynth,
      sectionArp: step.sectionArp,
      sectionDrums: step.sectionDrums,
    });
    if (this.suppressBasicChord || !this.settings.chordAudioEnabled || this.settings.chordVolume <= 0) {
      return;
    }
    scheduleChordSynth(
      this.ctx,
      this.ctx.destination,
      time,
      chordStr,
      semitones,
      durationSec,
      this.settings.chordVolume
    );
  }

  private scheduler(): void {
    if (!this.isRunning || !this.ctx) return;

    // Wait cleanly for the final scheduled beat of a non-looping song to finish playing
    if (this.pendingStopAtTime !== null) {
      if (this.ctx.currentTime >= this.pendingStopAtTime) {
        this.stop(true);
      }
      return;
    }

    // Resync gracefully if AudioContext was briefly halted by OS interruption (never burst)
    if (this.nextNoteTime < this.ctx.currentTime - 1.0) {
      this.nextNoteTime = this.ctx.currentTime + 0.04;
    }

    // Use a larger hardware lookahead when backgrounded/screen-locked so throttled wakeups never drop beats
    const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const scheduleAheadTime = isHidden ? 1.5 : 0.15;

    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      const currentStep = this.timeline[this.currentStepIndex];
      if (!currentStep) {
        this.stop(true);
        return;
      }

      const rawBpm = this.tempoOverride || currentStep.effectiveBpm || 92;
      const effectiveBpm = Math.max(10, Math.min(300, rawBpm * (this.speedPercent / 100)));
      const beatDurationSec = 60 / effectiveBpm;

      if (this.inCountIn) {
        const beatNum = this.countInBeat + 1;
        const scheduledTime = this.nextNoteTime;
        const stepIdxSnapshot = this.currentStepIndex;

        this.playClick(scheduledTime, beatNum === 1, false);
        scheduleSubdivisionClicks(
          this.ctx,
          this.ctx.destination,
          scheduledTime,
          beatDurationSec,
          this.settings.subdivision,
          this.settings.clickVolume,
          this.settings.clickBalance
        );
        // Play spoken MP3 count 1-7 for the count-in bar (e.g. 1-2-3-4 for 4/4, 1-2-3 for 3/4, 1-2-3-4-5-6 for 6/8)
        this.scheduleCountNumber(scheduledTime, beatNum);

        const delayMs = Math.max(0, (scheduledTime - this.ctx.currentTime) * 1000);
        const timer = window.setTimeout(() => {
          if (!this.isRunning || scheduledTime < this.lastUiBeatTime) return;
          this.lastUiBeatTime = scheduledTime;
          this.callbacks.onBarChange(
            stepIdxSnapshot,
            currentStep.displayBarNumber,
            currentStep.sectionId,
            beatNum,
            true
          );
          this.callbacks.onBeat(beatNum, this.countInTotalBeats, true);
        }, delayMs);
        this.scheduledTimers.push(timer);

        this.nextNoteTime += beatDurationSec;
        this.countInBeat += 1;
        if (this.countInBeat >= this.countInTotalBeats) {
          this.inCountIn = false;
          this.countInBeat = 0;
        }
        continue;
      }

      const beatIndex = this.currentBeatInBar;
      const beatNum = beatIndex + 1;
      const beatsInBar = currentStep.beatsPerBar;
      const scheduledTime = this.nextNoteTime;
      const stepIdxSnapshot = this.currentStepIndex;

      this.playClick(scheduledTime, beatNum === 1, false);
      const activeUnit = currentStep.bar.beatUnit || this.settings.subdivision;
      scheduleSubdivisionClicks(
        this.ctx,
        this.ctx.destination,
        scheduledTime,
        beatDurationSec,
        activeUnit,
        this.settings.clickVolume,
        this.settings.clickBalance
      );

      this.callbacks.onBeatSchedule?.({
        rawCtx: this.ctx,
        time: scheduledTime,
        beatNum,
        beatsPerBar: beatsInBar,
        beatDurationSec,
        barDurationSec: beatDurationSec * beatsInBar,
        effectiveMeter: currentStep.effectiveMeter,
        effectiveBpm,
        sectionId: currentStep.sectionId,
        sectionBarNumber: currentStep.sectionBarNumber,
        sectionTotalBars: currentStep.sectionTotalBars,
        sectionFx: currentStep.sectionFx,
      });

      const totalTranspose = this.globalTranspose + currentStep.sectionTranspose;
      if (hasBeatSplits(currentStep.bar) && currentStep.bar.beatChords) {
        const beatChord = (currentStep.bar.beatChords[beatIndex] || '').trim();
        if (beatChord && beatChord !== '-') {
          let holdBeats = 1;
          for (let nb = beatNum; nb < beatsInBar; nb++) {
            const nextVal = (currentStep.bar.beatChords[nb] || '').trim();
            if (nextVal && nextVal !== '-') break;
            holdBeats += 1;
          }
          this.playChord(
            scheduledTime,
            beatChord,
            totalTranspose,
            beatDurationSec * holdBeats,
            beatDurationSec,
            effectiveBpm,
            currentStep,
            beatNum === 1
          );
        } else if (beatNum === 1) {
          let emptyBeats = 1;
          for (let nb = beatNum; nb < beatsInBar; nb++) {
            const nextVal = (currentStep.bar.beatChords[nb] || '').trim();
            if (nextVal && nextVal !== '-') break;
            emptyBeats += 1;
          }
          // Ensure bar-boundary tracking & bar-range exits (and optional fill-empty-bar) use exact empty beat span
          this.playChord(
            scheduledTime,
            '-',
            totalTranspose,
            beatDurationSec * emptyBeats,
            beatDurationSec,
            effectiveBpm,
            currentStep,
            true
          );
        }
      } else if (beatNum === 1) {
        this.playChord(
          scheduledTime,
          currentStep.bar.chord,
          totalTranspose,
          beatDurationSec * beatsInBar,
          beatDurationSec,
          effectiveBpm,
          currentStep,
          true
        );
      }

      const allowLastBarVoice = shouldTriggerBarVoiceCueAndCount(currentStep);

      if (allowLastBarVoice && beatNum === 1 && (currentStep.bar.cue || currentStep.bar.customCueId)) {
        this.scheduleVoiceCue(scheduledTime, currentStep.bar.cue, currentStep.bar.customCueId);
      }

      // Play spoken MP3 counts 1-7 when Voice count is locked to this bar
      if (allowLastBarVoice && currentStep.bar.voiceCountLocked) {
        const countPattern = (currentStep.bar.countingSystem || '1 1 1 1')
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean);
        const countToken = countPattern[(beatNum - 1) % Math.max(1, countPattern.length)] || String(beatNum);
        const parsedCount = parseInt(countToken, 10);
        if (!Number.isNaN(parsedCount) && parsedCount >= 1 && parsedCount <= 7) {
          this.scheduleCountNumber(scheduledTime, parsedCount);
        }
      }

      const delayMs = Math.max(0, (scheduledTime - this.ctx.currentTime) * 1000);
      const timer = window.setTimeout(() => {
        if (!this.isRunning || scheduledTime < this.lastUiBeatTime) return;
        this.lastUiBeatTime = scheduledTime;
        this.callbacks.onBarChange(
          stepIdxSnapshot,
          currentStep.displayBarNumber,
          currentStep.sectionId,
          beatNum,
          false
        );
        this.callbacks.onBeat(beatNum, beatsInBar, false);
      }, delayMs);
      this.scheduledTimers.push(timer);

      this.nextNoteTime += beatDurationSec;
      this.currentBeatInBar += 1;

      if (this.currentBeatInBar >= beatsInBar) {
        this.currentBeatInBar = 0;
        this.currentStepIndex += 1;
        if (this.currentStepIndex >= this.timeline.length) {
          if (this.loopEnabled) {
            this.currentStepIndex = 0;
          } else {
            this.pendingStopAtTime = this.nextNoteTime;
            const endDelay = Math.max(0, (this.nextNoteTime - this.ctx.currentTime) * 1000);
            const stopTimer = window.setTimeout(() => {
              if (this.isRunning) this.stop(true);
            }, endDelay);
            this.scheduledTimers.push(stopTimer);
            return;
          }
        }
      }
    }
  }
}
