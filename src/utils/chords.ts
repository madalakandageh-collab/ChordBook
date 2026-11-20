import type {
  ArpLayerEntry,
  AudioExportFormat,
  Bar,
  BarMeter,
  BarRange,
  DrumFillFrequency,
  DrumLayerEntry,
  FxLayerEntry,
  LastBarCuePassRule,
  PadLayerEntry,
  Section,
  SectionArpConfig,
  SectionDrumsConfig,
  SectionFxConfig,
  SectionMultiPadConfig,
  SectionSynthConfig,
  Setlist,
  Song,
  SynthLayerEntry,
  TimelineBar,
} from '../types';

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_INDEX: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

const DISPLAY_FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export function normalizeRootIndex(note: string): number | null {
  const idx = NOTE_TO_INDEX[note];
  return typeof idx === 'number' ? idx : null;
}

export function transposeNote(note: string, semitones: number, preferFlats = false): string {
  const idx = normalizeRootIndex(note);
  if (idx === null) return note;
  const wrapped = ((idx + semitones) % 12 + 12) % 12;
  if (preferFlats) {
    return FLAT_SCALE[wrapped];
  }
  // Common stage-friendly spellings: C#, Eb, F#, Ab, Bb
  const stageScale = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  return stageScale[wrapped];
}

