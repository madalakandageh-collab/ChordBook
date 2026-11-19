import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Play, Power, Sliders, Sparkles, Waves, X } from 'lucide-react';
import {
  ARP_PATTERN_OPTIONS,
  ARP_PRESET_CATALOG,
  ARP_SUBDIVISION_OPTIONS,
  DEFAULT_SECTION_ARP,
  DEFAULT_SECTION_MULTI_PAD,
  DEFAULT_SECTION_SYNTH,
  PAD_PRESET_CATALOG,
  SECTION_PAD_PATTERN_OPTIONS,
  SECTION_SYNTH_PATTERN_OPTIONS,
  SYNTH_PRESET_CATALOG,
  type PresetCatalogItem,
} from '../audio/synthEngine';
import type {
  ArpPatternType,
  ArpPresetId,
  PadPresetId,
  Section,
  SectionArpConfig,
  SectionMultiPadConfig,
  SectionPadPattern,
  SectionSynthConfig,
  SectionSynthPattern,
  SynthPresetId,
} from '../types';
import { getSectionTotalBars } from '../utils/chords';

export type SectionLayerType = 'pad' | 'synth' | 'arp';

export function formatLayerBarRangeLabel(
  config:
    | {
        enabled?: boolean;
        barRangeMode?: 'all' | 'custom';
        startBar?: number;
        endBar?: number;
      }
    | undefined,
  sectionTotalBars: number
): string {
  if (!config?.barRangeMode || config.barRangeMode === 'all') {
    return 'All Bars';
  }
  const maxBar = Math.max(1, sectionTotalBars);
  const start = Math.max(1, Math.min(maxBar, config.startBar ?? 1));
  const end = Math.max(start, Math.min(maxBar, config.endBar ?? maxBar));
  return start === end ? `Bar ${start}` : `Bars ${start}–${end}`;
}

interface SectionLayerDotsClusterProps {
  section: Section;
  disabled?: boolean;
  onOpen: (layer: SectionLayerType) => void;
  className?: string;
}

