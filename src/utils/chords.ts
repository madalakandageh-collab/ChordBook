import type { Bar, BarMeter, LastBarCuePassRule, Section, Song, TimelineBar } from '../types';

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

export function isBarInSectionLayerRange(
  config:
    | {
        enabled?: boolean;
        barRangeMode?: 'all' | 'custom';
        startBar?: number;
        endBar?: number;
      }
    | undefined,
  sectionBarNumber: number,
  sectionTotalBars: number
): boolean {
  if (!config?.enabled) return false;
  if (!config.barRangeMode || config.barRangeMode === 'all') return true;
  const maxBar = Math.max(1, sectionTotalBars);
  const start = Math.max(1, Math.min(maxBar, config.startBar ?? 1));
  const end = Math.max(start, Math.min(maxBar, config.endBar ?? maxBar));
  return sectionBarNumber >= start && sectionBarNumber <= end;
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
  const bars: Bar[] = rawBars
    .filter((b): b is Partial<Bar> => Boolean(b && typeof b === 'object'))
    .map((b, bIdx) => ({
      ...b,
      id: typeof b.id === 'string' && b.id ? b.id : `bar-${idx}-${bIdx}-${Math.random().toString(36).slice(2, 6)}`,
      chord: typeof b.chord === 'string' ? b.chord : '-',
      repeat: typeof b.repeat === 'number' && b.repeat > 0 ? b.repeat : 1,
    }));

  return {
    ...safe,
    id: typeof safe.id === 'string' && safe.id ? safe.id : `sec-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    name: typeof safe.name === 'string' && safe.name.trim() ? safe.name : `Section ${idx + 1}`,
    bars,
  };
}

export function normalizeSong(raw: Partial<Song> | null | undefined, fallbackIdx = 0): Song {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const rawSections: unknown[] = Array.isArray(safe.sections) ? safe.sections : [];
  const sections = rawSections
    .filter((sec): sec is Partial<Section> => Boolean(sec && typeof sec === 'object'))
    .map((sec, idx) => normalizeSection(sec, idx));

  const rawLyrics = Array.isArray(safe.lyrics) ? safe.lyrics : [];
  const lyrics = rawLyrics
    .filter((l) => Boolean(l && typeof l === 'object'))
    .map((l, idx) => ({
      id: typeof l.id === 'string' && l.id ? l.id : `lyr-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      label: typeof l.label === 'string' ? l.label : `Section ${idx + 1}`,
      lines: Array.isArray(l.lines) ? l.lines.map((line) => String(line ?? '')) : [],
    }));

  return {
    id:
      typeof safe.id === 'string' && safe.id
        ? safe.id
        : `song-${fallbackIdx}-${Math.random().toString(36).slice(2, 7)}`,
    title: typeof safe.title === 'string' && safe.title.trim() ? safe.title.trim() : 'Untitled Song',
    artist: typeof safe.artist === 'string' && safe.artist.trim() ? safe.artist.trim() : 'Unknown Artist',
    key: typeof safe.key === 'string' && safe.key.trim() ? safe.key.trim() : 'C',
    bpm: typeof safe.bpm === 'number' && Number.isFinite(safe.bpm) && safe.bpm > 0 ? safe.bpm : 92,
    timeSignature:
      safe.timeSignature === '3/4' || safe.timeSignature === '6/8' || safe.timeSignature === '4/4'
        ? safe.timeSignature
        : '4/4',
    transpose: typeof safe.transpose === 'number' && Number.isFinite(safe.transpose) ? safe.transpose : 0,
    sections,
    lyrics,
    updatedAt: typeof safe.updatedAt === 'number' && Number.isFinite(safe.updatedAt) ? safe.updatedAt : Date.now(),
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

export const SONG_JSON_TEMPLATE = JSON.stringify(
  {
    id: 'song-custom-template',
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
  },
  null,
  2
);

export { SHARP_SCALE, FLAT_SCALE };
