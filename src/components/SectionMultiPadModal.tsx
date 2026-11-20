import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Disc3,
  Flame,
  Play,
  Plus,
  Power,
  Sliders,
  Sparkles,
  Trash2,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import {
  ARP_PATTERN_OPTIONS,
  ARP_PRESET_CATALOG,
  ARP_SUBDIVISION_OPTIONS,
  DEFAULT_ARP_LAYER,
  DEFAULT_DRUM_LAYER,
  DEFAULT_FX_ENTRY,
  DEFAULT_PAD_LAYER,
  DEFAULT_SECTION_ARP,
  DEFAULT_SECTION_DRUMS,
  DEFAULT_SECTION_FX,
  DEFAULT_SECTION_MULTI_PAD,
  DEFAULT_SECTION_SYNTH,
  DEFAULT_SYNTH_LAYER,
  DRUM_FILL_FREQUENCY_OPTIONS,
  DRUM_FILL_STYLE_OPTIONS,
  DRUM_KIT_CATALOG,
  DRUM_PATTERN_CATALOG,
  FX_CATALOG,
  FX_DURATION_BAR_OPTIONS,
  PAD_PRESET_CATALOG,
  SECTION_PAD_PATTERN_OPTIONS,
  SECTION_SYNTH_PATTERN_OPTIONS,
  SYNTH_PRESET_CATALOG,
  type PresetCatalogItem,
} from '../audio/synthEngine';
import type {
  ArpLayerEntry,
  ArpPatternType,
  ArpPresetId,
  BarRange,
  DrumFillFrequency,
  DrumFillStyle,
  DrumKitId,
  DrumLayerEntry,
  DrumPatternId,
  FxLayerEntry,
  FxTypeId,
  PadLayerEntry,
  PadPresetId,
  Section,
  SectionArpConfig,
  SectionDrumsConfig,
  SectionFxConfig,
  SectionMultiPadConfig,
  SectionPadPattern,
  SectionSynthConfig,
  SectionSynthPattern,
  SynthLayerEntry,
  SynthPresetId,
  TimeSignature,
} from '../types';
import {
  formatMultiBarRangesLabel,
  getEffectiveBarRanges,
  getNormalizedArpLayers,
  getNormalizedDrumLayers,
  getNormalizedFxLayers,
  getNormalizedPadLayers,
  getNormalizedSynthLayers,
  getSectionTotalBars,
  parseMeterBeats,
} from '../utils/chords';

export type SectionLayerType = 'pad' | 'synth' | 'arp' | 'drums' | 'fx';

export interface SectionPreviewOptions {
  tone?: PadPresetId | SynthPresetId | ArpPresetId | DrumKitId;
  pattern?: SectionPadPattern | SectionSynthPattern | ArpPatternType | DrumPatternId;
  subdivision?: '4n' | '8n' | '8t' | '16n';
  volumeDb?: number;
  fillStyle?: DrumFillStyle;
  previewFill?: boolean;
  effectType?: FxTypeId;
  durationBars?: number;
}

