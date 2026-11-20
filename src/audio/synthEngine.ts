import * as Tone from 'tone';
import type {
  ArpLayerEntry,
  ArpPatternType,
  ArpPresetId,
  AudioExportFormat,
  BarMeter,
  DrumFillFrequency,
  DrumFillStyle,
  DrumKitId,
  DrumLayerEntry,
  DrumPatternId,
  FxTypeId,
  MetronomeSettings,
  PadLayerEntry,
  PadPresetId,
  SectionArpConfig,
  SectionDrumsConfig,
  SectionFxConfig,
  SectionMultiPadConfig,
  SectionPadPattern,
  SectionSynthConfig,
  SectionSynthPattern,
  Song,
  SynthBackingSettings,
  SynthLayerEntry,
  SynthPresetId,
  WavExportTrackSelection,
} from '../types';
import {
  buildExportAudioFilename,
  buildSongTimeline,
  chordToMidiNotes,
  getNormalizedArpLayers,
  getNormalizedDrumLayers,
  getNormalizedFxLayers,
  getNormalizedPadLayers,
  getNormalizedSynthLayers,
  hasBeatSplits,
  isBarInSectionLayerRange,
  shouldTriggerBarVoiceCueAndCount,
  shouldTriggerDrumFill,
} from '../utils/chords';
import {
  getCustomVoiceCue,
  resolveBundledCueUrl,
  resolveCountCueUrl,
} from '../utils/voiceCues';
import type { BeatScheduleEvent } from './AudioEngine';
import {
  balanceToPan,
  encodeAudioBufferToMp3Blob,
  encodeAudioBufferToWavBlob,
  scheduleChordSynth,
  scheduleCubaseClick,
  scheduleSubdivisionClicks,
} from './cubaseClick';
import {
  DEFAULT_FX_ENTRY,
  FX_CATALOG,
  FX_DURATION_BAR_OPTIONS,
  scheduleWebAudioFx,
} from './fxSynth';

export { DEFAULT_FX_ENTRY, FX_CATALOG, FX_DURATION_BAR_OPTIONS };

export const SYNTH_STORAGE_KEY = 'chordbook_synth_v1';

export interface PresetCatalogItem<T extends string> {
  id: T;
  category: string;
  description: string;
}

export const DEFAULT_PAD_LAYER: PadLayerEntry = {
  id: 'pad-layer-1',
  enabled: false,
  pattern: 'Sustain',
  tone: 'Warm Analog Pad',
  volumeDb: 0,
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
};

export const DEFAULT_SECTION_MULTI_PAD: SectionMultiPadConfig = {
  enabled: false,
  pattern: 'Sustain',
  tone: 'Warm Analog Pad',
  volumeDb: 0,
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
};

export const DEFAULT_SYNTH_LAYER: SynthLayerEntry = {
  id: 'synth-layer-1',
  enabled: false,
  pattern: 'Full Chord',
  tone: 'FM Electric Piano',
  volumeDb: 0,
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
};

export const DEFAULT_SECTION_SYNTH: SectionSynthConfig = {
  enabled: false,
  pattern: 'Full Chord',
  tone: 'FM Electric Piano',
  volumeDb: 0,
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
};

export const DEFAULT_ARP_LAYER: ArpLayerEntry = {
  id: 'arp-layer-1',
  enabled: false,
  pattern: 'upDown',
  tone: 'Synth Pluck Arp',
  subdivision: '8n',
  volumeDb: 0,
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
};

export const DEFAULT_SECTION_ARP: SectionArpConfig = {
  enabled: false,
  pattern: 'upDown',
  tone: 'Synth Pluck Arp',
  subdivision: '8n',
  volumeDb: 0,
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
};

export const DEFAULT_DRUM_LAYER: DrumLayerEntry = {
  id: 'drum-layer-1',
  enabled: true,
  kit: 'Acoustic Pop Kit',
  pattern: 'Straight 8th Pop',
  volumeDb: 0,
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
  fillFrequency: 'none',
  customFillBars: [],
  fillStyle: 'Tom Fill Cascade',
};

export const DEFAULT_SECTION_DRUMS: SectionDrumsConfig = {
  enabled: false, // Drums ALWAYS default to OFF on new/unconfigured sections
  kit: 'Acoustic Pop Kit',
  pattern: 'Straight 8th Pop',
  volumeDb: 0,
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
  fillFrequency: 'none',
  customFillBars: [],
  fillStyle: 'Tom Fill Cascade',
};

export const DEFAULT_SECTION_FX: SectionFxConfig = {
  enabled: true,
  effects: [],
};

export const DEFAULT_WAV_TRACK_SELECTION: WavExportTrackSelection = {
  multiPad: true,
  synth: true,
  arp: true,
  drums: false, // Unchecked / OFF by default
  fx: true,
  click: true,
  voiceCues: true,
};

export const DEFAULT_SYNTH_BACKING_SETTINGS: SynthBackingSettings = {
  masterEnabled: true,
  showTrackDetailsInSections: true,
  synth: {
    volumeDb: -5,
    pan: -0.15,
    muted: false,
    fillEmptyBars: false,
  },
  pad: {
    volumeDb: -12,
    pan: 0.15,
    muted: false,
    fillEmptyBars: false,
  },
  arp: {
    volumeDb: -4,
    pan: 0,
    muted: false,
    fillEmptyBars: false,
  },
  drums: {
    enabled: true,
    volumeDb: -4,
    pan: 0,
    muted: false,
  },
  fx: {
    enabled: true,
    volumeDb: -2,
    pan: 0,
    muted: false,
  },
};

export const SYNTH_PRESET_CATALOG: PresetCatalogItem<SynthPresetId>[] = [
  // Keys & Plucks
  { id: 'FM Electric Piano', category: 'Keys & Plucks', description: 'Warm tine Rhodes-style FM electric keys' },
  { id: 'Wurli Reed Keys', category: 'Keys & Plucks', description: 'Vintage reed electric piano with gentle bite' },
  { id: 'Soft Pluck', category: 'Keys & Plucks', description: 'Mellow triangle pluck for clean chord comping' },
  { id: 'Mute Nylon Pluck', category: 'Keys & Plucks', description: 'Acoustic damped nylon-string chord pluck' },
  { id: 'Funk Clavinet', category: 'Keys & Plucks', description: 'Snappy resonant clavinet for rhythmic grooves' },
  // Analog Leads & Polys
  { id: 'Classic Saw Lead', category: 'Analog Leads & Polys', description: 'Bold dual-saw analog chord synth' },
  { id: 'Warm Analog Polysynth', category: 'Analog Leads & Polys', description: 'Creamy filtered polyphonic brass-synth chords' },
  { id: 'Brass Synth Stab', category: 'Analog Leads & Polys', description: 'Punchy 80s poly brass hit' },
  { id: 'Detuned Supersaw', category: 'Analog Leads & Polys', description: 'Wide stacked supersaw anthem synth' },
  { id: 'Retro 80s Poly', category: 'Analog Leads & Polys', description: 'Classic pulse-width vintage polysynth' },
  // Bells & Chimes
  { id: 'Crystal Bell', category: 'Bells & Chimes', description: 'Glassy harmonic FM bell chord sparkle' },
  { id: 'Celesta Sparkle', category: 'Bells & Chimes', description: 'Delicate high-register acoustic-style celesta' },
  // Basses
  { id: 'Sub Analog Bass', category: 'Basses', description: 'Deep low-passed analog sub bass foundation' },
  { id: 'Punchy Synth Bass', category: 'Basses', description: 'Focused octave synth bass with quick decay' },
  { id: 'FM Slap Bass', category: 'Basses', description: 'Articulate FM harmonic bass with snap' },
  // Strings, Choirs & Gates
  { id: 'Staccato Strings', category: 'Strings, Choirs & Gates', description: 'Short bowed orchestral string chord hits' },
  { id: 'Choir Vox Hit', category: 'Strings, Choirs & Gates', description: 'Formant-filtered vocal ensemble chord layer' },
  { id: 'Gated Synth Chop', category: 'Strings, Choirs & Gates', description: 'Tight rhythmic gated chord chop' },
];

export const PAD_PRESET_CATALOG: PresetCatalogItem<PadPresetId>[] = [
  // Warm Pads
  { id: 'Warm Analog Pad', category: 'Warm Pads', description: 'Thick detuned analog saw pad with silk filter' },
  { id: 'Velvet Brass Pad', category: 'Warm Pads', description: 'Slow-blooming warm low-brass pad sustain' },
  { id: 'Golden Tape Pad', category: 'Warm Pads', description: 'Nostalgic lo-fi tape-warmed chord cushion' },
  { id: 'Soft Sub Pad', category: 'Warm Pads', description: 'Pure low-mid sine-triangle sub atmosphere' },
  { id: 'Creamy Juno Chorus Pad', category: 'Warm Pads', description: 'Lush wide chorus analog synth bed' },
  // Strings & Choirs
  { id: 'Lush String Pad', category: 'Strings & Choirs', description: 'Full-bodied orchestral string ensemble pad' },
  { id: 'Chamber Strings', category: 'Strings & Choirs', description: 'Intimate warm studio string section' },
  { id: 'Ethereal Angel Choir', category: 'Strings & Choirs', description: 'Formant-shaped airy heavenly vocal choir' },
  { id: 'Cathedral Boys Choir', category: 'Strings & Choirs', description: 'Resonant sacred choral ahh sustain' },
  { id: 'Cinematic String Swell', category: 'Strings & Choirs', description: 'Slow dramatic film-score string rise' },
  // Ambient Textures
  { id: 'Deep Space Pad', category: 'Ambient Textures', description: 'Floating evolving FM cosmic atmosphere' },
  { id: 'Shimmer Halo Pad', category: 'Ambient Textures', description: 'Bright upper-octave ethereal shimmer wash' },
  { id: 'Glassy Horizon Texture', category: 'Ambient Textures', description: 'Crystalline evolving bell-pad horizon' },
  // Rhythmic Gates
  { id: 'Rhythmic Gate Pad', category: 'Rhythmic Gates', description: 'Syncopated chopped trance-style gate bed' },
  { id: 'Trance Sidechain Gate', category: 'Rhythmic Gates', description: 'Pumping festival saw pad texture' },
  // Organs & Drones
  { id: 'Soft Organ Pad', category: 'Organs & Drones', description: 'Smooth drawbar church organ sustain' },
  { id: 'Gospel B3 Swell', category: 'Organs & Drones', description: 'Warm soulful tonewheel organ swell' },
  { id: 'Harmonium Drone', category: 'Organs & Drones', description: 'Traditional reed drone bed for worship & folk' },
];

export const ARP_PRESET_CATALOG: PresetCatalogItem<ArpPresetId>[] = [
  // Plucked & Strings
  { id: 'Synth Pluck Arp', category: 'Plucked & Strings', description: 'Crisp modern pop-worship synth pluck arp' },
  { id: 'Acoustic Harp Arp', category: 'Plucked & Strings', description: 'Warm resonant Celtic/concert harp arpeggio' },
  { id: 'Electric Guitar Clean', category: 'Plucked & Strings', description: 'Clean picked electric guitar arpeggio chime' },
  { id: 'Muted Strat Pluck', category: 'Plucked & Strings', description: 'Tight palm-muted funk/pop guitar arp' },
  { id: 'Pizzicato String Arp', category: 'Plucked & Strings', description: 'Short plucked orchestral violin-cello arp' },
  // Bells & Mallets
  { id: 'Warm Kalimbaphone', category: 'Bells & Mallets', description: 'Woody African thumb-piano resonant pluck' },
  { id: 'Soft Marimba', category: 'Bells & Mallets', description: 'Round wooden mallet marimba pulse' },
  { id: 'Vibraphone Bell', category: 'Bells & Mallets', description: 'Metallic jazz vibraphone bell resonance' },
  { id: 'Music Box Chime', category: 'Bells & Mallets', description: 'Delicate sparkling wind-up chime arp' },
  { id: 'FM Tubular Bell', category: 'Bells & Mallets', description: 'Bright resonant FM chime harmonics' },
  { id: 'Glass Marimba', category: 'Bells & Mallets', description: 'Liquid crystal mallet arpeggio texture' },
  // Analog & Electronic
  { id: '8-Bit Retro', category: 'Analog & Electronic', description: 'Classic chiptune square-wave retro arp' },
  { id: 'Acid 303 Saw Arp', category: 'Analog & Electronic', description: 'Resonant filtered acid synth lead sequence' },
  { id: 'Trance Supersaw Arp', category: 'Analog & Electronic', description: 'Bright wide detuned festival trance arp' },
  { id: 'FM Percussive Zap', category: 'Analog & Electronic', description: 'Snappy futuristic FM transient sequence' },
  // Rhythmic, Bass & Ambient
  { id: 'Rhythmic Gate Pulse', category: 'Rhythmic, Bass & Ambient', description: 'Tight choppy gated pulse sequence' },
  { id: 'Driving Bass Arp', category: 'Rhythmic, Bass & Ambient', description: 'Low-end octave bassline arpeggiator' },
  { id: 'Ambient Dew Texture', category: 'Rhythmic, Bass & Ambient', description: 'Floating dreamy delay-like sine droplet arp' },
];

export const SYNTH_PRESET_OPTIONS: SynthPresetId[] = SYNTH_PRESET_CATALOG.map((p) => p.id);
export const PAD_PRESET_OPTIONS: PadPresetId[] = PAD_PRESET_CATALOG.map((p) => p.id);
export const ARP_PRESET_OPTIONS: ArpPresetId[] = ARP_PRESET_CATALOG.map((p) => p.id);

export const SECTION_PAD_PATTERN_OPTIONS: {
  value: SectionPadPattern;
  label: string;
  description: string;
}[] = [
  { value: 'Sustain', label: 'Sustain Hold', description: 'Warm full-bar held chord pad' },
  { value: 'Pulse', label: 'Beat Pulse', description: 'Soft rhythmic quarter-note pad pulses' },
  { value: 'Swell', label: 'Ambient Swell', description: 'Rising upper-harmonic bloom each bar' },
  { value: 'Octave Drone', label: 'Octave Drone', description: 'Deep root, fifth & octave foundation' },
  { value: 'Rhythmic Gate', label: 'Rhythmic Gate', description: 'Syncopated 8th-note gated pad chop' },
];

export const SECTION_SYNTH_PATTERN_OPTIONS: {
  value: SectionSynthPattern;
  label: string;
  description: string;
}[] = [
  { value: 'Full Chord', label: 'Full Chord', description: 'Smooth 96% overlap sustained chord' },
  { value: 'Stabs', label: 'Chord Stabs', description: 'Punchy rhythmic stabs on main beats' },
  { value: 'Off-Beat Comp', label: 'Off-Beat Comp', description: 'Syncopated upbeat chord groove' },
  { value: 'Bass Root Focus', label: 'Bass & Root', description: 'Deep root + fifth anchor voicing' },
];

export const ARP_PATTERN_OPTIONS: { value: ArpPatternType; label: string }[] = [
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'upDown', label: 'Up/Down' },
  { value: 'alternateUp', label: 'Alt Up' },
  { value: 'random', label: 'Random' },
];

export const ARP_SUBDIVISION_OPTIONS: {
  value: '4n' | '8n' | '8t' | '16n';
  label: string;
}[] = [
  { value: '4n', label: 'Quarter (4n)' },
  { value: '8n', label: 'Eighth (8n)' },
  { value: '8t', label: 'Triplet (8t)' },
  { value: '16n', label: '16th (16n)' },
];

const BASS_SYNTH_PRESETS = new Set<SynthPresetId>([
  'Sub Analog Bass',
  'Punchy Synth Bass',
  'FM Slap Bass',
]);

export const DRUM_KIT_CATALOG: PresetCatalogItem<DrumKitId>[] = [
  {
    id: 'Acoustic Pop Kit',
    category: 'Live Acoustic',
    description: 'Punchy studio kick, crisp snare wire, bright hats & warm acoustic toms',
  },
  {
    id: 'Modern Studio Kit',
    category: 'Live Acoustic',
    description: 'Tight sub-boosted kick, compressed pop snare, shimmering ride & splash hats',
  },
  {
    id: '808 Electronic Kit',
    category: 'Electronic',
    description: 'Deep booming 808 sub kick, crisp electronic snare, clap & sizzling hats',
  },
  {
    id: 'Vintage Analog Drum Machine',
    category: 'Electronic',
    description: 'Classic warm 80s drum-box kick, gated retro snare & crisp tick hats',
  },
  {
    id: 'Baila / Sri Lankan Percussion Kit',
    category: 'Sri Lankan / Percussion',
    description: 'Warm Rabana/dholak bass, sharp Conga, high Bongo, Timbales & continuous Shaker',
  },
  {
    id: 'Soft Brush / Ballad Kit',
    category: 'Acoustic Ballad',
    description: 'Gentle damped kick, soft brushed snare swish & delicate ride shimmer',
  },
];

