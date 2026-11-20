import type { Bar, BarMeter, Section, Song, TimeSignature } from '../types';
import { createEmptyBar, normalizeSong } from './chords';

export interface OcrParseResult {
  formattedText: string;
  sections: Section[];
  detectedKey: string;
  correctionsApplied: string[];
  totalBars: number;
}

const SECTION_KEYWORDS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /^(?:pre[\s\-_]*ch(?:o|or|ors|oru|orus|rous|ours)?|prechorus)$/i, canonical: 'Pre-Chorus' },
  { pattern: /^(?:[il1]?nt(?:r|ro|or|roduction)?|intor|lntro|1ntro)$/i, canonical: 'Intro' },
  { pattern: /^(?:v(?:er|ers|erse|rs|ese|orse)?|verce)$/i, canonical: 'Verse' },
  { pattern: /^(?:ch(?:o|or|ors|oru|orus|rous|ours|rs)?|cho)$/i, canonical: 'Chorus' },
  { pattern: /^(?:br(?:i|id|idg|idge|ige|ndge|dg)?)$/i, canonical: 'Bridge' },
  { pattern: /^(?:[il1]?nter(?:l|lu|lud|lude)?)$/i, canonical: 'Interlude' },
  { pattern: /^(?:[o0]ut(?:r|ro)?|out)$/i, canonical: 'Outro' },
  { pattern: /^(?:end(?:ing|ng)?)$/i, canonical: 'Ending' },
  { pattern: /^(?:inst(?:r|rum|rumental)?|solo|guitar\s*solo|sax\s*solo|keys\s*solo)$/i, canonical: 'Instrumental' },
  { pattern: /^(?:coda)$/i, canonical: 'Coda' },
  { pattern: /^(?:tag)$/i, canonical: 'Tag' },
  { pattern: /^(?:vamp)$/i, canonical: 'Vamp' },
  { pattern: /^(?:turnaround|turn\s*around)$/i, canonical: 'Turnaround' },
  { pattern: /^(?:refrain)$/i, canonical: 'Refrain' },
];

