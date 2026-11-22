import React from 'react';
import { ArrowLeft, Radio, Users, Wifi } from 'lucide-react';
import type { RoomPresence, Song, TimelineBar } from '../types';
import { formatBarChordsSummary, transposeKey } from '../utils/chords';
import { useWakeLock } from '../hooks/useWakeLock';
import { SectionLayerDotsCluster, type SectionLayerType } from './SectionMultiPadModal';
import { ChordDisplay } from './ChordDisplay';

interface LiveModeScreenProps {
  songs: Song[];
  activeSong: Song;
  timeline: TimelineBar[];
  activeStepIndex: number;
  currentBeat: number;
  isPlaying: boolean;
  isLocked: boolean;
  presence: RoomPresence;
  syncStatus: 'connecting' | 'connected' | 'offline';
  onBack: () => void;
  onSelectSong: (songId: string) => void;
  onTranspose: (delta: number) => void;
  onSeekToSection: (sectionId: string) => void;
  onSeekToBarIndex: (idx: number) => void;
  onOpenLocalWifi: () => void;
  onOpenSectionLayer: (sectionId: string, layer: SectionLayerType) => void;
}

export const LiveModeScreen: React.FC<LiveModeScreenProps> = ({
  songs,
  activeSong,
  timeline,
  activeStepIndex,
  currentBeat,
  isPlaying,
  isLocked,
  presence,
  syncStatus,
  onBack,
  onSelectSong,
  onTranspose,
  onSeekToSection,
  onSeekToBarIndex,
  onOpenLocalWifi,
  onOpenSectionLayer,
}) => {
  // Keep Leader screen awake on stage in Live Mode
  useWakeLock(true);

  const safeIdx = Math.max(0, Math.min(activeStepIndex, Math.max(0, timeline.length - 1)));
  const currentStep = timeline[safeIdx];
  const displayKey = transposeKey(activeSong.key, activeSong.transpose || 0);
  const totalTranspose = (activeSong.transpose || 0) + (currentStep?.sectionTranspose || 0);
  const currentChord = currentStep
    ? formatBarChordsSummary(currentStep.bar, totalTranspose, displayKey)
    : '—';

  const nextBars = [0, 1, 2, 3].map((offset) => {
    const idx = safeIdx + offset;
    const step = timeline[idx];
    if (!step) return null;
    const tr = (activeSong.transpose || 0) + step.sectionTranspose;
    return {
      idx,
      barNum: step.displayBarNumber,
      chord: formatBarChordsSummary(step.bar, tr, displayKey),
      cue: step.bar.cue,
      isCurrent: offset === 0,
    };
  });

  return (
    <div
      style={{ paddingBottom: 'calc(8rem + var(--ad-banner-offset, 0px))' }}
      className="max-w-4xl mx-auto px-4 pt-4 space-y-4"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Your sheets"
          className="w-10 h-10 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenLocalWifi}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium transition shadow-xs"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              syncStatus === 'connected' ? 'bg-emerald-500' : 'bg-[#E5A958]'
            }`}
          />
          <Users className="w-3.5 h-3.5 text-[var(--accent-amber-text)]" />
          <span className="text-[var(--text-primary)] tabular-nums">
            {presence.memberCount} {presence.memberCount === 1 ? 'member' : 'members'} synced
          </span>
          <Wifi className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* Stage Song Switcher */}
      <div>
        <p className="text-[11px] font-medium tracking-[0.22em] text-[var(--text-muted)] uppercase mb-2">
          LIVE STAGE · BROADCASTING TO ROOM {presence.roomId}
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {songs.map((s) => {
            const active = s.id === activeSong.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSong(s.id)}
                className={`px-3.5 py-2 rounded-full border text-xs font-medium whitespace-nowrap shrink-0 transition ${
                  active
                    ? 'bg-[#E5A958] border-[#E5A958] text-[#121212] font-semibold'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]/85 hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {s.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Song Banner + Key Transpose */}
      <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[var(--accent-amber-text)] font-medium">
            <Radio className="w-3.5 h-3.5" />
            <span>{currentStep?.sectionName || 'Start'}</span>
          </div>
          <h1 className="font-serif-display text-2xl font-bold text-[var(--text-primary)] truncate mt-0.5">
            {activeSong.title}
          </h1>
          <p className="text-xs text-[var(--text-muted)] tabular-nums">
            {activeSong.artist} · Key {displayKey} · {activeSong.bpm} bpm · {activeSong.timeSignature}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] tracking-[0.18em] text-[var(--text-muted)] uppercase">KEY</span>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onTranspose(-1)}
            className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] disabled:opacity-40 border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center"
          >
            −
          </button>
          <span className="w-8 text-center font-serif-display text-lg font-bold text-[var(--accent-amber-text)]">
            {displayKey}
          </span>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onTranspose(1)}
            className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] disabled:opacity-40 border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center"
          >
            +
          </button>
        </div>
      </div>

      {/* Big Stage Active Chord Display */}
      <div className="rounded-3xl bg-[var(--bg-stage)] border border-[var(--border-subtle)] py-12 px-6 flex flex-col items-center justify-center text-center shadow-xs overflow-hidden">
        <div className="font-serif-display text-[56px] sm:text-[68px] leading-none font-bold text-[var(--text-primary)] max-w-full">
          <ChordDisplay chordText={currentChord} size="lg" />
        </div>
        {currentStep?.bar.lyrics && (
          <div className="mt-2 font-sinhala text-base text-[var(--text-primary)]/90">
            {currentStep.bar.lyrics}
          </div>
        )}
        {currentStep?.bar.cue && (
          <div className="mt-3 px-3 py-1 rounded-full bg-[var(--accent-amber-tint)] border border-[#E5A958]/50 text-xs font-semibold text-[var(--accent-amber-text)] uppercase tracking-wider">
            {currentStep.bar.cue}
          </div>
        )}
        <p className="mt-4 text-sm text-[var(--text-muted)] tabular-nums">
          Bar {currentStep?.displayBarNumber || 1} of {timeline.length} · {currentStep?.effectiveBpm || activeSong.bpm} bpm · {currentStep?.effectiveMeter || activeSong.timeSignature}
        </p>
        {isPlaying && (
          <div className="mt-3 flex items-center gap-2">
            {Array.from({ length: currentStep?.beatsPerBar || 4 }).map((_, i) => (
              <span
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-transform ${
                  currentBeat === i + 1 ? 'bg-[#E5A958] scale-125' : 'bg-[var(--border-subtle)]'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Next 4 Bars */}
      <div className="grid grid-cols-4 gap-2.5">
        {nextBars.map((item, i) => (
          <button
            key={i}
            type="button"
            disabled={!item}
            onClick={() => item && onSeekToBarIndex(item.idx)}
            className={`relative h-20 rounded-2xl border px-2 flex flex-col items-center justify-center transition shadow-xs overflow-hidden ${
              item?.isCurrent
                ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            {item && (
              <>
                <span className="absolute top-1.5 left-2 text-[10px] text-[var(--text-subtle)] tabular-nums">
                  {item.barNum}
                </span>
                <ChordDisplay
                  chordText={item.chord}
                  size="sm"
                  className="font-serif-display text-xl font-bold max-w-full"
                />
                {item.cue && (
                  <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90%]">
                    {item.cue}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Section Jump Bar */}
      <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 shadow-xs">
        <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase mb-2.5">
          JUMP TO SECTION
        </p>
        <div className="flex flex-wrap gap-2.5">
          {activeSong.sections
            .filter((sec) => !sec.isReference)
            .map((sec) => {
              const isCurrentSec = currentStep?.sectionId === sec.id;
              return (
                <div
                  key={sec.id}
                  className={`inline-flex items-center gap-1.5 pl-3.5 pr-1.5 py-1 rounded-full border transition ${
                    isCurrentSec
                      ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)]/85 hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSeekToSection(sec.id)}
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
    </div>
  );
};