export const DRUM_PATTERN_CATALOG: PresetCatalogItem<DrumPatternId>[] = [
  // Pop / Rock
  { id: 'Straight 8th Pop', category: 'Pop / Rock', description: 'Clean 4/4 or 3/4 steady 8th-hat pop pocket' },
  { id: 'Driving 16th Rock', category: 'Pop / Rock', description: 'Energetic 16th hi-hat push with punchy kick-snare drive' },
  { id: 'Half-Time Ballad', category: 'Pop / Rock', description: 'Spacious half-time snare backbeat for worship & ballads' },
  { id: 'Upbeat Disco / Funk', category: 'Pop / Rock', description: 'Four-on-the-floor kick with open off-beat hats & crisp snare' },
  // Sri Lankan / South Asian / Baila
  { id: '6/8 Baila Groove', category: 'Sri Lankan / Baila', description: 'Classic 6/8 Baila bounce with conga, bongo, shaker & kick-snare lift' },
  { id: '6/8 Dadra / Folk', category: 'Sri Lankan / Baila', description: '6/8 South Asian folk/worship Dadra Dha-Dhin-Na rhythmic lilt' },
  { id: '4/4 Sinhala Pop / Calypso', category: 'Sri Lankan / Baila', description: 'Syncopated tropical Baila-pop / Calypso percussion bounce' },
  { id: 'Tabla-Groove Fusion', category: 'Sri Lankan / Baila', description: 'Bayan bass slide + Dayan tabla pulse layered with crisp shaker' },
  // Electronic / Modern
  { id: 'Four-on-the-Floor Dance', category: 'Electronic / Modern', description: 'Steady driving kick with off-beat open hat & beat 2/4 clap' },
  { id: 'Reggaeton / Dembow', category: 'Electronic / Modern', description: 'Iconic 3+3+2 dembow syncopated snare/rim bounce' },
  { id: 'Lo-Fi Chill Beat', category: 'Electronic / Modern', description: 'Laid-back swung kick-snare groove with warm muted hats' },
  // Groove Variations
  { id: 'Verse Groove', category: 'Groove Variations', description: 'Controlled cross-stick rimshot, tight closed hats & soft pocket' },
  { id: 'Chorus Groove', category: 'Groove Variations', description: 'Open hat / ride shimmer with big snare & downbeat crash lift' },
];

export const DRUM_FILL_FREQUENCY_OPTIONS: {
  value: DrumFillFrequency;
  label: string;
}[] = [
  { value: 'none', label: 'No Auto-Fill' },
  { value: 'every4', label: 'Every 4 Bars' },
  { value: 'every8', label: 'Every 8 Bars' },
  { value: 'last1', label: 'Last 1 Bar' },
  { value: 'last2', label: 'Last 2 Bars' },
];

export const DRUM_FILL_STYLE_OPTIONS: {
  value: DrumFillStyle;
  description: string;
}[] = [
  { value: 'Snare Roll Build-up', description: 'Escalating 16th/32nd snare build leading cleanly into next bar' },
  { value: 'Tom Fill Cascade', description: 'Descending high -> mid -> floor tom cascade transition' },
  { value: 'Stop-Time Silence Break', description: 'Strong beat-1 ensemble crash/kick stab then dramatic silence' },
  { value: 'Crash & Kick Accent', description: 'Syncopated full-kit kick + crash accent hits' },
  { value: 'Baila Percussion Roll', description: 'Rapid Baila conga, bongo, timbales & snare roll' },
];

export function loadSynthBackingSettings(): SynthBackingSettings {
  try {
    const raw = localStorage.getItem(SYNTH_STORAGE_KEY);
    if (!raw) return DEFAULT_SYNTH_BACKING_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SynthBackingSettings>;
    return {
      masterEnabled:
        typeof parsed.masterEnabled === 'boolean'
          ? parsed.masterEnabled
          : DEFAULT_SYNTH_BACKING_SETTINGS.masterEnabled,
      showTrackDetailsInSections:
        typeof parsed.showTrackDetailsInSections === 'boolean'
          ? parsed.showTrackDetailsInSections
          : true,
      synth: {
        ...DEFAULT_SYNTH_BACKING_SETTINGS.synth,
        ...(parsed.synth || {}),
        fillEmptyBars: Boolean(parsed.synth?.fillEmptyBars),
      },
      pad: {
        ...DEFAULT_SYNTH_BACKING_SETTINGS.pad,
        ...(parsed.pad || {}),
        fillEmptyBars: Boolean(parsed.pad?.fillEmptyBars),
      },
      arp: {
        ...DEFAULT_SYNTH_BACKING_SETTINGS.arp,
        ...(parsed.arp || {}),
        fillEmptyBars: Boolean(parsed.arp?.fillEmptyBars),
      },
      drums: {
        ...DEFAULT_SYNTH_BACKING_SETTINGS.drums,
        ...(parsed.drums || {}),
        enabled:
          typeof parsed.drums?.enabled === 'boolean'
            ? parsed.drums.enabled
            : DEFAULT_SYNTH_BACKING_SETTINGS.drums.enabled,
      },
      fx: {
        ...DEFAULT_SYNTH_BACKING_SETTINGS.fx,
        ...(parsed.fx || {}),
        enabled:
          typeof parsed.fx?.enabled === 'boolean'
            ? parsed.fx.enabled
            : DEFAULT_SYNTH_BACKING_SETTINGS.fx.enabled,
      },
    };
  } catch {
    return DEFAULT_SYNTH_BACKING_SETTINGS;
  }
}

export function saveSynthBackingSettings(settings: SynthBackingSettings): void {
  try {
    localStorage.setItem(SYNTH_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

function isEmptyChordToken(chordStr: string | undefined | null): boolean {
  const clean = (chordStr || '').trim();
  return !clean || clean === '-' || clean === '—';
}

function buildChordNotes(chordStr: string, semitones: number) {
  const midiNotes = chordToMidiNotes(chordStr, semitones);
  if (!midiNotes.length) {
    return {
      synthNotes: [] as string[],
      bassNotes: [] as string[],
      padNotes: [] as string[],
      droneNotes: [] as string[],
      swellUpperNotes: [] as string[],
      arpNotes: [] as string[],
      bassArpNotes: [] as string[],
    };
  }

  const root = midiNotes[0];
  const synthNotes = midiNotes.map((m) => Tone.Midi(m + 12).toNote()); // C4..B4 warm comping register
  const bassNotes = Array.from(new Set([root - 12, root])).map((m) => Tone.Midi(m).toNote());
  const padRaw = [root, ...midiNotes.map((m) => m + 12)];
  const padNotes = Array.from(new Set(padRaw)).map((m) => Tone.Midi(m).toNote());
  const droneRaw = [root, root + 7, root + 12];
  const droneNotes = Array.from(new Set(droneRaw)).map((m) => Tone.Midi(m).toNote());
  const swellUpperNotes = [root + 12, midiNotes[midiNotes.length - 1] + 24].map((m) =>
    Tone.Midi(m).toNote()
  );
  const arpRaw = [...midiNotes.map((m) => m + 12), root + 24];
  const arpNotes = arpRaw.map((m) => Tone.Midi(m).toNote());
  const bassArpRaw = [root - 12, root - 5, root, root - 12 + (midiNotes[1] - root)];
  const bassArpNotes = bassArpRaw.map((m) => Tone.Midi(m).toNote());

  return { synthNotes, bassNotes, padNotes, droneNotes, swellUpperNotes, arpNotes, bassArpNotes };
}

type AnyPolySynth = Tone.PolySynth<Tone.Synth> | Tone.PolySynth<Tone.FMSynth>;

interface ToneVoiceChain {
  poly: AnyPolySynth;
  filter?: Tone.Filter;
  outputGain: Tone.Gain;
  output: Tone.ToneAudioNode;
  dispose: () => void;
}

function makeSimpleSynthChain(
  options: ConstructorParameters<typeof Tone.Synth>[0],
  filterSpec?: { frequency: number; type: BiquadFilterType; Q?: number },
  makeupDb = 0
): ToneVoiceChain {
  const poly = new Tone.PolySynth(Tone.Synth, options);
  poly.maxPolyphony = 16;
  const outputGain = new Tone.Gain(Tone.dbToGain(makeupDb));

  if (filterSpec) {
    const filter = new Tone.Filter({
      frequency: filterSpec.frequency,
      type: filterSpec.type,
      Q: filterSpec.Q ?? 1,
    });
    poly.connect(filter);
    filter.connect(outputGain);
    return {
      poly,
      filter,
      outputGain,
      output: outputGain,
      dispose: () => {
        try {
          poly.releaseAll();
          poly.disconnect();
          poly.dispose();
          filter.disconnect();
          filter.dispose();
          outputGain.disconnect();
          outputGain.dispose();
        } catch {
          // Ignore cleanup errors
        }
      },
    };
  }

  poly.connect(outputGain);
  return {
    poly,
    outputGain,
    output: outputGain,
    dispose: () => {
      try {
        poly.releaseAll();
        poly.disconnect();
        poly.dispose();
        outputGain.disconnect();
        outputGain.dispose();
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

function makeFmSynthChain(
  options: ConstructorParameters<typeof Tone.FMSynth>[0],
  filterSpec?: { frequency: number; type: BiquadFilterType; Q?: number },
  makeupDb = 11
): ToneVoiceChain {
  // Tone.FMSynth (ModulationSynth) has an internal -10 dB carrier attenuation;
  // makeupDb compensates this so FM keys, bells, and guitars match analog presets.
  const poly = new Tone.PolySynth(Tone.FMSynth, options);
  poly.maxPolyphony = 16;
  const outputGain = new Tone.Gain(Tone.dbToGain(makeupDb));

  if (filterSpec) {
    const filter = new Tone.Filter({
      frequency: filterSpec.frequency,
      type: filterSpec.type,
      Q: filterSpec.Q ?? 1,
    });
    poly.connect(filter);
    filter.connect(outputGain);
    return {
      poly,
      filter,
      outputGain,
      output: outputGain,
      dispose: () => {
        try {
          poly.releaseAll();
          poly.disconnect();
          poly.dispose();
          filter.disconnect();
          filter.dispose();
          outputGain.disconnect();
          outputGain.dispose();
        } catch {
          // Ignore cleanup errors
        }
      },
    };
  }

  poly.connect(outputGain);
  return {
    poly,
    outputGain,
    output: outputGain,
    dispose: () => {
      try {
        poly.releaseAll();
        poly.disconnect();
        poly.dispose();
        outputGain.disconnect();
        outputGain.dispose();
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

function createSynthChainForPreset(preset: SynthPresetId): ToneVoiceChain {
  switch (preset) {
    case 'FM Electric Piano':
      return makeFmSynthChain(
        {
          harmonicity: 2,
          modulationIndex: 3.2,
          oscillator: { type: 'sine' },
          modulation: { type: 'triangle' },
          envelope: { attack: 0.012, decay: 0.65, sustain: 0.42, release: 0.6 },
          modulationEnvelope: { attack: 0.01, decay: 0.4, sustain: 0.14, release: 0.45 },
        },
        undefined,
        11
      );
    case 'Wurli Reed Keys':
      return makeFmSynthChain(
        {
          harmonicity: 1,
          modulationIndex: 4.5,
          oscillator: { type: 'triangle' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.008, decay: 0.55, sustain: 0.45, release: 0.5 },
          modulationEnvelope: { attack: 0.006, decay: 0.25, sustain: 0.22, release: 0.35 },
        },
        { frequency: 2600, type: 'lowpass' },
        11
      );
    case 'Soft Pluck':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.008, decay: 0.38, sustain: 0.3, release: 0.6 },
        },
        undefined,
        6
      );
    case 'Mute Nylon Pluck':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fattriangle', count: 2, spread: 8 },
          envelope: { attack: 0.005, decay: 0.28, sustain: 0.18, release: 0.35 },
        },
        { frequency: 1600, type: 'lowpass', Q: 1.4 },
        5
      );
    case 'Funk Clavinet':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'pulse', width: 0.22 },
          envelope: { attack: 0.004, decay: 0.22, sustain: 0.22, release: 0.24 },
        },
        { frequency: 2200, type: 'bandpass', Q: 2.0 },
        6
      );
    case 'Classic Saw Lead':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
          envelope: { attack: 0.025, decay: 0.25, sustain: 0.55, release: 0.6 },
        },
        { frequency: 3200, type: 'lowpass' },
        1
      );
    case 'Warm Analog Polysynth':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
          envelope: { attack: 0.04, decay: 0.35, sustain: 0.62, release: 0.75 },
        },
        { frequency: 1750, type: 'lowpass', Q: 1.5 },
        1
      );
    case 'Brass Synth Stab':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
          envelope: { attack: 0.025, decay: 0.28, sustain: 0.48, release: 0.35 },
        },
        { frequency: 2400, type: 'lowpass', Q: 2.4 },
        1
      );
    case 'Detuned Supersaw':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 5, spread: 34 },
          envelope: { attack: 0.03, decay: 0.3, sustain: 0.65, release: 0.75 },
        },
        { frequency: 3800, type: 'lowpass' },
        0
      );
    case 'Retro 80s Poly':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'pwm', modulationFrequency: 0.8 },
          envelope: { attack: 0.02, decay: 0.32, sustain: 0.52, release: 0.55 },
        },
        { frequency: 2200, type: 'lowpass', Q: 1.3 },
        4
      );
    case 'Crystal Bell':
      return makeFmSynthChain(
        {
          harmonicity: 4.5,
          modulationIndex: 4.2,
          oscillator: { type: 'sine' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.006, decay: 0.85, sustain: 0.28, release: 0.6 },
          modulationEnvelope: { attack: 0.005, decay: 0.42, sustain: 0.08, release: 0.5 },
        },
        undefined,
        12
      );
    case 'Celesta Sparkle':
      return makeFmSynthChain(
        {
          harmonicity: 3.0,
          modulationIndex: 2.4,
          oscillator: { type: 'sine' },
          modulation: { type: 'triangle' },
          envelope: { attack: 0.004, decay: 0.65, sustain: 0.2, release: 0.65 },
          modulationEnvelope: { attack: 0.003, decay: 0.3, sustain: 0.05, release: 0.35 },
        },
        undefined,
        12
      );
    case 'Sub Analog Bass':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.015, decay: 0.35, sustain: 0.72, release: 0.35 },
        },
        { frequency: 520, type: 'lowpass', Q: 1.6 },
        5
      );
    case 'Punchy Synth Bass':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 2, spread: 10 },
          envelope: { attack: 0.006, decay: 0.22, sustain: 0.42, release: 0.24 },
        },
        { frequency: 820, type: 'lowpass', Q: 2.4 },
        3
      );
    case 'FM Slap Bass':
      return makeFmSynthChain(
        {
          harmonicity: 2,
          modulationIndex: 5.5,
          oscillator: { type: 'sine' },
          modulation: { type: 'square' },
          envelope: { attack: 0.004, decay: 0.28, sustain: 0.3, release: 0.22 },
          modulationEnvelope: { attack: 0.002, decay: 0.14, sustain: 0.06, release: 0.15 },
        },
        { frequency: 1400, type: 'lowpass' },
        12
      );
    case 'Staccato Strings':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
          envelope: { attack: 0.035, decay: 0.2, sustain: 0.24, release: 0.28 },
        },
        { frequency: 2500, type: 'lowpass' },
        2
      );
    case 'Choir Vox Hit':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'amsawtooth', harmonicity: 1.5 },
          envelope: { attack: 0.08, decay: 0.35, sustain: 0.65, release: 0.65 },
        },
        { frequency: 1100, type: 'bandpass', Q: 2.0 },
        6
      );
    case 'Gated Synth Chop':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsquare', count: 2, spread: 16 },
          envelope: { attack: 0.006, decay: 0.18, sustain: 0.2, release: 0.16 },
        },
        { frequency: 1950, type: 'lowpass', Q: 2.0 },
        3
      );
    default:
      return makeFmSynthChain(
        {
          harmonicity: 2,
          modulationIndex: 3.2,
          oscillator: { type: 'sine' },
          modulation: { type: 'triangle' },
          envelope: { attack: 0.012, decay: 0.65, sustain: 0.42, release: 0.6 },
        },
        undefined,
        11
      );
  }
}

