import React from 'react';
import { ArrowLeft, Lock, LockOpen, Repeat, Target } from 'lucide-react';
import type { Song, TimelineBar } from '../types';
import { formatBarChordsSummary, transposeKey } from '../utils/chords';
import { SectionLayerDotsCluster, type SectionLayerType } from './SectionMultiPadModal';
import { ChordDisplay } from './ChordDisplay';

interface PracticeSelectScreenProps {
  songs: Song[];
  onBack: () => void;
  onSelectSong: (songId: string) => void;
}

export const PracticeSelectScreen: React.FC<PracticeSelectScreenProps> = ({
  songs,
  onBack,
  onSelectSong,
}) => {
  return (
    <div
      style={{ paddingBottom: 'calc(8rem + var(--ad-banner-offset, 0px))' }}
      className="max-w-4xl mx-auto px-4 pt-4"
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to Your sheets"
        className="w-10 h-10 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center transition shadow-xs"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      <div className="mt-4">
        <p className="text-[11px] font-medium tracking-[0.24em] text-[var(--text-muted)] uppercase">
          PRACTICE
        </p>
        <h1 className="font-serif-display text-[36px] leading-[1.1] font-bold text-[var(--text-primary)] mt-1">
          Rehearse
        </h1>
        <p className="text-[14px] text-[var(--text-muted)] mt-1.5">
          Slow it down, loop a section and count yourself in.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {songs.length === 0 ? (
          <div className="md:col-span-2 py-12 px-4 text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
            <p className="text-[var(--text-primary)] font-medium text-sm">
              No songs available to practice yet
            </p>
            <p className="text-[var(--text-muted)] text-xs">
              Add a song in &ldquo;Your sheets&rdquo; first to start rehearsing.
            </p>
          </div>
        ) : (
          songs.map((song) => {
            const displayKey = transposeKey(song.key, song.transpose || 0);
            return (
              <button
                key={song.id}
                type="button"
                onClick={() => onSelectSong(song.id)}
                className="w-full flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] active:scale-[0.99] border border-[var(--border-subtle)] text-left transition shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[var(--accent-amber-tint-strong)] border border-[#E5A958]/30 text-[var(--accent-amber-text)] font-bold text-[15px] flex items-center justify-center shrink-0">
                    {displayKey}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-medium text-[var(--text-primary)] truncate">
                      {song.title}
                    </h2>
                    <p className="text-[13px] text-[var(--text-muted)] mt-0.5 tabular-nums">
                      {song.bpm} bpm · {song.timeSignature}
                    </p>
                  </div>
                </div>
                <Target className="w-5 h-5 text-[var(--accent-amber-text)] shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

interface PracticePlayerScreenProps {
  song: Song;
  timeline: TimelineBar[];
  activeStepIndex: number;
  currentBeat: number;
  isPlaying: boolean;
  isLocked: boolean;
  speed: 50 | 75 | 100;
  loopSectionId: string | null;
  sectionTransposes: Record<string, number>;
  onBack: () => void;
  onToggleLock: () => void;
  onTransposeAll: (delta: number) => void;
  onSpeedChange: (speed: 50 | 75 | 100) => void;
  onLoopSectionChange: (sectionId: string | null) => void;
  onSectionTransposeChange: (sectionId: string, delta: number) => void;
  onSeekToBarIndex: (index: number) => void;
  onOpenSectionLayer: (sectionId: string, layer: SectionLayerType) => void;
}

export const PracticePlayerScreen: React.FC<PracticePlayerScreenProps> = ({
  song,
  timeline,
  activeStepIndex,
  currentBeat,
  isPlaying,
  isLocked,
  speed,
  loopSectionId,
  sectionTransposes,
  onBack,
  onToggleLock,
  onTransposeAll,
  onSpeedChange,
  onLoopSectionChange,
  onSectionTransposeChange,
  onSeekToBarIndex,
  onOpenSectionLayer,
}) => {
  const safeIndex = Math.max(0, Math.min(activeStepIndex, Math.max(0, timeline.length - 1)));
  const currentStep = timeline[safeIndex];
  const displayKey = transposeKey(song.key, song.transpose || 0);
  const totalBars = timeline.length;
  const effectiveBpm = Math.round((currentStep?.effectiveBpm || song.bpm) * (speed / 100));

  const currentTotalTranspose = (song.transpose || 0) + (currentStep?.sectionTranspose || 0);
  const currentChordDisplay = currentStep
    ? formatBarChordsSummary(currentStep.bar, currentTotalTranspose, displayKey)
    : '—';

  // Upcoming 4 bars strip (starting at current bar)
  const upcomingBars = [0, 1, 2, 3].map((offset) => {
    const idx = safeIndex + offset;
    const step = timeline[idx];
    if (!step) return null;
    const tr = (song.transpose || 0) + step.sectionTranspose;
    return {
      idx,
      chord: formatBarChordsSummary(step.bar, tr, displayKey),
      isCurrent: offset === 0,
    };
  });

  return (
    <div
      style={{ paddingBottom: 'calc(8rem + var(--ad-banner-offset, 0px))' }}
      className="min-h-screen bg-[var(--bg-canvas)] transition-colors"
    >
      {/* Custom Practice Header (no blue bar) */}
      <div className="max-w-2xl mx-auto px-4 pt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Rehearse song list"
          className="w-10 h-10 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-medium tracking-[0.26em] text-[var(--text-muted)] uppercase">
          PRACTICE · THIS PHONE
        </span>

        <button
          type="button"
          onClick={onToggleLock}
          aria-label={isLocked ? 'Unlock controls' : 'Lock controls'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
            isLocked
              ? 'bg-[#E5A958] text-[#121212]'
              : 'bg-[var(--accent-amber-tint)] border border-[#E5A958] text-[var(--accent-amber-text)]'
          }`}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-5 space-y-4">
        {/* Song Title & Current Section */}
        <div className="text-center">
          <p className="text-[11px] font-medium tracking-[0.28em] text-[var(--text-muted)] uppercase">
            {song.title}
          </p>
          <h1 className="font-serif-display text-[22px] font-semibold text-[var(--accent-amber-text)] mt-1">
            {currentStep?.sectionName || song.sections[0]?.name || 'Start'}
          </h1>
        </div>

        {/* KEY Bar */}
        <div className="rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] px-4 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
              KEY
            </span>
            <span className="font-serif-display text-[22px] font-bold text-[var(--text-primary)]">
              {displayKey}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-[11px] tracking-[0.18em] text-[var(--text-muted)] uppercase">
              ALL
            </span>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onTransposeAll(-1)}
              className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] disabled:opacity-40 border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              {song.transpose > 0 ? `+${song.transpose}` : song.transpose}
            </span>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onTransposeAll(1)}
              className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] disabled:opacity-40 border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Main Active Chord Display */}
        <div className="rounded-3xl bg-[var(--bg-stage)] border border-[var(--border-subtle)] py-12 px-6 flex flex-col items-center justify-center text-center min-h-[205px] shadow-xs overflow-hidden">
          <div className="font-serif-display text-[48px] sm:text-[56px] leading-none font-bold text-[var(--text-primary)] max-w-full">
            <ChordDisplay chordText={currentChordDisplay} size="lg" />
          </div>
          {currentStep?.bar.lyrics && (
            <div className="mt-2 font-sinhala text-sm text-[var(--text-primary)]/85">
              {currentStep.bar.lyrics}
            </div>
          )}
          {currentStep?.bar.cue && (
            <div className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent-amber-text)]">
              Cue: {currentStep.bar.cue}
            </div>
          )}
          <p className="mt-5 text-[13px] text-[var(--text-muted)] tabular-nums">
            Bar {currentStep?.displayBarNumber || 1} of {totalBars} · {effectiveBpm} bpm ·{' '}
            {currentStep?.effectiveMeter || song.timeSignature}
          </p>
          {isPlaying && (
            <div className="mt-3 flex items-center gap-1.5">
              {Array.from({ length: currentStep?.beatsPerBar || 4 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-transform ${
                    currentBeat === i + 1
                      ? 'bg-[#E5A958] scale-125'
                      : 'bg-[var(--border-subtle)]'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* 4-Box Upcoming Bars Strip */}
        <div className="grid grid-cols-4 gap-2.5">
          {upcomingBars.map((item, i) => (
            <button
              key={i}
              type="button"
              disabled={!item}
              onClick={() => item && onSeekToBarIndex(item.idx)}
              className={`h-14 rounded-2xl border px-2 flex items-center justify-center font-serif-display text-[20px] font-semibold transition shadow-xs overflow-hidden ${
                item?.isCurrent
                  ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--text-primary)]'
                  : 'bg-[var(--bg-stage)] border-[var(--border-subtle)] text-[var(--text-primary)]/85 hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {item ? <ChordDisplay chordText={item.chord} size="sm" className="max-w-full" /> : ''}
            </button>
          ))}
        </div>

        {/* SPEED Card */}
        <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 space-y-3 shadow-xs">
          <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
            SPEED
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {([50, 75, 100] as const).map((pct) => {
              const active = speed === pct;
              return (
                <button
                  key={pct}
                  type="button"
                  disabled={isLocked}
                  onClick={() => onSpeedChange(pct)}
                  className={`h-11 rounded-2xl border text-sm font-semibold tabular-nums transition ${
                    active
                      ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)]/80 hover:text-[var(--text-primary)]'
                  } disabled:opacity-50`}
                >
                  {pct}%
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed tabular-nums">
            {effectiveBpm} bpm · clicks and spoken counts keep their natural pitch
          </p>
        </div>

        {/* LOOP Card */}
        <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 space-y-3 shadow-xs">
          <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
            LOOP
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onLoopSectionChange(null)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-semibold transition ${
                loopSectionId === null
                  ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)]/85 hover:text-[var(--text-primary)]'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Whole song</span>
            </button>
            {song.sections
              .filter((sec) => !sec.isReference)
              .map((sec) => {
                const active = loopSectionId === sec.id;
                return (
                  <div
                    key={sec.id}
                    className={`inline-flex items-center gap-1.5 pl-3.5 pr-1.5 py-1 rounded-full border transition ${
                      active
                        ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                        : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)]/85 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onLoopSectionChange(sec.id)}
                      className="py-1 text-xs font-medium text-left"
                    >
                      {sec.name}
                    </button>
                    <SectionLayerDotsCluster
                      section={sec}
                      disabled={isLocked}
                      onOpen={(layer) => onOpenSectionLayer(sec.id, layer)}
                    />
                  </div>
                );
              })}
          </div>
        </div>

        {/* SECTION KEYS Card */}
        <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 space-y-2.5 shadow-xs">
          <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase mb-1">
            SECTION KEYS
          </p>
          {song.sections
            .filter((sec) => !sec.isReference)
            .map((sec) => {
              const val = sectionTransposes[sec.id] ?? sec.transpose ?? 0;
              return (
                <div
                  key={sec.id}
                  className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] px-4 py-2.5 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">{sec.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => onSectionTransposeChange(sec.id, -1)}
                      className="w-8 h-8 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                      {val > 0 ? `+${val}` : val}
                    </span>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => onSectionTransposeChange(sec.id, 1)}
                      className="w-8 h-8 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
