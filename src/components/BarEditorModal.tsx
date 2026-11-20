import React, { useState } from 'react';
import { Repeat, SplitSquareHorizontal, Trash2, Volume2, X } from 'lucide-react';
import type { Bar, BarMeter, BeatUnit, CustomVoiceCue, LastBarCuePassRule } from '../types';
import {
  formatChordDisplay,
  formatPassOrdinal,
  hasBeatSplits,
  parseMeterBeats,
} from '../utils/chords';
import { BUNDLED_VOICE_CUES } from '../utils/voiceCues';
import { CuePointLibrary } from './CuePointLibrary';

export type BarEditorMode = 'chords' | 'cues';

interface BarEditorModalProps {
  bar: Bar;
  barNumber: number;
  sectionName: string;
  songBpm: number;
  songTimeSignature: string;
  mode: BarEditorMode;
  libraryVersion?: number;
  sectionRepeat?: boolean;
  sectionRepeatCount?: number;
  sectionLastBarCuePassRule?: LastBarCuePassRule;
  isLastBarInSection?: boolean;
  onUpdateSectionRepeat?: (patch: { lastBarCuePassRule?: LastBarCuePassRule }) => void;
  onUpdateBar: (updated: Bar) => void;
  onRemoveBar: () => void;
  onPreviewBundledCue: (url: string) => void;
  onPreviewCustomCue: (cue: CustomVoiceCue) => void;
  onCacheInvalidate: (cueId: string) => void;
  onClose: () => void;
}

const COMMON_CHORDS = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B'];
const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const CHORD_TYPES = ['maj', 'min', '7', 'maj7', 'm7', 'sus2', 'sus4', 'add9', '6', '9', 'dim', 'aug', 'm7b5', '5'];
const BAR_METERS: BarMeter[] = ['4/4', '3/4', '2/4', '6/8', '5/4', '7/8', '9/8', '12/8'];
const BEAT_UNITS: BeatUnit[] = ['Quarter', 'Eighth', 'Dotted', 'Triplet'];
const DEFAULT_COUNTING_PRESETS = ['1 1 1 1', '1 2 3 1', '1 2 1 2'];
const CUSTOM_COUNTING_STORAGE_KEY = 'chordbook_custom_counting_sequences_v1';