function createPadChainForPreset(preset: PadPresetId): ToneVoiceChain {
  switch (preset) {
    case 'Warm Analog Pad':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
          envelope: { attack: 0.55, decay: 0.5, sustain: 0.78, release: 1.5 },
        },
        { frequency: 1450, type: 'lowpass' }
      );
    case 'Velvet Brass Pad':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
          envelope: { attack: 0.45, decay: 0.6, sustain: 0.72, release: 1.3 },
        },
        { frequency: 1050, type: 'lowpass', Q: 1.8 }
      );
    case 'Golden Tape Pad':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fattriangle', count: 3, spread: 22 },
          envelope: { attack: 0.65, decay: 0.5, sustain: 0.8, release: 1.5 },
        },
        { frequency: 1150, type: 'lowpass' }
      );
    case 'Soft Sub Pad':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.5, decay: 0.4, sustain: 0.88, release: 1.4 },
        },
        { frequency: 750, type: 'lowpass' }
      );
    case 'Creamy Juno Chorus Pad':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'pwm', modulationFrequency: 0.45 },
          envelope: { attack: 0.55, decay: 0.45, sustain: 0.8, release: 1.5 },
        },
        { frequency: 1850, type: 'lowpass' }
      );
    case 'Lush String Pad':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 4, spread: 28 },
          envelope: { attack: 0.6, decay: 0.45, sustain: 0.85, release: 1.5 },
        },
        { frequency: 2200, type: 'lowpass' }
      );
    case 'Chamber Strings':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.38, decay: 0.4, sustain: 0.82, release: 1.2 },
        },
        { frequency: 1900, type: 'lowpass', Q: 1.2 }
      );
    case 'Ethereal Angel Choir':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 3, spread: 26 },
          envelope: { attack: 0.7, decay: 0.5, sustain: 0.82, release: 1.6 },
        },
        { frequency: 920, type: 'bandpass', Q: 2.2 }
      );
    case 'Cathedral Boys Choir':
      return makeFmSynthChain(
        {
          harmonicity: 1,
          modulationIndex: 1.4,
          oscillator: { type: 'sine' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.65, decay: 0.45, sustain: 0.86, release: 1.6 },
        },
        { frequency: 1100, type: 'bandpass', Q: 1.9 },
        6
      );
    case 'Cinematic String Swell':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 5, spread: 32 },
          envelope: { attack: 0.95, decay: 0.6, sustain: 0.88, release: 1.7 },
        },
        { frequency: 2450, type: 'lowpass' }
      );
    case 'Deep Space Pad':
      return makeFmSynthChain(
        {
          harmonicity: 1.5,
          modulationIndex: 1.6,
          oscillator: { type: 'sine' },
          modulation: { type: 'triangle' },
          envelope: { attack: 0.65, decay: 0.6, sustain: 0.82, release: 1.6 },
          modulationEnvelope: { attack: 0.5, decay: 0.7, sustain: 0.4, release: 1.5 },
        },
        undefined,
        6
      );
    case 'Shimmer Halo Pad':
      return makeFmSynthChain(
        {
          harmonicity: 3.0,
          modulationIndex: 2.1,
          oscillator: { type: 'sine' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.6, decay: 0.55, sustain: 0.78, release: 1.7 },
          modulationEnvelope: { attack: 0.4, decay: 0.6, sustain: 0.35, release: 1.4 },
        },
        undefined,
        6
      );
    case 'Glassy Horizon Texture':
      return makeFmSynthChain(
        {
          harmonicity: 2.5,
          modulationIndex: 2.8,
          oscillator: { type: 'triangle' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.5, decay: 0.7, sustain: 0.72, release: 1.6 },
        },
        undefined,
        6
      );
    case 'Rhythmic Gate Pad':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsquare', count: 2, spread: 20 },
          envelope: { attack: 0.015, decay: 0.2, sustain: 0.45, release: 0.3 },
        },
        { frequency: 1650, type: 'lowpass', Q: 2.0 }
      );
    case 'Trance Sidechain Gate':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 4, spread: 30 },
          envelope: { attack: 0.08, decay: 0.25, sustain: 0.55, release: 0.38 },
        },
        { frequency: 2300, type: 'lowpass', Q: 1.8 }
      );
    case 'Soft Organ Pad':
      return makeSimpleSynthChain({
        oscillator: { type: 'amsine', harmonicity: 2 },
        envelope: { attack: 0.35, decay: 0.35, sustain: 0.88, release: 1.2 },
      });
    case 'Gospel B3 Swell':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'amsawtooth', harmonicity: 2 },
          envelope: { attack: 0.25, decay: 0.3, sustain: 0.86, release: 0.9 },
        },
        { frequency: 1850, type: 'lowpass', Q: 1.3 }
      );
    case 'Harmonium Drone':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 2, spread: 10 },
          envelope: { attack: 0.45, decay: 0.4, sustain: 0.9, release: 1.2 },
        },
        { frequency: 1200, type: 'bandpass', Q: 1.4 }
      );
    default:
      return makeSimpleSynthChain({
        oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
        envelope: { attack: 0.55, decay: 0.5, sustain: 0.78, release: 1.5 },
      });
  }
}

function createArpChainForPreset(preset: ArpPresetId): ToneVoiceChain {
  switch (preset) {
    case 'Synth Pluck Arp':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.006, decay: 0.26, sustain: 0.22, release: 0.32 },
        },
        undefined,
        7
      );
    case 'Acoustic Harp Arp':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fattriangle', count: 2, spread: 10 },
          envelope: { attack: 0.005, decay: 0.42, sustain: 0.14, release: 0.45 },
        },
        { frequency: 2800, type: 'lowpass' },
        5
      );
    case 'Electric Guitar Clean':
      return makeFmSynthChain(
        {
          harmonicity: 1,
          modulationIndex: 2.2,
          oscillator: { type: 'triangle' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.004, decay: 0.36, sustain: 0.2, release: 0.34 },
        },
        { frequency: 2900, type: 'lowpass' },
        13
      );
    case 'Muted Strat Pluck':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'pulse', width: 0.3 },
          envelope: { attack: 0.003, decay: 0.16, sustain: 0.1, release: 0.18 },
        },
        { frequency: 1950, type: 'lowpass', Q: 2.0 },
        7
      );
    case 'Pizzicato String Arp':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
          envelope: { attack: 0.005, decay: 0.18, sustain: 0.08, release: 0.2 },
        },
        { frequency: 2100, type: 'lowpass', Q: 1.5 },
        5
      );
    case 'Warm Kalimbaphone':
      return makeFmSynthChain(
        {
          harmonicity: 1,
          modulationIndex: 1.8,
          oscillator: { type: 'sine' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.003, decay: 0.34, sustain: 0.08, release: 0.28 },
        },
        undefined,
        14
      );
    case 'Soft Marimba':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.004, decay: 0.32, sustain: 0.1, release: 0.25 },
        },
        undefined,
        8
      );
    case 'Vibraphone Bell':
      return makeFmSynthChain(
        {
          harmonicity: 3.5,
          modulationIndex: 2.5,
          oscillator: { type: 'sine' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.005, decay: 0.52, sustain: 0.16, release: 0.55 },
        },
        undefined,
        14
      );
    case 'Music Box Chime':
      return makeFmSynthChain(
        {
          harmonicity: 5.5,
          modulationIndex: 3.2,
          oscillator: { type: 'sine' },
          modulation: { type: 'triangle' },
          envelope: { attack: 0.002, decay: 0.45, sustain: 0.12, release: 0.45 },
        },
        undefined,
        14
      );
    case 'FM Tubular Bell':
      return makeFmSynthChain(
        {
          harmonicity: 4.0,
          modulationIndex: 5.0,
          oscillator: { type: 'sine' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.004, decay: 0.65, sustain: 0.18, release: 0.6 },
        },
        undefined,
        14
      );
    case 'Glass Marimba':
      return makeFmSynthChain(
        {
          harmonicity: 2.5,
          modulationIndex: 2.9,
          oscillator: { type: 'sine' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.003, decay: 0.38, sustain: 0.1, release: 0.36 },
        },
        undefined,
        14
      );
    case '8-Bit Retro':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'square' },
          envelope: { attack: 0.004, decay: 0.16, sustain: 0.22, release: 0.14 },
        },
        undefined,
        4
      );
    case 'Acid 303 Saw Arp':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.004, decay: 0.2, sustain: 0.18, release: 0.16 },
        },
        { frequency: 2100, type: 'lowpass', Q: 4.5 },
        6
      );
    case 'Trance Supersaw Arp':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsawtooth', count: 4, spread: 26 },
          envelope: { attack: 0.006, decay: 0.24, sustain: 0.24, release: 0.28 },
        },
        { frequency: 3400, type: 'lowpass' },
        3
      );
    case 'FM Percussive Zap':
      return makeFmSynthChain(
        {
          harmonicity: 1.5,
          modulationIndex: 7.5,
          oscillator: { type: 'sine' },
          modulation: { type: 'square' },
          envelope: { attack: 0.002, decay: 0.15, sustain: 0.08, release: 0.15 },
          modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0.02, release: 0.08 },
        },
        undefined,
        14
      );
    case 'Rhythmic Gate Pulse':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'fatsquare', count: 2, spread: 16 },
          envelope: { attack: 0.004, decay: 0.14, sustain: 0.16, release: 0.14 },
        },
        { frequency: 2200, type: 'lowpass', Q: 2.0 },
        5
      );
    case 'Driving Bass Arp':
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.005, decay: 0.22, sustain: 0.3, release: 0.18 },
        },
        { frequency: 820, type: 'lowpass', Q: 2.2 },
        7
      );
    case 'Ambient Dew Texture':
      return makeFmSynthChain(
        {
          harmonicity: 2.0,
          modulationIndex: 1.3,
          oscillator: { type: 'sine' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.012, decay: 0.45, sustain: 0.2, release: 0.65 },
        },
        undefined,
        14
      );
    default:
      return makeSimpleSynthChain(
        {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.006, decay: 0.26, sustain: 0.22, release: 0.32 },
        },
        undefined,
        7
      );
  }
}

function scheduleSectionPadPattern(
  padPoly: AnyPolySynth,
  params: {
    chordStr: string;
    semitones: number;
    time: number;
    durationSec: number;
    beatDurationSec: number;
    pattern: SectionPadPattern;
  }
): void {
  const { padNotes, droneNotes, swellUpperNotes } = buildChordNotes(
    params.chordStr,
    params.semitones
  );
  if (!padNotes.length) return;

  const gateDur = Math.max(0.08, params.durationSec * 0.96);

  switch (params.pattern) {
    case 'Pulse': {
      const beatSec = Math.max(0.12, params.beatDurationSec);
      const count = Math.max(1, Math.min(12, Math.round(params.durationSec / beatSec)));
      for (let i = 0; i < count; i++) {
        const hitTime = params.time + i * beatSec;
        const hitDur = Math.max(0.08, beatSec * 0.72);
        const vel = i === 0 ? 0.74 : 0.52;
        padPoly.triggerAttackRelease(padNotes, hitDur, hitTime, vel);
      }
      break;
    }
    case 'Rhythmic Gate': {
      const eighthSec = Math.max(0.09, params.beatDurationSec / 2);
      const count = Math.max(1, Math.min(24, Math.round(params.durationSec / eighthSec)));
      for (let i = 0; i < count; i++) {
        if (i % 4 === 3) continue; // syncopated breather
        const hitTime = params.time + i * eighthSec;
        const hitDur = Math.max(0.06, eighthSec * 0.62);
        const vel = i % 2 === 0 ? 0.72 : 0.48;
        padPoly.triggerAttackRelease(padNotes, hitDur, hitTime, vel);
      }
      break;
    }
    case 'Swell': {
      padPoly.triggerAttackRelease(padNotes, gateDur, params.time, 0.44);
      if (swellUpperNotes.length > 0 && params.durationSec > 0.35) {
        const bloomDelay = params.durationSec * 0.38;
        const bloomDur = Math.max(0.1, params.durationSec * 0.58);
        padPoly.triggerAttackRelease(
          swellUpperNotes,
          bloomDur,
          params.time + bloomDelay,
          0.74
        );
      }
      break;
    }
    case 'Octave Drone': {
      padPoly.triggerAttackRelease(droneNotes, gateDur, params.time, 0.7);
      break;
    }
    case 'Sustain':
    default: {
      padPoly.triggerAttackRelease(padNotes, gateDur, params.time, 0.72);
      break;
    }
  }
}

function scheduleSectionSynthPattern(
  synthPoly: AnyPolySynth,
  params: {
    chordStr: string;
    semitones: number;
    time: number;
    durationSec: number;
    beatDurationSec: number;
    pattern: SectionSynthPattern;
    tone: SynthPresetId;
  }
): void {
  const { synthNotes, bassNotes } = buildChordNotes(params.chordStr, params.semitones);
  const isBassPreset = BASS_SYNTH_PRESETS.has(params.tone);
  const activeNotes = isBassPreset ? bassNotes : synthNotes;
  if (!activeNotes.length) return;

  const gateDur = Math.max(0.08, params.durationSec * 0.96);

  switch (params.pattern) {
    case 'Stabs': {
      const beatSec = Math.max(0.12, params.beatDurationSec);
      const totalBeats = Math.max(1, Math.min(12, Math.round(params.durationSec / beatSec)));
      for (let i = 0; i < totalBeats; i++) {
        if (i === 0 || i === 2 || (totalBeats >= 6 && i === 3)) {
          const hitTime = params.time + i * beatSec;
          const hitDur = Math.max(0.08, Math.min(0.32, beatSec * 0.52));
          synthPoly.triggerAttackRelease(activeNotes, hitDur, hitTime, i === 0 ? 0.85 : 0.7);
        }
      }
      break;
    }
    case 'Off-Beat Comp': {
      const beatSec = Math.max(0.12, params.beatDurationSec);
      const totalBeats = Math.max(1, Math.min(12, Math.round(params.durationSec / beatSec)));
      for (let i = 0; i < totalBeats; i++) {
        const offTime = params.time + (i + 0.5) * beatSec;
        if (offTime + 0.04 < params.time + params.durationSec) {
          const hitDur = Math.max(0.07, beatSec * 0.36);
          synthPoly.triggerAttackRelease(activeNotes, hitDur, offTime, 0.74);
        }
      }
      break;
    }
    case 'Bass Root Focus': {
      const anchorNotes = bassNotes.length ? bassNotes : activeNotes;
      synthPoly.triggerAttackRelease(anchorNotes, gateDur, params.time, 0.86);
      break;
    }
    case 'Full Chord':
    default: {
      synthPoly.triggerAttackRelease(activeNotes, gateDur, params.time, 0.84);
      break;
    }
  }
}

function getArpStepSeconds(
  beatDurationSec: number,
  subdivision?: '4n' | '8n' | '8t' | '16n'
): number {
  const safeBeat = Math.max(0.12, beatDurationSec);
  switch (subdivision) {
    case '4n':
      return safeBeat;
    case '8t':
      return safeBeat / 3;
    case '16n':
      return safeBeat / 4;
    case '8n':
    default:
      return safeBeat / 2;
  }
}

function buildArpStepSequence(pool: string[], pattern: ArpPatternType): string[] {
  if (!pool.length) return [];
  switch (pattern) {
    case 'down':
      return [...pool].reverse();
    case 'upDown':
      return pool.length > 2
        ? [...pool, ...[...pool].reverse().slice(1, -1)]
        : [...pool, ...[...pool].reverse().slice(1)];
    case 'alternateUp': {
      const seq: string[] = [];
      for (let i = 0; i < pool.length; i++) {
        seq.push(pool[0]);
        if (i > 0) seq.push(pool[i]);
      }
      return seq.length ? seq : [...pool];
    }
    case 'random':
      return [...pool];
    case 'up':
    default:
      return [...pool];
  }
}

function scheduleSectionArpPattern(
  arpPoly: AnyPolySynth,
  params: {
    chordStr: string;
    semitones: number;
    time: number;
    durationSec: number;
    beatDurationSec: number;
    pattern: ArpPatternType;
    tone: ArpPresetId;
    subdivision?: '4n' | '8n' | '8t' | '16n';
    stepOffset?: number;
  }
): number {
  const { arpNotes, bassArpNotes } = buildChordNotes(params.chordStr, params.semitones);
  const pool = params.tone === 'Driving Bass Arp' ? bassArpNotes : arpNotes;
  if (!pool.length) return params.stepOffset ?? 0;

  const seq = buildArpStepSequence(pool, params.pattern);
  if (!seq.length) return params.stepOffset ?? 0;

  const stepSec = getArpStepSeconds(params.beatDurationSec, params.subdivision);
  const totalSteps = Math.max(1, Math.round(params.durationSec / stepSec));
  const offset = params.stepOffset ?? 0;
  const noteDur = Math.max(0.08, Math.min(stepSec * 0.88, 0.45));

  for (let i = 0; i < totalSteps; i++) {
    const hitTime = params.time + i * stepSec;
    if (hitTime >= params.time + params.durationSec - 0.015) break;

    const note =
      params.pattern === 'random'
        ? pool[Math.floor(Math.random() * pool.length)]
        : seq[(offset + i) % seq.length];

    const vel = i === 0 ? 0.88 : i % 2 === 0 ? 0.8 : 0.72;
    arpPoly.triggerAttackRelease(note, noteDur, hitTime, vel);
  }

  return offset + totalSteps;
}

// ============================================================================
// OFFLINE DRUMS & RHYTHM SYNTHESIS ENGINE (6 KITS · 13 STYLES · 5 FILL STYLES)
// 100% Web Audio / Tone.js mathematical synthesis (zero external URLs)
// ============================================================================

type DrumPiece =
  | 'kick'
  | 'snare'
  | 'rim'
  | 'clap'
  | 'hatClosed'
  | 'hatOpen'
  | 'crash'
  | 'ride'
  | 'tomHigh'
  | 'tomMid'
  | 'tomLow'
  | 'congaHigh'
  | 'congaLow'
  | 'bongoHigh'
  | 'bongoLow'
  | 'timbale'
  | 'shaker'
  | 'bayan'
  | 'dayan';

interface DrumKitProfile {
  kickNote: string;
  kickPitchDecay: number;
  kickOctaves: number;
  kickDecay: number;
  snareToneNote: string;
  snareWireLevel: number;
  snareDuration: number;
  snareFilterHz: number;
  hatBrightnessHz: number;
  hatClosedDur: number;
  hatOpenDur: number;
  brushMode?: boolean;
  electronic808?: boolean;
  percMode?: boolean;
}