export function transposeChord(chord: string, semitones: number, targetKey?: string): string {
  const trimmed = chord.trim();
  if (!trimmed || trimmed === '-' || trimmed === '—' || semitones === 0) {
    return trimmed === '-' ? '—' : trimmed;
  }

  const preferFlats = targetKey ? DISPLAY_FLAT_KEYS.has(targetKey) : false;

  // Handle slash chords e.g. G/B, Dm7/C
  const slashParts = trimmed.split('/');
  const mainPart = slashParts[0];
  const bassPart = slashParts[1];

  const mainMatch = mainPart.match(/^([A-G][#b]?)(.*)$/);
  if (!mainMatch) return trimmed;

  const newRoot = transposeNote(mainMatch[1], semitones, preferFlats);
  let result = `${newRoot}${mainMatch[2]}`;

  if (bassPart) {
    const bassMatch = bassPart.match(/^([A-G][#b]?)(.*)$/);
    if (bassMatch) {
      const newBass = transposeNote(bassMatch[1], semitones, preferFlats);
      result += `/${newBass}${bassMatch[2]}`;
    } else {
      result += `/${bassPart}`;
    }
  }

  return result;
}

export function transposeKey(baseKey: string, semitones: number): string {
  const trimmed = (baseKey || '').trim();
  if (!trimmed || semitones === 0) return trimmed;
  const match = trimmed.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return trimmed;
  const newRoot = transposeNote(match[1], semitones, false);
  return `${newRoot}${match[2]}`;
}

export function formatChordDisplay(chord: string): string {
  if (!chord || chord.trim() === '' || chord.trim() === '-') {
    return '—';
  }
  return chord.trim();
}

export interface ParsedSlashChord {
  main: string;
  bass: string | null;
}

export function splitSlashChord(chord: string): ParsedSlashChord {
  const clean = formatChordDisplay(chord);
  if (clean === '—') {
    return { main: '—', bass: null };
  }
  const slashIdx = clean.indexOf('/');
  if (slashIdx > 0 && slashIdx < clean.length - 1) {
    const main = clean.slice(0, slashIdx).trim();
    const bass = clean.slice(slashIdx + 1).trim();
    if (main && bass) {
      return { main, bass };
    }
  }
  return { main: clean, bass: null };
}

export function parseMeterBeats(meter: BarMeter | string): number {
  const [numStr] = (meter || '4/4').split('/');
  const num = parseInt(numStr, 10);
  if (Number.isNaN(num) || num < 1) return 4;
  return num;
}

export function formatPassOrdinal(pass: number): string {
  const mod100 = pass % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${pass}th`;
  switch (pass % 10) {
    case 1:
      return `${pass}st`;
    case 2:
      return `${pass}nd`;
    case 3:
      return `${pass}rd`;
    default:
      return `${pass}th`;
  }
}

export function formatLastBarCuePassRuleLabel(
  rule: LastBarCuePassRule | undefined,
  repeatCount = 2
): string {
  if (!rule || rule === 'all') return 'All times';
  if (rule === 'first' || rule === 1) return '1st time only';
  if (rule === 'last') {
    return repeatCount <= 2
      ? '2nd time only (Last time)'
      : `${formatPassOrdinal(repeatCount)} time only (Last time)`;
  }
  if (typeof rule === 'number') {
    return rule === repeatCount
      ? `${formatPassOrdinal(rule)} time only (Last time)`
      : `${formatPassOrdinal(rule)} time only`;
  }
  return 'All times';
}

export function formatLastBarCuePassPrintBadge(
  rule: LastBarCuePassRule | undefined,
  repeatCount = 2
): string | null {
  if (!rule || rule === 'all') return null;
  if (rule === 'first' || rule === 1) return '(1st x)';
  if (rule === 'last') {
    return repeatCount <= 2 ? '(2nd x)' : '(Last time)';
  }
  if (typeof rule === 'number') {
    return `(${formatPassOrdinal(rule)} x)`;
  }
  return null;
}

export function shouldTriggerBarVoiceCueAndCount(step: TimelineBar): boolean {
  if (!step.isLastBarOfSection || (step.sectionTotalPasses ?? 1) <= 1) {
    return true;
  }
  const pass = step.sectionPass ?? 1;
  const total = step.sectionTotalPasses ?? 2;
  const rule = step.lastBarCuePassRule ?? 'all';
  if (rule === 'all') return true;
  if (rule === 'first') return pass === 1;
  if (rule === 'last') return pass === total;
  if (typeof rule === 'number') return pass === rule;
  return true;
}

export function getSectionTotalBars(
  section?: { bars?: Bar[] | null; isReference?: boolean } | null
): number {
  if (!section || section.isReference || !Array.isArray(section.bars) || section.bars.length === 0) {
    return 0;
  }
  return section.bars.reduce(
    (bAcc, bar) => bAcc + (bar?.repeat && bar.repeat > 1 ? bar.repeat : 1),
    0
  );
}

export function getSongTotalBars(song?: Partial<Song> | null): number {
  if (!song || !Array.isArray(song.sections)) return 0;
  return song.sections.reduce((acc, sec) => acc + getSectionTotalBars(sec), 0);
}

export function getEffectiveBarRanges(
  config:
    | {
        barRangeMode?: 'all' | 'custom';
        startBar?: number;
        endBar?: number;
        barRanges?: BarRange[];
      }
    | undefined,
  sectionTotalBars: number
): BarRange[] {
  const maxBar = Math.max(1, sectionTotalBars);
  if (!config || !config.barRangeMode || config.barRangeMode === 'all') {
    return [{ startBar: 1, endBar: maxBar }];
  }
  const rawList: BarRange[] =
    Array.isArray(config.barRanges) && config.barRanges.length > 0
      ? config.barRanges
      : [{ startBar: config.startBar ?? 1, endBar: config.endBar ?? maxBar }];

  return rawList.map((r) => {
    const startBar = Math.max(1, Math.min(maxBar, Number(r?.startBar) || 1));
    const endBar = Math.max(startBar, Math.min(maxBar, Number(r?.endBar) || maxBar));
    return { startBar, endBar };
  });
}

export function formatMultiBarRangesLabel(
  config:
    | {
        barRangeMode?: 'all' | 'custom';
        startBar?: number;
        endBar?: number;
        barRanges?: BarRange[];
      }
    | undefined,
  sectionTotalBars: number
): string {
  if (!config?.barRangeMode || config.barRangeMode === 'all') {
    return 'All Bars';
  }
  const ranges = getEffectiveBarRanges(config, sectionTotalBars);
  const parts = ranges.map((r) =>
    r.startBar === r.endBar ? `Bar ${r.startBar}` : `Bars ${r.startBar}–${r.endBar}`
  );
  return parts.join(', ');
}

export function isBarInSectionLayerRange(
  config:
    | {
        enabled?: boolean;
        barRangeMode?: 'all' | 'custom';
        startBar?: number;
        endBar?: number;
        barRanges?: BarRange[];
      }
    | undefined,
  sectionBarNumber: number,
  sectionTotalBars: number
): boolean {
  if (!config?.enabled) return false;
  if (!config.barRangeMode || config.barRangeMode === 'all') return true;
  const ranges = getEffectiveBarRanges(config, sectionTotalBars);
  return ranges.some((r) => sectionBarNumber >= r.startBar && sectionBarNumber <= r.endBar);
}

export function getNormalizedPadLayers(config?: SectionMultiPadConfig): PadLayerEntry[] {
  if (!config) return [];
  if (Array.isArray(config.layers) && config.layers.length > 0) {
    return config.layers;
  }
  return [
    {
      id: 'pad-layer-1',
      enabled: Boolean(config.enabled),
      pattern: config.pattern || 'Sustain',
      tone: config.tone || 'Warm Analog Pad',
      volumeDb: config.volumeDb ?? 0,
      barRangeMode: config.barRangeMode || 'all',
      startBar: config.startBar,
      endBar: config.endBar,
      barRanges: config.barRanges,
    },
  ];
}

export function getNormalizedSynthLayers(config?: SectionSynthConfig): SynthLayerEntry[] {
  if (!config) return [];
  if (Array.isArray(config.layers) && config.layers.length > 0) {
    return config.layers;
  }
  return [
    {
      id: 'synth-layer-1',
      enabled: Boolean(config.enabled),
      pattern: config.pattern || 'Full Chord',
      tone: config.tone || 'FM Electric Piano',
      volumeDb: config.volumeDb ?? 0,
      barRangeMode: config.barRangeMode || 'all',
      startBar: config.startBar,
      endBar: config.endBar,
      barRanges: config.barRanges,
    },
  ];
}

export function getNormalizedArpLayers(config?: SectionArpConfig): ArpLayerEntry[] {
  if (!config) return [];
  if (Array.isArray(config.layers) && config.layers.length > 0) {
    return config.layers;
  }
  return [
    {
      id: 'arp-layer-1',
      enabled: Boolean(config.enabled),
      pattern: config.pattern || 'upDown',
      tone: config.tone || 'Synth Pluck Arp',
      subdivision: config.subdivision || '8n',
      volumeDb: config.volumeDb ?? 0,
      barRangeMode: config.barRangeMode || 'all',
      startBar: config.startBar,
      endBar: config.endBar,
      barRanges: config.barRanges,
    },
  ];
}

export function getNormalizedDrumLayers(config?: SectionDrumsConfig): DrumLayerEntry[] {
  if (!config) return [];
  if (Array.isArray(config.layers) && config.layers.length > 0) {
    return config.layers;
  }
  return [
    {
      id: 'drum-layer-1',
      enabled: true,
      kit: config.kit || 'Acoustic Pop Kit',
      pattern: config.pattern || 'Straight 8th Pop',
      volumeDb: config.volumeDb ?? 0,
      barRangeMode: config.barRangeMode || 'all',
      startBar: config.startBar,
      endBar: config.endBar,
      barRanges: config.barRanges,
      fillFrequency: config.fillFrequency || 'none',
      customFillBars: config.customFillBars || [],
      fillStyle: config.fillStyle || 'Tom Fill Cascade',
    },
  ];
}

export function getNormalizedFxLayers(config?: SectionFxConfig): FxLayerEntry[] {
  if (!config || !Array.isArray(config.effects)) return [];
  return config.effects.map((fx, idx) => ({
    id: fx.id || `fx-layer-${idx + 1}`,
    enabled: Boolean(fx.enabled),
    effectType: fx.effectType || 'White Noise Riser',
    startBar: Math.max(1, Math.round(Number(fx.startBar) || 1)),
    startBeat: Math.max(1, Math.round(Number(fx.startBeat) || 1)),
    durationBars: Math.max(0.25, Number(fx.durationBars) || 1),
    volumeDb: Number.isFinite(Number(fx.volumeDb)) ? Number(fx.volumeDb) : 0,
  }));
}

export function buildExportAudioFilename(
  title: string,
  baseKey: string,
  transpose = 0,
  format: AudioExportFormat = 'wav'
): string {
  const safeTitle =
    (title || 'Untitled Song')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled Song';
  const effectiveKey =
    transposeKey(baseKey || 'C', transpose || 0)
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim() || 'C';
  return `${safeTitle} - Key ${effectiveKey}.${format}`;
}

export function shouldTriggerDrumFill(
  config:
    | {
        fillFrequency?: DrumFillFrequency;
        customFillBars?: number[];
      }
    | undefined,
  sectionBarNumber: number,
  sectionTotalBars: number
): boolean {
  if (!config) return false;
  if (
    Array.isArray(config.customFillBars) &&
    config.customFillBars.some((b) => Math.round(b) === sectionBarNumber)
  ) {
    return true;
  }
  const freq = config.fillFrequency || 'none';
  switch (freq) {
    case 'every4':
      return sectionBarNumber >= 4 && sectionBarNumber % 4 === 0;
    case 'every8':
      return sectionBarNumber >= 8 && sectionBarNumber % 8 === 0;
    case 'last1':
      return sectionBarNumber === sectionTotalBars;
    case 'last2':
      return sectionTotalBars >= 2
        ? sectionBarNumber >= sectionTotalBars - 1
        : sectionBarNumber === sectionTotalBars;
    case 'none':
    default:
      return false;
  }
}

export function buildSongTimeline(
  song: Song,
  sectionTransposes: Record<string, number> = {},
  loopSectionId: string | null = null
): TimelineBar[] {
  const timeline: TimelineBar[] = [];
  if (!song || !Array.isArray(song.sections)) return timeline;
  let displayBarCounter = 0;

  for (const section of song.sections) {
    if (!section || section.isReference || !Array.isArray(section.bars) || section.bars.length === 0) {
      continue;
    }

    const secTranspose = sectionTransposes[section.id] ?? section.transpose ?? 0;
    const sectionStartBarNum = displayBarCounter + 1;
    const sectionPasses = section.repeat ? Math.max(2, section.repeatCount ?? 2) : 1;

    let sectionBarSpan = 0;
    for (const b of section.bars) {
      sectionBarSpan += b.repeat && b.repeat > 1 ? b.repeat : 1;
    }

    for (let pass = 1; pass <= sectionPasses; pass++) {
      let localBarOffset = 0;
      for (let barIdx = 0; barIdx < section.bars.length; barIdx++) {
        const bar = section.bars[barIdx];
        const isLastBarOfSection = barIdx === section.bars.length - 1;
        const repeats = bar.repeat && bar.repeat > 1 ? bar.repeat : 1;
        for (let r = 1; r <= repeats; r++) {
          localBarOffset += 1;
          const barNumForStep = sectionStartBarNum + localBarOffset - 1;
          if (loopSectionId && section.id !== loopSectionId) {
            continue;
          }
          const effectiveMeter = (bar.meter || song.timeSignature) as BarMeter;
          const effectiveBpm = bar.tempo || song.bpm;
          timeline.push({
            globalBarIndex: timeline.length,
            displayBarNumber: barNumForStep,
            sectionId: section.id,
            sectionName: section.name,
            sectionBarNumber: localBarOffset,
            sectionTotalBars: sectionBarSpan,
            barId: bar.id,
            bar,
            repeatIteration: r,
            repeatTotal: repeats,
            effectiveBpm,
            effectiveMeter,
            beatsPerBar: parseMeterBeats(effectiveMeter),
            sectionTranspose: secTranspose,
            sectionPass: pass,
            sectionTotalPasses: sectionPasses,
            isLastBarOfSection,
            lastBarCuePassRule: section.lastBarCuePassRule ?? 'all',
            sectionMultiPad: section.multiPad,
            sectionSynth: section.synth,
            sectionArp: section.arp,
            sectionDrums: section.drums,
            sectionFx: section.fx,
          });
        }
      }
    }

    displayBarCounter += sectionBarSpan;
  }

  return timeline;
}

export function getGlobalDisplayBarNumber(song: Song, targetSectionId: string, targetBarId: string): number {
  if (!song || !Array.isArray(song.sections)) return 1;
  let count = 0;
  for (const sec of song.sections) {
    if (!sec || sec.isReference || !Array.isArray(sec.bars) || sec.bars.length === 0) continue;
    for (const bar of sec.bars) {
      if (!bar) continue;
      const repeats = bar.repeat && bar.repeat > 1 ? bar.repeat : 1;
      if (sec.id === targetSectionId && bar.id === targetBarId) {
        return count + 1;
      }
      count += repeats;
    }
  }
  return 1;
}

export function chordToMidiNotes(chordStr: string, semitones = 0): number[] {
  const transposed = transposeChord(chordStr, semitones);
  if (!transposed || transposed === '—' || transposed === '-') return [];

  const mainPart = transposed.split('/')[0];
  const match = mainPart.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return [];

  const rootIdx = normalizeRootIndex(match[1]);
  if (rootIdx === null) return [];

  const quality = match[2].toLowerCase();
  const baseMidi = 48 + rootIdx; // C3..B3 range

  let intervals = [0, 4, 7]; // major default
  if (quality === 'min' || quality === 'm') {
    intervals = [0, 3, 7];
  } else if (quality === '7') {
    intervals = [0, 4, 7, 10];
  } else if (quality === 'maj7') {
    intervals = [0, 4, 7, 11];
  } else if (quality === 'm7' || quality === 'min7') {
    intervals = [0, 3, 7, 10];
  } else if (quality === 'sus2') {
    intervals = [0, 2, 7];
  } else if (quality === 'sus4') {
    intervals = [0, 5, 7];
  } else if (quality === 'add9') {
    intervals = [0, 4, 7, 14];
  } else if (quality === '6') {
    intervals = [0, 4, 7, 9];
  } else if (quality === '9') {
    intervals = [0, 4, 7, 10, 14];
  } else if (quality === 'dim') {
    intervals = [0, 3, 6];
  } else if (quality === 'aug') {
    intervals = [0, 4, 8];
  } else if (quality === 'm7b5') {
    intervals = [0, 3, 6, 10];
  } else if (quality === '5') {
    intervals = [0, 7, 12];
  } else if (quality.startsWith('m')) {
    intervals = [0, 3, 7];
  }

  return intervals.map((iv) => baseMidi + iv);
}

export function normalizeSection(raw: Partial<Section> | null | undefined, idx = 0): Section {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const rawBars: unknown[] = Array.isArray(safe.bars) ? safe.bars : [];
  const bars: Bar[] = [];

  for (let bIdx = 0; bIdx < rawBars.length; bIdx++) {
    const item = rawBars[bIdx];
    if (typeof item === 'string') {
      const chordVal = item.trim() || '-';
      bars.push({
        id: `bar-${idx}-${bIdx}-${Math.random().toString(36).slice(2, 6)}`,
        chord: chordVal,
        repeat: 1,
      });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const b = item as Partial<Bar>;
    const parsedRepeat = Number(b.repeat);
    const parsedTempo = b.tempo !== undefined ? Number(b.tempo) : NaN;
    const cleanBeatChords = Array.isArray(b.beatChords)
      ? b.beatChords.map((c) => (typeof c === 'string' ? c : ''))
      : undefined;

    bars.push({
      ...b,
      id:
        typeof b.id === 'string' && b.id.trim()
          ? b.id.trim()
          : `bar-${idx}-${bIdx}-${Math.random().toString(36).slice(2, 6)}`,
      chord: typeof b.chord === 'string' && b.chord.trim() ? b.chord.trim() : '-',
      beatChords: cleanBeatChords,
      tempo:
        Number.isFinite(parsedTempo) && parsedTempo >= 20 && parsedTempo <= 300
          ? parsedTempo
          : undefined,
      repeat: Number.isFinite(parsedRepeat) && parsedRepeat >= 1 ? Math.round(parsedRepeat) : 1,
    });
  }

  return {
    ...safe,
    id:
      typeof safe.id === 'string' && safe.id.trim()
        ? safe.id.trim()
        : `sec-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    name: typeof safe.name === 'string' && safe.name.trim() ? safe.name.trim() : `Section ${idx + 1}`,
    bars,
  };
}

export function normalizeSong(raw: Partial<Song> | null | undefined, fallbackIdx = 0): Song {
  const safe = (raw && typeof raw === 'object' ? raw : {}) as Partial<Song> & { bars?: unknown[] };
  let rawSections: unknown[] = Array.isArray(safe.sections) ? safe.sections : [];
  if (rawSections.length === 0 && Array.isArray(safe.bars) && safe.bars.length > 0) {
    rawSections = [{ id: `sec-main-${fallbackIdx}`, name: 'Main', bars: safe.bars }];
  }
  const sections = rawSections
    .filter((sec): sec is Partial<Section> => Boolean(sec && typeof sec === 'object'))
    .map((sec, idx) => normalizeSection(sec, idx));

  const rawLyrics: unknown[] = Array.isArray(safe.lyrics) ? safe.lyrics : [];
  const lyrics = rawLyrics
    .filter((l): l is { id?: unknown; label?: unknown; lines?: unknown } => Boolean(l && typeof l === 'object'))
    .map((l, idx) => ({
      id:
        typeof l.id === 'string' && l.id.trim()
          ? l.id.trim()
          : `lyr-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      label: typeof l.label === 'string' && l.label.trim() ? l.label.trim() : `Section ${idx + 1}`,
      lines: Array.isArray(l.lines)
        ? l.lines.map((line) => String(line ?? ''))
        : typeof l.lines === 'string'
        ? l.lines.split(/\r?\n/)
        : [],
    }));

  const parsedBpm = Number(safe.bpm);
  const parsedTranspose = Number(safe.transpose);
  const parsedUpdatedAt = Number(safe.updatedAt);

  return {
    id:
      typeof safe.id === 'string' && safe.id.trim()
        ? safe.id.trim()
        : `song-${fallbackIdx}-${Math.random().toString(36).slice(2, 7)}`,
    title: typeof safe.title === 'string' && safe.title.trim() ? safe.title.trim() : 'Untitled Song',
    artist: typeof safe.artist === 'string' && safe.artist.trim() ? safe.artist.trim() : 'Unknown Artist',
    key: typeof safe.key === 'string' && safe.key.trim() ? safe.key.trim() : 'C',
    bpm:
      Number.isFinite(parsedBpm) && parsedBpm >= 20 && parsedBpm <= 300
        ? Math.round(parsedBpm)
        : 92,
    timeSignature:
      safe.timeSignature === '3/4' || safe.timeSignature === '6/8' || safe.timeSignature === '4/4'
        ? safe.timeSignature
        : '4/4',
    transpose:
      Number.isFinite(parsedTranspose)
        ? Math.max(-11, Math.min(11, Math.round(parsedTranspose)))
        : 0,
    sections,
    lyrics,
    updatedAt:
      Number.isFinite(parsedUpdatedAt) && parsedUpdatedAt > 0 ? parsedUpdatedAt : Date.now(),
  };
}

export function normalizeSongsList(raw: unknown, fallback: Song[]): Song[] {
  if (!Array.isArray(raw)) return fallback;
  const cleaned = raw
    .filter((item): item is Partial<Song> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => normalizeSong(item, idx));
  return cleaned.length > 0 ? cleaned : fallback;
}

export function createEmptyBar(chord = '-'): Bar {
  return {
    id: `bar-${Math.random().toString(36).slice(2, 9)}`,
    chord,
    repeat: 1,
  };
}

export function hasBeatSplits(bar: Bar): boolean {
  return Array.isArray(bar.beatChords) && bar.beatChords.some((c) => c && c.trim() !== '' && c.trim() !== '-');
}

export function formatBarChordsSummary(bar: Bar, semitones = 0, targetKey?: string): string {
  if (hasBeatSplits(bar) && bar.beatChords) {
    const tokens = bar.beatChords
      .map((c) => {
        const clean = (c || '').trim();
        if (!clean || clean === '-') return null;
        return formatChordDisplay(transposeChord(clean, semitones, targetKey));
      })
      .filter((t): t is string => Boolean(t));
    if (tokens.length > 0) {
      return tokens.join(' · ');
    }
  }
  return formatChordDisplay(transposeChord(bar.chord, semitones, targetKey));
}

export function sanitizeSongForLightweightJson(song: Song): Song {
  const normalized = normalizeSong(song);
  return {
    id: normalized.id,
    title: normalized.title,
    artist: normalized.artist,
    key: normalized.key,
    bpm: normalized.bpm,
    timeSignature: normalized.timeSignature,
    transpose: normalized.transpose,
    sections: normalized.sections.map((sec) => ({
      id: sec.id,
      name: sec.name,
      bars: sec.bars.map((bar) => {
        const cleanBar: Bar = {
          id: bar.id,
          chord: bar.chord,
        };
        if (bar.beatChords) cleanBar.beatChords = [...bar.beatChords];
        if (bar.lyrics) cleanBar.lyrics = bar.lyrics;
        if (bar.meter) cleanBar.meter = bar.meter;
        if (bar.tempo !== undefined) cleanBar.tempo = bar.tempo;
        if (bar.beatUnit) cleanBar.beatUnit = bar.beatUnit;
        if (bar.cue) cleanBar.cue = bar.cue;
        if (bar.customCueId) cleanBar.customCueId = bar.customCueId;
        if (bar.voiceCountLocked) cleanBar.voiceCountLocked = bar.voiceCountLocked;
        if (bar.countingSystem) cleanBar.countingSystem = bar.countingSystem;
        if (bar.repeat && bar.repeat > 1) cleanBar.repeat = bar.repeat;
        return cleanBar;
      }),
      ...(sec.transpose !== undefined ? { transpose: sec.transpose } : {}),
      ...(sec.repeat !== undefined ? { repeat: sec.repeat } : {}),
      ...(sec.repeatCount !== undefined ? { repeatCount: sec.repeatCount } : {}),
      ...(sec.lastBarCuePassRule !== undefined
        ? { lastBarCuePassRule: sec.lastBarCuePassRule }
        : {}),
      ...(sec.isReference !== undefined ? { isReference: sec.isReference } : {}),
      ...(sec.referenceTargetId ? { referenceTargetId: sec.referenceTargetId } : {}),
      ...(sec.multiPad ? { multiPad: JSON.parse(JSON.stringify(sec.multiPad)) } : {}),
      ...(sec.synth ? { synth: JSON.parse(JSON.stringify(sec.synth)) } : {}),
      ...(sec.arp ? { arp: JSON.parse(JSON.stringify(sec.arp)) } : {}),
      ...(sec.drums ? { drums: JSON.parse(JSON.stringify(sec.drums)) } : {}),
      ...(sec.fx ? { fx: JSON.parse(JSON.stringify(sec.fx)) } : {}),
    })),
    lyrics: normalized.lyrics.map((l) => ({
      id: l.id,
      label: l.label,
      lines: [...l.lines],
    })),
    updatedAt: normalized.updatedAt,
  };
}

export function sanitizeSetlistForLightweightJson(setlist: Setlist): Setlist {
  return {
    id: setlist.id,
    name: setlist.name,
    songIds: Array.isArray(setlist.songIds) ? [...setlist.songIds] : [],
    createdAt: typeof setlist.createdAt === 'number' ? setlist.createdAt : Date.now(),
  };
}

export function buildSongTemplateObject(songId = 'song-custom-template'): Omit<Song, 'updatedAt'> {
  return {
    id: songId,
    title: 'My New Song',
    artist: 'Artist Name',
    key: 'G',
    bpm: 92,
    timeSignature: '4/4',
    transpose: 0,
    sections: [
      {
        id: 'sec-intro',
        name: 'Intro',
        bars: [
          { id: 'bar-1', chord: 'G', cue: 'Intro', voiceCountLocked: true, countingSystem: '1 2 3 4' },
          { id: 'bar-2', chord: 'D' },
          { id: 'bar-3', chord: 'Em', beatChords: ['Em', '', 'C', ''] },
          { id: 'bar-4', chord: 'D', cue: 'Verse' },
        ],
      },
      {
        id: 'sec-verse',
        name: 'Verse 1',
        bars: [
          { id: 'bar-5', chord: 'G', lyrics: 'First line of lyrics' },
          { id: 'bar-6', chord: 'C' },
          { id: 'bar-7', chord: 'Am', repeat: 2 },
          { id: 'bar-8', chord: 'D', cue: 'Chorus' },
        ],
      },
    ],
    lyrics: [
      {
        id: 'lyr-verse-1',
        label: 'Verse 1',
        lines: ['First line of lyrics', 'Second line of lyrics'],
      },
    ],
  };
}

export function createSongJsonTemplate(): string {
  const uniqueId = `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return JSON.stringify(buildSongTemplateObject(uniqueId), null, 2);
}

export const SONG_JSON_TEMPLATE = JSON.stringify(buildSongTemplateObject(), null, 2);

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback (needed on iOS Safari / embedded iframes)
    }
  }

  if (typeof document === 'undefined') return false;

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.width = '2em';
  ta.style.height = '2em';
  ta.style.padding = '0';
  ta.style.border = 'none';
  ta.style.outline = 'none';
  ta.style.boxShadow = 'none';
  ta.style.background = 'transparent';
  ta.style.opacity = '0';
  document.body.appendChild(ta);

  try {
    ta.focus({ preventScroll: true });
  } catch {
    ta.focus();
  }
  ta.select();
  try {
    ta.setSelectionRange(0, text.length);
  } catch {
    // Ignore on non-supporting browsers
  }

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(ta);
  }
  return copied;
}

export { SHARP_SCALE, FLAT_SCALE };