export const SectionLayerDotsCluster: React.FC<SectionLayerDotsClusterProps> = ({
  section,
  disabled = false,
  onOpen,
  className = '',
}) => {
  const padOn = Boolean(section.multiPad?.enabled);
  const synthOn = Boolean(section.synth?.enabled);
  const arpOn = Boolean(section.arp?.enabled);
  const totalBars = Math.max(1, getSectionTotalBars(section));

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onPointerDown={stop}
      onClick={stop}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 bg-[var(--bg-recessed)]/90 border border-[var(--border-subtle)] ${className}`}
    >
      {/* Green Dot: Multi-Pad */}
      <button
        type="button"
        disabled={disabled}
        title={
          padOn
            ? `Multi-Pad ON · ${section.multiPad?.tone || DEFAULT_SECTION_MULTI_PAD.tone} (${formatLayerBarRangeLabel(section.multiPad, totalBars)})`
            : `Configure Multi-Pad (Green) for ${section.name}`
        }
        aria-label={`Configure Multi-Pad for ${section.name}`}
        onPointerDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) onOpen('pad');
        }}
        className="group/dot inline-flex items-center justify-center p-0.5 rounded-full focus:outline-none disabled:opacity-45"
      >
        <span
          className={`block w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
            padOn
              ? 'bg-emerald-400 border-emerald-200 shadow-[0_0_9px_rgba(52,211,153,0.95)] ring-2 ring-emerald-400/35 group-hover/dot:scale-125'
              : 'bg-zinc-400/50 dark:bg-zinc-600 border-emerald-500/40 opacity-75 group-hover/dot:opacity-100 group-hover/dot:bg-emerald-400/50 group-hover/dot:scale-115'
          }`}
        />
      </button>

      {/* Blue Dot: Synth */}
      <button
        type="button"
        disabled={disabled}
        title={
          synthOn
            ? `Synth ON · ${section.synth?.tone || DEFAULT_SECTION_SYNTH.tone} (${formatLayerBarRangeLabel(section.synth, totalBars)})`
            : `Configure Synth (Blue) for ${section.name}`
        }
        aria-label={`Configure Synth for ${section.name}`}
        onPointerDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) onOpen('synth');
        }}
        className="group/dot inline-flex items-center justify-center p-0.5 rounded-full focus:outline-none disabled:opacity-45"
      >
        <span
          className={`block w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
            synthOn
              ? 'bg-sky-400 border-sky-200 shadow-[0_0_9px_rgba(56,189,248,0.95)] ring-2 ring-sky-400/35 group-hover/dot:scale-125'
              : 'bg-zinc-400/50 dark:bg-zinc-600 border-sky-500/40 opacity-75 group-hover/dot:opacity-100 group-hover/dot:bg-sky-400/50 group-hover/dot:scale-115'
          }`}
        />
      </button>

      {/* Orange Dot: Arpeggios */}
      <button
        type="button"
        disabled={disabled}
        title={
          arpOn
            ? `Arpeggios ON · ${section.arp?.tone || DEFAULT_SECTION_ARP.tone} (${formatLayerBarRangeLabel(section.arp, totalBars)})`
            : `Configure Arpeggios (Orange) for ${section.name}`
        }
        aria-label={`Configure Arpeggios for ${section.name}`}
        onPointerDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) onOpen('arp');
        }}
        className="group/dot inline-flex items-center justify-center p-0.5 rounded-full focus:outline-none disabled:opacity-45"
      >
        <span
          className={`block w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
            arpOn
              ? 'bg-orange-400 border-orange-200 shadow-[0_0_9px_rgba(251,146,60,0.95)] ring-2 ring-orange-400/35 group-hover/dot:scale-125'
              : 'bg-zinc-400/50 dark:bg-zinc-600 border-orange-500/40 opacity-75 group-hover/dot:opacity-100 group-hover/dot:bg-orange-400/50 group-hover/dot:scale-115'
          }`}
        />
      </button>
    </div>
  );
};

// Backwards-compatible alias
export const SectionPadDotBadge = SectionLayerDotsCluster;

interface SectionLayerModalProps {
  section: Section;
  initialLayer: SectionLayerType;
  songBpm: number;
  isLocked?: boolean;
  onUpdatePad: (next: SectionMultiPadConfig) => void;
  onUpdateSynth: (next: SectionSynthConfig) => void;
  onUpdateArp: (next: SectionArpConfig) => void;
  onPreview: (layer: SectionLayerType) => void;
  onClose: () => void;
}

export const SectionLayerModal: React.FC<SectionLayerModalProps> = ({
  section,
  initialLayer,
  isLocked = false,
  onUpdatePad,
  onUpdateSynth,
  onUpdateArp,
  onPreview,
  onClose,
}) => {
  const [activeLayer, setActiveLayer] = useState<SectionLayerType>(initialLayer);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const sectionTotalBars = Math.max(1, getSectionTotalBars(section));

  const padConfig: SectionMultiPadConfig = {
    ...DEFAULT_SECTION_MULTI_PAD,
    endBar: sectionTotalBars,
    ...(section.multiPad || {}),
  };

  const synthConfig: SectionSynthConfig = {
    ...DEFAULT_SECTION_SYNTH,
    endBar: sectionTotalBars,
    ...(section.synth || {}),
  };

  const arpConfig: SectionArpConfig = {
    ...DEFAULT_SECTION_ARP,
    endBar: sectionTotalBars,
    ...(section.arp || {}),
  };

  const currentConfig =
    activeLayer === 'pad' ? padConfig : activeLayer === 'synth' ? synthConfig : arpConfig;

  const isEnabled = Boolean(currentConfig.enabled);
  const barRangeMode = currentConfig.barRangeMode || 'all';
  const clampedStartBar = Math.max(1, Math.min(sectionTotalBars, currentConfig.startBar ?? 1));
  const clampedEndBar = Math.max(
    clampedStartBar,
    Math.min(sectionTotalBars, currentConfig.endBar ?? sectionTotalBars)
  );

  const layerTheme =
    activeLayer === 'pad'
      ? {
          label: 'MULTI-PAD',
          title: 'Multi-Pad',
          dotBg: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]',
          iconWrap: 'bg-emerald-500/15 border-emerald-400/60 text-emerald-400',
          switchCard: 'bg-emerald-500/10 border-emerald-500/50',
          switchBtn: 'bg-emerald-500 border-emerald-400 text-[#0B1612]',
          accentText: 'text-emerald-400',
          selectedChip: 'bg-emerald-500/15 border-emerald-400 text-emerald-400',
          Icon: Waves,
        }
      : activeLayer === 'synth'
      ? {
          label: 'SYNTHESIZER',
          title: 'Synth',
          dotBg: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]',
          iconWrap: 'bg-sky-500/15 border-sky-400/60 text-sky-400',
          switchCard: 'bg-sky-500/10 border-sky-500/50',
          switchBtn: 'bg-sky-500 border-sky-400 text-[#071620]',
          accentText: 'text-sky-400',
          selectedChip: 'bg-sky-500/15 border-sky-400 text-sky-400',
          Icon: Sliders,
        }
      : {
          label: 'ARPEGGIATOR',
          title: 'Arpeggios',
          dotBg: 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.9)]',
          iconWrap: 'bg-orange-500/15 border-orange-400/60 text-orange-400',
          switchCard: 'bg-orange-500/10 border-orange-500/50',
          switchBtn: 'bg-orange-500 border-orange-400 text-[#1F0F04]',
          accentText: 'text-orange-400',
          selectedChip: 'bg-orange-500/15 border-orange-400 text-orange-400',
          Icon: Sparkles,
        };

  const catalog: PresetCatalogItem<string>[] = useMemo(() => {
    if (activeLayer === 'pad') return PAD_PRESET_CATALOG;
    if (activeLayer === 'synth') return SYNTH_PRESET_CATALOG;
    return ARP_PRESET_CATALOG;
  }, [activeLayer]);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(catalog.map((item) => item.category)))],
    [catalog]
  );

  const filteredCatalog = useMemo(() => {
    if (selectedCategory === 'All') return catalog;
    return catalog.filter((item) => item.category === selectedCategory);
  }, [catalog, selectedCategory]);

  const updateSharedFields = (patch: {
    enabled?: boolean;
    barRangeMode?: 'all' | 'custom';
    startBar?: number;
    endBar?: number;
  }) => {
    if (activeLayer === 'pad') {
      onUpdatePad({ ...padConfig, ...patch });
    } else if (activeLayer === 'synth') {
      onUpdateSynth({ ...synthConfig, ...patch });
    } else {
      onUpdateArp({ ...arpConfig, ...patch });
    }
  };

  const barNumbers = Array.from({ length: sectionTotalBars }, (_, i) => i + 1);
  const LayerIcon = layerTheme.Icon;

  return createPortal(
    <div
      style={{ backgroundColor: 'var(--bg-backdrop)' }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
      >
        {/* Sticky Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-[var(--border-subtle)] space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 transition ${
                  isEnabled
                    ? layerTheme.iconWrap
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                <LayerIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--text-muted)]">
                    SECTION {layerTheme.label}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isEnabled ? layerTheme.dotBg : 'bg-zinc-500/60'
                    }`}
                  />
                </div>
                <h3 className="font-serif-display text-xl font-bold text-[var(--text-primary)] truncate">
                  {section.name}{' '}
                  <span className="text-xs font-sans font-normal text-[var(--text-muted)]">
                    ({sectionTotalBars} {sectionTotalBars === 1 ? 'bar' : 'bars'})
                  </span>
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close section sound layer popup"
              className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Green / Blue / Orange Tab Switcher */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                setActiveLayer('pad');
                setSelectedCategory('All');
              }}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                activeLayer === 'pad'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  padConfig.enabled
                    ? 'bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.95)]'
                    : 'bg-zinc-500/60'
                }`}
              />
              <span>Multi-Pad</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveLayer('synth');
                setSelectedCategory('All');
              }}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                activeLayer === 'synth'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  synthConfig.enabled
                    ? 'bg-sky-400 shadow-[0_0_7px_rgba(56,189,248,0.95)]'
                    : 'bg-zinc-500/60'
                }`}
              />
              <span>Synth</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveLayer('arp');
                setSelectedCategory('All');
              }}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                activeLayer === 'arp'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  arpConfig.enabled
                    ? 'bg-orange-400 shadow-[0_0_7px_rgba(251,146,60,0.95)]'
                    : 'bg-zinc-500/60'
                }`}
              />
              <span>Arpeggios</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* 1. Feature ON / OFF Toggle */}
          <div
            className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 transition ${
              isEnabled
                ? layerTheme.switchCard
                : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Power
                className={`w-4 h-4 ${
                  isEnabled ? layerTheme.accentText : 'text-[var(--text-muted)]'
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {layerTheme.title}: {isEnabled ? 'ON' : 'OFF'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isEnabled
                    ? `Plays on ${formatLayerBarRangeLabel(currentConfig, sectionTotalBars)} of ${section.name}`
                    : `Silent during ${section.name}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              disabled={isLocked}
              onClick={() => updateSharedFields({ enabled: !isEnabled })}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase transition disabled:opacity-45 ${
                isEnabled
                  ? layerTheme.switchBtn
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <span>{isEnabled ? 'ON' : 'OFF'}</span>
              <span
                className={`w-8 h-4 rounded-full p-0.5 flex items-center transition ${
                  isEnabled ? 'bg-black/20' : 'bg-[var(--border-subtle)]'
                }`}
              >
                <span
                  className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${
                    isEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          {/* 2. Bar-Range Playback Selector (All Bars vs Specific Start–End Bars) */}
          <div className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                BAR RANGE ({sectionTotalBars} {sectionTotalBars === 1 ? 'BAR' : 'BARS'} IN SECTION)
              </span>
              <span className={`text-[11px] font-semibold ${layerTheme.accentText}`}>
                {formatLayerBarRangeLabel(currentConfig, sectionTotalBars)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isLocked}
                onClick={() =>
                  updateSharedFields({
                    barRangeMode: 'all',
                    startBar: 1,
                    endBar: sectionTotalBars,
                  })
                }
                className={`h-9 rounded-xl border text-xs font-semibold transition disabled:opacity-45 ${
                  barRangeMode === 'all'
                    ? layerTheme.selectedChip
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                All Bars (1–{sectionTotalBars})
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() =>
                  updateSharedFields({
                    barRangeMode: 'custom',
                    startBar: clampedStartBar,
                    endBar: clampedEndBar,
                  })
                }
                className={`h-9 rounded-xl border text-xs font-semibold transition disabled:opacity-45 ${
                  barRangeMode === 'custom'
                    ? layerTheme.selectedChip
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Specific Bars (Start–End)
              </button>
            </div>

            {barRangeMode === 'custom' && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Start Bar
                  </label>
                  <select
                    disabled={isLocked}
                    value={clampedStartBar}
                    onChange={(e) => {
                      const nextStart = Number(e.target.value);
                      updateSharedFields({
                        barRangeMode: 'custom',
                        startBar: nextStart,
                        endBar: Math.max(nextStart, clampedEndBar),
                      });
                    }}
                    className="w-full h-9 px-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] focus:border-[#E5A958] focus:outline-none disabled:opacity-45"
                  >
                    {barNumbers.map((num) => (
                      <option key={num} value={num}>
                        Bar {num}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    End Bar
                  </label>
                  <select
                    disabled={isLocked}
                    value={clampedEndBar}
                    onChange={(e) => {
                      const nextEnd = Number(e.target.value);
                      updateSharedFields({
                        barRangeMode: 'custom',
                        startBar: Math.min(clampedStartBar, nextEnd),
                        endBar: nextEnd,
                      });
                    }}
                    className="w-full h-9 px-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] focus:border-[#E5A958] focus:outline-none disabled:opacity-45"
                  >
                    {barNumbers
                      .filter((num) => num >= clampedStartBar)
                      .map((num) => (
                        <option key={num} value={num}>
                          Bar {num}
                        </option>
                      ))}
                  </select>
                </div>

                <p className="col-span-2 text-[11px] text-[var(--text-muted)]">
                  Plays only from <strong>Bar {clampedStartBar}</strong> to{' '}
                  <strong>Bar {clampedEndBar}</strong> and mutes automatically afterward.
                </p>
              </div>
            )}
          </div>

          {/* 3. Pattern Selector */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
              {activeLayer === 'pad'
                ? 'Pad Pattern'
                : activeLayer === 'synth'
                ? 'Synth Pattern'
                : 'Arpeggiator Pattern & Speed'}
            </label>

            {activeLayer === 'pad' && (
              <div className="grid grid-cols-2 gap-2">
                {SECTION_PAD_PATTERN_OPTIONS.map((opt) => {
                  const active = padConfig.pattern === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isLocked}
                      onClick={() =>
                        onUpdatePad({ ...padConfig, pattern: opt.value as SectionPadPattern })
                      }
                      className={`rounded-2xl border px-3 py-2 text-left transition disabled:opacity-45 ${
                        active
                          ? layerTheme.selectedChip
                          : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <p className="text-xs font-bold leading-tight">{opt.label}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-snug">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {activeLayer === 'synth' && (
              <div className="grid grid-cols-2 gap-2">
                {SECTION_SYNTH_PATTERN_OPTIONS.map((opt) => {
                  const active = synthConfig.pattern === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isLocked}
                      onClick={() =>
                        onUpdateSynth({
                          ...synthConfig,
                          pattern: opt.value as SectionSynthPattern,
                        })
                      }
                      className={`rounded-2xl border px-3 py-2 text-left transition disabled:opacity-45 ${
                        active
                          ? layerTheme.selectedChip
                          : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <p className="text-xs font-bold leading-tight">{opt.label}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-snug">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {activeLayer === 'arp' && (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)]">
                  {ARP_PATTERN_OPTIONS.map((opt) => {
                    const active = arpConfig.pattern === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          onUpdateArp({ ...arpConfig, pattern: opt.value as ArpPatternType })
                        }
                        className={`py-2 rounded-lg text-[11px] font-semibold transition ${
                          active
                            ? 'bg-orange-500 text-[#1F0F04]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {ARP_SUBDIVISION_OPTIONS.map((sub) => {
                    const active = (arpConfig.subdivision || '8n') === sub.value;
                    return (
                      <button
                        key={sub.value}
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          onUpdateArp({ ...arpConfig, subdivision: sub.value })
                        }
                        className={`py-1.5 px-2 rounded-xl border text-[11px] font-semibold transition ${
                          active
                            ? layerTheme.selectedChip
                            : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Expanded 18-Preset Tone Browser */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                {layerTheme.title} Tone Library ({catalog.length} Presets)
              </label>
              <span className={`text-[11px] font-semibold truncate ${layerTheme.accentText}`}>
                {currentConfig.tone}
              </span>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-medium whitespace-nowrap shrink-0 transition ${
                      active
                        ? layerTheme.selectedChip
                        : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Tone Cards List */}
            <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-2">
              {filteredCatalog.map((preset) => {
                const selected = currentConfig.tone === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      if (activeLayer === 'pad') {
                        onUpdatePad({ ...padConfig, tone: preset.id as PadPresetId });
                      } else if (activeLayer === 'synth') {
                        onUpdateSynth({ ...synthConfig, tone: preset.id as SynthPresetId });
                      } else {
                        onUpdateArp({ ...arpConfig, tone: preset.id as ArpPresetId });
                      }
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left flex items-center justify-between gap-2 transition disabled:opacity-45 ${
                      selected
                        ? `${layerTheme.selectedChip} bg-[var(--bg-surface)]`
                        : 'bg-[var(--bg-surface)]/60 border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold truncate text-[var(--text-primary)]">
                          {preset.id}
                        </p>
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-recessed)] text-[var(--text-muted)] shrink-0">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                        {preset.description}
                      </p>
                    </div>
                    {selected && <Check className={`w-4 h-4 shrink-0 ${layerTheme.accentText}`} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="p-4 sm:p-5 pt-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onPreview(activeLayer)}
            className="flex-1 h-11 rounded-2xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 transition"
          >
            <Play className={`w-3.5 h-3.5 ${layerTheme.accentText}`} />
            <span>Preview {layerTheme.title}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-2xl bg-[#E5A958] hover:bg-[#ecb66c] text-[#121212] text-xs font-bold uppercase tracking-wider transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Backwards-compatible alias if imported elsewhere
export const SectionMultiPadModal = SectionLayerModal;
