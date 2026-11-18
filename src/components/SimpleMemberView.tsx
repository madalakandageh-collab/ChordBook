import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, Moon, Sun } from 'lucide-react';
import type { RoomSyncState, Song } from '../types';
import type { SyncConnectionStatus } from '../hooks/useRoomSync';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  buildSongTimeline,
  formatBarChordsSummary,
  hasBeatSplits,
  transposeKey,
} from '../utils/chords';
import {
  MEMBER_THEME_KEY,
  applyDocumentTheme,
  loadThemePreference,
  saveThemePreference,
  type ThemeMode,
} from '../utils/theme';
import { PWAInstallButton } from './PWAInstallButton';

interface SimpleMemberViewProps {
  roomId: string;
  syncStatus: SyncConnectionStatus;
  syncedState: RoomSyncState | null;
  fallbackSong: Song;
  clockOffsetMs: number;
  isPreview?: boolean;
  onExitPreview?: () => void;
}

export const SimpleMemberView: React.FC<SimpleMemberViewProps> = ({
  roomId,
  syncStatus,
  syncedState,
  fallbackSong,
  clockOffsetMs,
  isPreview = false,
  onExitPreview,
}) => {
  const [tab, setTab] = useState<'chords' | 'lyrics'>('chords');
  const [tickBarIndex, setTickBarIndex] = useState<number>(0);
  const [memberTheme, setMemberTheme] = useState<ThemeMode>(() =>
    loadThemePreference(MEMBER_THEME_KEY)
  );

  // Persist & apply independent Band Member theme on this device
  useEffect(() => {
    saveThemePreference(MEMBER_THEME_KEY, memberTheme);
    applyDocumentTheme(memberTheme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', memberTheme === 'light' ? '#F8F9FA' : '#121212');
    }
  }, [memberTheme]);

  // Keep Band Member's screen awake on stage
  const wakeLockActive = useWakeLock(true);

  const activeSong = syncedState?.song || fallbackSong;
  const globalTranspose = syncedState?.transpose ?? activeSong.transpose ?? 0;
  const sectionTransposes = syncedState?.sectionTransposes ?? {};
  const isPlaying = syncedState?.isPlaying ?? false;
  const speed = syncedState?.speed ?? 100;
  const tempoOverride = syncedState?.tempoOverride ?? null;
  const loopSectionId = syncedState?.loopSectionId ?? null;

  const timeline = useMemo(
    () => buildSongTimeline(activeSong, sectionTransposes, loopSectionId),
    [activeSong, sectionTransposes, loopSectionId]
  );

  // Millisecond-synchronized bar tracking using server clock offset!
  useEffect(() => {
    if (!syncedState) return;
    if (!syncedState.isPlaying || !syncedState.playStartedAtServerTime) {
      setTickBarIndex(syncedState.activeBarIndex || 0);
      return;
    }

    const computeExactBar = () => {
      if (!timeline.length) return;
      const estimatedServerNow = Date.now() + clockOffsetMs;
      const elapsedSec = Math.max(
        0,
        (estimatedServerNow - (syncedState.playStartedAtServerTime || estimatedServerNow)) / 1000
      );

      let remaining = elapsedSec;
      let idx = Math.max(0, Math.min(syncedState.playStartBarIndex || 0, timeline.length - 1));

      // Step through timeline using exact bar durations
      for (let guard = 0; guard < 1000; guard++) {
        const step = timeline[idx];
        if (!step) break;
        const rawBpm = tempoOverride || step.effectiveBpm || activeSong.bpm;
        const effectiveBpm = Math.max(10, rawBpm * (speed / 100));
        const barDurationSec = (60 / effectiveBpm) * step.beatsPerBar;
        if (remaining < barDurationSec) {
          break;
        }
        remaining -= barDurationSec;
        idx += 1;
        if (idx >= timeline.length) {
          if (loopSectionId) {
            idx = 0;
          } else {
            idx = timeline.length - 1;
            break;
          }
        }
      }
      setTickBarIndex(idx);
    };

    computeExactBar();
    const interval = window.setInterval(computeExactBar, 80);
    return () => clearInterval(interval);
  }, [syncedState, clockOffsetMs, timeline, tempoOverride, activeSong.bpm, speed, loopSectionId]);

  const currentStep = timeline[tickBarIndex] || timeline[0];
  const activeBarId = currentStep?.barId || null;
  const activeSectionId = currentStep?.sectionId || syncedState?.activeSectionId || null;

  const activeBarRef = useRef<HTMLDivElement | null>(null);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tab === 'chords' && activeBarRef.current) {
      activeBarRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeBarId, tab]);

  useEffect(() => {
    if (tab === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSectionId, tab]);

  const displayKey = transposeKey(activeSong.key, globalTranspose);
  const effectiveBpm = Math.round(
    (tempoOverride || currentStep?.effectiveBpm || activeSong.bpm) * (speed / 100)
  );

  let runningBarNum = 0;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-16 transition-colors">
      {/* Minimal Read-Only Member Header */}
      <header
        style={{ backgroundColor: 'var(--bg-header-sticky)' }}
        className="sticky top-0 z-30 backdrop-blur-md border-b border-[var(--border-subtle)] px-3 sm:px-4 py-3"
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: LIVE SYNCED badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'connected'
                  ? 'bg-emerald-500'
                  : syncStatus === 'connecting'
                  ? 'bg-[#E5A958]'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--text-primary)] whitespace-nowrap">
              {syncStatus === 'connected' ? 'LIVE SYNCED' : `ROOM ${roomId}`}
            </span>
          </div>

          {/* Center: Song Title & Artist */}
          <div className="text-center min-w-0 flex-1">
            <h1 className="font-serif-display text-[16px] sm:text-[17px] font-bold text-[var(--text-primary)] truncate leading-tight">
              {activeSong.title}
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] truncate">{activeSong.artist}</p>
          </div>

          {/* Right: Current Key + BPM pill + Independent Theme Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="px-2.5 sm:px-3 py-1 rounded-full bg-[var(--accent-amber-tint)] border border-[#E5A958]/60 text-[var(--accent-amber-text)] text-xs font-bold tabular-nums whitespace-nowrap">
              {displayKey} · {effectiveBpm} bpm
            </div>

            <button
              type="button"
              onClick={() => setMemberTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label={memberTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={memberTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-8 h-8 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center transition active:scale-95"
            >
              {memberTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#E5A958]" />
              ) : (
                <Moon className="w-4 h-4 text-[#6E7BF2]" />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* Optional PWA Add to Home Screen prompt for Chordbook Stage */}
        <PWAInstallButton appName="Chordbook Stage" variant="banner" />

        {/* Clean Segmented Toggle: CHORDS | LYRICS */}
        <div className="p-1 rounded-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] grid grid-cols-2 shadow-xs">
          <button
            type="button"
            onClick={() => setTab('chords')}
            className={`py-2.5 rounded-full text-[13px] font-bold tracking-[0.16em] uppercase transition ${
              tab === 'chords'
                ? 'bg-[#E5A958] text-[#121212]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            CHORDS
          </button>
          <button
            type="button"
            onClick={() => setTab('lyrics')}
            className={`py-2.5 rounded-full text-[13px] font-bold tracking-[0.16em] uppercase transition ${
              tab === 'lyrics'
                ? 'bg-[#E5A958] text-[#121212]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            LYRICS
          </button>
        </div>

        {/* Read-Only High-Contrast Stage Content */}
        {tab === 'chords' ? (
          <div className="space-y-4">
            {activeSong.sections.map((section) => {
              if (section.isReference) {
                return (
                  <section
                    key={section.id}
                    className="rounded-3xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 sm:px-5 py-3 flex items-center justify-between"
                  >
                    <h2 className="font-serif-display text-[19px] font-bold text-[var(--text-primary)]">
                      ({section.name})
                    </h2>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                      Reference
                    </span>
                  </section>
                );
              }

              const secTranspose =
                globalTranspose + (sectionTransposes[section.id] ?? section.transpose ?? 0);
              const isSectionPlaying = isPlaying && activeSectionId === section.id;
              const isRepeatOn = Boolean(section.repeat);
              const repeatCount = Math.max(2, section.repeatCount ?? 2);

              return (
                <section
                  key={section.id}
                  className={`rounded-3xl border p-4 sm:p-5 transition ${
                    isSectionPlaying
                      ? 'bg-[var(--accent-amber-tint)]/55 border-[#E5A958]/60'
                      : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2
                        className={`font-serif-display text-[22px] font-bold truncate ${
                          isSectionPlaying
                            ? 'text-[var(--accent-amber-text)]'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {section.name}
                      </h2>
                      {isRepeatOn && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent-amber-tint)] border border-[#E5A958]/60 text-[11px] font-bold text-[var(--accent-amber-text)] tabular-nums shrink-0">
                          ||: :|| ×{repeatCount}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums shrink-0">
                      {activeSong.timeSignature}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5">
                    {section.bars.map((bar, barIdx) => {
                      const barNum = runningBarNum + 1;
                      const repeats = bar.repeat && bar.repeat > 1 ? bar.repeat : 1;
                      runningBarNum += repeats;

                      const isFirstInRepeat = isRepeatOn && barIdx === 0;
                      const isLastInRepeat = isRepeatOn && barIdx === section.bars.length - 1;
                      const isActive = isPlaying && activeBarId === bar.id;
                      const isSplit = hasBeatSplits(bar);
                      const chordText = formatBarChordsSummary(bar, secTranspose, displayKey);

                      return (
                        <div
                          key={bar.id}
                          ref={isActive ? activeBarRef : undefined}
                          className={`relative min-h-[88px] rounded-2xl border p-2 flex flex-col items-center justify-center text-center transition ${
                            isActive
                              ? 'bg-[var(--accent-amber-active-bar)] border-[#E5A958] ring-2 ring-[#E5A958]/50 scale-[1.02]'
                              : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)]'
                          }`}
                        >
                          <span className="absolute top-2 left-2.5 flex items-center gap-1 text-[11px] text-[var(--text-subtle)] tabular-nums">
                            <span>{barNum}</span>
                            {isFirstInRepeat && (
                              <span className="font-mono text-[11px] font-bold text-[var(--accent-amber-text)]">
                                ||:
                              </span>
                            )}
                          </span>
                          {(repeats > 1 || isLastInRepeat) && (
                            <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold text-[var(--accent-amber-text)] tabular-nums">
                              {repeats > 1 && <span>×{repeats}</span>}
                              {isLastInRepeat && (
                                <span className="font-mono text-[11px] font-bold">:||</span>
                              )}
                            </span>
                          )}
                          <span
                            className={`font-serif-display ${
                              isSplit ? 'text-[16px] sm:text-[18px]' : 'text-[22px] sm:text-[26px]'
                            } font-bold max-w-full truncate ${
                              isActive
                                ? 'text-[var(--accent-amber-text)]'
                                : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {chordText}
                          </span>
                          {bar.lyrics && (
                            <span className="text-[10px] font-sinhala text-[var(--text-muted)] mt-1 truncate max-w-full">
                              {bar.lyrics}
                            </span>
                          )}
                          {bar.cue && (
                            <span className="text-[10px] text-[var(--accent-amber-text)] mt-0.5 truncate max-w-full">
                              {bar.cue}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-6 space-y-6 shadow-xs">
            {activeSong.lyrics.map((lyr) => {
              const currentSectionObj = activeSong.sections.find((s) => s.id === activeSectionId);
              const isHighlighted =
                isPlaying &&
                currentSectionObj &&
                currentSectionObj.name.toLowerCase().includes(lyr.label.toLowerCase());

              return (
                <div
                  key={lyr.id}
                  ref={isHighlighted ? activeLyricRef : undefined}
                  className={`rounded-2xl transition ${
                    isHighlighted
                      ? 'bg-[var(--accent-amber-tint)] p-4 border border-[#E5A958]/50'
                      : ''
                  }`}
                >
                  <h3
                    className={`text-[16px] font-semibold mb-2.5 ${
                      isHighlighted
                        ? 'text-[var(--accent-amber-text)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {lyr.label}
                  </h3>
                  <div className="font-sinhala space-y-2 text-[22px] sm:text-[24px] leading-[1.7] text-[var(--text-primary)]">
                    {lyr.lines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-[var(--text-subtle)] pt-2">
          Chordbook Stage · Read-only live sync{wakeLockActive ? ' · Screen kept awake' : ''}
        </p>
      </div>

      {/* Exit Preview Pill (ONLY shown when Leader clicks "Preview Member App") */}
      {isPreview && onExitPreview && (
        <div className="fixed bottom-5 right-5 z-50">
          <button
            type="button"
            onClick={onExitPreview}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#6E7BF2] hover:bg-[#7d89f5] text-white font-semibold text-xs shadow-xl transition"
          >
            <EyeOff className="w-4 h-4" />
            <span>Exit Member Preview</span>
          </button>
        </div>
      )}
    </div>
  );
};