function getDrumKitProfile(kit: DrumKitId): DrumKitProfile {
  switch (kit) {
    case 'Modern Studio Kit':
      return {
        kickNote: 'B0',
        kickPitchDecay: 0.045,
        kickOctaves: 6.5,
        kickDecay: 0.34,
        snareToneNote: 'E3',
        snareWireLevel: 0.9,
        snareDuration: 0.19,
        snareFilterHz: 2400,
        hatBrightnessHz: 6800,
        hatClosedDur: 0.055,
        hatOpenDur: 0.34,
      };
    case '808 Electronic Kit':
      return {
        kickNote: 'G0',
        kickPitchDecay: 0.075,
        kickOctaves: 5.5,
        kickDecay: 0.56,
        snareToneNote: 'G3',
        snareWireLevel: 0.85,
        snareDuration: 0.16,
        snareFilterHz: 2100,
        hatBrightnessHz: 7500,
        hatClosedDur: 0.048,
        hatOpenDur: 0.38,
        electronic808: true,
      };
    case 'Vintage Analog Drum Machine':
      return {
        kickNote: 'D1',
        kickPitchDecay: 0.035,
        kickOctaves: 4.5,
        kickDecay: 0.24,
        snareToneNote: 'F#3',
        snareWireLevel: 0.82,
        snareDuration: 0.14,
        snareFilterHz: 1900,
        hatBrightnessHz: 6200,
        hatClosedDur: 0.042,
        hatOpenDur: 0.26,
        electronic808: true,
      };
    case 'Baila / Sri Lankan Percussion Kit':
      return {
        kickNote: 'F1',
        kickPitchDecay: 0.05,
        kickOctaves: 3.4,
        kickDecay: 0.3,
        snareToneNote: 'A3',
        snareWireLevel: 0.45,
        snareDuration: 0.11,
        snareFilterHz: 2600,
        hatBrightnessHz: 5400,
        hatClosedDur: 0.055,
        hatOpenDur: 0.2,
        percMode: true,
      };
    case 'Soft Brush / Ballad Kit':
      return {
        kickNote: 'C1',
        kickPitchDecay: 0.055,
        kickOctaves: 3.8,
        kickDecay: 0.26,
        snareToneNote: 'D3',
        snareWireLevel: 0.65,
        snareDuration: 0.22,
        snareFilterHz: 3200,
        hatBrightnessHz: 5000,
        hatClosedDur: 0.08,
        hatOpenDur: 0.36,
        brushMode: true,
      };
    case 'Acoustic Pop Kit':
    default:
      return {
        kickNote: 'C1',
        kickPitchDecay: 0.04,
        kickOctaves: 5.5,
        kickDecay: 0.3,
        snareToneNote: 'D3',
        snareWireLevel: 0.85,
        snareDuration: 0.18,
        snareFilterHz: 2200,
        hatBrightnessHz: 6200,
        hatClosedDur: 0.058,
        hatOpenDur: 0.3,
      };
  }
}

interface ProceduralNoiseBuffers {
  snare: AudioBuffer;
  rim: AudioBuffer;
  clap: AudioBuffer;
  hatClosed: AudioBuffer;
  hatOpen: AudioBuffer;
  crash: AudioBuffer;
  ride: AudioBuffer;
  shaker: AudioBuffer;
}

function buildDrumNoiseBuffers(profile: DrumKitProfile): ProceduralNoiseBuffers {
  const rawCtx = Tone.getContext().rawContext;
  const sr = rawCtx.sampleRate || 44100;

  const makeNoise = (
    sec: number,
    fn: (t: number, i: number, total: number) => number
  ): AudioBuffer => {
    const len = Math.max(128, Math.floor(sr * sec));
    const buf = rawCtx.createBuffer(1, len, sr);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = fn(i / sr, i, len);
    }
    return buf;
  };

  // Seeded pseudo-random noise so exports & previews sound crisp and deterministic
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };

  const snare = makeNoise(profile.snareDuration, (t) => {
    if (profile.brushMode) {
      const env = Math.sin(Math.min(1, t / 0.025) * (Math.PI / 2)) * Math.exp(-t * 14);
      return rand() * env * 0.65;
    }
    const env = Math.exp(-t / (profile.snareDuration * 0.32));
    const snap = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 36) * 0.25;
    return (rand() * 0.85 + snap) * env;
  });

  const rim = makeNoise(0.05, (t) => {
    const click =
      Math.sin(2 * Math.PI * 840 * t) * 0.5 +
      Math.sin(2 * Math.PI * 1580 * t) * 0.35 +
      rand() * 0.3;
    return click * Math.exp(-t * 95);
  });

  const clap = makeNoise(0.22, (t) => {
    const burst =
      t < 0.036
        ? Math.abs(Math.sin((t / 0.011) * Math.PI)) * 0.9
        : Math.exp(-(t - 0.032) * 24) * 0.78;
    return rand() * burst;
  });

  const metallic = (t: number) =>
    Math.sign(Math.sin(2 * Math.PI * 318 * t)) * 0.16 +
    Math.sign(Math.sin(2 * Math.PI * 462 * t)) * 0.16 +
    Math.sign(Math.sin(2 * Math.PI * 698 * t)) * 0.14 +
    rand() * 0.55;

  const hatClosed = makeNoise(profile.hatClosedDur, (t) => {
    const env = Math.exp(-t / (profile.hatClosedDur * 0.28));
    return (profile.brushMode ? rand() * 0.72 : metallic(t)) * env;
  });

  const hatOpen = makeNoise(profile.hatOpenDur, (t) => {
    const env = Math.exp(-t / (profile.hatOpenDur * 0.34));
    return (profile.brushMode ? rand() * 0.7 : metallic(t)) * env;
  });

  const crash = makeNoise(1.2, (t) => {
    const attack = Math.min(1, t / 0.004);
    const env = attack * Math.exp(-t / 0.42);
    return (metallic(t) * 0.55 + rand() * 0.55) * env;
  });

  const ride = makeNoise(0.55, (t) => {
    const bell = Math.sin(2 * Math.PI * 2820 * t) * Math.exp(-t * 16) * 0.36;
    const wash = metallic(t) * Math.exp(-t / 0.22) * 0.55;
    return bell + wash;
  });

  const shaker = makeNoise(0.068, (t) => {
    const env = Math.sin(Math.min(1, t / 0.015) * (Math.PI / 2)) * Math.exp(-t * 48);
    return rand() * env;
  });

  return { snare, rim, clap, hatClosed, hatOpen, crash, ride, shaker };
}

interface ToneDrumChain {
  kit: DrumKitId;
  output: Tone.Gain;
  trigger: (piece: DrumPiece, time: number, velocity?: number) => void;
  dispose: () => void;
}