export function formatLayerBarRangeLabel(
  config:
    | {
        enabled?: boolean;
        barRangeMode?: 'all' | 'custom';
        startBar?: number;
        endBar?: number;
        barRanges?: BarRange[];
      }
    | undefined,
  sectionTotalBars: number
): string {
  return formatMultiBarRangesLabel(config, sectionTotalBars);
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
  const padLayers = getNormalizedPadLayers(section.multiPad);
  const synthLayers = getNormalizedSynthLayers(section.synth);
  const arpLayers = getNormalizedArpLayers(section.arp);
  const drumLayers = getNormalizedDrumLayers(section.drums);
  const fxLayers = getNormalizedFxLayers(section.fx);

  const padOn = padLayers.some((l) => l.enabled);
  const synthOn = synthLayers.some((l) => l.enabled);
  const arpOn = arpLayers.some((l) => l.enabled);
  const drumsOn = Boolean(section.drums?.enabled) && drumLayers.some((l) => l.enabled);
  const fxOn = Boolean(section.fx?.enabled) && fxLayers.some((l) => l.enabled);

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

      {/* Red / Coral Dot: Drums & Rhythm */}
      <button
        type="button"
        disabled={disabled}
        aria-label={`Configure Drums for ${section.name}`}
        onPointerDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) onOpen('drums');
        }}
        className="group/dot inline-flex items-center justify-center p-0.5 rounded-full focus:outline-none disabled:opacity-45"
      >
        <span
          className={`block w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
            drumsOn
              ? 'bg-rose-500 border-rose-200 shadow-[0_0_9px_rgba(244,63,94,0.95)] ring-2 ring-rose-500/35 group-hover/dot:scale-125'
              : 'bg-zinc-400/50 dark:bg-zinc-600 border-rose-500/40 opacity-75 group-hover/dot:opacity-100 group-hover/dot:bg-rose-500/50 group-hover/dot:scale-115'
          }`}
        />
      </button>

      {/* Fuchsia / Purple Dot: FX & Risers */}
      <button
        type="button"
        disabled={disabled}
        aria-label={`Configure FX and Risers for ${section.name}`}
        onPointerDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) onOpen('fx');
        }}
        className="group/dot inline-flex items-center justify-center p-0.5 rounded-full focus:outline-none disabled:opacity-45"
      >
        <span
          className={`block w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
            fxOn
              ? 'bg-fuchsia-400 border-fuchsia-200 shadow-[0_0_9px_rgba(232,121,249,0.95)] ring-2 ring-fuchsia-400/35 group-hover/dot:scale-125'
              : 'bg-zinc-400/50 dark:bg-zinc-600 border-fuchsia-500/40 opacity-75 group-hover/dot:opacity-100 group-hover/dot:bg-fuchsia-400/50 group-hover/dot:scale-115'
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
  songTimeSignature?: TimeSignature;
  isLocked?: boolean;
  onUpdatePad: (next: SectionMultiPadConfig) => void;
  onUpdateSynth: (next: SectionSynthConfig) => void;
  onUpdateArp: (next: SectionArpConfig) => void;
  onUpdateDrums: (next: SectionDrumsConfig) => void;
  onUpdateFx: (next: SectionFxConfig) => void;
  onPreview: (layer: SectionLayerType, opts?: SectionPreviewOptions) => void;
  onPreviewFx?: (opts: { effectType: FxTypeId; durationBars: number; volumeDb: number }) => void;
  onClose: () => void;
}

function makeLayerId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export const SectionLayerModal: React.FC<SectionLayerModalProps> = ({
  section,
  initialLayer,
  songBpm,
  songTimeSignature = '4/4',
  isLocked = false,
  onUpdatePad,
  onUpdateSynth,
  onUpdateArp,
  onUpdateDrums,
  onUpdateFx,
  onPreview,
  onPreviewFx,
  onClose,
}) => {
  const [activeLayer, setActiveLayer] = useState<SectionLayerType>(initialLayer);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0);
  const [selectedFxIndex, setSelectedFxIndex] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [customBarsInput, setCustomBarsInput] = useState<string>('');

  const sectionTotalBars = Math.max(1, getSectionTotalBars(section));
  const beatsPerBar = Math.max(1, parseMeterBeats(songTimeSignature));
  const safeBpm = Math.max(40, Math.min(240, songBpm || 92));
  const barDurationSec = (60 / safeBpm) * beatsPerBar;

  const padConfig: SectionMultiPadConfig = {
    ...DEFAULT_SECTION_MULTI_PAD,
    endBar: sectionTotalBars,
    ...(section.multiPad || {}),
  };
  const padLayers: PadLayerEntry[] = useMemo(() => {
    const list = getNormalizedPadLayers(padConfig);
    return list.length > 0 ? list : [{ ...DEFAULT_PAD_LAYER, endBar: sectionTotalBars }];
  }, [padConfig, sectionTotalBars]);

  const synthConfig: SectionSynthConfig = {
    ...DEFAULT_SECTION_SYNTH,
    endBar: sectionTotalBars,
    ...(section.synth || {}),
  };
  const synthLayers: SynthLayerEntry[] = useMemo(() => {
    const list = getNormalizedSynthLayers(synthConfig);
    return list.length > 0 ? list : [{ ...DEFAULT_SYNTH_LAYER, endBar: sectionTotalBars }];
  }, [synthConfig, sectionTotalBars]);

  const arpConfig: SectionArpConfig = {
    ...DEFAULT_SECTION_ARP,
    endBar: sectionTotalBars,
    ...(section.arp || {}),
  };
  const arpLayers: ArpLayerEntry[] = useMemo(() => {
    const list = getNormalizedArpLayers(arpConfig);
    return list.length > 0 ? list : [{ ...DEFAULT_ARP_LAYER, endBar: sectionTotalBars }];
  }, [arpConfig, sectionTotalBars]);

  const drumsConfig: SectionDrumsConfig = {
    ...DEFAULT_SECTION_DRUMS,
    endBar: sectionTotalBars,
    ...(section.drums || {}),
  };
  const drumLayers: DrumLayerEntry[] = useMemo(() => {
    const list = getNormalizedDrumLayers(drumsConfig);
    return list.length > 0 ? list : [{ ...DEFAULT_DRUM_LAYER, endBar: sectionTotalBars }];
  }, [drumsConfig, sectionTotalBars]);

  const fxConfig: SectionFxConfig = useMemo(
    () => ({
      ...DEFAULT_SECTION_FX,
      ...(section.fx || {}),
      effects: getNormalizedFxLayers(section.fx),
    }),
    [section.fx]
  );
  const fxLayers: FxLayerEntry[] = fxConfig.effects;
  const safeFxIdx = fxLayers.length > 0 ? Math.max(0, Math.min(fxLayers.length - 1, selectedFxIndex)) : 0;
  const currentFxEntry: FxLayerEntry | null = fxLayers[safeFxIdx] || null;

  const activeLayerList =
    activeLayer === 'pad'
      ? padLayers
      : activeLayer === 'synth'
      ? synthLayers
      : activeLayer === 'arp'
      ? arpLayers
      : drumLayers;

  const safeLayerIdx = Math.max(0, Math.min(activeLayerList.length - 1, selectedLayerIndex));
  const currentEntry = activeLayerList[safeLayerIdx];

  useEffect(() => {
    if (activeLayer === 'drums') {
      const bars = (drumLayers[safeLayerIdx]?.customFillBars || [])
        .slice()
        .sort((a, b) => a - b);
      setCustomBarsInput(bars.join(', '));
    }
  }, [activeLayer, safeLayerIdx, section.id]);

  const padAnyOn = padLayers.some((l) => l.enabled);
  const synthAnyOn = synthLayers.some((l) => l.enabled);
  const arpAnyOn = arpLayers.some((l) => l.enabled);
  const drumsMasterOn = Boolean(drumsConfig.enabled);
  const drumsAnyActive = drumsMasterOn && drumLayers.some((l) => l.enabled);
  const fxMasterOn = Boolean(fxConfig.enabled);
  const fxAnyActive = fxMasterOn && fxLayers.some((l) => l.enabled);

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
          accentHex: 'accent-emerald-400',
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
          accentHex: 'accent-sky-400',
          Icon: Sliders,
        }
      : activeLayer === 'arp'
      ? {
          label: 'ARPEGGIATOR',
          title: 'Arpeggios',
          dotBg: 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.9)]',
          iconWrap: 'bg-orange-500/15 border-orange-400/60 text-orange-400',
          switchCard: 'bg-orange-500/10 border-orange-500/50',
          switchBtn: 'bg-orange-500 border-orange-400 text-[#1F0F04]',
          accentText: 'text-orange-400',
          selectedChip: 'bg-orange-500/15 border-orange-400 text-orange-400',
          accentHex: 'accent-orange-400',
          Icon: Sparkles,
        }
      : activeLayer === 'fx'
      ? {
          label: 'FX / RISERS',
          title: 'FX',
          dotBg: 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.95)]',
          iconWrap: 'bg-fuchsia-500/15 border-fuchsia-400/60 text-fuchsia-400',
          switchCard: 'bg-fuchsia-500/10 border-fuchsia-500/50',
          switchBtn: 'bg-fuchsia-500 border-fuchsia-400 text-white',
          accentText: 'text-fuchsia-400',
          selectedChip: 'bg-fuchsia-500/15 border-fuchsia-400 text-fuchsia-400',
          accentHex: 'accent-fuchsia-400',
          Icon: Zap,
        }
      : {
          label: 'DRUMS & RHYTHM',
          title: 'Drums',
          dotBg: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]',
          iconWrap: 'bg-rose-500/15 border-rose-500/60 text-rose-400',
          switchCard: 'bg-rose-500/10 border-rose-500/50',
          switchBtn: 'bg-rose-500 border-rose-400 text-white',
          accentText: 'text-rose-400',
          selectedChip: 'bg-rose-500/15 border-rose-400 text-rose-400',
          accentHex: 'accent-rose-500',
          Icon: Disc3,
        };

  const catalog: PresetCatalogItem<string>[] = useMemo(() => {
    if (activeLayer === 'pad') return PAD_PRESET_CATALOG;
    if (activeLayer === 'synth') return SYNTH_PRESET_CATALOG;
    if (activeLayer === 'arp') return ARP_PRESET_CATALOG;
    if (activeLayer === 'fx') return FX_CATALOG;
    return DRUM_PATTERN_CATALOG;
  }, [activeLayer]);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(catalog.map((item) => item.category)))],
    [catalog]
  );

  const filteredCatalog = useMemo(() => {
    if (selectedCategory === 'All') return catalog;
    return catalog.filter((item) => item.category === selectedCategory);
  }, [catalog, selectedCategory]);

  // Write helpers that sync layers[] cleanly with legacy top-level fields
  const commitPadLayers = (nextLayers: PadLayerEntry[]) => {
    const primary = nextLayers[0] || DEFAULT_PAD_LAYER;
    onUpdatePad({
      ...padConfig,
      enabled: nextLayers.some((l) => l.enabled),
      pattern: primary.pattern,
      tone: primary.tone,
      volumeDb: primary.volumeDb,
      barRangeMode: primary.barRangeMode,
      startBar: primary.startBar,
      endBar: primary.endBar,
      barRanges: primary.barRanges,
      layers: nextLayers,
    });
  };

  const commitSynthLayers = (nextLayers: SynthLayerEntry[]) => {
    const primary = nextLayers[0] || DEFAULT_SYNTH_LAYER;
    onUpdateSynth({
      ...synthConfig,
      enabled: nextLayers.some((l) => l.enabled),
      pattern: primary.pattern,
      tone: primary.tone,
      volumeDb: primary.volumeDb,
      barRangeMode: primary.barRangeMode,
      startBar: primary.startBar,
      endBar: primary.endBar,
      barRanges: primary.barRanges,
      layers: nextLayers,
    });
  };

  const commitArpLayers = (nextLayers: ArpLayerEntry[]) => {
    const primary = nextLayers[0] || DEFAULT_ARP_LAYER;
    onUpdateArp({
      ...arpConfig,
      enabled: nextLayers.some((l) => l.enabled),
      pattern: primary.pattern,
      tone: primary.tone,
      subdivision: primary.subdivision,
      volumeDb: primary.volumeDb,
      barRangeMode: primary.barRangeMode,
      startBar: primary.startBar,
      endBar: primary.endBar,
      barRanges: primary.barRanges,
      layers: nextLayers,
    });
  };

  const commitDrumLayers = (nextLayers: DrumLayerEntry[], sectionEnabledOverride?: boolean) => {
    const primary = nextLayers[0] || DEFAULT_DRUM_LAYER;
    onUpdateDrums({
      ...drumsConfig,
      enabled:
        sectionEnabledOverride !== undefined ? sectionEnabledOverride : drumsConfig.enabled,
      kit: primary.kit,
      pattern: primary.pattern,
      volumeDb: primary.volumeDb,
      barRangeMode: primary.barRangeMode,
      startBar: primary.startBar,
      endBar: primary.endBar,
      barRanges: primary.barRanges,
      fillFrequency: primary.fillFrequency,
      customFillBars: primary.customFillBars,
      fillStyle: primary.fillStyle,
      layers: nextLayers,
    });
  };

  const updateSharedFields = (patch: {
    enabled?: boolean;
    volumeDb?: number;
    barRangeMode?: 'all' | 'custom';
    startBar?: number;
    endBar?: number;
    barRanges?: BarRange[];
  }) => {
    if (activeLayer === 'pad') {
      commitPadLayers(padLayers.map((l, idx) => (idx === safeLayerIdx ? { ...l, ...patch } : l)));
    } else if (activeLayer === 'synth') {
      commitSynthLayers(synthLayers.map((l, idx) => (idx === safeLayerIdx ? { ...l, ...patch } : l)));
    } else if (activeLayer === 'arp') {
      commitArpLayers(arpLayers.map((l, idx) => (idx === safeLayerIdx ? { ...l, ...patch } : l)));
    } else {
      commitDrumLayers(drumLayers.map((l, idx) => (idx === safeLayerIdx ? { ...l, ...patch } : l)));
    }
  };

  const updatePadEntry = (patch: Partial<PadLayerEntry>) => {
    commitPadLayers(padLayers.map((l, idx) => (idx === safeLayerIdx ? { ...l, ...patch } : l)));
  };

  const updateSynthEntry = (patch: Partial<SynthLayerEntry>) => {
    commitSynthLayers(synthLayers.map((l, idx) => (idx === safeLayerIdx ? { ...l, ...patch } : l)));
  };

  const updateArpEntry = (patch: Partial<ArpLayerEntry>) => {
    commitArpLayers(arpLayers.map((l, idx) => (idx === safeLayerIdx ? { ...l, ...patch } : l)));
  };

  const updateDrumEntry = (patch: Partial<DrumLayerEntry>) => {
    commitDrumLayers(drumLayers.map((l, idx) => (idx === safeLayerIdx ? { ...l, ...patch } : l)));
  };

  const handleAddLayer = () => {
    if (isLocked) return;
    if (activeLayer === 'pad') {
      const next: PadLayerEntry = {
        ...DEFAULT_PAD_LAYER,
        id: makeLayerId('pad'),
        enabled: true,
        tone: 'Lush String Pad',
        endBar: sectionTotalBars,
      };
      commitPadLayers([...padLayers, next]);
      setSelectedLayerIndex(padLayers.length);
    } else if (activeLayer === 'synth') {
      const next: SynthLayerEntry = {
        ...DEFAULT_SYNTH_LAYER,
        id: makeLayerId('synth'),
        enabled: true,
        tone: 'Sub Analog Bass',
        pattern: 'Bass Root Focus',
        endBar: sectionTotalBars,
      };
      commitSynthLayers([...synthLayers, next]);
      setSelectedLayerIndex(synthLayers.length);
    } else if (activeLayer === 'arp') {
      const next: ArpLayerEntry = {
        ...DEFAULT_ARP_LAYER,
        id: makeLayerId('arp'),
        enabled: true,
        tone: 'Music Box Chime',
        pattern: 'up',
        subdivision: '16n',
        endBar: sectionTotalBars,
      };
      commitArpLayers([...arpLayers, next]);
      setSelectedLayerIndex(arpLayers.length);
    } else {
      const next: DrumLayerEntry = {
        ...DEFAULT_DRUM_LAYER,
        id: makeLayerId('drum'),
        enabled: true,
        kit: 'Baila / Sri Lankan Percussion Kit',
        pattern: '4/4 Sinhala Pop / Calypso',
        endBar: sectionTotalBars,
      };
      commitDrumLayers([...drumLayers, next]);
      setSelectedLayerIndex(drumLayers.length);
    }
  };

  const handleRemoveLayer = (idxToRemove: number) => {
    if (isLocked || activeLayerList.length <= 1) return;
    if (activeLayer === 'pad') {
      commitPadLayers(padLayers.filter((_, i) => i !== idxToRemove));
    } else if (activeLayer === 'synth') {
      commitSynthLayers(synthLayers.filter((_, i) => i !== idxToRemove));
    } else if (activeLayer === 'arp') {
      commitArpLayers(arpLayers.filter((_, i) => i !== idxToRemove));
    } else {
      commitDrumLayers(drumLayers.filter((_, i) => i !== idxToRemove));
    }
    setSelectedLayerIndex(Math.max(0, Math.min(activeLayerList.length - 2, idxToRemove)));
  };

  const commitFxLayers = (nextEffects: FxLayerEntry[], enabledOverride?: boolean) => {
    onUpdateFx({
      enabled: enabledOverride !== undefined ? enabledOverride : fxConfig.enabled,
      effects: nextEffects,
    });
  };

  const updateFxEntry = (patch: Partial<FxLayerEntry>) => {
    if (!currentFxEntry) return;
    commitFxLayers(
      fxLayers.map((fx, idx) => (idx === safeFxIdx ? { ...fx, ...patch } : fx))
    );
  };

  const handleAddFx = () => {
    if (isLocked) return;
    const defaultStartBar = Math.max(1, sectionTotalBars - 1);
    const nextEntry: FxLayerEntry = {
      ...DEFAULT_FX_ENTRY,
      id: makeLayerId('fx'),
      enabled: true,
      effectType: fxLayers.length === 0 ? 'White Noise Riser' : 'Reverse Cymbal',
      startBar: fxLayers.length === 0 ? defaultStartBar : sectionTotalBars,
      startBeat: 1,
      durationBars: fxLayers.length === 0 ? 2 : 1,
      volumeDb: 0,
    };
    commitFxLayers([...fxLayers, nextEntry], true);
    setSelectedFxIndex(fxLayers.length);
  };

  const handleRemoveFx = (idxToRemove: number) => {
    if (isLocked) return;
    const next = fxLayers.filter((_, idx) => idx !== idxToRemove);
    commitFxLayers(next);
    setSelectedFxIndex(Math.max(0, Math.min(next.length - 1, idxToRemove)));
  };

  const barRangeMode = currentEntry.barRangeMode || 'all';
  const effectiveRanges = getEffectiveBarRanges(currentEntry, sectionTotalBars);
  const barNumbers = Array.from({ length: sectionTotalBars }, (_, i) => i + 1);
  const beatNumbers = Array.from({ length: beatsPerBar }, (_, i) => i + 1);
  const LayerIcon = layerTheme.Icon;
  const headerIsActive =
    activeLayer === 'pad'
      ? padAnyOn
      : activeLayer === 'synth'
      ? synthAnyOn
      : activeLayer === 'arp'
      ? arpAnyOn
      : activeLayer === 'fx'
      ? fxAnyActive
      : drumsAnyActive;

  const currentLayerVolumeDb = currentEntry.volumeDb ?? 0;
  const currentDrumEntry = activeLayer === 'drums' ? (currentEntry as DrumLayerEntry) : null;

  const triggerCurrentPreview = (previewFill = false) => {
    if (activeLayer === 'fx') {
      if (!currentFxEntry) return;
      if (onPreviewFx) {
        onPreviewFx({
          effectType: currentFxEntry.effectType,
          durationBars: currentFxEntry.durationBars,
          volumeDb: currentFxEntry.volumeDb ?? 0,
        });
      } else {
        onPreview('fx', {
          effectType: currentFxEntry.effectType,
          durationBars: currentFxEntry.durationBars,
          volumeDb: currentFxEntry.volumeDb ?? 0,
        });
      }
      return;
    }

    if (activeLayer === 'pad') {
      const entry = currentEntry as PadLayerEntry;
      onPreview('pad', {
        tone: entry.tone,
        pattern: entry.pattern,
        volumeDb: entry.volumeDb ?? 0,
      });
    } else if (activeLayer === 'synth') {
      const entry = currentEntry as SynthLayerEntry;
      onPreview('synth', {
        tone: entry.tone,
        pattern: entry.pattern,
        volumeDb: entry.volumeDb ?? 0,
      });
    } else if (activeLayer === 'arp') {
      const entry = currentEntry as ArpLayerEntry;
      onPreview('arp', {
        tone: entry.tone,
        pattern: entry.pattern,
        subdivision: entry.subdivision || '8n',
        volumeDb: entry.volumeDb ?? 0,
      });
    } else {
      const entry = currentEntry as DrumLayerEntry;
      onPreview('drums', {
        tone: entry.kit,
        pattern: entry.pattern,
        volumeDb: entry.volumeDb ?? 0,
        fillStyle: entry.fillStyle || 'Tom Fill Cascade',
        previewFill,
      });
    }
  };

  return createPortal(
    <div
      style={{ backgroundColor: 'var(--bg-backdrop)' }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
      >
        {/* Sticky Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-[var(--border-subtle)] space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 transition ${
                  headerIsActive
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
                      headerIsActive ? layerTheme.dotBg : 'bg-zinc-500/60'
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

          {/* 5-Tab Switcher: Green Multi-Pad / Blue Synth / Orange Arpeggios / Red Drums / Fuchsia FX */}
          <div className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                setActiveLayer('pad');
                setSelectedLayerIndex(0);
                setSelectedCategory('All');
              }}
              className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                activeLayer === 'pad'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  padAnyOn
                    ? 'bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.95)]'
                    : 'bg-zinc-500/60'
                }`}
              />
              <span className="truncate">Pad</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveLayer('synth');
                setSelectedLayerIndex(0);
                setSelectedCategory('All');
              }}
              className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                activeLayer === 'synth'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  synthAnyOn
                    ? 'bg-sky-400 shadow-[0_0_7px_rgba(56,189,248,0.95)]'
                    : 'bg-zinc-500/60'
                }`}
              />
              <span className="truncate">Synth</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveLayer('arp');
                setSelectedLayerIndex(0);
                setSelectedCategory('All');
              }}
              className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                activeLayer === 'arp'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  arpAnyOn
                    ? 'bg-orange-400 shadow-[0_0_7px_rgba(251,146,60,0.95)]'
                    : 'bg-zinc-500/60'
                }`}
              />
              <span className="truncate">Arp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveLayer('drums');
                setSelectedLayerIndex(0);
                setSelectedCategory('All');
              }}
              className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                activeLayer === 'drums'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  drumsAnyActive
                    ? 'bg-rose-500 shadow-[0_0_7px_rgba(244,63,94,0.95)]'
                    : 'bg-zinc-500/60'
                }`}
              />
              <span className="truncate">Drums</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveLayer('fx');
                setSelectedFxIndex(0);
                setSelectedCategory('All');
              }}
              className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 transition ${
                activeLayer === 'fx'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  fxAnyActive
                    ? 'bg-fuchsia-400 shadow-[0_0_7px_rgba(232,121,249,0.95)]'
                    : 'bg-zinc-500/60'
                }`}
              />
              <span className="truncate">FX</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* FX / RISERS TAB BODY */}
          {activeLayer === 'fx' ? (
            <>
              {/* Section FX Master Toggle + + Add FX */}
              <div
                className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 transition ${
                  fxMasterOn
                    ? 'bg-fuchsia-500/12 border-fuchsia-500/50'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Power
                    className={`w-4 h-4 shrink-0 ${
                      fxMasterOn ? 'text-fuchsia-400' : 'text-[var(--text-muted)]'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      Section FX / Risers: {fxMasterOn ? 'ON' : 'OFF'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={fxMasterOn}
                  disabled={isLocked}
                  onClick={() => commitFxLayers(fxLayers, !fxMasterOn)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase transition shrink-0 disabled:opacity-45 ${
                    fxMasterOn
                      ? 'bg-fuchsia-500 border-fuchsia-400 text-white'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  <span>{fxMasterOn ? 'ON' : 'OFF'}</span>
                  <span
                    className={`w-8 h-4 rounded-full p-0.5 flex items-center transition ${
                      fxMasterOn ? 'bg-black/20' : 'bg-[var(--border-subtle)]'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${
                        fxMasterOn ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>
              </div>

              {/* FX Instances Header & + Add FX Button */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                    FX / Risers in Section ({fxLayers.length})
                  </span>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={handleAddFx}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-400/50 text-xs font-bold text-fuchsia-300 transition disabled:opacity-45"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add FX</span>
                  </button>
                </div>

                {fxLayers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-6 text-center space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-400/40 text-fuchsia-400 flex items-center justify-center mx-auto">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        No FX or Risers added to {section.name} yet
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                        Add risers, reverse cymbals, sub drops, cinematic impacts, or textures positioned on any bar &amp; beat.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={handleAddFx}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-xs font-bold uppercase tracking-wider transition disabled:opacity-45"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First FX</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {fxLayers.map((fx, idx) => {
                      const isSelected = idx === safeFxIdx;
                      return (
                        <button
                          key={fx.id || idx}
                          type="button"
                          onClick={() => {
                            setSelectedFxIndex(idx);
                            setSelectedCategory('All');
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                            isSelected
                              ? layerTheme.selectedChip
                              : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              fx.enabled ? layerTheme.dotBg : 'bg-zinc-500/50'
                            }`}
                          />
                          <span>
                            FX {idx + 1} · {fx.effectType}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected FX Configurator */}
              {currentFxEntry && (
                <>
                  {/* Selected FX ON/OFF + Delete + Volume/Intensity */}
                  <div
                    className={`rounded-2xl border p-3.5 space-y-3 transition ${
                      currentFxEntry.enabled
                        ? layerTheme.switchCard
                        : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          FX {safeFxIdx + 1}: {currentFxEntry.effectType}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate tabular-nums">
                          Bar {currentFxEntry.startBar}, Beat {currentFxEntry.startBeat} · {currentFxEntry.durationBars}{' '}
                          {currentFxEntry.durationBars === 1 ? 'bar' : 'bars'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleRemoveFx(safeFxIdx)}
                          aria-label="Delete FX"
                          title="Delete FX"
                          className="w-8 h-8 rounded-full bg-[var(--bg-surface)] hover:bg-red-500/15 border border-[var(--border-subtle)] hover:border-red-500/40 text-[var(--text-muted)] hover:text-red-400 flex items-center justify-center transition disabled:opacity-45"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentFxEntry.enabled}
                          disabled={isLocked}
                          onClick={() => updateFxEntry({ enabled: !currentFxEntry.enabled })}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase transition disabled:opacity-45 ${
                            currentFxEntry.enabled
                              ? layerTheme.switchBtn
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                          }`}
                        >
                          <span>{currentFxEntry.enabled ? 'ON' : 'OFF'}</span>
                          <span
                            className={`w-8 h-4 rounded-full p-0.5 flex items-center transition ${
                              currentFxEntry.enabled ? 'bg-black/20' : 'bg-[var(--border-subtle)]'
                            }`}
                          >
                            <span
                              className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${
                                currentFxEntry.enabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Volume / Intensity Slider */}
                    <div className="pt-2 border-t border-[var(--border-subtle)]/50">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold tracking-[0.12em] uppercase text-[var(--text-muted)]">
                          Volume / Intensity
                        </span>
                        <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                          {currentFxEntry.volumeDb > 0 ? '+' : ''}
                          {currentFxEntry.volumeDb.toFixed(1)} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-24}
                        max={6}
                        step={0.5}
                        disabled={isLocked}
                        value={currentFxEntry.volumeDb}
                        onChange={(e) => updateFxEntry({ volumeDb: Number(e.target.value) })}
                        className="w-full accent-fuchsia-400"
                      />
                    </div>
                  </div>

                  {/* Start Position (Bar & Beat) + BPM-Synced Duration (Bars) */}
                  <div className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                        START POSITION &amp; BAR DURATION
                      </span>
                      <span className="text-[11px] font-semibold text-fuchsia-400 tabular-nums">
                        {(currentFxEntry.durationBars * barDurationSec).toFixed(2)}s @ {safeBpm} BPM ({songTimeSignature})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                          Start Bar (1–{sectionTotalBars})
                        </label>
                        <select
                          disabled={isLocked}
                          value={Math.min(sectionTotalBars, Math.max(1, currentFxEntry.startBar))}
                          onChange={(e) => updateFxEntry({ startBar: Number(e.target.value) })}
                          className="w-full h-9 px-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] focus:border-fuchsia-400 focus:outline-none disabled:opacity-45"
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
                          Start Beat (1–{beatsPerBar})
                        </label>
                        <select
                          disabled={isLocked}
                          value={Math.min(beatsPerBar, Math.max(1, currentFxEntry.startBeat))}
                          onChange={(e) => updateFxEntry({ startBeat: Number(e.target.value) })}
                          className="w-full h-9 px-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] focus:border-fuchsia-400 focus:outline-none disabled:opacity-45"
                        >
                          {beatNumbers.map((b) => (
                            <option key={b} value={b}>
                              Beat {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Duration (Bars — synced to BPM &amp; Meter)
                      </span>
                      <div className="grid grid-cols-6 gap-1.5">
                        {FX_DURATION_BAR_OPTIONS.map((durOpt) => {
                          const active = Math.abs(currentFxEntry.durationBars - durOpt.value) < 0.01;
                          return (
                            <button
                              key={durOpt.value}
                              type="button"
                              disabled={isLocked}
                              onClick={() => updateFxEntry({ durationBars: durOpt.value })}
                              className={`h-8 rounded-xl border text-xs font-bold tabular-nums transition disabled:opacity-45 ${
                                active
                                  ? layerTheme.selectedChip
                                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                              }`}
                              title={durOpt.label}
                            >
                              {durOpt.value}b
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Categorized 16-Preset FX Browser */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                        Effect Type ({FX_CATALOG.length} Synthesized Offline FX)
                      </label>
                      <button
                        type="button"
                        onClick={() => triggerCurrentPreview(false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/50 text-[10px] font-bold text-fuchsia-300 hover:bg-fuchsia-500/25 transition"
                      >
                        <Play className="w-3 h-3" />
                        <span>Preview FX</span>
                      </button>
                    </div>

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

                    <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-2">
                      {filteredCatalog.map((fxItem) => {
                        const selected = currentFxEntry.effectType === fxItem.id;
                        return (
                          <button
                            key={fxItem.id}
                            type="button"
                            disabled={isLocked}
                            onClick={() => updateFxEntry({ effectType: fxItem.id as FxTypeId })}
                            className={`w-full rounded-xl border px-3 py-2 text-left flex items-center justify-between gap-2 transition disabled:opacity-45 ${
                              selected
                                ? `${layerTheme.selectedChip} bg-[var(--bg-surface)]`
                                : 'bg-[var(--bg-surface)]/60 border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold truncate text-[var(--text-primary)]">
                                  {fxItem.id}
                                </p>
                                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-recessed)] text-[var(--text-muted)] shrink-0">
                                  {fxItem.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                                {fxItem.description}
                              </p>
                            </div>
                            {selected && <Check className="w-4 h-4 shrink-0 text-fuchsia-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Section-level Master Drums Toggle (for Drums Tab ONLY) */}
              {activeLayer === 'drums' && (
            <div
              className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 transition ${
                drumsMasterOn
                  ? 'bg-rose-500/12 border-rose-500/50'
                  : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Power
                  className={`w-4 h-4 ${
                    drumsMasterOn ? 'text-rose-400' : 'text-[var(--text-muted)]'
                  }`}
                />
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    Section Drums: {drumsMasterOn ? 'ON' : 'OFF'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={drumsMasterOn}
                disabled={isLocked}
                onClick={() => commitDrumLayers(drumLayers, !drumsMasterOn)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase transition disabled:opacity-45 ${
                  drumsMasterOn
                    ? 'bg-rose-500 border-rose-400 text-white'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                <span>{drumsMasterOn ? 'ON' : 'OFF'}</span>
                <span
                  className={`w-8 h-4 rounded-full p-0.5 flex items-center transition ${
                    drumsMasterOn ? 'bg-black/20' : 'bg-[var(--border-subtle)]'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${
                      drumsMasterOn ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </div>
          )}

          {/* Layer Stack Switcher (+ Add Layer) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                {layerTheme.title} Layers ({activeLayerList.length})
              </span>
              <button
                type="button"
                disabled={isLocked}
                onClick={handleAddLayer}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--accent-amber-text)] transition disabled:opacity-45"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Layer</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {activeLayerList.map((entry, idx) => {
                const isSelected = idx === safeLayerIdx;
                const layerShort =
                  activeLayer === 'pad'
                    ? `Pad ${idx + 1}`
                    : activeLayer === 'synth'
                    ? `Synth ${idx + 1}`
                    : activeLayer === 'arp'
                    ? `Arp ${idx + 1}`
                    : `Drum ${idx + 1}`;
                return (
                  <button
                    key={entry.id || idx}
                    type="button"
                    onClick={() => {
                      setSelectedLayerIndex(idx);
                      setSelectedCategory('All');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                      isSelected
                        ? layerTheme.selectedChip
                        : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        entry.enabled ? layerTheme.dotBg : 'bg-zinc-500/50'
                      }`}
                    />
                    <span>{layerShort}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Layer ON/OFF + Delete Extra Layer + Individual Volume Slider */}
          <div
            className={`rounded-2xl border p-3.5 space-y-3 transition ${
              currentEntry.enabled
                ? layerTheme.switchCard
                : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {layerTheme.title} {safeLayerIdx + 1}: {currentEntry.enabled ? 'ON' : 'OFF'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeLayerList.length > 1 && (
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleRemoveLayer(safeLayerIdx)}
                    aria-label="Delete extra layer"
                    title="Delete layer"
                    className="w-8 h-8 rounded-full bg-[var(--bg-surface)] hover:bg-red-500/15 border border-[var(--border-subtle)] hover:border-red-500/40 text-[var(--text-muted)] hover:text-red-400 flex items-center justify-center transition disabled:opacity-45"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  role="switch"
                  aria-checked={currentEntry.enabled}
                  disabled={isLocked}
                  onClick={() => updateSharedFields({ enabled: !currentEntry.enabled })}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase transition disabled:opacity-45 ${
                    currentEntry.enabled
                      ? layerTheme.switchBtn
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  <span>{currentEntry.enabled ? 'ON' : 'OFF'}</span>
                  <span
                    className={`w-8 h-4 rounded-full p-0.5 flex items-center transition ${
                      currentEntry.enabled ? 'bg-black/20' : 'bg-[var(--border-subtle)]'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${
                        currentEntry.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>

            {/* Individual Layer Volume Slider */}
            <div className="pt-2 border-t border-[var(--border-subtle)]/50">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-semibold tracking-[0.12em] uppercase text-[var(--text-muted)]">
                  Layer Volume
                </span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {currentLayerVolumeDb > 0 ? '+' : ''}
                  {currentLayerVolumeDb.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={-24}
                max={6}
                step={0.5}
                disabled={isLocked}
                value={currentLayerVolumeDb}
                onChange={(e) => updateSharedFields({ volumeDb: Number(e.target.value) })}
                className={`w-full ${layerTheme.accentHex}`}
              />
            </div>
          </div>

          {/* Multi-Bar-Range Selector (All Bars vs Multiple Specific Start–End Ranges) */}
          <div className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                BAR RANGES ({sectionTotalBars} {sectionTotalBars === 1 ? 'BAR' : 'BARS'} IN SECTION)
              </span>
              <span className={`text-[11px] font-semibold truncate ${layerTheme.accentText}`}>
                {formatLayerBarRangeLabel(currentEntry, sectionTotalBars)}
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
                    barRanges: [{ startBar: 1, endBar: sectionTotalBars }],
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
                    startBar: effectiveRanges[0]?.startBar ?? 1,
                    endBar: effectiveRanges[0]?.endBar ?? sectionTotalBars,
                    barRanges:
                      effectiveRanges.length > 0
                        ? effectiveRanges
                        : [{ startBar: 1, endBar: sectionTotalBars }],
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
              <div className="space-y-2 pt-1">
                {effectiveRanges.map((range, rIdx) => (
                  <div
                    key={rIdx}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
                  >
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                        Range {rIdx + 1} Start
                      </label>
                      <select
                        disabled={isLocked}
                        value={range.startBar}
                        onChange={(e) => {
                          const nextStart = Number(e.target.value);
                          const nextRanges = effectiveRanges.map((item, i) =>
                            i === rIdx
                              ? {
                                  startBar: nextStart,
                                  endBar: Math.max(nextStart, item.endBar),
                                }
                              : item
                          );
                          updateSharedFields({
                            barRangeMode: 'custom',
                            startBar: nextRanges[0].startBar,
                            endBar: nextRanges[0].endBar,
                            barRanges: nextRanges,
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
                        value={range.endBar}
                        onChange={(e) => {
                          const nextEnd = Number(e.target.value);
                          const nextRanges = effectiveRanges.map((item, i) =>
                            i === rIdx
                              ? {
                                  startBar: Math.min(item.startBar, nextEnd),
                                  endBar: nextEnd,
                                }
                              : item
                          );
                          updateSharedFields({
                            barRangeMode: 'custom',
                            startBar: nextRanges[0].startBar,
                            endBar: nextRanges[0].endBar,
                            barRanges: nextRanges,
                          });
                        }}
                        className="w-full h-9 px-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] focus:border-[#E5A958] focus:outline-none disabled:opacity-45"
                      >
                        {barNumbers
                          .filter((num) => num >= range.startBar)
                          .map((num) => (
                            <option key={num} value={num}>
                              Bar {num}
                            </option>
                          ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={isLocked || effectiveRanges.length <= 1}
                      onClick={() => {
                        const nextRanges = effectiveRanges.filter((_, i) => i !== rIdx);
                        if (nextRanges.length === 0) return;
                        updateSharedFields({
                          barRangeMode: 'custom',
                          startBar: nextRanges[0].startBar,
                          endBar: nextRanges[0].endBar,
                          barRanges: nextRanges,
                        });
                      }}
                      title={
                        effectiveRanges.length <= 1
                          ? 'At least one bar range required'
                          : 'Remove this bar range'
                      }
                      aria-label="Remove bar range"
                      className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 flex items-center justify-center transition disabled:opacity-35"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    const lastEnd = effectiveRanges[effectiveRanges.length - 1]?.endBar ?? 1;
                    const suggestedStart = Math.min(sectionTotalBars, lastEnd + 1);
                    const suggestedEnd = sectionTotalBars;
                    const nextRanges = [
                      ...effectiveRanges,
                      { startBar: suggestedStart, endBar: suggestedEnd },
                    ];
                    updateSharedFields({
                      barRangeMode: 'custom',
                      startBar: nextRanges[0].startBar,
                      endBar: nextRanges[0].endBar,
                      barRanges: nextRanges,
                    });
                  }}
                  className="w-full h-8 rounded-xl border border-dashed border-[var(--border-subtle)] hover:border-[#E5A958]/70 bg-[var(--bg-surface)]/50 text-xs font-semibold text-[var(--accent-amber-text)] inline-flex items-center justify-center gap-1.5 transition disabled:opacity-45"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Bar Range</span>
                </button>
              </div>
            )}
          </div>

          {/* PAD / SYNTH / ARP PATTERN & TONE CONTROLS */}
          {activeLayer !== 'drums' && (
            <>
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
                      const active = (currentEntry as PadLayerEntry).pattern === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isLocked}
                          onClick={() =>
                            updatePadEntry({ pattern: opt.value as SectionPadPattern })
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
                      const active = (currentEntry as SynthLayerEntry).pattern === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isLocked}
                          onClick={() =>
                            updateSynthEntry({ pattern: opt.value as SectionSynthPattern })
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
                        const active = (currentEntry as ArpLayerEntry).pattern === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={isLocked}
                            onClick={() =>
                              updateArpEntry({ pattern: opt.value as ArpPatternType })
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
                        const active =
                          ((currentEntry as ArpLayerEntry).subdivision || '8n') === sub.value;
                        return (
                          <button
                            key={sub.value}
                            type="button"
                            disabled={isLocked}
                            onClick={() => updateArpEntry({ subdivision: sub.value })}
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

              {/* 18-Preset Tone Browser */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                    {layerTheme.title} Tone Library ({catalog.length} Presets)
                  </label>
                  <span className={`text-[11px] font-semibold truncate ${layerTheme.accentText}`}>
                    {(currentEntry as PadLayerEntry | SynthLayerEntry | ArpLayerEntry).tone}
                  </span>
                </div>

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

                <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-2">
                  {filteredCatalog.map((preset) => {
                    const currentTone = (
                      currentEntry as PadLayerEntry | SynthLayerEntry | ArpLayerEntry
                    ).tone;
                    const selected = currentTone === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={isLocked}
                        onClick={() => {
                          if (activeLayer === 'pad') {
                            updatePadEntry({ tone: preset.id as PadPresetId });
                          } else if (activeLayer === 'synth') {
                            updateSynthEntry({ tone: preset.id as SynthPresetId });
                          } else {
                            updateArpEntry({ tone: preset.id as ArpPresetId });
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
            </>
          )}

          {/* DRUMS TAB: 6 OFFLINE KITS + 13 PATTERNS + BREAKS/FILLS */}
          {activeLayer === 'drums' && currentDrumEntry && (
            <>
              {/* 1. Drum Kit Selector (6 Kits) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                    Offline Drum Kit ({DRUM_KIT_CATALOG.length} Synthesized Kits)
                  </label>
                  <span className="text-[11px] font-semibold text-rose-400 truncate">
                    {currentDrumEntry.kit}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {DRUM_KIT_CATALOG.map((kitItem) => {
                    const selected = currentDrumEntry.kit === kitItem.id;
                    return (
                      <button
                        key={kitItem.id}
                        type="button"
                        disabled={isLocked}
                        onClick={() => updateDrumEntry({ kit: kitItem.id })}
                        className={`rounded-xl border px-3 py-2 text-left transition disabled:opacity-45 ${
                          selected
                            ? layerTheme.selectedChip
                            : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold truncate">{kitItem.id}</span>
                          {selected && <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                          {kitItem.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Drum Beat Style / Pattern Selector (13 Styles) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                    Beat Style / Pattern ({DRUM_PATTERN_CATALOG.length} Grooves)
                  </label>
                  <span className="text-[11px] font-semibold text-rose-400 truncate">
                    {currentDrumEntry.pattern}
                  </span>
                </div>

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

                <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5 rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-2">
                  {filteredCatalog.map((pat) => {
                    const selected = currentDrumEntry.pattern === pat.id;
                    return (
                      <button
                        key={pat.id}
                        type="button"
                        disabled={isLocked}
                        onClick={() => updateDrumEntry({ pattern: pat.id as DrumPatternId })}
                        className={`w-full rounded-xl border px-3 py-2 text-left flex items-center justify-between gap-2 transition disabled:opacity-45 ${
                          selected
                            ? `${layerTheme.selectedChip} bg-[var(--bg-surface)]`
                            : 'bg-[var(--bg-surface)]/60 border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold truncate text-[var(--text-primary)]">
                              {pat.id}
                            </p>
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-recessed)] text-[var(--text-muted)] shrink-0">
                              {pat.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                            {pat.description}
                          </p>
                        </div>
                        {selected && <Check className="w-4 h-4 shrink-0 text-rose-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Drum Breaks & Fills System */}
              <div className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                      DRUM BREAKS &amp; FILLS
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerCurrentPreview(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-[10px] font-bold text-rose-400 hover:bg-rose-500/25 transition"
                  >
                    <Play className="w-3 h-3" />
                    <span>Preview Fill</span>
                  </button>
                </div>

                {/* Auto-Fill Frequency */}
                <div className="space-y-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Auto-Fill Frequency
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DRUM_FILL_FREQUENCY_OPTIONS.map((opt) => {
                      const active = (currentDrumEntry.fillFrequency || 'none') === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isLocked}
                          onClick={() =>
                            updateDrumEntry({ fillFrequency: opt.value as DrumFillFrequency })
                          }
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition disabled:opacity-45 ${
                            active
                              ? layerTheme.selectedChip
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Break / Fill Bars */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Custom Break / Fill Bars (Tap or Type)
                    </span>
                    {(currentDrumEntry.customFillBars?.length || 0) > 0 && (
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => {
                          updateDrumEntry({ customFillBars: [] });
                          setCustomBarsInput('');
                        }}
                        className="text-[10px] font-semibold text-rose-400 hover:underline"
                      >
                        Clear Custom
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {barNumbers.slice(0, 32).map((num) => {
                      const active = (currentDrumEntry.customFillBars || []).includes(num);
                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            const existing = new Set(currentDrumEntry.customFillBars || []);
                            if (existing.has(num)) existing.delete(num);
                            else existing.add(num);
                            const sorted = Array.from(existing).sort((a, b) => a - b);
                            updateDrumEntry({ customFillBars: sorted });
                            setCustomBarsInput(sorted.join(', '));
                          }}
                          className={`w-7 h-7 rounded-lg border text-[11px] font-bold tabular-nums transition disabled:opacity-45 ${
                            active
                              ? 'bg-rose-500 border-rose-400 text-white'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={customBarsInput}
                    placeholder="Exact bar numbers e.g. 4, 12, 24, 36"
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCustomBarsInput(raw);
                      const parsed = Array.from(
                        new Set(
                          raw
                            .split(/[^0-9]+/)
                            .map((tok) => parseInt(tok, 10))
                            .filter((n) => Number.isFinite(n) && n >= 1 && n <= sectionTotalBars)
                        )
                      ).sort((a, b) => a - b);
                      updateDrumEntry({ customFillBars: parsed });
                    }}
                    className="w-full h-8 px-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:border-rose-400 focus:outline-none disabled:opacity-45"
                  />
                </div>

                {/* Break / Fill Style */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Break / Fill Style
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {DRUM_FILL_STYLE_OPTIONS.map((fs) => {
                      const active =
                        (currentDrumEntry.fillStyle || 'Tom Fill Cascade') === fs.value;
                      return (
                        <button
                          key={fs.value}
                          type="button"
                          disabled={isLocked}
                          onClick={() => updateDrumEntry({ fillStyle: fs.value })}
                          className={`rounded-xl border px-2.5 py-2 text-left transition disabled:opacity-45 ${
                            active
                              ? layerTheme.selectedChip
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                          }`}
                        >
                          <p className="text-xs font-bold leading-tight">{fs.value}</p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-snug">
                            {fs.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
            </>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="p-4 sm:p-5 pt-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={activeLayer === 'fx' && !currentFxEntry}
            onClick={() => triggerCurrentPreview(false)}
            className="flex-1 h-11 rounded-2xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 transition"
          >
            <Play className={`w-3.5 h-3.5 ${layerTheme.accentText}`} />
            <span>
              {activeLayer === 'fx'
                ? currentFxEntry
                  ? `Preview FX ${safeFxIdx + 1}`
                  : 'Add an FX to Preview'
                : `Preview ${layerTheme.title} ${safeLayerIdx + 1}`}
            </span>
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
