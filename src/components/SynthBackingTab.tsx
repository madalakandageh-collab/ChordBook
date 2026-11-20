import React, { useEffect, useRef } from 'react';
import {
  AudioWaveform,
  Disc3,
  Download,
  Power,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  Zap,
} from 'lucide-react';
import type {
  Bar,
  MetronomeSettings,
  Section,
  Song,
  SynthBackingSettings,
} from '../types';
import {
  formatBarChordsSummary,
  getNormalizedArpLayers,
  getNormalizedDrumLayers,
  getNormalizedFxLayers,
  getNormalizedPadLayers,
  getNormalizedSynthLayers,
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
  onOpenExportAudio: () => void;
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
  onOpenExportAudio,
}) => {
  const activeMirrorBarRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isPlaying && activeMirrorBarRef.current) {
      activeMirrorBarRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isPlaying, activeBarId]);

  const displayKey = transposeKey(song.key, song.transpose || 0);
  const masterOn = synthSettings.masterEnabled;
  const showTrackDetails = synthSettings.showTrackDetailsInSections ?? true;
  const globalDrumsOn = synthSettings.drums?.enabled ?? true;
  const globalFxOn = synthSettings.fx?.enabled ?? true;
  const padBusActive = masterOn && !synthSettings.pad.muted;
  const synthBusActive = masterOn && !synthSettings.synth.muted;
  const arpBusActive = masterOn && !synthSettings.arp.muted;
  const drumsBusActive = masterOn && globalDrumsOn && !synthSettings.drums?.muted;
  const fxBusActive = masterOn && globalFxOn && !synthSettings.fx?.muted;
  const playableSections = song.sections.filter((sec) => !sec.isReference);

  let runningBarNum = 0;

  return (
    <div className="mt-5 space-y-4">
      {/* 1. Master Power Switch Card */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 transition-all duration-200 shadow-xs ${
          masterOn
            ? 'bg-[var(--bg-panel)] border-emerald-500/60 shadow-[0_0_24px_rgba(16,185,129,0.12)]'
            : 'bg-[var(--bg-panel)] border-[var(--border-subtle)]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-200 ${
                masterOn
                  ? 'bg-emerald-500/20 border-emerald-400/75 text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.45)]'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-55 shadow-none'
              }`}
            >
              <Power className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Synth &amp; Backing
              </h2>
              <span
                className={`inline-block w-3 h-3 rounded-full transition-all duration-200 ${
                  masterOn
                    ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.95),0_0_4px_rgba(167,243,208,0.95)] ring-2 ring-emerald-400/35'
                    : 'bg-zinc-600/50 border border-zinc-500/30 opacity-55 shadow-none'
                }`}
              />
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
            className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full border text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
              masterOn
                ? 'bg-emerald-500 text-[#071912] border-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.55)]'
                : 'bg-[var(--bg-recessed)] text-[var(--text-muted)] border-[var(--border-subtle)] opacity-75 hover:text-[var(--text-primary)] shadow-none'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                masterOn
                  ? 'bg-white shadow-[0_0_8px_#ffffff]'
                  : 'bg-zinc-500/50 shadow-none'
              }`}
            />
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

        {/* Toggle Switch: Show Track Details in Sections */}
        <div className="mt-3.5 pt-3.5 border-t border-[var(--border-subtle)]/70 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Show Track Details in Sections
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={showTrackDetails}
            onClick={() =>
              onUpdateSynthSettings({
                ...synthSettings,
                showTrackDetailsInSections: !showTrackDetails,
              })
            }
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold tracking-wider uppercase transition-all duration-200 shrink-0 ${
              showTrackDetails
                ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.3)]'
                : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-75 shadow-none'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                showTrackDetails
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]'
                  : 'bg-zinc-500/45 shadow-none'
              }`}
            />
            <span>{showTrackDetails ? 'ON' : 'OFF'}</span>
            <span
              className={`w-8 h-4 rounded-full p-0.5 flex items-center transition ${
                showTrackDetails ? 'bg-emerald-500' : 'bg-[var(--border-subtle)]'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${
                  showTrackDetails ? 'translate-x-4' : 'translate-x-0'
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
              Tap Green / Blue / Orange / Red / Purple dots per section · Tap any bar to jump &amp; play
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
            const activePadLayers = getNormalizedPadLayers(section.multiPad).filter((l) => l.enabled);
            const activeSynthLayers = getNormalizedSynthLayers(section.synth).filter((l) => l.enabled);
            const activeArpLayers = getNormalizedArpLayers(section.arp).filter((l) => l.enabled);
            const activeDrumLayers = section.drums?.enabled
              ? getNormalizedDrumLayers(section.drums).filter((l) => l.enabled)
              : [];
            const activeFxLayers = section.fx?.enabled
              ? getNormalizedFxLayers(section.fx).filter((l) => l.enabled)
              : [];

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

                  {showTrackDetails && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
                      {activePadLayers.map((layer, idx) => (
                        <button
                          key={layer.id || idx}
                          type="button"
                          onClick={() => onOpenSectionLayer(section.id, 'pad')}
                          className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                        >
                          Pad {idx + 1}: {layer.tone} (
                          {formatLayerBarRangeLabel(layer, secTotalBars)})
                        </button>
                      ))}
                      {activeSynthLayers.map((layer, idx) => (
                        <button
                          key={layer.id || idx}
                          type="button"
                          onClick={() => onOpenSectionLayer(section.id, 'synth')}
                          className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-400"
                        >
                          Synth {idx + 1}: {layer.tone} (
                          {formatLayerBarRangeLabel(layer, secTotalBars)})
                        </button>
                      ))}
                      {activeArpLayers.map((layer, idx) => (
                        <button
                          key={layer.id || idx}
                          type="button"
                          onClick={() => onOpenSectionLayer(section.id, 'arp')}
                          className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-400"
                        >
                          Arp {idx + 1}: {layer.tone} (
                          {formatLayerBarRangeLabel(layer, secTotalBars)})
                        </button>
                      ))}
                      {activeDrumLayers.map((layer, idx) => (
                        <button
                          key={layer.id || idx}
                          type="button"
                          onClick={() => onOpenSectionLayer(section.id, 'drums')}
                          className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400"
                        >
                          Drum {idx + 1}: {layer.kit} · {layer.pattern} (
                          {formatLayerBarRangeLabel(layer, secTotalBars)})
                        </button>
                      ))}
                      {activeFxLayers.map((fx, idx) => (
                        <button
                          key={fx.id || idx}
                          type="button"
                          onClick={() => onOpenSectionLayer(section.id, 'fx')}
                          className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/40 text-fuchsia-400"
                        >
                          FX {idx + 1}: {fx.effectType} (B{fx.startBar}:{fx.startBeat}, {fx.durationBars}b)
                        </button>
                      ))}
                    </div>
                  )}
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

      {/* 3. Offline Sound Buses (Multi-Pad / Synthesizer / Arpeggiator / Drums) */}
      <div className={`space-y-3.5 transition-opacity ${masterOn ? 'opacity-100' : 'opacity-60'}`}>
        {/* Multi-Pad Bus (Green Dots) */}
        <div
          className={`rounded-3xl bg-[var(--bg-panel)] border p-4 sm:p-5 space-y-4 shadow-xs transition-all duration-200 ${
            padBusActive
              ? 'border-emerald-500/45 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
              : 'border-[var(--border-subtle)]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                  padBusActive
                    ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.4)]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-55 shadow-none'
                }`}
              >
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Multi-Pad Bus (Per-Section)
                  </h3>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                      padBusActive
                        ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.95)] ring-2 ring-emerald-400/30'
                        : 'bg-zinc-600/45 border border-zinc-500/30 opacity-55 shadow-none'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Tap any section below or its green dot to stack pad layers, tones &amp; bar ranges
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                synthSettings.pad.muted
                  ? 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-red-400/80 opacity-75 shadow-none'
                  : padBusActive
                  ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.35)]'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-70 shadow-none'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-all ${
                  padBusActive
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]'
                    : 'bg-zinc-500/45 shadow-none'
                }`}
              />
              {synthSettings.pad.muted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2
                  className={`w-3.5 h-3.5 ${
                    padBusActive ? 'text-emerald-300' : 'text-[var(--text-muted)]'
                  }`}
                />
              )}
              <span>{synthSettings.pad.muted ? 'Muted' : 'Active'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {playableSections.map((sec) => {
              const activeLayers = getNormalizedPadLayers(sec.multiPad).filter((l) => l.enabled);
              const padOn = activeLayers.length > 0;
              const padLit = padOn && padBusActive;
              const totalBars = Math.max(1, getSectionTotalBars(sec));
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onOpenSectionLayer(sec.id, 'pad')}
                  className={`inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-medium transition-all duration-200 text-left ${
                    padLit
                      ? 'bg-emerald-500/15 border-emerald-400/65 text-[var(--text-primary)] shadow-[0_0_12px_rgba(52,211,153,0.22)]'
                      : padOn
                      ? 'bg-emerald-500/5 border-emerald-500/25 text-[var(--text-muted)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-75 hover:opacity-100 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                      padLit
                        ? 'bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,0.95)] ring-2 ring-emerald-400/30'
                        : padOn
                        ? 'bg-emerald-500/45 shadow-none'
                        : 'bg-zinc-500/45 shadow-none'
                    }`}
                  />
                  <span>{sec.name}</span>
                  {padOn && (
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      ·{' '}
                      {activeLayers
                        .map(
                          (l, idx) =>
                            `${activeLayers.length > 1 ? `L${idx + 1} ` : ''}${l.tone} (${formatLayerBarRangeLabel(l, totalBars)})`
                        )
                        .join(' + ')}
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

          <div className="pt-1 border-t border-[var(--border-subtle)]/70 flex items-center justify-between gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(synthSettings.pad.fillEmptyBars)}
              onClick={() =>
                onUpdateSynthSettings({
                  ...synthSettings,
                  pad: {
                    ...synthSettings.pad,
                    fillEmptyBars: !synthSettings.pad.fillEmptyBars,
                  },
                })
              }
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                synthSettings.pad.fillEmptyBars
                  ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.28)]'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-80 hover:opacity-100 hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] shadow-none'
              }`}
            >
              <span className="inline-flex items-center gap-2 text-left">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                    synthSettings.pad.fillEmptyBars
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]'
                      : 'bg-zinc-500/45 shadow-none'
                  }`}
                />
                <span>Fill Empty Bars (Pad Only)</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase shrink-0 transition-all ${
                  synthSettings.pad.fillEmptyBars
                    ? 'bg-emerald-500 text-[#071912] shadow-[0_0_10px_rgba(52,211,153,0.55)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] shadow-none'
                }`}
              >
                {synthSettings.pad.fillEmptyBars ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Synthesizer Bus (Blue Dots) */}
        <div
          className={`rounded-3xl bg-[var(--bg-panel)] border p-4 sm:p-5 space-y-4 shadow-xs transition-all duration-200 ${
            synthBusActive
              ? 'border-sky-500/45 shadow-[0_0_20px_rgba(56,189,248,0.08)]'
              : 'border-[var(--border-subtle)]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                  synthBusActive
                    ? 'bg-sky-500/20 border-sky-400/70 text-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.4)]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-55 shadow-none'
                }`}
              >
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Synthesizer Bus (Per-Section)
                  </h3>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                      synthBusActive
                        ? 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.95)] ring-2 ring-sky-400/30'
                        : 'bg-zinc-600/45 border border-zinc-500/30 opacity-55 shadow-none'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Tap any section below or its blue dot to layer keys, leads, basses &amp; bar ranges
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                synthSettings.synth.muted
                  ? 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-red-400/80 opacity-75 shadow-none'
                  : synthBusActive
                  ? 'bg-sky-500/15 border-sky-400/70 text-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.35)]'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-70 shadow-none'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-all ${
                  synthBusActive
                    ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.95)]'
                    : 'bg-zinc-500/45 shadow-none'
                }`}
              />
              {synthSettings.synth.muted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2
                  className={`w-3.5 h-3.5 ${
                    synthBusActive ? 'text-sky-300' : 'text-[var(--text-muted)]'
                  }`}
                />
              )}
              <span>{synthSettings.synth.muted ? 'Muted' : 'Active'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {playableSections.map((sec) => {
              const activeLayers = getNormalizedSynthLayers(sec.synth).filter((l) => l.enabled);
              const synthOn = activeLayers.length > 0;
              const synthLit = synthOn && synthBusActive;
              const totalBars = Math.max(1, getSectionTotalBars(sec));
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onOpenSectionLayer(sec.id, 'synth')}
                  className={`inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-medium transition-all duration-200 text-left ${
                    synthLit
                      ? 'bg-sky-500/15 border-sky-400/65 text-[var(--text-primary)] shadow-[0_0_12px_rgba(56,189,248,0.22)]'
                      : synthOn
                      ? 'bg-sky-500/5 border-sky-500/25 text-[var(--text-muted)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-75 hover:opacity-100 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                      synthLit
                        ? 'bg-sky-400 shadow-[0_0_9px_rgba(56,189,248,0.95)] ring-2 ring-sky-400/30'
                        : synthOn
                        ? 'bg-sky-500/45 shadow-none'
                        : 'bg-zinc-500/45 shadow-none'
                    }`}
                  />
                  <span>{sec.name}</span>
                  {synthOn && (
                    <span className="text-[10px] text-sky-400 font-semibold">
                      ·{' '}
                      {activeLayers
                        .map(
                          (l, idx) =>
                            `${activeLayers.length > 1 ? `L${idx + 1} ` : ''}${l.tone} (${formatLayerBarRangeLabel(l, totalBars)})`
                        )
                        .join(' + ')}
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

          <div className="pt-1 border-t border-[var(--border-subtle)]/70 flex items-center justify-between gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(synthSettings.synth.fillEmptyBars)}
              onClick={() =>
                onUpdateSynthSettings({
                  ...synthSettings,
                  synth: {
                    ...synthSettings.synth,
                    fillEmptyBars: !synthSettings.synth.fillEmptyBars,
                  },
                })
              }
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                synthSettings.synth.fillEmptyBars
                  ? 'bg-sky-500/15 border-sky-400/70 text-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.28)]'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-80 hover:opacity-100 hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] shadow-none'
              }`}
            >
              <span className="inline-flex items-center gap-2 text-left">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                    synthSettings.synth.fillEmptyBars
                      ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.95)]'
                      : 'bg-zinc-500/45 shadow-none'
                  }`}
                />
                <span>Fill Empty Bars (Synth Only)</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase shrink-0 transition-all ${
                  synthSettings.synth.fillEmptyBars
                    ? 'bg-sky-500 text-[#071620] shadow-[0_0_10px_rgba(56,189,248,0.55)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] shadow-none'
                }`}
              >
                {synthSettings.synth.fillEmptyBars ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Arpeggiator Bus (Orange Dots) */}
        <div
          className={`rounded-3xl bg-[var(--bg-panel)] border p-4 sm:p-5 space-y-4 shadow-xs transition-all duration-200 ${
            arpBusActive
              ? 'border-orange-500/45 shadow-[0_0_20px_rgba(251,146,60,0.08)]'
              : 'border-[var(--border-subtle)]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                  arpBusActive
                    ? 'bg-orange-500/20 border-orange-400/70 text-orange-300 shadow-[0_0_14px_rgba(251,146,60,0.4)]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-55 shadow-none'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Arpeggiator Bus (Per-Section)
                  </h3>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                      arpBusActive
                        ? 'bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.95)] ring-2 ring-orange-400/30'
                        : 'bg-zinc-600/45 border border-zinc-500/30 opacity-55 shadow-none'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Tap any section below or its orange dot to stack arp patterns, speeds &amp; bar ranges
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                synthSettings.arp.muted
                  ? 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-red-400/80 opacity-75 shadow-none'
                  : arpBusActive
                  ? 'bg-orange-500/15 border-orange-400/70 text-orange-300 shadow-[0_0_14px_rgba(251,146,60,0.35)]'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-70 shadow-none'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-all ${
                  arpBusActive
                    ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.95)]'
                    : 'bg-zinc-500/45 shadow-none'
                }`}
              />
              {synthSettings.arp.muted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2
                  className={`w-3.5 h-3.5 ${
                    arpBusActive ? 'text-orange-300' : 'text-[var(--text-muted)]'
                  }`}
                />
              )}
              <span>{synthSettings.arp.muted ? 'Muted' : 'Active'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {playableSections.map((sec) => {
              const activeLayers = getNormalizedArpLayers(sec.arp).filter((l) => l.enabled);
              const arpOn = activeLayers.length > 0;
              const arpLit = arpOn && arpBusActive;
              const totalBars = Math.max(1, getSectionTotalBars(sec));
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onOpenSectionLayer(sec.id, 'arp')}
                  className={`inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-medium transition-all duration-200 text-left ${
                    arpLit
                      ? 'bg-orange-500/15 border-orange-400/65 text-[var(--text-primary)] shadow-[0_0_12px_rgba(251,146,60,0.22)]'
                      : arpOn
                      ? 'bg-orange-500/5 border-orange-500/25 text-[var(--text-muted)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-75 hover:opacity-100 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                      arpLit
                        ? 'bg-orange-400 shadow-[0_0_9px_rgba(251,146,60,0.95)] ring-2 ring-orange-400/30'
                        : arpOn
                        ? 'bg-orange-500/45 shadow-none'
                        : 'bg-zinc-500/45 shadow-none'
                    }`}
                  />
                  <span>{sec.name}</span>
                  {arpOn && (
                    <span className="text-[10px] text-orange-400 font-semibold">
                      ·{' '}
                      {activeLayers
                        .map(
                          (l, idx) =>
                            `${activeLayers.length > 1 ? `L${idx + 1} ` : ''}${l.tone} (${formatLayerBarRangeLabel(l, totalBars)})`
                        )
                        .join(' + ')}
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

          <div className="pt-1 border-t border-[var(--border-subtle)]/70 flex items-center justify-between gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(synthSettings.arp.fillEmptyBars)}
              onClick={() =>
                onUpdateSynthSettings({
                  ...synthSettings,
                  arp: {
                    ...synthSettings.arp,
                    fillEmptyBars: !synthSettings.arp.fillEmptyBars,
                  },
                })
              }
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                synthSettings.arp.fillEmptyBars
                  ? 'bg-orange-500/15 border-orange-400/70 text-orange-300 shadow-[0_0_14px_rgba(251,146,60,0.28)]'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-80 hover:opacity-100 hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] shadow-none'
              }`}
            >
              <span className="inline-flex items-center gap-2 text-left">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                    synthSettings.arp.fillEmptyBars
                      ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.95)]'
                      : 'bg-zinc-500/45 shadow-none'
                  }`}
                />
                <span>Fill Empty Bars (Arp Only)</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase shrink-0 transition-all ${
                  synthSettings.arp.fillEmptyBars
                    ? 'bg-orange-500 text-[#1F1206] shadow-[0_0_10px_rgba(251,146,60,0.55)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] shadow-none'
                }`}
              >
                {synthSettings.arp.fillEmptyBars ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Drums & Rhythm Bus (Red/Coral Dots) */}
        <div
          className={`rounded-3xl bg-[var(--bg-panel)] border p-4 sm:p-5 space-y-4 shadow-xs transition-all duration-200 ${
            drumsBusActive
              ? 'border-rose-500/45 shadow-[0_0_20px_rgba(244,63,94,0.08)]'
              : globalDrumsOn
              ? 'border-[var(--border-subtle)]'
              : 'border-[var(--border-subtle)] opacity-75'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                  drumsBusActive
                    ? 'bg-rose-500/20 border-rose-400/70 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.4)]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-55 shadow-none'
                }`}
              >
                <Disc3 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Drums &amp; Rhythm Bus (Per-Section)
                  </h3>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                      drumsBusActive
                        ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.95)] ring-2 ring-rose-500/30'
                        : 'bg-zinc-600/45 border border-zinc-500/30 opacity-55 shadow-none'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  6 offline kits, 13 grooves (4/4, 3/4, 6/8 Baila &amp; Dadra) &amp; drum breaks
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Global Master Drums ON / OFF Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={globalDrumsOn}
                onClick={() =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    drums: {
                      ...(synthSettings.drums || { volumeDb: -4, pan: 0, muted: false, enabled: true }),
                      enabled: !globalDrumsOn,
                    },
                  })
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase transition-all duration-200 ${
                  globalDrumsOn
                    ? 'bg-rose-500 border-rose-300 text-white shadow-[0_0_16px_rgba(244,63,94,0.55)]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-75 hover:text-[var(--text-primary)] shadow-none'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full transition-all ${
                    globalDrumsOn
                      ? 'bg-white shadow-[0_0_8px_#ffffff]'
                      : 'bg-zinc-500/45 shadow-none'
                  }`}
                />
                <span>Master Drums: {globalDrumsOn ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    drums: {
                      ...(synthSettings.drums || { volumeDb: -4, pan: 0, muted: false, enabled: true }),
                      muted: !synthSettings.drums?.muted,
                    },
                  })
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                  synthSettings.drums?.muted
                    ? 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-red-400/80 opacity-75 shadow-none'
                    : drumsBusActive
                    ? 'bg-rose-500/15 border-rose-400/70 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.35)]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-70 shadow-none'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full transition-all ${
                    drumsBusActive
                      ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.95)]'
                      : 'bg-zinc-500/45 shadow-none'
                  }`}
                />
                {synthSettings.drums?.muted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2
                    className={`w-3.5 h-3.5 ${
                      drumsBusActive ? 'text-rose-300' : 'text-[var(--text-muted)]'
                    }`}
                  />
                )}
                <span>{synthSettings.drums?.muted ? 'Muted' : 'Active'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {playableSections.map((sec) => {
              const activeLayers = sec.drums?.enabled
                ? getNormalizedDrumLayers(sec.drums).filter((l) => l.enabled)
                : [];
              const drumsOn = activeLayers.length > 0;
              const drumsLit = drumsOn && drumsBusActive;
              const totalBars = Math.max(1, getSectionTotalBars(sec));
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onOpenSectionLayer(sec.id, 'drums')}
                  className={`inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-medium transition-all duration-200 text-left ${
                    drumsLit
                      ? 'bg-rose-500/15 border-rose-400/65 text-[var(--text-primary)] shadow-[0_0_12px_rgba(244,63,94,0.22)]'
                      : drumsOn
                      ? 'bg-rose-500/5 border-rose-500/25 text-[var(--text-muted)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-75 hover:opacity-100 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                      drumsLit
                        ? 'bg-rose-500 shadow-[0_0_9px_rgba(244,63,94,0.95)] ring-2 ring-rose-500/30'
                        : drumsOn
                        ? 'bg-rose-500/45 shadow-none'
                        : 'bg-zinc-500/45 shadow-none'
                    }`}
                  />
                  <span>{sec.name}</span>
                  {drumsOn && (
                    <span className="text-[10px] text-rose-400 font-semibold">
                      ·{' '}
                      {activeLayers
                        .map(
                          (l, idx) =>
                            `${activeLayers.length > 1 ? `D${idx + 1} ` : ''}${l.kit} (${formatLayerBarRangeLabel(l, totalBars)})`
                        )
                        .join(' + ')}
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
                  Drums Bus Volume
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatDbLabel(synthSettings.drums?.volumeDb ?? -4)}
                </span>
              </div>
              <input
                type="range"
                min={-36}
                max={6}
                step={0.5}
                value={synthSettings.drums?.volumeDb ?? -4}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    drums: {
                      ...(synthSettings.drums || { volumeDb: -4, pan: 0, muted: false, enabled: true }),
                      volumeDb: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-rose-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
                  Drums Bus Pan
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatPanLabel(synthSettings.drums?.pan ?? 0)}
                </span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={synthSettings.drums?.pan ?? 0}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    drums: {
                      ...(synthSettings.drums || { volumeDb: -4, pan: 0, muted: false, enabled: true }),
                      pan: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-rose-500"
              />
            </div>
          </div>
        </div>

        {/* FX / Risers Bus (Purple / Fuchsia Dots) */}
        <div
          className={`rounded-3xl bg-[var(--bg-panel)] border p-4 sm:p-5 space-y-4 shadow-xs transition-all duration-200 ${
            fxBusActive
              ? 'border-fuchsia-500/45 shadow-[0_0_20px_rgba(232,121,249,0.08)]'
              : globalFxOn
              ? 'border-[var(--border-subtle)]'
              : 'border-[var(--border-subtle)] opacity-75'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                  fxBusActive
                    ? 'bg-fuchsia-500/20 border-fuchsia-400/70 text-fuchsia-300 shadow-[0_0_14px_rgba(232,121,249,0.4)]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-55 shadow-none'
                }`}
              >
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    FX / Risers Bus (Per-Section)
                  </h3>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                      fxBusActive
                        ? 'bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.95)] ring-2 ring-fuchsia-400/30'
                        : 'bg-zinc-600/45 border border-zinc-500/30 opacity-55 shadow-none'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  16 offline risers, sweeps, reverse cymbals, drops &amp; textures synced to BPM &amp; meter
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={globalFxOn}
                onClick={() =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    fx: {
                      ...(synthSettings.fx || { volumeDb: -2, pan: 0, muted: false, enabled: true }),
                      enabled: !globalFxOn,
                    },
                  })
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase transition-all duration-200 ${
                  globalFxOn
                    ? 'bg-fuchsia-500 border-fuchsia-300 text-white shadow-[0_0_16px_rgba(232,121,249,0.55)]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-75 hover:text-[var(--text-primary)] shadow-none'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full transition-all ${
                    globalFxOn
                      ? 'bg-white shadow-[0_0_8px_#ffffff]'
                      : 'bg-zinc-500/45 shadow-none'
                  }`}
                />
                <span>Master FX: {globalFxOn ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    fx: {
                      ...(synthSettings.fx || { volumeDb: -2, pan: 0, muted: false, enabled: true }),
                      muted: !synthSettings.fx?.muted,
                    },
                  })
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                  synthSettings.fx?.muted
                    ? 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-red-400/80 opacity-75 shadow-none'
                    : fxBusActive
                    ? 'bg-fuchsia-500/15 border-fuchsia-400/70 text-fuchsia-300 shadow-[0_0_14px_rgba(232,121,249,0.35)]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-70 shadow-none'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full transition-all ${
                    fxBusActive
                      ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.95)]'
                      : 'bg-zinc-500/45 shadow-none'
                  }`}
                />
                {synthSettings.fx?.muted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2
                    className={`w-3.5 h-3.5 ${
                      fxBusActive ? 'text-fuchsia-300' : 'text-[var(--text-muted)]'
                    }`}
                  />
                )}
                <span>{synthSettings.fx?.muted ? 'Muted' : 'Active'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {playableSections.map((sec) => {
              const activeFx = sec.fx?.enabled
                ? getNormalizedFxLayers(sec.fx).filter((fx) => fx.enabled)
                : [];
              const fxOn = activeFx.length > 0;
              const fxLit = fxOn && fxBusActive;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onOpenSectionLayer(sec.id, 'fx')}
                  className={`inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-medium transition-all duration-200 text-left ${
                    fxLit
                      ? 'bg-fuchsia-500/15 border-fuchsia-400/65 text-[var(--text-primary)] shadow-[0_0_12px_rgba(232,121,249,0.22)]'
                      : fxOn
                      ? 'bg-fuchsia-500/5 border-fuchsia-500/25 text-[var(--text-muted)]'
                      : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-75 hover:opacity-100 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                      fxLit
                        ? 'bg-fuchsia-400 shadow-[0_0_9px_rgba(232,121,249,0.95)] ring-2 ring-fuchsia-400/30'
                        : fxOn
                        ? 'bg-fuchsia-500/45 shadow-none'
                        : 'bg-zinc-500/45 shadow-none'
                    }`}
                  />
                  <span>{sec.name}</span>
                  {fxOn && (
                    <span className="text-[10px] text-fuchsia-400 font-semibold">
                      ·{' '}
                      {activeFx
                        .map((fx) => `${fx.effectType} (B${fx.startBar}:${fx.startBeat}, ${fx.durationBars}b)`)
                        .join(' + ')}
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
                  FX Bus Volume
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatDbLabel(synthSettings.fx?.volumeDb ?? -2)}
                </span>
              </div>
              <input
                type="range"
                min={-36}
                max={6}
                step={0.5}
                value={synthSettings.fx?.volumeDb ?? -2}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    fx: {
                      ...(synthSettings.fx || { volumeDb: -2, pan: 0, muted: false, enabled: true }),
                      volumeDb: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-fuchsia-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold tracking-[0.14em] uppercase text-[var(--text-muted)]">
                  FX Bus Pan
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatPanLabel(synthSettings.fx?.pan ?? 0)}
                </span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={synthSettings.fx?.pan ?? 0}
                onChange={(e) =>
                  onUpdateSynthSettings({
                    ...synthSettings,
                    fx: {
                      ...(synthSettings.fx || { volumeDb: -2, pan: 0, muted: false, enabled: true }),
                      pan: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-fuchsia-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Full-Project Mixdown (Unified WAV / MP3 Track Selector Modal) */}
      <div className="rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-amber-tint)] border border-[#E5A958]/40 text-[var(--accent-amber-text)] flex items-center justify-center shrink-0">
              <AudioWaveform className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Full-Project Mixdown (Tone.Offline WAV &amp; MP3)
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Select any combination of Synth, Multi-Pad, Arp, Drums, FX / Risers, Click &amp; Voice Cues · Auto-named by song &amp; key
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
              masterOn
                ? 'bg-emerald-500/10 border-emerald-500/40 text-[var(--text-primary)]'
                : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                masterOn
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]'
                  : 'bg-zinc-500/45'
              }`}
            />
            <span>
              Synth Engine: <strong>{masterOn ? 'ON' : 'OFF'}</strong>
            </span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
              globalDrumsOn && masterOn
                ? 'bg-rose-500/10 border-rose-500/40 text-[var(--text-primary)]'
                : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                globalDrumsOn && masterOn
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.95)]'
                  : 'bg-zinc-500/45'
              }`}
            />
            <span>
              Drums Master: <strong>{globalDrumsOn ? 'ON' : 'OFF'}</strong>
            </span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
              globalFxOn && masterOn
                ? 'bg-fuchsia-500/10 border-fuchsia-500/40 text-[var(--text-primary)]'
                : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                globalFxOn && masterOn
                  ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.95)]'
                  : 'bg-zinc-500/45'
              }`}
            />
            <span>
              FX / Risers: <strong>{globalFxOn ? 'ON' : 'OFF'}</strong>
            </span>
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

        <button
          type="button"
          onClick={onOpenExportAudio}
          className="w-full h-12 rounded-2xl bg-[#E5A958] hover:bg-[#ecb66c] text-[#121212] font-bold text-sm flex items-center justify-center gap-2 shadow-md transition"
        >
          <Download className="w-4 h-4" />
          <span>Export Full Mix (WAV / MP3)</span>
        </button>
      </div>
    </div>
  );
};