const VALID_CHORD_REGEX =
  /^[A-G](?:#|b)?(?:maj7|maj9|maj|min7|min|m7b5|m7|m9|m6|madd9|msus4|m|7sus4|7b9|7#9|7|9|11|13|6|5|sus2|sus4|sus|add9|add2|dim7|dim|aug)?(?:\/[A-G](?:#|b)?)?$/;

/**
 * Attempts to normalize a section header string (handling OCR typos like "Vers", "Chors", "lntro").
 * Returns null if the token is not a recognizable section header.
 */
export function normalizeSectionHeader(rawLine: string): { header: string; trailingChords: string } | null {
  const cleaned = rawLine
    .replace(/^[\[\(\{#*\s\-–—•]+/, '')
    .replace(/[\]\)\}*]+$/, '')
    .trim();

  if (!cleaned) return null;

  // Check for "Header: chords..." or "Header - chords..."
  const splitMatch = cleaned.match(/^([A-Za-z0-9\s\-]{2,22}?)(\s*\d{1,2})?\s*[:\-–]\s*(.*)$/);
  if (splitMatch) {
    const base = `${splitMatch[1]}${splitMatch[2] || ''}`.trim();
    const matched = matchHeaderWord(base);
    if (matched) {
      return { header: matched, trailingChords: splitMatch[3].trim() };
    }
  }

  // Whole line is a section header (possibly with number like "Vers 1", "Chorus 2")
  const wholeMatch = matchHeaderWord(cleaned);
  if (wholeMatch) {
    return { header: wholeMatch, trailingChords: '' };
  }

  return null;
}

function matchHeaderWord(text: string): string | null {
  const trimmed = text.replace(/[:\-–.\[\]\(\)]+$/g, '').trim();
  if (!trimmed) return null;

  // Avoid treating single chord letter "A", "B", "C"... or "Am" as a section header
  if (/^[A-G][#b]?(m|maj|min|dim|aug|sus|add|\d).*$/i.test(trimmed) && trimmed.length <= 6) {
    return null;
  }

  const numMatch = trimmed.match(/^(.*?)\s*(\d{1,2})$/);
  const wordPart = (numMatch ? numMatch[1] : trimmed).trim();
  const numPart = numMatch ? numMatch[2] : '';

  // Also handle joined "Vers1", "Chorus2", "V1"
  const joinedNumMatch = !numPart ? wordPart.match(/^([A-Za-z\-]+?)(\d{1,2})$/) : null;
  const finalWord = (joinedNumMatch ? joinedNumMatch[1] : wordPart).trim();
  const finalNum = numPart || (joinedNumMatch ? joinedNumMatch[2] : '');

  for (const entry of SECTION_KEYWORDS) {
    if (entry.pattern.test(finalWord)) {
      return finalNum ? `${entry.canonical} ${finalNum}` : entry.canonical;
    }
  }
  return null;
}

/**
 * Fixes a single chord root + suffix part (without slash bass).
 */
function fixSingleChordPart(raw: string, isBassNote = false): string | null {
  let s = raw
    .trim()
    .replace(/[♯]/g, '#')
    .replace(/[♭]/g, 'b')
    .replace(/[`'’‘"]/g, '');

  if (!s) return null;

  // Strip common leading/trailing OCR grid artifacts when non-letter
  s = s.replace(/^[,.;:]+|[,.;:]+$/g, '');
  if (!s) return null;

  // Fix common misread root characters
  // e.g. "N/F#m" -> "A/F#m", "Nm" -> "Am", "N7" -> "A7"
  if (/^N(?=$|#|b|m|rn|nn|7|T|maj|min|sus|add|dim|aug|\d)/i.test(s)) {
    s = 'A' + s.slice(1);
  } else if (/^4(?=[#b]?[mrn]|7|T|maj|min|sus|add|dim|aug)/i.test(s)) {
    s = 'A' + s.slice(1);
  } else if (/^6(?=[#b]?[mrn]|7|T|maj|min|sus|add|dim|aug)/i.test(s)) {
    s = 'G' + s.slice(1);
  } else if (/^8(?=[#b]?[mrn]|7|T|maj|min|sus|add|dim|aug)/i.test(s)) {
    s = 'B' + s.slice(1);
  }

  // Capitalize root note a-g -> A-G
  if (/^[a-g]/.test(s)) {
    s = s[0].toUpperCase() + s.slice(1);
  }

  // Must start with valid root note A-G now
  if (!/^[A-G]/.test(s)) {
    return null;
  }

  const root = s[0];
  let rest = s.slice(1);

  // Sharp misreads: H, tt, ++ right after root note (except Bh -> B? Wait: B# rarely written, F/C/G/D/A# very common)
  if (/^(?:H|tt|\+\+)/.test(rest) && ['A', 'C', 'D', 'F', 'G'].includes(root)) {
    rest = '#' + rest.replace(/^(?:H|tt|\+\+)/, '');
  }

  // Extract accidental if present
  let accidental = '';
  if (rest.startsWith('#') || rest.startsWith('b')) {
    accidental = rest[0];
    rest = rest.slice(1);
    // Double sharp OCR typo like F## -> F#
    if (accidental === '#' && rest.startsWith('#')) {
      rest = rest.slice(1);
    }
  }

  if (isBassNote) {
    // Bass notes in slash chords can still carry e.g. "F#m" like "A/F#m" if the user writes it that way,
    // or plain root+accidental like "G/B". Handle rn->m for bass note too!
    rest = rest
      .replace(/^rn/i, 'm')
      .replace(/^nn/i, 'm')
      .replace(/T$/i, '7')
      .replace(/\?$/, '7');
    if (rest === '' || /^m7?$|^min$/i.test(rest)) {
      return `${root}${accidental}${rest === 'min' ? 'm' : rest}`;
    }
    return `${root}${accidental}`;
  }

  // Fix modifier OCR errors in `rest`:
  // 1. "rn" / "nn" -> "m" (e.g. "F#rn" -> "F#m", "C#rn" -> "C#m", "Arn7" -> "Am7", "dirn" -> "dim")
  rest = rest
    .replace(/dirn/gi, 'dim')
    .replace(/rnin/gi, 'min')
    .replace(/mln/gi, 'min')
    .replace(/^rn/i, 'm')
    .replace(/^nn/i, 'm')
    .replace(/rn$/i, 'm');

  // 2. Trailing "T" or "?" misread for "7" (e.g. "AT" -> "A7", "BT" -> "B7", "ET" -> "E7", "AmT" -> "Am7", "CmajT" -> "Cmaj7")
  rest = rest
    .replace(/majT$/i, 'maj7')
    .replace(/minT$/i, 'm7')
    .replace(/mT$/i, 'm7')
    .replace(/sus4T$/i, 'sus4')
    .replace(/T$/i, '7')
    .replace(/\?$/, '7');

  // 3. Common uppercase / typo modifier normalizations
  rest = rest
    .replace(/^MAJ7$/i, 'maj7')
    .replace(/^Maj7$/i, 'maj7')
    .replace(/^ma7$/i, 'maj7')
    .replace(/^mj7$/i, 'maj7')
    .replace(/^MAJ$/i, 'maj')
    .replace(/^MIN7$/i, 'm7')
    .replace(/^min7$/i, 'm7')
    .replace(/^MIN$/i, 'm')
    .replace(/^min$/i, 'm')
    .replace(/^[5s]us4$/i, 'sus4')
    .replace(/^[5s]us2$/i, 'sus2')
    .replace(/^sus[Y4]$/i, 'sus4')
    .replace(/^add[qg9]$/i, 'add9')
    .replace(/^m7b[5s]$/i, 'm7b5')
    .replace(/^DIM$/i, 'dim')
    .replace(/^AUG$/i, 'aug')
    .replace(/^M7$/, 'maj7')
    .replace(/^M$/, '');

  // Strip trailing stray barline artifact letters like I or l (no valid chord suffix ends in I or l)
  rest = rest.replace(/[Il]+$/, '');

  const candidate = `${root}${accidental}${rest}`;
  if (VALID_CHORD_REGEX.test(candidate)) {
    return candidate;
  }

  // Fallback: if rest is just digits/m/7 combos or valid prefix, allow up to clean characters
  if (/^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|\d|[b#]){0,6}$/i.test(candidate)) {
    return candidate;
  }

  return `${root}${accidental}${rest}`;
}

/**
 * Fixes a single chord token (supports slash chords like "N/F#m" -> "A/F#m").
 */
export function fixChordToken(rawToken: string): { fixed: string; wasCorrected: boolean } | null {
  const original = rawToken.trim();
  if (!original) return null;

  // Repeat / hold bar markers
  if (/^(?:-|—|–|_|%|\/\/)$/.test(original)) {
    return { fixed: '-', wasCorrected: original !== '-' };
  }

  // Handle slash chords like "N/F#m", "G/B", "D/F#"
  if (original.includes('/')) {
    const slashParts = original.split('/');
    if (slashParts.length === 2 && slashParts[0] && slashParts[1]) {
      const mainFixed = fixSingleChordPart(slashParts[0], false);
      const bassFixed = fixSingleChordPart(slashParts[1], true);
      if (mainFixed && bassFixed) {
        const combined = `${mainFixed}/${bassFixed}`;
        return { fixed: combined, wasCorrected: combined !== original };
      }
    }
  }

  const fixed = fixSingleChordPart(original, false);
  if (!fixed) return null;
  return { fixed, wasCorrected: fixed !== original };
}

/**
 * Cleans vertical grid lines misread as "l", "I", "1", "!", "¦", "[", "]"
 * and extracts normalized bar cells from a line of chords.
 */
function parseChordLineToBarCells(rawLine: string, corrections: Set<string>): string[][] | null {
  // Normalize obvious barline unicode & join split accidentals/suffixes/slash bass like "F #m" -> "F#m", "A 7" -> "A7", "C / G" -> "C/G"
  let line = rawLine
    .replace(/[∣｜¦│┃]/g, '|')
    .replace(/([A-Ga-gN468])\s+([#b])(?=\s|$|[A-Za-z0-9|/])/g, '$1$2')
    .replace(
      /([A-Ga-gN468][#b]?(?:m|maj|min|dim|aug|sus|add|\d|rn|nn|T)*)\s+(rn|nn|m7|maj7|sus4|sus2|add9|dim|aug|m|7|T)(?=\s|$|[|Il1/])/g,
      '$1$2'
    )
    .replace(
      /([A-Ga-gN468][#b]?(?:maj7|maj|min7|min|m7b5|m7|m|rn|nn|7|T|sus4|sus2|add9|dim|aug|6|9)?)\s*(?<!\/)\/(?!\/)\s*([A-Ga-gN][#b]?(?:m|rn|nn)?)(?=\s|$|[|Il1])/g,
      '$1/$2'
    );

  // Convert standalone barline misreads between whitespace into `|`
  // e.g. "G l Em I C 1 D" -> "G | Em | C | D"
  line = line.replace(/(^|\s)[lI1!¡\[\]\{\}]+(?=\s|$)/g, (full, lead) => {
    corrections.add('Normalized grid lines (l/I/1 → |)');
    return `${lead}|`;
  });

  // Separate `|` with spaces so splitting works cleanly
  line = line.replace(/\|+/g, ' | ');

  const rawTokens = line.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return null;

  // Determine if the line is mostly chords vs English lyrics/noise
  let recognizedChordCount = 0;
  let nonSeparatorCount = 0;

  interface ProcessedTok {
    type: 'bar' | 'chord' | 'unknown';
    value: string;
  }
  const processed: ProcessedTok[] = [];

  for (const tok of rawTokens) {
    if (tok === '|') {
      processed.push({ type: 'bar', value: '|' });
      continue;
    }

    // Strip leading/trailing attached barline misreads:
    // e.g. "lAm", "IG", "1Em", "[C" or "AmI", "Dl", "G1", "C]"
    let working = tok;
    let hadLeadingBar = false;
    let hadTrailingBar = false;

    const leadMatch = working.match(/^([lI1!¡\[\(\{]+)([A-Ga-gN468].*)$/);
    if (leadMatch) {
      hadLeadingBar = true;
      working = leadMatch[2];
      corrections.add('Separated barlines from chords');
    }

    // Trailing barline: I, l, !, ], ), }, or trailing single 1 (except 11 or 13)
    const trailMatch = working.match(/^(.*?)([lI!¡\]\)\}]+)$/);
    if (trailMatch && trailMatch[1].length >= 1) {
      hadTrailingBar = true;
      working = trailMatch[1];
      corrections.add('Separated barlines from chords');
    } else if (/^[A-Ga-gN].*(?<!1)1$/.test(working) && !/11$/.test(working)) {
      hadTrailingBar = true;
      working = working.slice(0, -1);
      corrections.add('Separated barlines from chords');
    }

    if (hadLeadingBar) {
      processed.push({ type: 'bar', value: '|' });
    }

    nonSeparatorCount += 1;
    const fixedRes = fixChordToken(working);
    if (fixedRes) {
      recognizedChordCount += 1;
      if (fixedRes.wasCorrected) {
        corrections.add(`${working} → ${fixedRes.fixed}`);
      }
      processed.push({ type: 'chord', value: fixedRes.fixed });
    } else {
      processed.push({ type: 'unknown', value: working });
    }

    if (hadTrailingBar) {
      processed.push({ type: 'bar', value: '|' });
    }
  }

  if (recognizedChordCount === 0) return null;
  // Require at least half of non-separator tokens to be recognizable chords
  if (nonSeparatorCount > 0 && recognizedChordCount / nonSeparatorCount < 0.5) {
    return null;
  }

  const hasExplicitBars = processed.some((p) => p.type === 'bar');
  const bars: string[][] = [];

  if (hasExplicitBars) {
    let currentCell: string[] = [];
    for (const p of processed) {
      if (p.type === 'bar') {
        if (currentCell.length > 0) {
          bars.push(currentCell);
          currentCell = [];
        }
      } else if (p.type === 'chord') {
        currentCell.push(p.value);
      }
    }
    if (currentCell.length > 0) {
      bars.push(currentCell);
    }
  } else {
    // No barlines detected on this chord line — treat each recognized chord as 1 bar
    for (const p of processed) {
      if (p.type === 'chord') {
        bars.push([p.value]);
      }
    }
  }

  return bars.length > 0 ? bars : null;
}

/**
 * Post-processes raw OCR output into cleanly formatted Chordbook text
 * and structured Song Section[] data.
 */
export function postProcessOcrText(rawOcrText: string): OcrParseResult {
  const corrections = new Set<string>();
  const rawLines = (rawOcrText || '').split(/\r?\n/);

  interface ParsedSectionDraft {
    name: string;
    barLines: string[][][]; // array of lines -> array of bar cells -> chords in cell
  }

  const sectionDrafts: ParsedSectionDraft[] = [];
  let currentSection: ParsedSectionDraft = { name: 'Intro', barLines: [] };
  let hasExplicitSection = false;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const headerMatch = normalizeSectionHeader(trimmed);
    if (headerMatch) {
      if (headerMatch.header.toLowerCase() !== trimmed.toLowerCase().replace(/[:\-–]+$/, '').trim()) {
        corrections.add(`Section header → ${headerMatch.header}`);
      }
      if (currentSection.barLines.length > 0 || hasExplicitSection) {
        if (currentSection.barLines.length > 0) {
          sectionDrafts.push(currentSection);
        }
        currentSection = { name: headerMatch.header, barLines: [] };
      } else {
        currentSection.name = headerMatch.header;
      }
      hasExplicitSection = true;

      if (headerMatch.trailingChords) {
        const trailingBars = parseChordLineToBarCells(headerMatch.trailingChords, corrections);
        if (trailingBars) {
          currentSection.barLines.push(trailingBars);
        }
      }
      continue;
    }

    const barCells = parseChordLineToBarCells(trimmed, corrections);
    if (barCells) {
      currentSection.barLines.push(barCells);
    }
  }

  if (currentSection.barLines.length > 0) {
    sectionDrafts.push(currentSection);
  }

  if (sectionDrafts.length === 0) {
    return {
      formattedText: '',
      sections: [],
      detectedKey: 'C',
      correctionsApplied: [],
      totalBars: 0,
    };
  }

  // If the first section had no explicit header and defaulted to Intro, keep Intro (standard Chordbook first section)
  const formattedBlocks: string[] = [];
  for (const draft of sectionDrafts) {
    const lines = [draft.name];
    for (const barRow of draft.barLines) {
      const cellsStr = barRow.map((cell) => cell.map((c) => (c === '-' ? '—' : c)).join(' ')).join(' | ');
      lines.push(`| ${cellsStr} |`);
    }
    formattedBlocks.push(lines.join('\n'));
  }

  const formattedText = formattedBlocks.join('\n\n');
  const sections = parseFormattedChordTextToSongSections(formattedText);
  const detectedKey = inferKeyFromSections(sections);
  const totalBars = sections.reduce((sum, sec) => sum + sec.bars.length, 0);

  return {
    formattedText,
    sections,
    detectedKey,
    correctionsApplied: Array.from(corrections),
    totalBars,
  };
}

/**
 * Parses the user-editable formatted text area back into Chordbook Section[] objects.
 */
export function parseFormattedChordTextToSongSections(
  formattedText: string,
  timeSignature: TimeSignature = '4/4'
): Section[] {
  const lines = (formattedText || '').split(/\r?\n/);
  const beatsPerBar = timeSignature === '3/4' ? 3 : timeSignature === '6/8' ? 6 : 4;
  const dummyCorrections = new Set<string>();

  const sections: Section[] = [];
  let activeSection: { name: string; bars: Bar[] } = { name: 'Intro', bars: [] };
  let explicitHeaderSeen = false;

  const pushActiveIfReady = () => {
    if (activeSection.bars.length > 0) {
      sections.push({
        id: `sec-scan-${sections.length + 1}-${Date.now().toString(36)}`,
        name: activeSection.name,
        bars: activeSection.bars,
      });
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Treat any non-bar line that doesn't parse strictly as chords (or matches known header) as a section name
    const headerMatch = normalizeSectionHeader(trimmed);
    const looksLikeChordRow = trimmed.includes('|') || parseChordLineToBarCells(trimmed, dummyCorrections) !== null;

    if (headerMatch) {
      if (activeSection.bars.length > 0 || explicitHeaderSeen) {
        pushActiveIfReady();
        activeSection = { name: headerMatch.header, bars: [] };
      } else {
        activeSection.name = headerMatch.header;
      }
      explicitHeaderSeen = true;

      if (headerMatch.trailingChords) {
        const trailingCells = parseChordLineToBarCells(headerMatch.trailingChords, dummyCorrections);
        if (trailingCells) {
          for (const cell of trailingCells) {
            activeSection.bars.push(cellToBar(cell, beatsPerBar));
          }
        }
      }
      continue;
    }

    if (!looksLikeChordRow && /^[A-Za-z0-9\s\-()[\]]{2,32}$/.test(trimmed)) {
      if (activeSection.bars.length > 0 || explicitHeaderSeen) {
        pushActiveIfReady();
        activeSection = { name: trimmed.replace(/[:]+$/, '').trim(), bars: [] };
      } else {
        activeSection.name = trimmed.replace(/[:]+$/, '').trim();
      }
      explicitHeaderSeen = true;
      continue;
    }

    // Parse chord bar row
    const normalizedRow = trimmed.replace(/—/g, '-');
    const barCells = parseChordLineToBarCells(normalizedRow, dummyCorrections);
    if (barCells) {
      for (const cell of barCells) {
        activeSection.bars.push(cellToBar(cell, beatsPerBar));
      }
    }
  }

  pushActiveIfReady();
  return sections;
}

function cellToBar(cellChords: string[], beatsPerBar: number): Bar {
  const clean = cellChords.map((c) => (c === '—' ? '-' : c)).filter(Boolean);
  if (clean.length === 0) {
    return createEmptyBar('-');
  }
  if (clean.length === 1) {
    return createEmptyBar(clean[0]);
  }
  // Multi-chord bar: distribute across beatChords slots
  const beatChords = Array.from({ length: beatsPerBar }, () => '');
  if (clean.length === 2) {
    beatChords[0] = clean[0];
    beatChords[Math.min(beatsPerBar - 1, Math.floor(beatsPerBar / 2))] = clean[1];
  } else {
    for (let i = 0; i < Math.min(beatsPerBar, clean.length); i++) {
      beatChords[i] = clean[i];
    }
  }
  return {
    id: `bar-${Math.random().toString(36).slice(2, 9)}`,
    chord: clean[0] || '-',
    beatChords,
    repeat: 1,
  };
}

function inferKeyFromSections(sections: Section[]): string {
  for (const sec of sections) {
    for (const bar of sec.bars) {
      const c = (bar.chord || '').trim();
      if (!c || c === '-' || c === '—') continue;
      const base = c.split('/')[0];
      const match = base.match(/^([A-G][#b]?)(m?)/);
      if (match) {
        return `${match[1]}${match[2]}`;
      }
    }
  }
  return 'C';
}

export function buildScannedSongObject(params: {
  title: string;
  artist?: string;
  key: string;
  bpm: number;
  timeSignature: TimeSignature;
  sections: Section[];
}): Song {
  const safeSections =
    params.sections.length > 0
      ? params.sections
      : [
          {
            id: `sec-main-${Date.now().toString(36)}`,
            name: 'Intro',
            bars: [createEmptyBar(params.key || 'C'), createEmptyBar('-')],
          },
        ];

  return normalizeSong({
    id: `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: params.title.trim() || 'Scanned Chord Sheet',
    artist: (params.artist || '').trim() || 'Scanned Sheet',
    key: params.key || 'C',
    bpm: Math.max(20, Math.min(300, Number(params.bpm) || 92)),
    timeSignature: params.timeSignature || ('4/4' as BarMeter & TimeSignature),
    transpose: 0,
    sections: safeSections,
    lyrics: [],
    updatedAt: Date.now(),
  });
}