function createDrumChainForKit(kit: DrumKitId): ToneDrumChain {
  const profile = getDrumKitProfile(kit);
  const buffers = buildDrumNoiseBuffers(profile);
  const output = new Tone.Gain(1.0);

  const kickPoly = new Tone.PolySynth(Tone.MembraneSynth, {
    pitchDecay: profile.kickPitchDecay,
    octaves: profile.kickOctaves,
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.002,
      decay: profile.kickDecay,
      sustain: 0.01,
      release: 0.14,
      attackCurve: 'exponential',
    },
  });
  kickPoly.maxPolyphony = 8;

  const percPoly = new Tone.PolySynth(Tone.MembraneSynth, {
    pitchDecay: profile.percMode ? 0.032 : 0.025,
    octaves: profile.percMode ? 2.6 : 3.2,
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.002,
      decay: 0.22,
      sustain: 0.01,
      release: 0.1,
    },
  });
  percPoly.maxPolyphony = 16;

  const kickGain = new Tone.Gain(Tone.dbToGain(2.5));
  const percGain = new Tone.Gain(Tone.dbToGain(-1.0));
  const snareFilter = new Tone.Filter(profile.snareFilterHz, 'bandpass', -12);
  snareFilter.Q.value = 0.85;
  const snareGain = new Tone.Gain(profile.snareWireLevel);

  const hatFilter = new Tone.Filter(profile.hatBrightnessHz, 'highpass');
  const hatGain = new Tone.Gain(Tone.dbToGain(-5.5));

  const shakerFilter = new Tone.Filter(4800, 'bandpass');
  shakerFilter.Q.value = 1.4;
  const shakerGain = new Tone.Gain(Tone.dbToGain(-7.5));

  kickPoly.chain(kickGain, output);
  percPoly.chain(percGain, output);
  snareFilter.chain(snareGain, output);
  hatFilter.chain(hatGain, output);
  shakerFilter.chain(shakerGain, output);

  const activeSources = new Set<Tone.ToneBufferSource>();

  const playNoise = (buf: AudioBuffer, dest: Tone.ToneAudioNode, time: number, vel: number) => {
    try {
      const src = new Tone.ToneBufferSource(buf);
      const g = new Tone.Gain(Math.max(0.05, Math.min(1.4, vel)));
      src.chain(g, dest);
      activeSources.add(src);
      src.onended = () => {
        activeSources.delete(src);
        try {
          src.dispose();
          g.dispose();
        } catch {
          // Ignore disposal errors
        }
      };
      src.start(time);
    } catch {
      // Ignore scheduling errors outside context lifecycle
    }
  };

  const trigger = (piece: DrumPiece, time: number, velocity = 0.85) => {
    const vel = Math.max(0.1, Math.min(1.0, velocity));
    switch (piece) {
      case 'kick':
        kickPoly.triggerAttackRelease(profile.kickNote, '16n', time, Math.min(1, vel * 1.05));
        break;
      case 'snare':
        percPoly.triggerAttackRelease(profile.snareToneNote, '32n', time, vel * 0.72);
        playNoise(buffers.snare, snareFilter, time, vel * 0.95);
        break;
      case 'rim':
        percPoly.triggerAttackRelease('C4', '64n', time, vel * 0.65);
        playNoise(buffers.rim, snareFilter, time, vel * 0.78);
        break;
      case 'clap':
        playNoise(buffers.clap, snareFilter, time, vel * 0.98);
        break;
      case 'hatClosed':
        playNoise(buffers.hatClosed, hatFilter, time, vel * 0.75);
        break;
      case 'hatOpen':
        playNoise(buffers.hatOpen, hatFilter, time, vel * 0.8);
        break;
      case 'crash':
        playNoise(buffers.crash, hatFilter, time, vel * 0.85);
        break;
      case 'ride':
        playNoise(buffers.ride, hatFilter, time, vel * 0.72);
        break;
      case 'tomHigh':
        percPoly.triggerAttackRelease('D3', '16n', time, vel * 0.9);
        break;
      case 'tomMid':
        percPoly.triggerAttackRelease('A2', '16n', time, vel * 0.92);
        break;
      case 'tomLow':
        percPoly.triggerAttackRelease('F2', '16n', time, vel * 0.96);
        break;
      case 'congaHigh':
        percPoly.triggerAttackRelease('D3', '16n', time, vel * 0.9);
        playNoise(buffers.rim, snareFilter, time, vel * 0.35);
        break;
      case 'congaLow':
        percPoly.triggerAttackRelease('G2', '16n', time, vel * 0.94);
        break;
      case 'bongoHigh':
        percPoly.triggerAttackRelease('A3', '32n', time, vel * 0.88);
        playNoise(buffers.rim, snareFilter, time, vel * 0.38);
        break;
      case 'bongoLow':
        percPoly.triggerAttackRelease('E3', '32n', time, vel * 0.9);
        break;
      case 'timbale':
        percPoly.triggerAttackRelease('E4', '32n', time, vel * 0.9);
        playNoise(buffers.rim, hatFilter, time, vel * 0.48);
        break;
      case 'shaker':
        playNoise(buffers.shaker, shakerFilter, time, vel * 0.82);
        break;
      case 'bayan':
        kickPoly.triggerAttackRelease('E1', '16n', time, vel * 0.95);
        break;
      case 'dayan':
        percPoly.triggerAttackRelease('D4', '32n', time, vel * 0.92);
        playNoise(buffers.rim, snareFilter, time, vel * 0.28);
        break;
    }
  };

  return {
    kit,
    output,
    trigger,
    dispose: () => {
      for (const s of activeSources) {
        try {
          s.stop();
          s.dispose();
        } catch {
          // Ignore
        }
      }
      activeSources.clear();
      try {
        kickPoly.releaseAll();
        kickPoly.dispose();
        percPoly.releaseAll();
        percPoly.dispose();
        kickGain.dispose();
        percGain.dispose();
        snareFilter.dispose();
        snareGain.dispose();
        hatFilter.dispose();
        hatGain.dispose();
        shakerFilter.dispose();
        shakerGain.dispose();
        output.dispose();
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

interface DrumHitEvent {
  step: number;
  piece: DrumPiece;
  vel: number;
}

function getDrumPatternStepCount(pattern: DrumPatternId, meter: BarMeter, beatsInBar: number): number {
  if (
    pattern === '6/8 Baila Groove' ||
    pattern === '6/8 Dadra / Folk' ||
    meter === '6/8' ||
    meter === '3/4'
  ) {
    return 12;
  }
  if (beatsInBar === 2) return 8;
  if (beatsInBar === 3) return 12;
  if (beatsInBar === 5) return 20;
  if (beatsInBar === 7) return 14;
  return 16;
}

function buildFillEvents(
  fillStyle: DrumFillStyle,
  kit: DrumKitId,
  steps: number,
  meter: BarMeter
): DrumHitEvent[] {
  const isPercKit = kit === 'Baila / Sri Lankan Percussion Kit';
  const events: DrumHitEvent[] = [];

  if (fillStyle === 'Stop-Time Silence Break') {
    // Strong ensemble beat 1 stab then dramatic total drum silence
    events.push({ step: 0, piece: 'crash', vel: 0.95 });
    events.push({ step: 0, piece: 'kick', vel: 1.0 });
    events.push({ step: 0, piece: isPercKit ? 'congaHigh' : 'snare', vel: 0.9 });
    if (kit === '808 Electronic Kit') {
      events.push({ step: 0, piece: 'clap', vel: 0.85 });
    }
    return events;
  }

  if (fillStyle === 'Crash & Kick Accent') {
    const accentSteps =
      steps === 12 ? [0, 6, 10] : steps === 8 ? [0, 4, 6] : [0, 6, 12];
    for (const s of accentSteps) {
      events.push({ step: s, piece: 'kick', vel: 0.98 });
      events.push({ step: s, piece: 'crash', vel: s === 0 ? 0.92 : 0.78 });
      if (s > 0) events.push({ step: s, piece: isPercKit ? 'congaHigh' : 'snare', vel: 0.84 });
    }
    return events;
  }

  if (fillStyle === 'Baila Percussion Roll') {
    const mid = Math.floor(steps / 2);
    events.push({ step: 0, piece: 'kick', vel: 0.95 });
    events.push({ step: 0, piece: 'congaLow', vel: 0.82 });
    events.push({ step: 2, piece: 'shaker', vel: 0.72 });
    events.push({ step: 4, piece: 'bongoHigh', vel: 0.8 });
    const rollSeq: DrumPiece[] = ['congaHigh', 'bongoHigh', 'bongoLow', 'timbale', 'congaLow', 'snare'];
    for (let s = mid; s < steps; s++) {
      const progress = (s - mid) / Math.max(1, steps - mid);
      events.push({
        step: s,
        piece: rollSeq[(s - mid) % rollSeq.length],
        vel: 0.68 + progress * 0.3,
      });
      if (s === steps - 2) {
        events.push({ step: s, piece: 'kick', vel: 0.86 });
      }
    }
    return events;
  }

  if (fillStyle === 'Tom Fill Cascade') {
    const startFill = steps === 12 ? 4 : Math.floor(steps / 2);
    events.push({ step: 0, piece: 'kick', vel: 0.95 });
    events.push({ step: 0, piece: 'hatClosed', vel: 0.7 });
    if (startFill > 4) {
      events.push({ step: 4, piece: isPercKit ? 'congaHigh' : 'snare', vel: 0.85 });
      events.push({ step: 4, piece: 'hatClosed', vel: 0.72 });
    }
    const toms: DrumPiece[] = ['tomHigh', 'tomHigh', 'tomMid', 'tomMid', 'tomLow', 'tomLow', 'snare', 'tomLow'];
    for (let s = startFill; s < steps; s++) {
      const idx = Math.min(toms.length - 1, Math.floor(((s - startFill) / (steps - startFill)) * toms.length));
      events.push({ step: s, piece: toms[idx], vel: 0.76 + (s - startFill) * 0.03 });
    }
    return events;
  }

  // 'Snare Roll Build-up' default
  const isTernary = steps === 12 || meter === '6/8';
  const startRoll = isTernary ? 6 : 8;
  events.push({ step: 0, piece: 'kick', vel: 0.94 });
  events.push({ step: 0, piece: 'hatClosed', vel: 0.7 });
  if (startRoll > 4) {
    events.push({ step: 4, piece: isPercKit ? 'congaHigh' : 'snare', vel: 0.78 });
    events.push({ step: 4, piece: 'kick', vel: 0.82 });
  }
  for (let s = startRoll; s < steps; s++) {
    const pct = (s - startRoll) / Math.max(1, steps - startRoll);
    events.push({
      step: s,
      piece: isPercKit ? (s % 2 === 0 ? 'timbale' : 'congaHigh') : 'snare',
      vel: 0.5 + pct * 0.48,
    });
    if (s % 2 === 0) {
      events.push({ step: s, piece: 'kick', vel: 0.65 + pct * 0.25 });
    }
  }
  return events;
}

function buildGrooveEvents(
  pattern: DrumPatternId,
  kit: DrumKitId,
  steps: number,
  meter: BarMeter
): DrumHitEvent[] {
  const isPercKit = kit === 'Baila / Sri Lankan Percussion Kit';
  const is808 = kit === '808 Electronic Kit';
  const events: DrumHitEvent[] = [];

  const add = (step: number, piece: DrumPiece, vel = 0.8) => {
    if (step >= 0 && step < steps) events.push({ step, piece, vel });
  };

  switch (pattern) {
    case '6/8 Baila Groove': {
      // 12-step 6/8 Baila grid: main beats at 0, 2, 4, 6, 8, 10
      add(0, isPercKit ? 'bayan' : 'kick', 0.98);
      add(0, 'congaLow', 0.85);
      add(3, 'kick', 0.74);
      add(4, isPercKit ? 'congaHigh' : 'snare', 0.82);
      add(6, isPercKit ? 'bayan' : 'kick', 0.9);
      add(8, 'bongoHigh', 0.82);
      add(10, isPercKit ? 'timbale' : 'snare', 0.86);
      add(11, 'bongoLow', 0.74);
      for (let s = 0; s < 12; s++) {
        if (s % 2 === 0 || s === 5 || s === 11) {
          add(s, isPercKit ? 'shaker' : 'hatClosed', s % 6 === 0 ? 0.82 : 0.56);
        }
      }
      break;
    }

    case '6/8 Dadra / Folk': {
      // South Asian 6-beat Dadra: Dha Dhin Na / Dha Tin Na
      add(0, 'bayan', 0.95);
      add(0, 'dayan', 0.88);
      add(2, 'congaHigh', 0.76);
      add(4, 'dayan', 0.74);
      add(6, 'congaLow', 0.86);
      add(6, 'kick', 0.72);
      add(8, 'dayan', 0.82);
      add(10, 'bongoHigh', 0.78);
      for (let s = 0; s < 12; s += 2) {
        add(s, 'shaker', s === 0 || s === 6 ? 0.75 : 0.48);
      }
      break;
    }

    case '4/4 Sinhala Pop / Calypso': {
      if (steps === 12) {
        add(0, 'kick', 0.95);
        add(3, 'congaLow', 0.78);
        add(4, 'snare', 0.82);
        add(6, 'kick', 0.86);
        add(8, 'congaHigh', 0.84);
        add(10, 'bongoHigh', 0.76);
      } else {
        add(0, 'kick', 0.96);
        add(3, 'congaLow', 0.8);
        add(4, isPercKit ? 'timbale' : 'snare', 0.84);
        add(6, 'kick', 0.85);
        add(8, 'kick', 0.9);
        add(10, 'congaHigh', 0.85);
        add(12, isPercKit ? 'timbale' : 'snare', 0.88);
        add(14, 'bongoHigh', 0.78);
      }
      for (let s = 0; s < steps; s += 2) {
        add(s, 'shaker', s % 4 === 0 ? 0.78 : 0.54);
      }
      break;
    }

    case 'Tabla-Groove Fusion': {
      if (steps === 12) {
        add(0, 'bayan', 0.96);
        add(0, 'dayan', 0.86);
        add(2, 'dayan', 0.7);
        add(4, 'bongoLow', 0.74);
        add(6, 'bayan', 0.88);
        add(8, 'dayan', 0.85);
        add(10, 'congaHigh', 0.74);
      } else {
        // Teen-taal / pop fusion across 16 steps
        add(0, 'bayan', 0.98);
        add(0, 'dayan', 0.88);
        add(3, 'dayan', 0.72);
        add(4, 'congaLow', 0.78);
        add(6, 'bayan', 0.82);
        add(8, 'dayan', 0.85);
        add(10, 'bayan', 0.86);
        add(12, 'dayan', 0.9);
        add(14, 'congaHigh', 0.76);
      }
      for (let s = 0; s < steps; s += 2) {
        add(s, 'shaker', s % 4 === 0 ? 0.72 : 0.5);
      }
      break;
    }

    case 'Driving 16th Rock': {
      if (steps === 12) {
        add(0, 'kick', 0.98);
        add(4, 'kick', 0.74);
        add(6, 'snare', 0.92);
        add(8, 'kick', 0.86);
        add(10, 'snare', 0.65);
      } else {
        add(0, 'kick', 0.98);
        add(3, 'kick', 0.78);
        add(4, 'snare', 0.94);
        add(8, 'kick', 0.94);
        add(10, 'kick', 0.82);
        add(12, 'snare', 0.95);
        add(15, 'snare', 0.5);
      }
      for (let s = 0; s < steps; s++) {
        add(s, isPercKit ? 'shaker' : 'hatClosed', s % 4 === 0 ? 0.78 : s % 2 === 0 ? 0.58 : 0.42);
      }
      break;
    }

    case 'Half-Time Ballad': {
      if (steps === 12) {
        add(0, 'kick', 0.92);
        add(6, 'snare', 0.9);
        add(10, 'kick', 0.65);
      } else {
        add(0, 'kick', 0.95);
        add(6, 'kick', 0.68);
        add(8, 'snare', 0.94);
        add(14, 'kick', 0.62);
      }
      for (let s = 0; s < steps; s += 2) {
        add(s, kit === 'Soft Brush / Ballad Kit' ? 'ride' : 'hatClosed', s % 4 === 0 ? 0.68 : 0.48);
      }
      break;
    }

    case 'Upbeat Disco / Funk': {
      const beatSteps = steps === 12 ? [0, 4, 8] : [0, 4, 8, 12];
      for (const b of beatSteps) {
        add(b, 'kick', 0.95);
        add(b + 2, 'hatOpen', 0.74);
        add(b, 'hatClosed', 0.62);
      }
      if (steps === 12) {
        add(4, 'snare', 0.88);
        add(8, 'snare', 0.88);
      } else {
        add(4, 'snare', 0.9);
        add(12, 'snare', 0.92);
      }
      break;
    }

    case 'Four-on-the-Floor Dance': {
      const beatSteps = steps === 12 ? [0, 4, 8] : [0, 4, 8, 12];
      for (const b of beatSteps) {
        add(b, 'kick', 1.0);
        add(b + 2, 'hatOpen', 0.72);
      }
      if (steps === 12) {
        add(6, is808 ? 'clap' : 'snare', 0.9);
      } else {
        add(4, is808 ? 'clap' : 'snare', 0.9);
        add(12, is808 ? 'clap' : 'snare', 0.92);
      }
      break;
    }

    case 'Reggaeton / Dembow': {
      if (steps === 12) {
        add(0, 'kick', 0.98);
        add(3, 'snare', 0.86);
        add(6, 'kick', 0.94);
        add(9, 'snare', 0.88);
      } else {
        add(0, 'kick', 0.98);
        add(3, is808 ? 'clap' : 'snare', 0.88);
        add(4, 'kick', 0.92);
        add(6, 'snare', 0.84);
        add(8, 'kick', 0.98);
        add(11, is808 ? 'clap' : 'snare', 0.9);
        add(12, 'kick', 0.92);
        add(14, 'snare', 0.82);
      }
      for (let s = 0; s < steps; s += 2) {
        add(s, 'hatClosed', s % 4 === 0 ? 0.65 : 0.45);
      }
      break;
    }

    case 'Lo-Fi Chill Beat': {
      if (steps === 12) {
        add(0, 'kick', 0.9);
        add(5, 'kick', 0.65);
        add(6, 'snare', 0.82);
      } else {
        add(0, 'kick', 0.92);
        add(4, 'snare', 0.82);
        add(7, 'kick', 0.68);
        add(10, 'kick', 0.78);
        add(12, 'snare', 0.84);
      }
      for (let s = 0; s < steps; s += 2) {
        add(s, 'hatClosed', s % 4 === 0 ? 0.56 : 0.36);
      }
      break;
    }

    case 'Verse Groove': {
      if (steps === 12) {
        add(0, 'kick', 0.88);
        add(4, 'rim', 0.78);
        add(6, 'kick', 0.72);
        add(8, 'rim', 0.76);
      } else {
        add(0, 'kick', 0.88);
        add(4, 'rim', 0.82);
        add(8, 'kick', 0.82);
        add(10, 'kick', 0.66);
        add(12, 'rim', 0.84);
      }
      for (let s = 0; s < steps; s += 2) {
        add(s, 'hatClosed', s % 4 === 0 ? 0.64 : 0.44);
      }
      break;
    }

    case 'Chorus Groove': {
      if (steps === 12) {
        add(0, 'kick', 0.98);
        add(0, 'ride', 0.76);
        add(4, 'snare', 0.92);
        add(6, 'kick', 0.88);
        add(8, 'snare', 0.9);
      } else {
        add(0, 'kick', 0.98);
        add(4, 'snare', 0.95);
        add(6, 'kick', 0.78);
        add(8, 'kick', 0.92);
        add(10, 'kick', 0.76);
        add(12, 'snare', 0.96);
      }
      for (let s = 0; s < steps; s += 2) {
        add(s, s % 4 === 2 ? 'hatOpen' : 'ride', s % 4 === 0 ? 0.78 : 0.6);
      }
      break;
    }

    case 'Straight 8th Pop':
    default: {
      if (meter === '6/8' && steps === 12) {
        add(0, 'kick', 0.95);
        add(6, 'snare', 0.88);
        add(8, 'kick', 0.72);
      } else if (steps === 12) {
        // 3/4 Pop / Waltz pocket
        add(0, 'kick', 0.94);
        add(4, 'snare', 0.82);
        add(8, 'snare', 0.78);
      } else {
        add(0, 'kick', 0.96);
        add(4, isPercKit ? 'congaHigh' : 'snare', 0.9);
        add(8, 'kick', 0.9);
        add(10, 'kick', 0.74);
        add(12, isPercKit ? 'congaHigh' : 'snare', 0.92);
      }
      for (let s = 0; s < steps; s += 2) {
        add(s, isPercKit ? 'shaker' : 'hatClosed', s % 4 === 0 ? 0.72 : 0.5);
      }
      break;
    }
  }

  return events;
}

function scheduleSectionDrumPattern(
  drumChain: ToneDrumChain,
  params: {
    time: number;
    barDurationSec: number;
    beatsPerBar: number;
    effectiveMeter: BarMeter;
    pattern: DrumPatternId;
    kit: DrumKitId;
    isFillBar: boolean;
    fillStyle: DrumFillStyle;
    postFillCrash: boolean;
  }
): void {
  const steps = getDrumPatternStepCount(params.pattern, params.effectiveMeter, params.beatsPerBar);
  const stepSec = Math.max(0.03, params.barDurationSec / steps);

  const hits = params.isFillBar
    ? buildFillEvents(params.fillStyle, params.kit, steps, params.effectiveMeter)
    : buildGrooveEvents(params.pattern, params.kit, steps, params.effectiveMeter);

  if (params.postFillCrash && !params.isFillBar) {
    drumChain.trigger('crash', params.time, 0.88);
  }

  for (const h of hits) {
    const t = params.time + h.step * stepSec;
    if (t >= params.time + params.barDurationSec - 0.01) continue;
    drumChain.trigger(h.piece, t, h.vel);
  }
}

export class ToneSynthBackingEngine {
  private settings: SynthBackingSettings;
  private boundRawCtx: AudioContext | null = null;
  private isBuilt = false;
  private isPlayingLive = false;

  // Per-Layer Synth Pool -> Bus Volume -> Bus Panner -> Destination
  private synthLayerChains = new Map<string, { chain: ToneVoiceChain; gain: Tone.Gain }>();
  private synthVol: Tone.Volume | null = null;
  private synthPan: Tone.Panner | null = null;
  private activeSynthSectionId: string | null = null;

  // Per-Layer Multi-Pad Pool -> Lowpass Filter -> Bus Volume -> Bus Panner -> Destination
  private padLayerChains = new Map<string, { chain: ToneVoiceChain; gain: Tone.Gain }>();
  private padFilter: Tone.Filter | null = null;
  private padVol: Tone.Volume | null = null;
  private padPan: Tone.Panner | null = null;
  private activePadSectionId: string | null = null;

  // Per-Layer Arpeggiator Pool -> Bus Volume -> Bus Panner -> Destination
  private arpLayerChains = new Map<string, { chain: ToneVoiceChain; gain: Tone.Gain }>();
  private arpVol: Tone.Volume | null = null;
  private arpPan: Tone.Panner | null = null;
  private activeArpSectionId: string | null = null;
  private arpStepCursors = new Map<string, number>();

  // Per-Layer Drums Pool -> Bus Volume -> Bus Panner -> Destination
  private drumLayerChains = new Map<string, { chain: ToneDrumChain; gain: Tone.Gain }>();
  private drumsVol: Tone.Volume | null = null;
  private drumsPan: Tone.Panner | null = null;
  private drumPrevBarWasFill = new Map<string, boolean>();

  // Native Web Audio FX / Risers Bus -> Bus Gain -> Bus Panner -> rawCtx.destination
  private fxBusGain: GainNode | null = null;
  private fxBusPan: StereoPannerNode | null = null;
  private activeFxStoppers = new Set<() => void>();

  // Most recent preceding non-empty chord for independent per-bus Fill Empty Bars resolution
  private lastNonEmptyChord: { chordStr: string; semitones: number } | null = null;

  // Preview lifecycle guard
  private activePreviewCleanup: (() => void) | null = null;
  private activePreviewTimer: number | null = null;

  constructor(initialSettings: SynthBackingSettings) {
    this.settings = initialSettings;
  }

  private ensureToneContext(rawCtx: AudioContext): void {
    if (this.boundRawCtx !== rawCtx) {
      this.teardownNodes();
      Tone.setContext(rawCtx, false);
      this.boundRawCtx = rawCtx;
    }
  }

  private getOrCreateSynthLayerChain(
    layerKey: string,
    tone: SynthPresetId,
    volumeDb = 0
  ): ToneVoiceChain {
    const cacheKey = `${layerKey}::${tone}`;
    let entry = this.synthLayerChains.get(cacheKey);
    if (!entry) {
      const chain = createSynthChainForPreset(tone);
      const gain = new Tone.Gain(Tone.dbToGain(volumeDb));
      chain.output.connect(gain);
      if (this.synthVol) gain.connect(this.synthVol);
      entry = { chain, gain };
      this.synthLayerChains.set(cacheKey, entry);
    } else {
      entry.gain.gain.rampTo(Tone.dbToGain(volumeDb), 0.02);
    }
    return entry.chain;
  }

  private getOrCreatePadLayerChain(
    layerKey: string,
    tone: PadPresetId,
    volumeDb = 0
  ): ToneVoiceChain {
    const cacheKey = `${layerKey}::${tone}`;
    let entry = this.padLayerChains.get(cacheKey);
    if (!entry) {
      const chain = createPadChainForPreset(tone);
      const gain = new Tone.Gain(Tone.dbToGain(volumeDb));
      chain.output.connect(gain);
      if (this.padFilter) gain.connect(this.padFilter);
      entry = { chain, gain };
      this.padLayerChains.set(cacheKey, entry);
    } else {
      entry.gain.gain.rampTo(Tone.dbToGain(volumeDb), 0.02);
    }
    return entry.chain;
  }

  private getOrCreateArpLayerChain(
    layerKey: string,
    tone: ArpPresetId,
    volumeDb = 0
  ): ToneVoiceChain {
    const cacheKey = `${layerKey}::${tone}`;
    let entry = this.arpLayerChains.get(cacheKey);
    if (!entry) {
      const chain = createArpChainForPreset(tone);
      const gain = new Tone.Gain(Tone.dbToGain(volumeDb));
      chain.output.connect(gain);
      if (this.arpVol) gain.connect(this.arpVol);
      entry = { chain, gain };
      this.arpLayerChains.set(cacheKey, entry);
    } else {
      entry.gain.gain.rampTo(Tone.dbToGain(volumeDb), 0.02);
    }
    return entry.chain;
  }

  private getOrCreateDrumLayerChain(
    layerKey: string,
    kit: DrumKitId,
    volumeDb = 0
  ): ToneDrumChain {
    const cacheKey = `${layerKey}::${kit}`;
    let entry = this.drumLayerChains.get(cacheKey);
    if (!entry) {
      const chain = createDrumChainForKit(kit);
      const gain = new Tone.Gain(Tone.dbToGain(volumeDb));
      chain.output.connect(gain);
      if (this.drumsVol) gain.connect(this.drumsVol);
      entry = { chain, gain };
      this.drumLayerChains.set(cacheKey, entry);
    } else {
      entry.gain.gain.rampTo(Tone.dbToGain(volumeDb), 0.02);
    }
    return entry.chain;
  }

  private releaseAllSynthVoices(time?: number): void {
    for (const entry of this.synthLayerChains.values()) {
      try {
        entry.chain.poly.releaseAll(time);
      } catch {
        // Ignore
      }
    }
  }

  private releaseAllPadVoices(time?: number): void {
    for (const entry of this.padLayerChains.values()) {
      try {
        entry.chain.poly.releaseAll(time);
      } catch {
        // Ignore
      }
    }
  }

  private releaseAllArpVoices(time?: number): void {
    for (const entry of this.arpLayerChains.values()) {
      try {
        entry.chain.poly.releaseAll(time);
      } catch {
        // Ignore
      }
    }
  }

  private stopActivePreview(): void {
    if (this.activePreviewTimer !== null) {
      window.clearTimeout(this.activePreviewTimer);
      this.activePreviewTimer = null;
    }
    if (this.activePreviewCleanup) {
      this.activePreviewCleanup();
      this.activePreviewCleanup = null;
    }
  }

  private buildNodes(): void {
    if (this.isBuilt) return;

    // 1. Synthesizer Output Bus
    this.synthVol = new Tone.Volume(this.settings.synth.volumeDb);
    this.synthVol.mute = this.settings.synth.muted;
    this.synthPan = new Tone.Panner(this.settings.synth.pan);
    this.synthVol.chain(this.synthPan, Tone.getDestination());

    // 2. Per-Section Multi-Pad Output Bus
    this.padFilter = new Tone.Filter(2600, 'lowpass');
    this.padVol = new Tone.Volume(this.settings.pad.volumeDb);
    this.padVol.mute = this.settings.pad.muted;
    this.padPan = new Tone.Panner(this.settings.pad.pan);
    this.padFilter.chain(this.padVol, this.padPan, Tone.getDestination());

    // 3. Arpeggiator Output Bus
    this.arpVol = new Tone.Volume(this.settings.arp.volumeDb);
    this.arpVol.mute = this.settings.arp.muted;
    this.arpPan = new Tone.Panner(this.settings.arp.pan);
    this.arpVol.chain(this.arpPan, Tone.getDestination());

    // 4. Drums & Rhythm Output Bus
    this.drumsVol = new Tone.Volume(this.settings.drums.volumeDb);
    this.drumsVol.mute = !this.settings.drums.enabled || this.settings.drums.muted;
    this.drumsPan = new Tone.Panner(this.settings.drums.pan);
    this.drumsVol.chain(this.drumsPan, Tone.getDestination());

    // 5. FX / Risers Web Audio Output Bus
    const rawCtx = this.boundRawCtx || (Tone.getContext().rawContext as AudioContext);
    if (rawCtx) {
      const fxBus = this.settings.fx || DEFAULT_SYNTH_BACKING_SETTINGS.fx;
      const fxGain = rawCtx.createGain();
      const targetLinear = !fxBus.enabled || fxBus.muted ? 0 : Tone.dbToGain(fxBus.volumeDb);
      fxGain.gain.setValueAtTime(targetLinear, rawCtx.currentTime);
      const fxPan = rawCtx.createStereoPanner();
      fxPan.pan.setValueAtTime(fxBus.pan, rawCtx.currentTime);
      fxGain.connect(fxPan);
      fxPan.connect(rawCtx.destination);
      this.fxBusGain = fxGain;
      this.fxBusPan = fxPan;
    }

    this.isBuilt = true;
  }

  public teardownNodes(): void {
    this.activeSynthSectionId = null;
    this.activePadSectionId = null;
    this.activeArpSectionId = null;
    this.arpStepCursors.clear();
    this.drumPrevBarWasFill.clear();

    const safeDisposeNode = (node: Tone.ToneAudioNode | null) => {
      if (!node) return;
      try {
        node.disconnect();
        node.dispose();
      } catch {
        // Ignore
      }
    };

    for (const e of this.synthLayerChains.values()) {
      e.chain.dispose();
      safeDisposeNode(e.gain);
    }
    this.synthLayerChains.clear();
    safeDisposeNode(this.synthVol);
    safeDisposeNode(this.synthPan);
    this.synthVol = null;
    this.synthPan = null;

    for (const e of this.padLayerChains.values()) {
      e.chain.dispose();
      safeDisposeNode(e.gain);
    }
    this.padLayerChains.clear();
    safeDisposeNode(this.padFilter);
    safeDisposeNode(this.padVol);
    safeDisposeNode(this.padPan);
    this.padFilter = null;
    this.padVol = null;
    this.padPan = null;

    for (const e of this.arpLayerChains.values()) {
      e.chain.dispose();
      safeDisposeNode(e.gain);
    }
    this.arpLayerChains.clear();
    safeDisposeNode(this.arpVol);
    safeDisposeNode(this.arpPan);
    this.arpVol = null;
    this.arpPan = null;

    for (const e of this.drumLayerChains.values()) {
      e.chain.dispose();
      safeDisposeNode(e.gain);
    }
    this.drumLayerChains.clear();
    safeDisposeNode(this.drumsVol);
    safeDisposeNode(this.drumsPan);
    this.drumsVol = null;
    this.drumsPan = null;

    this.stopAllActiveFx();
    if (this.fxBusGain) {
      try {
        this.fxBusGain.disconnect();
      } catch {
        // Ignore
      }
      this.fxBusGain = null;
    }
    if (this.fxBusPan) {
      try {
        this.fxBusPan.disconnect();
      } catch {
        // Ignore
      }
      this.fxBusPan = null;
    }

    this.isBuilt = false;
  }

  private stopAllActiveFx(): void {
    for (const stop of this.activeFxStoppers) {
      try {
        stop();
      } catch {
        // Ignore
      }
    }
    this.activeFxStoppers.clear();
  }

  public updateSettings(next: SynthBackingSettings): void {
    this.settings = next;

    // Complete bypass & node disposal when Master Switch is turned OFF
    if (!next.masterEnabled) {
      this.teardownNodes();
      return;
    }

    if (!this.isBuilt) return;

    if (this.synthVol) {
      this.synthVol.volume.rampTo(next.synth.volumeDb, 0.03);
      this.synthVol.mute = next.synth.muted;
    }
    if (this.synthPan) {
      this.synthPan.pan.rampTo(next.synth.pan, 0.03);
    }

    if (this.padVol) {
      this.padVol.volume.rampTo(next.pad.volumeDb, 0.03);
      this.padVol.mute = next.pad.muted;
    }
    if (this.padPan) {
      this.padPan.pan.rampTo(next.pad.pan, 0.03);
    }

    if (this.arpVol) {
      this.arpVol.volume.rampTo(next.arp.volumeDb, 0.03);
      this.arpVol.mute = next.arp.muted;
    }
    if (this.arpPan) {
      this.arpPan.pan.rampTo(next.arp.pan, 0.03);
    }

    if (this.drumsVol) {
      this.drumsVol.volume.rampTo(next.drums.volumeDb, 0.03);
      this.drumsVol.mute = !next.drums.enabled || next.drums.muted;
    }
    if (this.drumsPan) {
      this.drumsPan.pan.rampTo(next.drums.pan, 0.03);
    }

    const fxBus = next.fx || DEFAULT_SYNTH_BACKING_SETTINGS.fx;
    if (this.fxBusGain && this.boundRawCtx) {
      const targetLinear = !fxBus.enabled || fxBus.muted ? 0 : Tone.dbToGain(fxBus.volumeDb);
      this.fxBusGain.gain.setTargetAtTime(targetLinear, this.boundRawCtx.currentTime, 0.02);
    }
    if (this.fxBusPan && this.boundRawCtx) {
      this.fxBusPan.pan.setTargetAtTime(fxBus.pan, this.boundRawCtx.currentTime, 0.02);
    }
  }

  public onPlaybackStart(
    rawCtx: AudioContext,
    initialSeedChord?: { chordStr: string; semitones: number } | null
  ): void {
    this.stopActivePreview();
    this.isPlayingLive = true;
    this.activeSynthSectionId = null;
    this.activePadSectionId = null;
    this.activeArpSectionId = null;
    this.arpStepCursors.clear();
    this.drumPrevBarWasFill.clear();
    this.lastNonEmptyChord = initialSeedChord ?? null;

    if (!this.settings.masterEnabled) {
      this.teardownNodes();
      return;
    }

    this.ensureToneContext(rawCtx);
    this.buildNodes();
  }

  public scheduleChord(params: {
    rawCtx: AudioContext;
    time: number;
    chordStr: string;
    semitones: number;
    durationSec: number;
    barDurationSec: number;
    beatDurationSec: number;
    beatsPerBar: number;
    effectiveMeter: BarMeter;
    effectiveBpm: number;
    isBarStart: boolean;
    sectionId: string;
    sectionBarNumber: number;
    sectionTotalBars: number;
    sectionMultiPad?: SectionMultiPadConfig;
    sectionSynth?: SectionSynthConfig;
    sectionArp?: SectionArpConfig;
    sectionDrums?: SectionDrumsConfig;
  }): void {
    if (!this.settings.masterEnabled || !this.isPlayingLive) {
      return;
    }

    this.ensureToneContext(params.rawCtx);
    this.buildNodes();

    const isEmptyBar = isEmptyChordToken(params.chordStr);
    if (!isEmptyBar) {
      this.lastNonEmptyChord = {
        chordStr: params.chordStr,
        semitones: params.semitones,
      };
    }

    const resolveBusChord = (fillEmpty?: boolean) => {
      if (!isEmptyBar) {
        return { chordStr: params.chordStr, semitones: params.semitones };
      }
      if (fillEmpty && this.lastNonEmptyChord) {
        return this.lastNonEmptyChord;
      }
      return null;
    };

    // 1. Multi-Layer Per-Section Synth (Blue Dot)
    if (this.activeSynthSectionId !== null && this.activeSynthSectionId !== params.sectionId) {
      this.releaseAllSynthVoices(params.time);
    }
    this.activeSynthSectionId = params.sectionId;

    const synthChord = resolveBusChord(this.settings.synth.fillEmptyBars);
    const synthLayers = getNormalizedSynthLayers(params.sectionSynth);
    let anySynthPlayed = false;

    if (!this.settings.synth.muted && synthChord && synthLayers.length > 0) {
      synthLayers.forEach((layer, idx) => {
        if (!isBarInSectionLayerRange(layer, params.sectionBarNumber, params.sectionTotalBars)) {
          return;
        }
        anySynthPlayed = true;
        const chain = this.getOrCreateSynthLayerChain(
          layer.id || `synth-${idx}`,
          layer.tone,
          layer.volumeDb ?? 0
        );
        scheduleSectionSynthPattern(chain.poly, {
          chordStr: synthChord.chordStr,
          semitones: synthChord.semitones,
          time: params.time,
          durationSec: params.durationSec,
          beatDurationSec: params.beatDurationSec,
          pattern: layer.pattern,
          tone: layer.tone,
        });
      });
    }
    if (!anySynthPlayed) {
      this.releaseAllSynthVoices(params.time);
    }

    // 2. Multi-Layer Per-Section Multi-Pad (Green Dot)
    if (this.activePadSectionId !== null && this.activePadSectionId !== params.sectionId) {
      this.releaseAllPadVoices(params.time);
    }
    this.activePadSectionId = params.sectionId;

    const padChord = resolveBusChord(this.settings.pad.fillEmptyBars);
    const padLayers = getNormalizedPadLayers(params.sectionMultiPad);
    let anyPadPlayed = false;

    if (!this.settings.pad.muted && padChord && padLayers.length > 0) {
      padLayers.forEach((layer, idx) => {
        if (!isBarInSectionLayerRange(layer, params.sectionBarNumber, params.sectionTotalBars)) {
          return;
        }
        anyPadPlayed = true;
        const chain = this.getOrCreatePadLayerChain(
          layer.id || `pad-${idx}`,
          layer.tone,
          layer.volumeDb ?? 0
        );
        scheduleSectionPadPattern(chain.poly, {
          chordStr: padChord.chordStr,
          semitones: padChord.semitones,
          time: params.time,
          durationSec: params.durationSec,
          beatDurationSec: params.beatDurationSec,
          pattern: layer.pattern,
        });
      });
    }
    if (!anyPadPlayed) {
      this.releaseAllPadVoices(params.time);
    }

    // 3. Multi-Layer Per-Section Arpeggiator (Orange Dot)
    if (this.activeArpSectionId !== null && this.activeArpSectionId !== params.sectionId) {
      this.releaseAllArpVoices(params.time);
      this.arpStepCursors.clear();
    }
    this.activeArpSectionId = params.sectionId;

    const arpChord = resolveBusChord(this.settings.arp.fillEmptyBars);
    const arpLayers = getNormalizedArpLayers(params.sectionArp);
    let anyArpPlayed = false;

    if (!this.settings.arp.muted && arpChord && arpLayers.length > 0) {
      arpLayers.forEach((layer, idx) => {
        const cursorKey = layer.id || `arp-${idx}`;
        if (!isBarInSectionLayerRange(layer, params.sectionBarNumber, params.sectionTotalBars)) {
          this.arpStepCursors.set(cursorKey, 0);
          return;
        }
        anyArpPlayed = true;
        const arpTone = layer.tone || DEFAULT_SECTION_ARP.tone;
        const chain = this.getOrCreateArpLayerChain(
          cursorKey,
          arpTone,
          layer.volumeDb ?? 0
        );
        const prevCursor = this.arpStepCursors.get(cursorKey) ?? 0;
        const nextCursor = scheduleSectionArpPattern(chain.poly, {
          chordStr: arpChord.chordStr,
          semitones: arpChord.semitones,
          time: params.time,
          durationSec: params.durationSec,
          beatDurationSec: params.beatDurationSec,
          pattern: layer.pattern || DEFAULT_SECTION_ARP.pattern,
          tone: arpTone,
          subdivision: layer.subdivision || DEFAULT_SECTION_ARP.subdivision || '8n',
          stepOffset: prevCursor,
        });
        this.arpStepCursors.set(cursorKey, nextCursor);
      });
    }
    if (!anyArpPlayed) {
      this.releaseAllArpVoices(params.time);
    }

    // 4. Per-Section Drums & Rhythm (Red/Coral Dot) - Bar-Level, Never auto-filled on empty chord setting
    if (params.isBarStart && this.settings.drums.enabled && !this.settings.drums.muted) {
      if (params.sectionDrums?.enabled) {
        const drumLayers = getNormalizedDrumLayers(params.sectionDrums);
        drumLayers.forEach((layer, idx) => {
          const fillKey = `${params.sectionId}::${layer.id || idx}`;
          if (!isBarInSectionLayerRange(layer, params.sectionBarNumber, params.sectionTotalBars)) {
            this.drumPrevBarWasFill.set(fillKey, false);
            return;
          }
          const isFillBar = shouldTriggerDrumFill(
            layer,
            params.sectionBarNumber,
            params.sectionTotalBars
          );
          const prevWasFill = Boolean(this.drumPrevBarWasFill.get(fillKey));
          const chain = this.getOrCreateDrumLayerChain(
            layer.id || `drum-${idx}`,
            layer.kit,
            layer.volumeDb ?? 0
          );
          scheduleSectionDrumPattern(chain, {
            time: params.time,
            barDurationSec: params.barDurationSec,
            beatsPerBar: params.beatsPerBar,
            effectiveMeter: params.effectiveMeter,
            pattern: layer.pattern,
            kit: layer.kit,
            isFillBar,
            fillStyle: layer.fillStyle || 'Tom Fill Cascade',
            postFillCrash: prevWasFill && !isFillBar,
          });
          this.drumPrevBarWasFill.set(fillKey, isFillBar);
        });
      }
    }
  }

  public async previewSectionLayer(options: {
    layer: 'pad' | 'synth' | 'arp' | 'drums';
    tone: PadPresetId | SynthPresetId | ArpPresetId | DrumKitId;
    pattern: SectionPadPattern | SectionSynthPattern | ArpPatternType | DrumPatternId;
    subdivision?: '4n' | '8n' | '8t' | '16n';
    volumeDb?: number;
    fillStyle?: DrumFillStyle;
    previewFill?: boolean;
    meter?: BarMeter;
    chordStr: string;
    bpm: number;
  }): Promise<void> {
    this.stopActivePreview();

    const toneCtx = Tone.getContext();
    try {
      if (toneCtx.state !== 'running') {
        await toneCtx.resume();
      }
      await Tone.start();
    } catch {
      // Ignore outside gesture errors
    }

    const now = Math.max(Tone.now(), toneCtx.currentTime + toneCtx.lookAhead) + 0.03;
    const safeChord = options.chordStr && options.chordStr !== '-' ? options.chordStr : 'C';
    const beatSec = 60 / Math.max(40, Math.min(240, options.bpm || 92));
    const layerGain = new Tone.Gain(Tone.dbToGain(options.volumeDb ?? 0));

    if (options.layer === 'drums') {
      const vol = new Tone.Volume(this.settings.drums.volumeDb);
      const pan = new Tone.Panner(this.settings.drums.pan);
      const drumChain = createDrumChainForKit(options.tone as DrumKitId);
      drumChain.output.chain(layerGain, vol, pan, Tone.getDestination());

      const meter: BarMeter = options.meter || '4/4';
      const beats = meter === '6/8' ? 6 : meter === '3/4' ? 3 : 4;
      const barDur = beatSec * beats;

      scheduleSectionDrumPattern(drumChain, {
        time: now,
        barDurationSec: barDur,
        beatsPerBar: beats,
        effectiveMeter: meter,
        pattern: options.pattern as DrumPatternId,
        kit: options.tone as DrumKitId,
        isFillBar: Boolean(options.previewFill),
        fillStyle: options.fillStyle || 'Tom Fill Cascade',
        postFillCrash: false,
      });

      const cleanup = () => {
        drumChain.dispose();
        layerGain.dispose();
        vol.dispose();
        pan.dispose();
      };
      this.activePreviewCleanup = cleanup;
      this.activePreviewTimer = window.setTimeout(() => {
        if (this.activePreviewCleanup === cleanup) {
          cleanup();
          this.activePreviewCleanup = null;
          this.activePreviewTimer = null;
        }
      }, Math.round((barDur + 1.4) * 1000));
      return;
    }

    if (options.layer === 'pad') {
      const vol = new Tone.Volume(this.settings.pad.volumeDb);
      const pan = new Tone.Panner(this.settings.pad.pan);
      const chain = createPadChainForPreset(options.tone as PadPresetId);
      chain.output.chain(layerGain, vol, pan, Tone.getDestination());

      const dur = beatSec * 2.5;
      scheduleSectionPadPattern(chain.poly, {
        chordStr: safeChord,
        semitones: 0,
        time: now,
        durationSec: dur,
        beatDurationSec: beatSec,
        pattern: options.pattern as SectionPadPattern,
      });

      const cleanup = () => {
        chain.dispose();
        layerGain.dispose();
        vol.dispose();
        pan.dispose();
      };
      this.activePreviewCleanup = cleanup;
      this.activePreviewTimer = window.setTimeout(() => {
        if (this.activePreviewCleanup === cleanup) {
          cleanup();
          this.activePreviewCleanup = null;
          this.activePreviewTimer = null;
        }
      }, Math.round((dur + 2.0) * 1000));
      return;
    }

    if (options.layer === 'synth') {
      const vol = new Tone.Volume(this.settings.synth.volumeDb);
      const pan = new Tone.Panner(this.settings.synth.pan);
      const toneId = options.tone as SynthPresetId;
      const chain = createSynthChainForPreset(toneId);
      chain.output.chain(layerGain, vol, pan, Tone.getDestination());

      const dur = beatSec * 2.5;
      scheduleSectionSynthPattern(chain.poly, {
        chordStr: safeChord,
        semitones: 0,
        time: now,
        durationSec: dur,
        beatDurationSec: beatSec,
        pattern: options.pattern as SectionSynthPattern,
        tone: toneId,
      });

      const cleanup = () => {
        chain.dispose();
        layerGain.dispose();
        vol.dispose();
        pan.dispose();
      };
      this.activePreviewCleanup = cleanup;
      this.activePreviewTimer = window.setTimeout(() => {
        if (this.activePreviewCleanup === cleanup) {
          cleanup();
          this.activePreviewCleanup = null;
          this.activePreviewTimer = null;
        }
      }, Math.round((dur + 1.5) * 1000));
      return;
    }

    // Arp preview
    const vol = new Tone.Volume(this.settings.arp.volumeDb);
    const pan = new Tone.Panner(this.settings.arp.pan);
    const toneId = options.tone as ArpPresetId;
    const chain = createArpChainForPreset(toneId);
    chain.output.chain(layerGain, vol, pan, Tone.getDestination());

    const dur = beatSec * 2.5;
    scheduleSectionArpPattern(chain.poly, {
      chordStr: safeChord,
      semitones: 0,
      time: now,
      durationSec: dur,
      beatDurationSec: beatSec,
      pattern: options.pattern as ArpPatternType,
      tone: toneId,
      subdivision: options.subdivision || '8n',
      stepOffset: 0,
    });

    const cleanup = () => {
      chain.dispose();
      layerGain.dispose();
      vol.dispose();
      pan.dispose();
    };
    this.activePreviewCleanup = cleanup;
    this.activePreviewTimer = window.setTimeout(() => {
      if (this.activePreviewCleanup === cleanup) {
        cleanup();
        this.activePreviewCleanup = null;
        this.activePreviewTimer = null;
      }
    }, Math.round((dur + 1.5) * 1000));
  }

  public async previewSectionMultiPad(options: {
    tone: PadPresetId;
    pattern: SectionPadPattern;
    chordStr: string;
    bpm: number;
  }): Promise<void> {
    return this.previewSectionLayer({
      layer: 'pad',
      tone: options.tone,
      pattern: options.pattern,
      chordStr: options.chordStr,
      bpm: options.bpm,
    });
  }

  public scheduleBeatFx(ev: BeatScheduleEvent): void {
    const fxBus = this.settings.fx || DEFAULT_SYNTH_BACKING_SETTINGS.fx;
    if (!this.settings.masterEnabled || !this.isPlayingLive || !fxBus.enabled || fxBus.muted) {
      return;
    }
    if (!ev.sectionFx?.enabled) return;

    const fxList = getNormalizedFxLayers(ev.sectionFx);
    if (fxList.length === 0) return;

    this.ensureToneContext(ev.rawCtx);
    this.buildNodes();
    if (!this.fxBusGain) return;

    for (const fx of fxList) {
      if (!fx.enabled) continue;
      if (fx.startBar !== ev.sectionBarNumber) continue;
      const targetBeat = Math.max(1, Math.min(ev.beatsPerBar, fx.startBeat));
      if (targetBeat !== ev.beatNum) continue;

      const durationSec = Math.max(0.2, fx.durationBars * ev.barDurationSec);
      const stopFx = scheduleWebAudioFx({
        ctx: ev.rawCtx,
        destination: this.fxBusGain,
        effectType: fx.effectType,
        startTime: ev.time,
        durationSec,
        beatDurationSec: ev.beatDurationSec,
        volumeDb: fx.volumeDb,
      });
      this.activeFxStoppers.add(stopFx);
    }
  }

  public async previewFx(options: {
    effectType: FxTypeId;
    durationBars: number;
    volumeDb?: number;
    bpm: number;
    meter?: BarMeter;
  }): Promise<void> {
    this.stopActivePreview();

    const toneCtx = Tone.getContext();
    try {
      if (toneCtx.state !== 'running') {
        await toneCtx.resume();
      }
      await Tone.start();
    } catch {
      // Ignore outside gesture errors
    }

    const rawCtx = toneCtx.rawContext as AudioContext;
    if (!rawCtx) return;

    const fxBus = this.settings.fx || DEFAULT_SYNTH_BACKING_SETTINGS.fx;
    const busGain = rawCtx.createGain();
    busGain.gain.setValueAtTime(Tone.dbToGain(fxBus.volumeDb), rawCtx.currentTime);
    const busPan = rawCtx.createStereoPanner();
    busPan.pan.setValueAtTime(fxBus.pan, rawCtx.currentTime);
    busGain.connect(busPan);
    busPan.connect(rawCtx.destination);

    const safeBpm = Math.max(40, Math.min(240, options.bpm || 92));
    const beatSec = 60 / safeBpm;
    const beats = options.meter === '6/8' ? 6 : options.meter === '3/4' ? 3 : 4;
    const barDur = beatSec * beats;
    // Preview exact bar duration up to 10s so long risers remain responsive to audition
    const previewDur = Math.max(0.35, Math.min(10, (options.durationBars || 1) * barDur));

    const stopFx = scheduleWebAudioFx({
      ctx: rawCtx,
      destination: busGain,
      effectType: options.effectType,
      startTime: rawCtx.currentTime + 0.03,
      durationSec: previewDur,
      beatDurationSec: beatSec,
      volumeDb: options.volumeDb ?? 0,
    });

    const cleanup = () => {
      stopFx();
      try {
        busGain.disconnect();
        busPan.disconnect();
      } catch {
        // Ignore
      }
    };
    this.activePreviewCleanup = cleanup;
    this.activePreviewTimer = window.setTimeout(() => {
      if (this.activePreviewCleanup === cleanup) {
        cleanup();
        this.activePreviewCleanup = null;
        this.activePreviewTimer = null;
      }
    }, Math.round((previewDur + 0.45) * 1000));
  }

  public onPlaybackStop(): void {
    this.isPlayingLive = false;
    this.activeSynthSectionId = null;
    this.activePadSectionId = null;
    this.activeArpSectionId = null;
    this.arpStepCursors.clear();
    this.drumPrevBarWasFill.clear();
    this.lastNonEmptyChord = null;

    this.stopAllActiveFx();
    this.releaseAllSynthVoices();
    this.releaseAllPadVoices();
    this.releaseAllArpVoices();
  }

  public destroy(): void {
    this.isPlayingLive = false;
    this.stopActivePreview();
    this.teardownNodes();
  }
}

interface OfflineChordSegment {
  time: number;
  durationSec: number;
  barDurationSec: number;
  beatDurationSec: number;
  beatsPerBar: number;
  effectiveMeter: BarMeter;
  effectiveBpm: number;
  isBarStart: boolean;
  chordStr: string;
  semitones: number;
  sectionId: string;
  sectionBarNumber: number;
  sectionTotalBars: number;
  sectionMultiPad?: SectionMultiPadConfig;
  sectionSynth?: SectionSynthConfig;
  sectionArp?: SectionArpConfig;
  sectionDrums?: SectionDrumsConfig;
}

interface OfflineBeatSchedule {
  time: number;
  beatDurationSec: number;
  beatNum: number;
  beatsInBar: number;
  isCountIn: boolean;
  step: ReturnType<typeof buildSongTimeline>[number];
}

/**
 * Renders the selected project audio tracks (Multi-Pad, Synth, Arpeggiator, Drums, FX/Risers, Metronome Click, Voice Cues & Count-in)
 * at 44.1 kHz Stereo using Tone.Offline() (OfflineAudioContext), returning either 16-bit Stereo PCM WAV or 192 kbps Stereo MP3
 * with automatic "<Song Title> - Key <Key>.<ext>" naming.
 */
export async function exportProjectAudio(options: {
  song: Song;
  metronomeSettings: MetronomeSettings;
  synthSettings: SynthBackingSettings;
  trackSelection?: WavExportTrackSelection;
  format?: AudioExportFormat;
  onProgress?: (pct: number, stage: string) => void;
}): Promise<{ blob: Blob; filename: string; audioBuffer: AudioBuffer }> {
  const { song, metronomeSettings, synthSettings, onProgress } = options;
  const format: AudioExportFormat = options.format ?? 'wav';
  const tracks: WavExportTrackSelection = options.trackSelection ?? DEFAULT_WAV_TRACK_SELECTION;

  const sampleRate = 44100;
  const timeline = buildSongTimeline(song, {}, null);
  if (!timeline.length) {
    throw new Error('This song has no bars to export.');
  }

  onProgress?.(6, 'Scanning selected tracks & cues...');

  const neededUrls = new Set<string>();
  const neededCustomIds = new Set<string>();

  if (tracks.voiceCues) {
    if (metronomeSettings.countInBar) {
      const firstBeats = timeline[0].beatsPerBar;
      for (let b = 1; b <= firstBeats; b++) {
        neededUrls.add(resolveCountCueUrl(b));
      }
    }

    for (const step of timeline) {
      if (step.bar.customCueId) {
        neededCustomIds.add(step.bar.customCueId);
      } else if (step.bar.cue) {
        const url = resolveBundledCueUrl(step.bar.cue);
        if (url) neededUrls.add(url);
      }

      if (step.bar.voiceCountLocked) {
        const pattern = (step.bar.countingSystem || '1 1 1 1')
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean);
        for (let b = 1; b <= step.beatsPerBar; b++) {
          const token = pattern[(b - 1) % Math.max(1, pattern.length)] || String(b);
          const parsed = parseInt(token, 10);
          if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 7) {
            neededUrls.add(resolveCountCueUrl(parsed));
          }
        }
      }
    }
  }

  const decodeCtx = new OfflineAudioContext(2, 1, sampleRate);
  const urlBuffers = new Map<string, AudioBuffer>();
  const customBuffers = new Map<string, AudioBuffer>();

  const totalAssets = neededUrls.size + neededCustomIds.size;
  let loaded = 0;

  for (const url of neededUrls) {
    onProgress?.(
      10 + Math.round((loaded / Math.max(1, totalAssets)) * 24),
      'Decoding studio cues & counts...'
    );
    try {
      const res = await fetch(url);
      if (res.ok) {
        const arr = await res.arrayBuffer();
        const decoded = await decodeCtx.decodeAudioData(arr.slice(0));
        urlBuffers.set(url, decoded);
      }
    } catch {
      // Skip unreadable asset
    }
    loaded += 1;
  }

  for (const cueId of neededCustomIds) {
    onProgress?.(
      10 + Math.round((loaded / Math.max(1, totalAssets)) * 24),
      'Decoding custom voice cues...'
    );
    try {
      const cue = await getCustomVoiceCue(cueId);
      if (cue) {
        const decoded = await decodeCtx.decodeAudioData(cue.audioData.slice(0));
        customBuffers.set(cueId, decoded);
      }
    } catch {
      // Skip unreadable custom cue
    }
    loaded += 1;
  }

  // 2. Build sample-accurate Beat Schedule + Chord Segments + FX Triggers
  let cursorTime = 0.04;
  const beatEvents: OfflineBeatSchedule[] = [];
  const chordSegments: OfflineChordSegment[] = [];

  interface OfflineFxTrigger {
    time: number;
    durationSec: number;
    beatDurationSec: number;
    effectType: FxTypeId;
    volumeDb: number;
  }
  const fxTriggers: OfflineFxTrigger[] = [];
  const fxBusCfg = synthSettings.fx || DEFAULT_SYNTH_BACKING_SETTINGS.fx;
  const renderFx = tracks.fx && synthSettings.masterEnabled && fxBusCfg.enabled && !fxBusCfg.muted;

  if (metronomeSettings.countInBar) {
    const first = timeline[0];
    const countBpm = Math.max(10, Math.min(300, first.effectiveBpm || song.bpm));
    const beatSec = 60 / countBpm;
    for (let b = 1; b <= first.beatsPerBar; b++) {
      beatEvents.push({
        time: cursorTime,
        beatDurationSec: beatSec,
        beatNum: b,
        beatsInBar: first.beatsPerBar,
        isCountIn: true,
        step: first,
      });
      cursorTime += beatSec;
    }
  }

  for (const step of timeline) {
    const bpm = Math.max(10, Math.min(300, step.effectiveBpm || song.bpm));
    const beatSec = 60 / bpm;
    const barDur = beatSec * step.beatsPerBar;
    const totalTranspose = (song.transpose || 0) + step.sectionTranspose;

    for (let b = 1; b <= step.beatsPerBar; b++) {
      beatEvents.push({
        time: cursorTime,
        beatDurationSec: beatSec,
        beatNum: b,
        beatsInBar: step.beatsPerBar,
        isCountIn: false,
        step,
      });

      if (renderFx && step.sectionFx?.enabled) {
        const fxList = getNormalizedFxLayers(step.sectionFx);
        for (const fx of fxList) {
          if (!fx.enabled) continue;
          if (fx.startBar !== step.sectionBarNumber) continue;
          const targetBeat = Math.max(1, Math.min(step.beatsPerBar, fx.startBeat));
          if (targetBeat !== b) continue;

          fxTriggers.push({
            time: cursorTime,
            durationSec: Math.max(0.2, fx.durationBars * barDur),
            beatDurationSec: beatSec,
            effectType: fx.effectType,
            volumeDb: fx.volumeDb,
          });
        }
      }

      if (hasBeatSplits(step.bar) && step.bar.beatChords) {
        const beatChord = (step.bar.beatChords[b - 1] || '').trim();
        if (beatChord && beatChord !== '-') {
          let holdBeats = 1;
          for (let nb = b; nb < step.beatsPerBar; nb++) {
            const nextVal = (step.bar.beatChords[nb] || '').trim();
            if (nextVal && nextVal !== '-') break;
            holdBeats += 1;
          }
          chordSegments.push({
            time: cursorTime,
            durationSec: beatSec * holdBeats,
            barDurationSec: barDur,
            beatDurationSec: beatSec,
            beatsPerBar: step.beatsPerBar,
            effectiveMeter: step.effectiveMeter,
            effectiveBpm: bpm,
            isBarStart: b === 1,
            chordStr: beatChord,
            semitones: totalTranspose,
            sectionId: step.sectionId,
            sectionBarNumber: step.sectionBarNumber,
            sectionTotalBars: step.sectionTotalBars,
            sectionMultiPad: step.sectionMultiPad,
            sectionSynth: step.sectionSynth,
            sectionArp: step.sectionArp,
            sectionDrums: step.sectionDrums,
          });
        } else if (b === 1) {
          let emptyBeats = 1;
          for (let nb = b; nb < step.beatsPerBar; nb++) {
            const nextVal = (step.bar.beatChords[nb] || '').trim();
            if (nextVal && nextVal !== '-') break;
            emptyBeats += 1;
          }
          chordSegments.push({
            time: cursorTime,
            durationSec: beatSec * emptyBeats,
            barDurationSec: barDur,
            beatDurationSec: beatSec,
            beatsPerBar: step.beatsPerBar,
            effectiveMeter: step.effectiveMeter,
            effectiveBpm: bpm,
            isBarStart: true,
            chordStr: '-',
            semitones: totalTranspose,
            sectionId: step.sectionId,
            sectionBarNumber: step.sectionBarNumber,
            sectionTotalBars: step.sectionTotalBars,
            sectionMultiPad: step.sectionMultiPad,
            sectionSynth: step.sectionSynth,
            sectionArp: step.sectionArp,
            sectionDrums: step.sectionDrums,
          });
        }
      } else if (b === 1) {
        chordSegments.push({
          time: cursorTime,
          durationSec: barDur,
          barDurationSec: barDur,
          beatDurationSec: beatSec,
          beatsPerBar: step.beatsPerBar,
          effectiveMeter: step.effectiveMeter,
          effectiveBpm: bpm,
          isBarStart: true,
          chordStr: step.bar.chord,
          semitones: totalTranspose,
          sectionId: step.sectionId,
          sectionBarNumber: step.sectionBarNumber,
          sectionTotalBars: step.sectionTotalBars,
          sectionMultiPad: step.sectionMultiPad,
          sectionSynth: step.sectionSynth,
          sectionArp: step.sectionArp,
          sectionDrums: step.sectionDrums,
        });
      }

      cursorTime += beatSec;
    }
  }

  const songEndTime = cursorTime;
  const maxFxEndTime = fxTriggers.reduce(
    (maxEnd, fx) => Math.max(maxEnd, fx.time + fx.durationSec),
    songEndTime
  );
  const totalRenderDuration = Math.max(songEndTime + 1.8, maxFxEndTime + 0.4);

  onProgress?.(45, 'Rendering selected stereo tracks via Tone.Offline...');

  const renderedToneBuffer = await Tone.Offline(
    () => {
      const offlineToneCtx = Tone.getContext();
      const rawCtx = offlineToneCtx.rawContext as OfflineAudioContext;

      const scheduleRawVoiceBuffer = (buf: AudioBuffer | undefined, time: number) => {
        if (!buf || metronomeSettings.voiceVolume <= 0) return;
        const src = rawCtx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.setValueAtTime(1.0, time);

        const gain = rawCtx.createGain();
        gain.gain.setValueAtTime(
          Math.max(0, Math.min(1.5, metronomeSettings.voiceVolume / 100)),
          time
        );

        const panner = rawCtx.createStereoPanner();
        panner.pan.setValueAtTime(balanceToPan(metronomeSettings.voiceBalance), time);

        src.connect(gain);
        gain.connect(panner);
        panner.connect(rawCtx.destination);
        src.start(time);
      };

      // A. Metronome Click & Voice Cues / Count-in (strictly filtered by track selection)
      if (tracks.click || tracks.voiceCues) {
        for (const ev of beatEvents) {
          if (tracks.click) {
            const activeUnit = ev.isCountIn
              ? metronomeSettings.subdivision
              : ev.step.bar.beatUnit || metronomeSettings.subdivision;

            scheduleCubaseClick(
              rawCtx,
              rawCtx.destination,
              ev.time,
              ev.beatNum === 1,
              false,
              metronomeSettings.clickVolume,
              metronomeSettings.clickBalance
            );
            scheduleSubdivisionClicks(
              rawCtx,
              rawCtx.destination,
              ev.time,
              ev.beatDurationSec,
              activeUnit,
              metronomeSettings.clickVolume,
              metronomeSettings.clickBalance
            );
          }

          if (!tracks.voiceCues) continue;

          if (ev.isCountIn) {
            scheduleRawVoiceBuffer(urlBuffers.get(resolveCountCueUrl(ev.beatNum)), ev.time);
            continue;
          }

          const allowLastBarVoice = shouldTriggerBarVoiceCueAndCount(ev.step);

          if (allowLastBarVoice && ev.beatNum === 1) {
            if (ev.step.bar.customCueId) {
              scheduleRawVoiceBuffer(customBuffers.get(ev.step.bar.customCueId), ev.time);
            } else if (ev.step.bar.cue) {
              const url = resolveBundledCueUrl(ev.step.bar.cue);
              if (url) scheduleRawVoiceBuffer(urlBuffers.get(url), ev.time);
            }
          }

          if (allowLastBarVoice && ev.step.bar.voiceCountLocked) {
            const pattern = (ev.step.bar.countingSystem || '1 1 1 1')
              .trim()
              .split(/[\s,]+/)
              .filter(Boolean);
            const token =
              pattern[(ev.beatNum - 1) % Math.max(1, pattern.length)] || String(ev.beatNum);
            const parsed = parseInt(token, 10);
            if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 7) {
              scheduleRawVoiceBuffer(urlBuffers.get(resolveCountCueUrl(parsed)), ev.time);
            }
          }
        }
      }

      // A2. Scheduled FX / Risers track (strictly filtered by tracks.fx)
      if (renderFx && fxTriggers.length > 0) {
        const offlineFxGain = rawCtx.createGain();
        offlineFxGain.gain.setValueAtTime(Tone.dbToGain(fxBusCfg.volumeDb), 0);
        const offlineFxPan = rawCtx.createStereoPanner();
        offlineFxPan.pan.setValueAtTime(fxBusCfg.pan, 0);
        offlineFxGain.connect(offlineFxPan);
        offlineFxPan.connect(rawCtx.destination);

        for (const fx of fxTriggers) {
          scheduleWebAudioFx({
            ctx: rawCtx,
            destination: offlineFxGain,
            effectType: fx.effectType,
            startTime: fx.time,
            durationSec: fx.durationSec,
            beatDurationSec: fx.beatDurationSec,
            volumeDb: fx.volumeDb,
          });
        }
      }

      // B. Multi-Layer Per-Section Synth / Multi-Pad / Arpeggiator / Drums (strictly filtered by track selection)
      const renderPad = tracks.multiPad && !synthSettings.pad.muted;
      const renderSynth = tracks.synth && !synthSettings.synth.muted;
      const renderArp = tracks.arp && !synthSettings.arp.muted;
      const renderDrums = tracks.drums && synthSettings.drums.enabled && !synthSettings.drums.muted;

      if (synthSettings.masterEnabled && (renderPad || renderSynth || renderArp || renderDrums)) {
        const synthVol = new Tone.Volume(synthSettings.synth.volumeDb);
        synthVol.mute = synthSettings.synth.muted;
        const synthPan = new Tone.Panner(synthSettings.synth.pan);
        synthVol.chain(synthPan, Tone.getDestination());

        const offlineSynthChains = new Map<string, { chain: ToneVoiceChain; gain: Tone.Gain }>();
        const getOfflineSynthLayerChain = (key: string, tone: SynthPresetId, volDb = 0) => {
          const cacheKey = `${key}::${tone}`;
          let entry = offlineSynthChains.get(cacheKey);
          if (!entry) {
            const chain = createSynthChainForPreset(tone);
            const gain = new Tone.Gain(Tone.dbToGain(volDb));
            chain.output.chain(gain, synthVol);
            entry = { chain, gain };
            offlineSynthChains.set(cacheKey, entry);
          } else {
            entry.gain.gain.setValueAtTime(Tone.dbToGain(volDb), 0);
          }
          return entry.chain;
        };

        const padFilter = new Tone.Filter(2600, 'lowpass');
        const padVol = new Tone.Volume(synthSettings.pad.volumeDb);
        padVol.mute = synthSettings.pad.muted;
        const padPan = new Tone.Panner(synthSettings.pad.pan);
        padFilter.chain(padVol, padPan, Tone.getDestination());

        const offlinePadChains = new Map<string, { chain: ToneVoiceChain; gain: Tone.Gain }>();
        const getOfflinePadLayerChain = (key: string, tone: PadPresetId, volDb = 0) => {
          const cacheKey = `${key}::${tone}`;
          let entry = offlinePadChains.get(cacheKey);
          if (!entry) {
            const chain = createPadChainForPreset(tone);
            const gain = new Tone.Gain(Tone.dbToGain(volDb));
            chain.output.chain(gain, padFilter);
            entry = { chain, gain };
            offlinePadChains.set(cacheKey, entry);
          } else {
            entry.gain.gain.setValueAtTime(Tone.dbToGain(volDb), 0);
          }
          return entry.chain;
        };

        const arpVol = new Tone.Volume(synthSettings.arp.volumeDb);
        arpVol.mute = synthSettings.arp.muted;
        const arpPan = new Tone.Panner(synthSettings.arp.pan);
        arpVol.chain(arpPan, Tone.getDestination());

        const offlineArpChains = new Map<string, { chain: ToneVoiceChain; gain: Tone.Gain }>();
        const getOfflineArpLayerChain = (key: string, tone: ArpPresetId, volDb = 0) => {
          const cacheKey = `${key}::${tone}`;
          let entry = offlineArpChains.get(cacheKey);
          if (!entry) {
            const chain = createArpChainForPreset(tone);
            const gain = new Tone.Gain(Tone.dbToGain(volDb));
            chain.output.chain(gain, arpVol);
            entry = { chain, gain };
            offlineArpChains.set(cacheKey, entry);
          } else {
            entry.gain.gain.setValueAtTime(Tone.dbToGain(volDb), 0);
          }
          return entry.chain;
        };

        const drumsVol = new Tone.Volume(synthSettings.drums.volumeDb);
        drumsVol.mute = !synthSettings.drums.enabled || synthSettings.drums.muted;
        const drumsPan = new Tone.Panner(synthSettings.drums.pan);
        drumsVol.chain(drumsPan, Tone.getDestination());

        const offlineDrumChains = new Map<string, { chain: ToneDrumChain; gain: Tone.Gain }>();
        const getOfflineDrumLayerChain = (key: string, kit: DrumKitId, volDb = 0) => {
          const cacheKey = `${key}::${kit}`;
          let entry = offlineDrumChains.get(cacheKey);
          if (!entry) {
            const chain = createDrumChainForKit(kit);
            const gain = new Tone.Gain(Tone.dbToGain(volDb));
            chain.output.chain(gain, drumsVol);
            entry = { chain, gain };
            offlineDrumChains.set(cacheKey, entry);
          } else {
            entry.gain.gain.setValueAtTime(Tone.dbToGain(volDb), 0);
          }
          return entry.chain;
        };

        let lastOfflinePadSectionId: string | null = null;
        let lastOfflineSynthSectionId: string | null = null;
        let lastOfflineArpSectionId: string | null = null;
        const offlineArpCursors = new Map<string, number>();
        const offlineDrumPrevWasFill = new Map<string, boolean>();
        let offlineLastNonEmptyChord: { chordStr: string; semitones: number } | null = null;

        for (const seg of chordSegments) {
          const isEmptySeg = isEmptyChordToken(seg.chordStr);
          if (!isEmptySeg) {
            offlineLastNonEmptyChord = {
              chordStr: seg.chordStr,
              semitones: seg.semitones,
            };
          }

          const resolveOfflineBusChord = (fillEmpty?: boolean) => {
            if (!isEmptySeg) {
              return { chordStr: seg.chordStr, semitones: seg.semitones };
            }
            if (fillEmpty && offlineLastNonEmptyChord) {
              return offlineLastNonEmptyChord;
            }
            return null;
          };

          // 1. Multi-layer Synth
          if (renderSynth) {
            if (lastOfflineSynthSectionId !== null && lastOfflineSynthSectionId !== seg.sectionId) {
              for (const e of offlineSynthChains.values()) e.chain.poly.releaseAll(seg.time);
            }
            lastOfflineSynthSectionId = seg.sectionId;

            const offlineSynthChord = resolveOfflineBusChord(synthSettings.synth.fillEmptyBars);
            const synthLayers = getNormalizedSynthLayers(seg.sectionSynth);
            let anyPlayed = false;

            if (offlineSynthChord && synthLayers.length > 0) {
              synthLayers.forEach((layer, idx) => {
                if (!isBarInSectionLayerRange(layer, seg.sectionBarNumber, seg.sectionTotalBars)) {
                  return;
                }
                anyPlayed = true;
                const chain = getOfflineSynthLayerChain(
                  layer.id || `synth-${idx}`,
                  layer.tone,
                  layer.volumeDb ?? 0
                );
                scheduleSectionSynthPattern(chain.poly, {
                  chordStr: offlineSynthChord.chordStr,
                  semitones: offlineSynthChord.semitones,
                  time: seg.time,
                  durationSec: seg.durationSec,
                  beatDurationSec: seg.beatDurationSec,
                  pattern: layer.pattern,
                  tone: layer.tone,
                });
              });
            }
            if (!anyPlayed) {
              for (const e of offlineSynthChains.values()) e.chain.poly.releaseAll(seg.time);
            }
          }

          // 2. Multi-layer Multi-Pad
          if (renderPad) {
            if (lastOfflinePadSectionId !== null && lastOfflinePadSectionId !== seg.sectionId) {
              for (const e of offlinePadChains.values()) e.chain.poly.releaseAll(seg.time);
            }
            lastOfflinePadSectionId = seg.sectionId;

            const offlinePadChord = resolveOfflineBusChord(synthSettings.pad.fillEmptyBars);
            const padLayers = getNormalizedPadLayers(seg.sectionMultiPad);
            let anyPlayed = false;

            if (offlinePadChord && padLayers.length > 0) {
              padLayers.forEach((layer, idx) => {
                if (!isBarInSectionLayerRange(layer, seg.sectionBarNumber, seg.sectionTotalBars)) {
                  return;
                }
                anyPlayed = true;
                const chain = getOfflinePadLayerChain(
                  layer.id || `pad-${idx}`,
                  layer.tone,
                  layer.volumeDb ?? 0
                );
                scheduleSectionPadPattern(chain.poly, {
                  chordStr: offlinePadChord.chordStr,
                  semitones: offlinePadChord.semitones,
                  time: seg.time,
                  durationSec: seg.durationSec,
                  beatDurationSec: seg.beatDurationSec,
                  pattern: layer.pattern,
                });
              });
            }
            if (!anyPlayed) {
              for (const e of offlinePadChains.values()) e.chain.poly.releaseAll(seg.time);
            }
          }

          // 3. Multi-layer Arpeggiator
          if (renderArp) {
            if (lastOfflineArpSectionId !== null && lastOfflineArpSectionId !== seg.sectionId) {
              for (const e of offlineArpChains.values()) e.chain.poly.releaseAll(seg.time);
              offlineArpCursors.clear();
            }
            lastOfflineArpSectionId = seg.sectionId;

            const offlineArpChord = resolveOfflineBusChord(synthSettings.arp.fillEmptyBars);
            const arpLayers = getNormalizedArpLayers(seg.sectionArp);
            let anyPlayed = false;

            if (offlineArpChord && arpLayers.length > 0) {
              arpLayers.forEach((layer, idx) => {
                const cursorKey = layer.id || `arp-${idx}`;
                if (!isBarInSectionLayerRange(layer, seg.sectionBarNumber, seg.sectionTotalBars)) {
                  offlineArpCursors.set(cursorKey, 0);
                  return;
                }
                anyPlayed = true;
                const arpTone = layer.tone || DEFAULT_SECTION_ARP.tone;
                const chain = getOfflineArpLayerChain(
                  cursorKey,
                  arpTone,
                  layer.volumeDb ?? 0
                );
                const prevCursor = offlineArpCursors.get(cursorKey) ?? 0;
                const nextCursor = scheduleSectionArpPattern(chain.poly, {
                  chordStr: offlineArpChord.chordStr,
                  semitones: offlineArpChord.semitones,
                  time: seg.time,
                  durationSec: seg.durationSec,
                  beatDurationSec: seg.beatDurationSec,
                  pattern: layer.pattern || DEFAULT_SECTION_ARP.pattern,
                  tone: arpTone,
                  subdivision: layer.subdivision || DEFAULT_SECTION_ARP.subdivision || '8n',
                  stepOffset: prevCursor,
                });
                offlineArpCursors.set(cursorKey, nextCursor);
              });
            }
            if (!anyPlayed) {
              for (const e of offlineArpChains.values()) e.chain.poly.releaseAll(seg.time);
            }
          }

          // 4. Multi-layer Drums & Rhythm (strictly checked by tracks.drums + section.drums.enabled)
          if (renderDrums && seg.isBarStart && seg.sectionDrums?.enabled) {
            const drumLayers = getNormalizedDrumLayers(seg.sectionDrums);
            drumLayers.forEach((layer, idx) => {
              const fillKey = `${seg.sectionId}::${layer.id || idx}`;
              if (!isBarInSectionLayerRange(layer, seg.sectionBarNumber, seg.sectionTotalBars)) {
                offlineDrumPrevWasFill.set(fillKey, false);
                return;
              }
              const isFillBar = shouldTriggerDrumFill(
                layer,
                seg.sectionBarNumber,
                seg.sectionTotalBars
              );
              const prevWasFill = Boolean(offlineDrumPrevWasFill.get(fillKey));
              const chain = getOfflineDrumLayerChain(
                layer.id || `drum-${idx}`,
                layer.kit,
                layer.volumeDb ?? 0
              );
              scheduleSectionDrumPattern(chain, {
                time: seg.time,
                barDurationSec: seg.barDurationSec,
                beatsPerBar: seg.beatsPerBar,
                effectiveMeter: seg.effectiveMeter,
                pattern: layer.pattern,
                kit: layer.kit,
                isFillBar,
                fillStyle: layer.fillStyle || 'Tom Fill Cascade',
                postFillCrash: prevWasFill && !isFillBar,
              });
              offlineDrumPrevWasFill.set(fillKey, isFillBar);
            });
          }
        }
      } else if (
        !synthSettings.masterEnabled &&
        metronomeSettings.chordAudioEnabled &&
        metronomeSettings.chordVolume > 0 &&
        (tracks.multiPad || tracks.synth || tracks.arp)
      ) {
        for (const seg of chordSegments) {
          scheduleChordSynth(
            rawCtx,
            rawCtx.destination,
            seg.time,
            seg.chordStr,
            seg.semitones,
            seg.durationSec,
            metronomeSettings.chordVolume
          );
        }
      }
    },
    totalRenderDuration,
    2,
    sampleRate
  );

  onProgress?.(85, 'Encoding 16-bit PCM Stereo WAV...');

  const nativeAudioBuffer = renderedToneBuffer.get();
  if (!nativeAudioBuffer) {
    throw new Error('Failed to obtain rendered AudioBuffer from Tone.Offline.');
  }

  const filename = buildExportAudioFilename(
    song.title,
    song.key,
    song.transpose || 0,
    format
  );

  if (format === 'mp3') {
    onProgress?.(78, 'Encoding Stereo MP3...');
    const mp3Blob = await encodeAudioBufferToMp3Blob(nativeAudioBuffer, (pct) => {
      onProgress?.(pct, 'Encoding Stereo MP3...');
    });
    onProgress?.(100, 'Stereo MP3 ready!');
    return { blob: mp3Blob, filename, audioBuffer: nativeAudioBuffer };
  }

  onProgress?.(85, 'Encoding 16-bit PCM Stereo WAV...');
  const wavBlob = encodeAudioBufferToWavBlob(nativeAudioBuffer);
  onProgress?.(100, 'Stereo WAV ready!');

  return { blob: wavBlob, filename, audioBuffer: nativeAudioBuffer };
}

export async function exportFullProjectMixWav(options: {
  song: Song;
  metronomeSettings: MetronomeSettings;
  synthSettings: SynthBackingSettings;
  trackSelection?: WavExportTrackSelection;
  onProgress?: (pct: number, stage: string) => void;
}): Promise<{ blob: Blob; filename: string }> {
  const result = await exportProjectAudio({ ...options, format: 'wav' });
  return { blob: result.blob, filename: result.filename };
}