function loadCustomCountingSequences(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_COUNTING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set(DEFAULT_COUNTING_PRESETS);
    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item === 'string') {
        const clean = item.trim().replace(/\s+/g, ' ');
        if (clean && !seen.has(clean)) {
          seen.add(clean);
          result.push(clean);
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

function saveCustomCountingSequences(sequences: string[]): void {
  try {
    localStorage.setItem(CUSTOM_COUNTING_STORAGE_KEY, JSON.stringify(sequences));
  } catch {
    // Ignore storage quota errors
  }
}

function parseRootAndType(chord: string): { root: string; type: string } {
  const clean = chord.trim();
  if (!clean || clean === '-' || clean === '—') {
    return { root: '', type: 'maj' };
  }
  const match = clean.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return { root: '', type: 'maj' };
  const suffix = match[2];
  if (suffix === '' || suffix === 'maj') return { root: match[1], type: 'maj' };
  if (suffix === 'm' || suffix === 'min') return { root: match[1], type: 'min' };
  return { root: match[1], type: suffix };
}

function buildChord(root: string, type: string): string {
  if (!root) return '-';
  if (type === 'maj') return root;
  if (type === 'min') return `${root}m`;
  return `${root}${type}`;
}

export const BarEditorModal: React.FC<BarEditorModalProps> = ({
  bar,
  barNumber,
  sectionName,
  songBpm,
  songTimeSignature,
  mode,
  libraryVersion,
  sectionRepeat,
  sectionRepeatCount = 2,
  sectionLastBarCuePassRule = 'all',
  isLastBarInSection,
  onUpdateSectionRepeat,
  onUpdateBar,
  onRemoveBar,
  onPreviewBundledCue,
  onPreviewCustomCue,
  onCacheInvalidate,
  onClose,
}) => {
  const [typingMode, setTypingMode] = useState(false);
  const [customCountingSequences, setCustomCountingSequences] = useState<string[]>(() =>
    loadCustomCountingSequences()
  );
  // null = Whole Bar chord; number (0..beats-1) = Beat Split slot index
  const [activeBeatSlot, setActiveBeatSlot] = useState<number | null>(() =>
    hasBeatSplits(bar) ? 0 : null
  );

  const effectiveMeter = (bar.meter || songTimeSignature) as BarMeter;
  const effectiveBeats = parseMeterBeats(effectiveMeter);
  const effectiveTempo = bar.tempo ?? songBpm;
  const effectiveBeatUnit = bar.beatUnit ?? 'Quarter';
  const effectiveCounting = bar.countingSystem ?? '1 1 1 1';
  const repeatCount = bar.repeat ?? 1;

  const beatSplitsEnabled = hasBeatSplits(bar) || activeBeatSlot !== null;
  const currentBeatSlots: string[] = Array.from({ length: effectiveBeats }, (_, idx) => {
    if (bar.beatChords && bar.beatChords[idx] !== undefined) {
      return bar.beatChords[idx];
    }
    if (idx === 0 && bar.chord && bar.chord !== '-') {
      return bar.chord;
    }
    return '';
  });

  const activeChordValue =
    activeBeatSlot !== null ? currentBeatSlots[activeBeatSlot] || '-' : bar.chord;

  const parsed = parseRootAndType(activeChordValue);

  const setActiveChord = (nextChord: string) => {
    if (activeBeatSlot === null) {
      onUpdateBar({ ...bar, chord: nextChord });
      return;
    }
    const nextSlots = [...currentBeatSlots];
    nextSlots[activeBeatSlot] = nextChord === '-' ? '' : nextChord;
    const firstNonEmpty = nextSlots.find((c) => c && c.trim() !== '' && c.trim() !== '-') || '-';
    const anyFilled = nextSlots.some((c) => c && c.trim() !== '' && c.trim() !== '-');
    onUpdateBar({
      ...bar,
      chord: firstNonEmpty,
      beatChords: anyFilled ? nextSlots : undefined,
    });
  };

  const handleSelectRoot = (root: string) => {
    const nextType = parsed.type || 'maj';
    setActiveChord(buildChord(root, nextType));
  };

  const handleSelectType = (type: string) => {
    const root = parsed.root || 'C';
    setActiveChord(buildChord(root, type));
  };

  const handleClearBeatSplits = () => {
    setActiveBeatSlot(null);
    onUpdateBar({ ...bar, beatChords: undefined });
  };

  const normalizedCustomInput = (bar.countingSystem || '').trim().replace(/\s+/g, ' ');
  const canSaveCustomSequence =
    normalizedCustomInput.length > 0 &&
    !DEFAULT_COUNTING_PRESETS.includes(normalizedCustomInput) &&
    !customCountingSequences.includes(normalizedCustomInput);

  const handleSaveCustomSequence = () => {
    if (!canSaveCustomSequence) return;
    const next = [...customCountingSequences, normalizedCustomInput];
    setCustomCountingSequences(next);
    saveCustomCountingSequences(next);
    onUpdateBar({ ...bar, countingSystem: normalizedCustomInput });
  };

  const handleRemoveCustomSequence = (patternToRemove: string) => {
    const next = customCountingSequences.filter((p) => p !== patternToRemove);
    setCustomCountingSequences(next);
    saveCustomCountingSequences(next);
  };

  return (
    <div
      style={{ backgroundColor: 'var(--bg-backdrop)' }}
      className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-xs"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col rounded-t-3xl bg-[var(--bg-panel)] border-t border-x border-[var(--border-subtle)] shadow-2xl">
        {/* Drag Handle */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--drag-handle)]" />
        </div>

        {/* Sticky Modal Header */}
        <div className="px-5 pb-3.5 flex items-start justify-between border-b border-[var(--border-subtle)] shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-serif-display text-[26px] font-bold text-[var(--text-primary)] leading-tight">
                Bar {barNumber}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${
                  mode === 'cues'
                    ? 'bg-[var(--accent-amber-tint)] border-[#E5A958]/60 text-[var(--accent-amber-text)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {mode === 'cues' ? 'Cues & Settings' : 'Chords Mode'}
              </span>
            </div>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5 tabular-nums">
              {sectionName} · {effectiveTempo} bpm · {effectiveMeter}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Bar Editor"
            className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-5 py-4 space-y-5 pb-8">
          {mode === 'chords' ? (
            /* CHORDS MODE (Compact: Chords + Beat Split Slots + Bar Lyrics) */
            <>
              {/* BEAT SPLIT SLOTS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
                    <SplitSquareHorizontal className="w-3.5 h-3.5 text-[var(--accent-amber-text)]" />
                    <span>BEAT SPLIT SLOTS ({effectiveBeats} BEATS)</span>
                  </span>
                  {beatSplitsEnabled && (
                    <button
                      type="button"
                      onClick={handleClearBeatSplits}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-amber-text)]"
                    >
                      Single chord
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveBeatSlot(null)}
                    className={`h-11 rounded-xl border text-xs font-semibold transition flex flex-col items-center justify-center ${
                      activeBeatSlot === null
                        ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                        : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="text-[10px] opacity-80">Whole</span>
                    <span className="font-serif-display text-sm font-bold text-[var(--text-primary)] truncate max-w-full px-1">
                      {formatChordDisplay(bar.chord)}
                    </span>
                  </button>

                  {currentBeatSlots.map((slotChord, idx) => {
                    const isSlotActive = activeBeatSlot === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveBeatSlot(idx)}
                        className={`h-11 rounded-xl border text-xs font-semibold transition flex flex-col items-center justify-center ${
                          isSlotActive
                            ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                            : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="text-[10px] opacity-75 tabular-nums">Beat {idx + 1}</span>
                        <span className="font-serif-display text-sm font-bold text-[var(--text-primary)] truncate max-w-full px-1">
                          {slotChord ? formatChordDisplay(slotChord) : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CHORD DISPLAY & TYPE */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
                    {activeBeatSlot !== null ? `BEAT ${activeBeatSlot + 1} CHORD` : 'CHORD'}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeChordValue && activeChordValue !== '-' && (
                      <button
                        type="button"
                        onClick={() => setActiveChord('-')}
                        className="px-3 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Clear (—)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setTypingMode((v) => !v)}
                      className={`px-3.5 py-1 rounded-full border text-xs font-medium transition ${
                        typingMode
                          ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      {typingMode ? 'Done' : 'Type'}
                    </button>
                  </div>
                </div>

                {typingMode ? (
                  <input
                    type="text"
                    autoFocus
                    value={activeChordValue === '-' ? '' : activeChordValue}
                    onChange={(e) => setActiveChord(e.target.value || '-')}
                    placeholder="Type chord e.g. G/B, F#m7"
                    className="w-full h-14 px-4 rounded-2xl bg-[var(--bg-recessed)] border border-[#E5A958] text-center font-serif-display text-2xl font-bold text-[var(--text-primary)] focus:outline-none"
                  />
                ) : (
                  <div className="w-full h-14 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] flex items-center justify-center">
                    <span className="font-serif-display text-[24px] font-bold text-[var(--text-primary)]">
                      {formatChordDisplay(activeChordValue)}
                    </span>
                  </div>
                )}
              </div>

              {/* COMMON */}
              <div>
                <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase mb-2">
                  COMMON
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {COMMON_CHORDS.map((c) => {
                    const active = activeChordValue === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setActiveChord(c)}
                        className={`h-10 rounded-full border text-sm font-medium transition ${
                          active
                            ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ROOT */}
              <div>
                <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase mb-2">
                  ROOT
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {ROOTS.map((r) => {
                    const active = parsed.root === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleSelectRoot(r)}
                        className={`h-9 rounded-full border text-sm font-medium transition ${
                          active
                            ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TYPE */}
              <div>
                <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase mb-2">
                  TYPE
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {CHORD_TYPES.map((t) => {
                    const active = parsed.type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleSelectType(t)}
                        className={`h-9 rounded-full border text-xs sm:text-sm font-medium transition ${
                          active
                            ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BAR LYRICS INPUT */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
                    BAR LYRICS
                  </span>
                  {bar.lyrics && (
                    <button
                      type="button"
                      onClick={() => onUpdateBar({ ...bar, lyrics: undefined })}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={bar.lyrics || ''}
                  onChange={(e) =>
                    onUpdateBar({ ...bar, lyrics: e.target.value || undefined })
                  }
                  placeholder="Optional lyrics line for this bar (English / Sinhala)"
                  className="w-full h-11 px-4 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] font-sinhala text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:border-[#E5A958] focus:outline-none"
                />
              </div>
            </>
          ) : (
            /* CUES & SETTINGS MODE */
            <>
              {/* VOICE CUE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
                    VOICE CUE
                  </p>
                  {bar.cue && (
                    <button
                      type="button"
                      onClick={() => onUpdateBar({ ...bar, cue: undefined, customCueId: undefined })}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Clear cue
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={bar.cue || ''}
                  onChange={(e) =>
                    onUpdateBar({
                      ...bar,
                      cue: e.target.value || undefined,
                      customCueId: undefined,
                    })
                  }
                  placeholder="Select a studio voice cue or record/import your own"
                  className="w-full h-12 px-4 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:border-[#E5A958] focus:outline-none"
                />

                <div className="flex flex-wrap gap-2">
                  {BUNDLED_VOICE_CUES.map((cueItem) => {
                    const active = !bar.customCueId && bar.cue === cueItem.label;
                    return (
                      <button
                        key={cueItem.label}
                        type="button"
                        onClick={() => {
                          if (active) {
                            onUpdateBar({ ...bar, cue: undefined, customCueId: undefined });
                          } else {
                            onUpdateBar({ ...bar, cue: cueItem.label, customCueId: undefined });
                            onPreviewBundledCue(cueItem.url);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-medium transition ${
                          active
                            ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <Volume2 className="w-3 h-3 opacity-70" />
                        <span>{cueItem.label}</span>
                      </button>
                    );
                  })}
                </div>

                <CuePointLibrary
                  mode="bar-editor"
                  libraryVersion={libraryVersion}
                  selectedCustomCueId={bar.customCueId}
                  selectedBundledCueLabel={bar.cue}
                  onSelectBundledCue={(label, url) => {
                    onUpdateBar({ ...bar, cue: label, customCueId: undefined });
                    onPreviewBundledCue(url);
                  }}
                  onSelectCustomCue={(customCue) => {
                    onUpdateBar({
                      ...bar,
                      cue: customCue.name,
                      customCueId: customCue.id,
                    });
                  }}
                  onPreviewBundledCue={onPreviewBundledCue}
                  onPreviewCustomCue={onPreviewCustomCue}
                  onCustomCueRenamed={(renamed) => {
                    if (bar.customCueId === renamed.id) {
                      onUpdateBar({ ...bar, cue: renamed.name });
                    }
                  }}
                  onCustomCueDeleted={(deletedId) => {
                    if (bar.customCueId === deletedId) {
                      onUpdateBar({ ...bar, cue: undefined, customCueId: undefined });
                    }
                  }}
                  onCacheInvalidate={onCacheInvalidate}
                />
              </div>

              {/* Voice count locked to this bar */}
              <div className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[15px] font-medium text-[var(--text-primary)]">
                    Voice count locked to this bar
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed tabular-nums">
                    Counts this bar&apos;s {effectiveBeats} beats at {effectiveTempo} bpm · numbers restart at each group
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!bar.voiceCountLocked}
                  onClick={() =>
                    onUpdateBar({ ...bar, voiceCountLocked: !bar.voiceCountLocked })
                  }
                  className={`w-12 h-7 rounded-full p-1 transition shrink-0 ${
                    bar.voiceCountLocked ? 'bg-[#E5A958]' : 'bg-[var(--border-subtle)]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-[var(--switch-knob)] shadow-xs transition-transform ${
                      bar.voiceCountLocked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Last-Bar Voice Count / Cue Playback Pass Rule (for repeated sections) */}
              {isLastBarInSection && sectionRepeat && onUpdateSectionRepeat && (
                <div className="rounded-2xl bg-[var(--bg-recessed)] border border-[#E5A958]/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-3.5 h-3.5 text-[var(--accent-amber-text)] shrink-0" />
                    <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--accent-amber-text)] uppercase">
                      LAST-BAR VOICE COUNT / CUE PLAYBACK (×{Math.max(2, sectionRepeatCount)})
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Choose which repeat pass triggers this bar&apos;s voice cue &amp; spoken count:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateSectionRepeat({ lastBarCuePassRule: 'all' })}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                        sectionLastBarCuePassRule === 'all'
                          ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      All times
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSectionRepeat({ lastBarCuePassRule: 'first' })}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                        sectionLastBarCuePassRule === 'first' || sectionLastBarCuePassRule === 1
                          ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      1st time only
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSectionRepeat({ lastBarCuePassRule: 'last' })}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                        sectionLastBarCuePassRule === 'last' ||
                        sectionLastBarCuePassRule === Math.max(2, sectionRepeatCount)
                          ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      {Math.max(2, sectionRepeatCount) === 2
                        ? '2nd time only (Last time)'
                        : `${formatPassOrdinal(Math.max(2, sectionRepeatCount))} time only (Last time)`}
                    </button>
                    {Math.max(2, sectionRepeatCount) > 2 &&
                      Array.from({ length: Math.max(2, sectionRepeatCount) }, (_, i) => i + 1)
                        .filter((p) => p > 1 && p < Math.max(2, sectionRepeatCount))
                        .map((passNum) => (
                          <button
                            key={passNum}
                            type="button"
                            onClick={() => onUpdateSectionRepeat({ lastBarCuePassRule: passNum })}
                            className={`px-3 py-1.5 rounded-full border text-xs font-medium tabular-nums transition ${
                              sectionLastBarCuePassRule === passNum
                                ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                            }`}
                          >
                            {formatPassOrdinal(passNum)} pass
                          </button>
                        ))}
                  </div>
                </div>
              )}

              {/* COUNTING SYSTEM */}
              <div>
                <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
                  COUNTING SYSTEM
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1 mb-3 tabular-nums">
                  Spoken 1–7 MP3 count on each of this bar&apos;s {effectiveBeats} beats
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {DEFAULT_COUNTING_PRESETS.map((pattern) => {
                    const active = effectiveCounting === pattern;
                    return (
                      <button
                        key={pattern}
                        type="button"
                        onClick={() => onUpdateBar({ ...bar, countingSystem: pattern })}
                        className={`px-4 py-2 rounded-full border text-xs font-medium tracking-[0.2em] tabular-nums transition ${
                          active
                            ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                        }`}
                      >
                        {pattern}
                      </button>
                    );
                  })}
                  {customCountingSequences.map((pattern) => {
                    const active = effectiveCounting === pattern;
                    return (
                      <div
                        key={pattern}
                        className={`inline-flex items-center rounded-full border transition ${
                          active
                            ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onUpdateBar({ ...bar, countingSystem: pattern })}
                          className="pl-4 pr-1.5 py-2 text-xs font-medium tracking-[0.2em] tabular-nums"
                        >
                          {pattern}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomSequence(pattern)}
                          aria-label={`Remove custom sequence ${pattern}`}
                          className="pr-2.5 pl-1 py-2 text-[var(--text-muted)] hover:text-red-400 flex items-center justify-center transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bar.countingSystem || ''}
                    onChange={(e) =>
                      onUpdateBar({ ...bar, countingSystem: e.target.value || undefined })
                    }
                    placeholder="Custom sequence (1–7), e.g. 1 2 3 4 5 6"
                    className="flex-1 min-w-0 h-11 px-4 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:border-[#E5A958] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!canSaveCustomSequence}
                    onClick={handleSaveCustomSequence}
                    className="h-11 px-4 rounded-2xl bg-[#E5A958] hover:bg-[#ecb66c] disabled:opacity-40 disabled:hover:bg-[#E5A958] text-[#121212] text-xs font-bold uppercase tracking-wider shrink-0 transition"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* BAR METER */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
                    BAR METER
                  </span>
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">
                    {bar.meter ? `${effectiveBeats} beats` : 'Follows the song'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {BAR_METERS.map((m) => {
                    const active = effectiveMeter === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          onUpdateBar({
                            ...bar,
                            meter: m === songTimeSignature ? undefined : m,
                          })
                        }
                        className={`h-10 rounded-full border text-sm font-medium tabular-nums transition ${
                          active
                            ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BAR TEMPO */}
              <div>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
                      BAR TEMPO
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums">
                      Overrides this bar only · section is {songBpm}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {bar.tempo !== undefined && (
                      <button
                        type="button"
                        onClick={() => onUpdateBar({ ...bar, tempo: undefined })}
                        className="text-xs text-[var(--accent-amber-text)] underline"
                      >
                        Reset
                      </button>
                    )}
                    <input
                      type="number"
                      min={20}
                      max={300}
                      value={effectiveTempo}
                      onChange={(e) =>
                        onUpdateBar({
                          ...bar,
                          tempo: Math.max(20, Math.min(300, Number(e.target.value) || songBpm)),
                        })
                      }
                      className="w-20 h-11 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-center font-serif-display text-lg font-bold text-[var(--text-primary)] tabular-nums focus:border-[#E5A958] focus:outline-none"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={20}
                  max={240}
                  value={effectiveTempo}
                  onChange={(e) => onUpdateBar({ ...bar, tempo: Number(e.target.value) })}
                  className="amber-slider"
                />
              </div>

              {/* BEAT UNIT */}
              <div>
                <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase mb-2.5">
                  BEAT UNIT
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {BEAT_UNITS.map((unit) => {
                    const active = effectiveBeatUnit === unit;
                    return (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => onUpdateBar({ ...bar, beatUnit: unit })}
                        className={`h-10 rounded-full border text-xs sm:text-sm font-medium transition ${
                          active
                            ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {unit}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Repeat this bar */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <div>
                  <p className="text-[15px] font-medium text-[var(--text-primary)]">Repeat this bar</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
                    Plays it ×{repeatCount} in a row, live and in the export
                  </p>
                </div>
                <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-[var(--bg-recessed)] border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateBar({ ...bar, repeat: Math.max(1, repeatCount - 1) })
                    }
                    className="w-7 h-7 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center text-lg"
                  >
                    −
                  </button>
                  <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums min-w-[24px] text-center">
                    ×{repeatCount}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateBar({ ...bar, repeat: Math.min(16, repeatCount + 1) })
                    }
                    className="w-7 h-7 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Remove this bar */}
              <button
                type="button"
                onClick={onRemoveBar}
                style={{
                  backgroundColor: 'var(--danger-bg)',
                  borderColor: 'var(--danger-border)',
                  color: 'var(--danger-text)',
                }}
                className="w-full h-12 rounded-full border font-semibold text-sm flex items-center justify-center gap-2 transition hover:opacity-90"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove this bar</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
