import React, { useEffect, useRef, useState } from 'react';
import {
  AudioWaveform,
  Check,
  Download,
  Loader2,
  Power,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react';
import { exportFullProjectMixWav } from '../audio/synthEngine';
import type {
  Bar,
  MetronomeSettings,
  Section,
  Song,
  SynthBackingSettings,
} from '../types';
import {
  formatBarChordsSummary,
  getSectionTotalBars,
  hasBeatSplits,
  transposeKey,
} from '../utils/chords';
import {
  formatLayerBarRangeLabel,
  SectionLayerDotsCluster,
  type SectionLayerType,
} from './SectionMultiPadModal';

interface SynthBackingTabProps {
  song: Song;
  isPlaying: boolean;
  activeBarId: string | null;
  metronomeSettings: MetronomeSettings;
  synthSettings: SynthBackingSettings;
  onUpdateSynthSettings: (next: SynthBackingSettings) => void;
  onSeekToBarId: (sectionId: string, barId: string) => void;
  onOpenSectionLayer: (sectionId: string, layer: SectionLayerType) => void;
}

function formatPanLabel(pan: number): string {
  if (Math.abs(pan) < 0.04) return 'Center';
  const pct = Math.round(Math.abs(pan) * 100);
  return pan < 0 ? `L ${pct}%` : `R ${pct}%`;
}

function formatDbLabel(db: number): string {
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

export const SynthBackingTab: React.FC<SynthBackingTabProps> = ({
  song,
  isPlaying,
  activeBarId,
  metronomeSettings,
  synthSettings,
  onUpdateSynthSettings,
  onSeekToBarId,
  onOpenSectionLayer,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const [exportDoneName, setExportDoneName] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const activeMirrorBarRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isPlaying && activeMirrorBarRef.current) {
      activeMirrorBarRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isPlaying, activeBarId]);

  const displayKey = transposeKey(song.key, song.transpose || 0);
  const masterOn = synthSettings.masterEnabled;
  const playableSections = song.sections.filter((sec) => !sec.isReference);

  const handleExportFullMixWav = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    setExportDoneName(null);
    setExportProgress(5);
    setExportStage('Preparing Tone.Offline engine...');

    try {
      const { blob, filename } = await exportFullProjectMixWav({
        song,
        metronomeSettings,
        synthSettings,
        onProgress: (pct, stage) => {
          setExportProgress(pct);
          setExportStage(stage);
        },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      setExportDoneName(filename);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Unable to export full mix WAV file.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  let runningBarNum = 0;

  return (
    <div className="mt-5 space-y-4">
      {/* 1. Master Power Switch Card */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition shadow-xs ${
          masterOn
            ? 'bg-[var(--bg-panel)] border-[#E5A958]/70'
            : 'bg-[var(--bg-panel)] border-[var(--border-subtle)]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition ${
                masterOn
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <Power className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Synth &amp; Backing: {masterOn ? 'ON' : 'OFF'}
                </h2>
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    masterOn
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]'
                      : 'bg-[var(--text-subtle)]'
                  }`}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {masterOn
                  ? 'Tap Green (Multi-Pad), Blue (Synth), or Orange (Arp) section dots to configure per-section tones & bar ranges'
                  : 'Engine bypassed & disconnected to save CPU · Chord Sheet, Metronome, Cues & WAV Export remain active'}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={masterOn}
            onClick={() =>
              onUpdateSynthSettings({
                ...synthSettings,
                masterEnabled: !masterOn,
              })
            }
            className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full border text-xs font-bold tracking-wider uppercase transition ${
              masterOn
                ? 'bg-emerald-500 text-[#0B1612] border-emerald-400 shadow-sm'
                : 'bg-[var(--bg-recessed)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>{masterOn ? 'ON' : 'OFF'}</span>
            <span
              className={`w-9 h-5 rounded-full p-0.5 flex items-center transition ${
                masterOn ? 'bg-black/20' : 'bg-[var(--border-subtle)]'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                  masterOn ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* 2. Real-Time Synced Visual Chord Sheet Mirror */}
      <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
              LIVE CHORD SHEET MIRROR
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Tap Green / Blue / Orange dots per section · Tap any bar to jump &amp; play
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] tabular-nums">
            Key {displayKey} · {song.bpm} BPM · {song.timeSignature}
          </span>
        </div>

        <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
          {song.sections.map((section: Section) => {
            if (section.isReference) {
              return (
                <div
                  key={section.id}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-recessed)] border border-dashed border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)]"
                >
                  ({section.name})
                </div>
              );
            }

            const secTranspose = (song.transpose || 0) + (section.transpose || 0);
            const secTotalBars = Math.max(1, getSectionTotalBars(section));

            return (
              <div key={section.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {section.name}
                      {section.repeat
                        ? ` (||: :|| ×${Math.max(2, section.repeatCount ?? 2)})`
                        : ''}
                    </span>
                    <SectionLayerDotsCluster
                      section={section}
                      onOpen={(layer) => onOpenSectionLayer(section.id, layer)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
                    {section.multiPad?.enabled && (
                      <button
                        type="button"
                        onClick={() => onOpenSectionLayer(section.id, 'pad')}
                        className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                      >
                        Pad: {section.multiPad.tone} (
                        {formatLayerBarRangeLabel(section.multiPad, secTotalBars)})
                      </button>
                    )}
                    {section.synth?.enabled && (
                      <button
                        type="button"
                        onClick={() => onOpenSectionLayer(section.id, 'synth')}
                        className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400"
                      >
                        Synth: {section.synth.tone} (
                        {formatLayerBarRangeLabel(section.synth, secTotalBars)})
                      </button>
                    )}
                    {section.arp?.enabled && (
                      <button
                        type="button"
                        onClick={() => onOpenSectionLayer(section.id, 'arp')}
                        className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-400"
                      >
                        Arp: {section.arp.tone} (
                        {formatLayerBarRangeLabel(section.arp, secTotalBars)})
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {section.bars.map((bar: Bar) => {
                    const barNum = runningBarNum + 1;
                    const repeats = bar.repeat && bar.repeat > 1 ? bar.repeat : 1;
                    runningBarNum += repeats;

                    const isBarActive = isPlaying && activeBarId === bar.id;
                    const isSplit = hasBeatSplits(bar);
                    const chordLabel = formatBarChordsSummary(bar, secTranspose, displayKey);

                    return (
                      <button
                        key={bar.id}
                        ref={isBarActive ? activeMirrorBarRef : undefined}
                        type="button"
                        onClick={() => onSeekToBarId(section.id, bar.id)}
                        className={`relative min-h-[56px] rounded-xl border px-2 py-2 flex flex-col items-center justify-center text-center transition ${
                          isBarActive
                            ? 'bg-[var(--accent-amber-tint-strong)] border-[#E5A958] ring-2 ring-[#E5A958]/40'
                            : 'bg-[var(--bg-recessed)] hover:bg-[var(--bg-bar-hover)] border-[var(--border-subtle)]'
                        }`}
                      >
                        <span className="absolute top-1 left-2 text-[10px] text-[var(--text-subtle)] tabular-nums">
                          {barNum}
                        </span>
                        {repeats > 1 && (
                          <span className="absolute top-1 right-2 text-[10px] font-semibold text-[var(--accent-amber-text)] tabular-nums">
                            ×{repeats}
                          </span>
                        )}
                        <span
                          className={`font-serif-display font-semibold leading-tight max-w-full truncate ${
                            isSplit ? 'text-[12px] sm:text-[13px]' : 'text-[15px] sm:text-[16px]'
                          } ${
                            isBarActive ? 'text-[var(--accent-amber-text)]' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {chordLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Offline Sound Buses (Multi-Pad [Green] / Synthesizer [Blue] / Arpeggiator [Orange]) */}
      <div className={`space-y-3.5 transition-opacity ${masterOn ? 'opacity-100' : 'opacity-60'}`}>
        {/* Multi-Pad Bus (Green Dots) */}
        <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Multi-Pad Bus (Per-Section)
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.85)]" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Tap any section below or its green dot to set tone, pattern &amp; bar range (18 presets)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdateSynthSettings({
                  ...synthSettings,
                  pad: { ...synthSettings.pad, muted: !synthSettings.pad.muted },
                })
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                synthSettings.pad.muted
                  ? 'bg-red-500/15 border-red-500/40 text-red-400'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {synthSettings.pad.muted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{synthSettings.pad.muted ? 'Muted' : 'Active'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {playableSections.map((sec) => {
              const padOn = Boolean(sec.multiPad?.enabled);
              const totalBars = Math.max(1, getSectionTotalBars(sec));
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onOpenSectionLayer(sec.id, 'pad')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                    padOn
                      ? 'bg-emerald-500/10 border-emerald-500/45 text-[var(--text-primary)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      padOn
                        ? 'bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.9)]'
                        : 'bg-zinc-500/55'
                    }`}
                  />
                  <span>{sec.name}</span>
                  {padOn && (
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      · {sec.multiPad?.tone} ({formatLayerBarRangeLabel(sec.multiPad, totalBars)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
                  Pad Bus Volume
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatDbLabel(synthSettings.pad.volumeDb)}
                </span>
              </div>
              <input
                type="range"
                min={-36}
                max={6}
                step={0.5}
                value={synthSettings.pad.volumeDb}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    pad: { ...synthSettings.pad, volumeDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-emerald-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
                  Pad Bus Pan
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatPanLabel(synthSettings.pad.pan)}
                </span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={synthSettings.pad.pan}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    pad: { ...synthSettings.pad, pan: Number(e.target.value) },
                  })
                }
                className="w-full accent-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* Synthesizer Bus (Blue Dots) */}
        <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-400 flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Synthesizer Bus (Per-Section)
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.85)]" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Tap any section below or its blue dot to set keys, leads, basses &amp; bar range (18 presets)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdateSynthSettings({
                  ...synthSettings,
                  synth: { ...synthSettings.synth, muted: !synthSettings.synth.muted },
                })
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                synthSettings.synth.muted
                  ? 'bg-red-500/15 border-red-500/40 text-red-400'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {synthSettings.synth.muted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>{synthSettings.synth.muted ? 'Muted' : 'Active'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {playableSections.map((sec) => {
              const synthOn = Boolean(sec.synth?.enabled);
              const totalBars = Math.max(1, getSectionTotalBars(sec));
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onOpenSectionLayer(sec.id, 'synth')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                    synthOn
                      ? 'bg-sky-500/10 border-sky-500/45 text-[var(--text-primary)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      synthOn
                        ? 'bg-sky-400 shadow-[0_0_7px_rgba(56,189,248,0.9)]'
                        : 'bg-zinc-500/55'
                    }`}
                  />
                  <span>{sec.name}</span>
                  {synthOn && (
                    <span className="text-[10px] text-sky-400 font-semibold">
                      · {sec.synth?.tone} ({formatLayerBarRangeLabel(sec.synth, totalBars)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
                  Synth Bus Volume
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatDbLabel(synthSettings.synth.volumeDb)}
                </span>
              </div>
              <input
                type="range"
                min={-36}
                max={6}
                step={0.5}
                value={synthSettings.synth.volumeDb}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    synth: { ...synthSettings.synth, volumeDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-sky-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
                  Synth Bus Pan
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatPanLabel(synthSettings.synth.pan)}
                </span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={synthSettings.synth.pan}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    synth: { ...synthSettings.synth, pan: Number(e.target.value) },
                  })
                }
                className="w-full accent-sky-400"
              />
            </div>
          </div>
        </div>

        {/* Arpeggiator Bus (Orange Dots) */}
        <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Arpeggiator Bus (Per-Section)
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.85)]" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Tap any section below or its orange dot to set arp pattern, speed, tone &amp; bar range (18 presets)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdateSynthSettings({
                  ...synthSettings,
                  arp: { ...synthSettings.arp, muted: !synthSettings.arp.muted },
                })
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                synthSettings.arp.muted
                  ? 'bg-red-500/15 border-red-500/40 text-red-400'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {synthSettings.arp.muted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-orange-400" />
              )}
              <span>{synthSettings.arp.muted ? 'Muted' : 'Active'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {playableSections.map((sec) => {
              const arpOn = Boolean(sec.arp?.enabled);
              const totalBars = Math.max(1, getSectionTotalBars(sec));
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onOpenSectionLayer(sec.id, 'arp')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                    arpOn
                      ? 'bg-orange-500/10 border-orange-500/45 text-[var(--text-primary)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      arpOn
                        ? 'bg-orange-400 shadow-[0_0_7px_rgba(251,146,60,0.9)]'
                        : 'bg-zinc-500/55'
                    }`}
                  />
                  <span>{sec.name}</span>
                  {arpOn && (
                    <span className="text-[10px] text-orange-400 font-semibold">
                      · {sec.arp?.tone} ({formatLayerBarRangeLabel(sec.arp, totalBars)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
                  Arp Bus Volume
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatDbLabel(synthSettings.arp.volumeDb)}
                </span>
              </div>
              <input
                type="range"
                min={-36}
                max={6}
                step={0.5}
                value={synthSettings.arp.volumeDb}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    arp: { ...synthSettings.arp, volumeDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-orange-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
                  Arp Bus Pan
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatPanLabel(synthSettings.arp.pan)}
                </span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={synthSettings.arp.pan}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    arp: { ...synthSettings.arp, pan: Number(e.target.value) },
                  })
                }
                className="w-full accent-orange-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Full-Project State 16-Bit Stereo WAV Export (Tone.Offline) */}
      <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-amber-tint)] border border-[#E5A958]/40 text-[var(--accent-amber-text)] flex items-center justify-center shrink-0">
              <AudioWaveform className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Full-Project Mixdown (Tone.Offline)
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Captures Per-Section Multi-Pad, Synth, Arpeggiator (with Bar Ranges), Metronome Click, Voice Cues &amp; Count-in · 44.1 kHz 16-Bit Stereo WAV
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
            Synth Engine: <strong>{masterOn ? 'ON' : 'OFF'}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
            Click: <strong>{metronomeSettings.clickVolume}% ({metronomeSettings.clickBalance})</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
            Cues &amp; Counts:{' '}
            <strong>
              {metronomeSettings.voiceVolume}% ({metronomeSettings.voiceBalance})
              {metronomeSettings.countInBar ? ' + Count-In' : ''}
            </strong>
          </span>
        </div>

        {isExporting && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">{exportStage}</span>
              <span className="font-semibold text-[var(--accent-amber-text)] tabular-nums">
                {exportProgress}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-recessed)] overflow-hidden">
              <div
                className="h-full bg-[#E5A958] transition-all duration-200"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        {exportDoneName && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-xs font-medium text-emerald-400">
            <Check className="w-4 h-4 shrink-0" />
            <span>Downloaded {exportDoneName}</span>
          </div>
        )}

        {exportError && (
          <div className="rounded-xl bg-red-500/15 border border-red-500/40 px-3 py-2 text-xs font-medium text-red-400">
            {exportError}
          </div>
        )}

        <button
          type="button"
          disabled={isExporting}
          onClick={() => void handleExportFullMixWav()}
          className="w-full h-12 rounded-2xl bg-[#E5A958] hover:bg-[#ecb66c] disabled:opacity-60 text-[#121212] font-bold text-sm flex items-center justify-center gap-2 shadow-md transition"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{isExporting ? 'Rendering Full Mix WAV...' : 'Export Full Mix (WAV)'}</span>
        </button>
      </div>
    </div>
  );
};
