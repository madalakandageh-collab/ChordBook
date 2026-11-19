import * as Tone from 'tone';
import type {
  ArpPatternType,
  ArpPresetId,
  MetronomeSettings,
  PadPresetId,
  SectionArpConfig,
  SectionMultiPadConfig,
  SectionPadPattern,
  SectionSynthConfig,
  SectionSynthPattern,
  Song,
  SynthBackingSettings,
  SynthPresetId,
} from '../types';
import {
  buildSongTimeline,
  chordToMidiNotes,
  hasBeatSplits,
  isBarInSectionLayerRange,
  shouldTriggerBarVoiceCueAndCount,
} from '../utils/chords';
import {
  getCustomVoiceCue,
  resolveBundledCueUrl,
  resolveCountCueUrl,
} from '../utils/voiceCues';
import {
  balanceToPan,
  encodeAudioBufferToWavBlob,
  scheduleChordSynth,
  scheduleCubaseClick,
  scheduleSubdivisionClicks,
} from './cubaseClick';

export const SYNTH_STORAGE_KEY = 'chordbook_synth_v1';

export interface PresetCatalogItem<T extends string> {
  id: T;
  category: string;
  description: string;
}

export const DEFAULT_SECTION_MULTI_PAD: SectionMultiPadConfig = {
  enabled: false,
  pattern: 'Sustain',
  tone: 'Warm Analog Pad',
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
};

export const DEFAULT_SECTION_SYNTH: SectionSynthConfig = {
  enabled: false,
  pattern: 'Full Chord',
  tone: 'FM Electric Piano',
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
};

export const DEFAULT_SECTION_ARP: SectionArpConfig = {
  enabled: false,
  pattern: 'upDown',
  tone: 'Synth Pluck Arp',
  subdivision: '8n',
  barRangeMode: 'all',
  startBar: 1,
  endBar: 4,
};

export const DEFAULT_SYNTH_BACKING_SETTINGS: SynthBackingSettings = {
  masterEnabled: true,
  synth: {
    volumeDb: -5,
    pan: -0.15,
    muted: false,
  },
  pad: {
    volumeDb: -12,
    pan: 0.15,
    muted: false,
  },
  arp: {
    volumeDb: -4,
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
      synth: {
        ...DEFAULT_SYNTH_BACKING_SETTINGS.synth,
        ...(parsed.synth || {}),
      },
      pad: {
        ...DEFAULT_SYNTH_BACKING_SETTINGS.pad,
        ...(parsed.pad || {}),
      },
      arp: {
        ...DEFAULT_SYNTH_BACKING_SETTINGS.arp,
        ...(parsed.arp || {}),
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

export class ToneSynthBackingEngine {
  private settings: SynthBackingSettings;
  private boundRawCtx: AudioContext | null = null;
  private isBuilt = false;
  private isPlayingLive = false;

  // Per-Section Synth Pool -> Bus Volume -> Bus Panner -> Destination
  private synthChainsByTone = new Map<SynthPresetId, ToneVoiceChain>();
  private synthVol: Tone.Volume | null = null;
  private synthPan: Tone.Panner | null = null;
  private activeSynthSectionId: string | null = null;

  // Per-Section Multi-Pad Pool -> Lowpass Filter -> Bus Volume -> Bus Panner -> Destination
  private padChainsByTone = new Map<PadPresetId, ToneVoiceChain>();
  private padFilter: Tone.Filter | null = null;
  private padVol: Tone.Volume | null = null;
  private padPan: Tone.Panner | null = null;
  private activePadSectionId: string | null = null;

  // Per-Section Arpeggiator Pool -> Bus Volume -> Bus Panner -> Destination
  private arpChainsByTone = new Map<ArpPresetId, ToneVoiceChain>();
  private arpVol: Tone.Volume | null = null;
  private arpPan: Tone.Panner | null = null;
  private activeArpSectionId: string | null = null;
  private arpStepCursor = 0;

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

  private getOrCreateSynthChain(tone: SynthPresetId): ToneVoiceChain {
    const existing = this.synthChainsByTone.get(tone);
    if (existing) return existing;
    const chain = createSynthChainForPreset(tone);
    if (this.synthVol) {
      chain.output.connect(this.synthVol);
    }
    this.synthChainsByTone.set(tone, chain);
    return chain;
  }

  private getOrCreatePadChain(tone: PadPresetId): ToneVoiceChain {
    const existing = this.padChainsByTone.get(tone);
    if (existing) return existing;
    const chain = createPadChainForPreset(tone);
    if (this.padFilter) {
      chain.output.connect(this.padFilter);
    }
    this.padChainsByTone.set(tone, chain);
    return chain;
  }

  private getOrCreateArpChain(tone: ArpPresetId): ToneVoiceChain {
    const existing = this.arpChainsByTone.get(tone);
    if (existing) return existing;
    const chain = createArpChainForPreset(tone);
    if (this.arpVol) {
      chain.output.connect(this.arpVol);
    }
    this.arpChainsByTone.set(tone, chain);
    return chain;
  }

  private releaseAllSynthVoices(time?: number): void {
    for (const chain of this.synthChainsByTone.values()) {
      try {
        chain.poly.releaseAll(time);
      } catch {
        // Ignore
      }
    }
  }

  private releaseAllPadVoices(time?: number): void {
    for (const chain of this.padChainsByTone.values()) {
      try {
        chain.poly.releaseAll(time);
      } catch {
        // Ignore
      }
    }
  }

  private releaseAllArpVoices(time?: number): void {
    for (const chain of this.arpChainsByTone.values()) {
      try {
        chain.poly.releaseAll(time);
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

    this.isBuilt = true;
  }

  public teardownNodes(): void {
    this.activeSynthSectionId = null;
    this.activePadSectionId = null;
    this.activeArpSectionId = null;
    this.arpStepCursor = 0;

    const safeDisposeNode = (node: Tone.ToneAudioNode | null) => {
      if (!node) return;
      try {
        node.disconnect();
        node.dispose();
      } catch {
        // Ignore
      }
    };

    for (const c of this.synthChainsByTone.values()) c.dispose();
    this.synthChainsByTone.clear();
    safeDisposeNode(this.synthVol);
    safeDisposeNode(this.synthPan);
    this.synthVol = null;
    this.synthPan = null;

    for (const c of this.padChainsByTone.values()) c.dispose();
    this.padChainsByTone.clear();
    safeDisposeNode(this.padFilter);
    safeDisposeNode(this.padVol);
    safeDisposeNode(this.padPan);
    this.padFilter = null;
    this.padVol = null;
    this.padPan = null;

    for (const c of this.arpChainsByTone.values()) c.dispose();
    this.arpChainsByTone.clear();
    safeDisposeNode(this.arpVol);
    safeDisposeNode(this.arpPan);
    this.arpVol = null;
    this.arpPan = null;

    this.isBuilt = false;
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
  }

  public onPlaybackStart(rawCtx: AudioContext): void {
    this.stopActivePreview();
    this.isPlayingLive = true;
    this.activeSynthSectionId = null;
    this.activePadSectionId = null;
    this.activeArpSectionId = null;
    this.arpStepCursor = 0;

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
    beatDurationSec: number;
    effectiveBpm: number;
    sectionId: string;
    sectionBarNumber: number;
    sectionTotalBars: number;
    sectionMultiPad?: SectionMultiPadConfig;
    sectionSynth?: SectionSynthConfig;
    sectionArp?: SectionArpConfig;
  }): void {
    if (!this.settings.masterEnabled || !this.isPlayingLive) {
      return;
    }

    this.ensureToneContext(params.rawCtx);
    this.buildNodes();

    // 1. Per-Section Synth (Blue Dot) with Bar-Range Gating
    const isSynthAllowed =
      !this.settings.synth.muted &&
      isBarInSectionLayerRange(
        params.sectionSynth,
        params.sectionBarNumber,
        params.sectionTotalBars
      );

    if (this.activeSynthSectionId !== null && this.activeSynthSectionId !== params.sectionId) {
      this.releaseAllSynthVoices(params.time);
    }
    this.activeSynthSectionId = params.sectionId;

    if (!isSynthAllowed) {
      this.releaseAllSynthVoices(params.time);
    } else if (params.sectionSynth) {
      const chain = this.getOrCreateSynthChain(params.sectionSynth.tone);
      scheduleSectionSynthPattern(chain.poly, {
        chordStr: params.chordStr,
        semitones: params.semitones,
        time: params.time,
        durationSec: params.durationSec,
        beatDurationSec: params.beatDurationSec,
        pattern: params.sectionSynth.pattern,
        tone: params.sectionSynth.tone,
      });
    }

    // 2. Per-Section Multi-Pad (Green Dot) with Bar-Range Gating
    const isPadAllowed =
      !this.settings.pad.muted &&
      isBarInSectionLayerRange(
        params.sectionMultiPad,
        params.sectionBarNumber,
        params.sectionTotalBars
      );

    if (this.activePadSectionId !== null && this.activePadSectionId !== params.sectionId) {
      this.releaseAllPadVoices(params.time);
    }
    this.activePadSectionId = params.sectionId;

    if (!isPadAllowed) {
      this.releaseAllPadVoices(params.time);
    } else if (params.sectionMultiPad) {
      const chain = this.getOrCreatePadChain(params.sectionMultiPad.tone);
      scheduleSectionPadPattern(chain.poly, {
        chordStr: params.chordStr,
        semitones: params.semitones,
        time: params.time,
        durationSec: params.durationSec,
        beatDurationSec: params.beatDurationSec,
        pattern: params.sectionMultiPad.pattern,
      });
    }

    // 3. Per-Section Arpeggiator (Orange Dot) with Bar-Range Gating
    // Directly scheduled on the Web Audio clock in lockstep with AudioEngine (no Transport/setTimeout race)
    const isArpAllowed =
      !this.settings.arp.muted &&
      isBarInSectionLayerRange(
        params.sectionArp,
        params.sectionBarNumber,
        params.sectionTotalBars
      );

    if (this.activeArpSectionId !== null && this.activeArpSectionId !== params.sectionId) {
      this.releaseAllArpVoices(params.time);
      this.arpStepCursor = 0;
    }
    this.activeArpSectionId = params.sectionId;

    if (!isArpAllowed) {
      this.releaseAllArpVoices(params.time);
      this.arpStepCursor = 0;
    } else if (params.sectionArp) {
      const arpTone = params.sectionArp.tone || DEFAULT_SECTION_ARP.tone;
      const chain = this.getOrCreateArpChain(arpTone);
      this.arpStepCursor = scheduleSectionArpPattern(chain.poly, {
        chordStr: params.chordStr,
        semitones: params.semitones,
        time: params.time,
        durationSec: params.durationSec,
        beatDurationSec: params.beatDurationSec,
        pattern: params.sectionArp.pattern || DEFAULT_SECTION_ARP.pattern,
        tone: arpTone,
        subdivision: params.sectionArp.subdivision || DEFAULT_SECTION_ARP.subdivision || '8n',
        stepOffset: this.arpStepCursor,
      });
    }
  }

  public async previewSectionLayer(options: {
    layer: 'pad' | 'synth' | 'arp';
    tone: PadPresetId | SynthPresetId | ArpPresetId;
    pattern: SectionPadPattern | SectionSynthPattern | ArpPatternType;
    subdivision?: '4n' | '8n' | '8t' | '16n';
    chordStr: string;
    bpm: number;
  }): Promise<void> {
    this.stopActivePreview();

    // Initialize real Context BEFORE calling resume/start (Tone.start() alone on DummyContext is a no-op)
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

    if (options.layer === 'pad') {
      const vol = new Tone.Volume(this.settings.pad.volumeDb);
      const pan = new Tone.Panner(this.settings.pad.pan);
      const chain = createPadChainForPreset(options.tone as PadPresetId);
      chain.output.chain(vol, pan, Tone.getDestination());

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
      chain.output.chain(vol, pan, Tone.getDestination());

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

    // Arp preview: plays exact same arpeggio pattern engine as live & offline playback
    const vol = new Tone.Volume(this.settings.arp.volumeDb);
    const pan = new Tone.Panner(this.settings.arp.pan);
    const toneId = options.tone as ArpPresetId;
    const chain = createArpChainForPreset(toneId);
    chain.output.chain(vol, pan, Tone.getDestination());

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

  public onPlaybackStop(): void {
    this.isPlayingLive = false;
    this.activeSynthSectionId = null;
    this.activePadSectionId = null;
    this.activeArpSectionId = null;
    this.arpStepCursor = 0;

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
  beatDurationSec: number;
  effectiveBpm: number;
  chordStr: string;
  semitones: number;
  sectionId: string;
  sectionBarNumber: number;
  sectionTotalBars: number;
  sectionMultiPad?: SectionMultiPadConfig;
  sectionSynth?: SectionSynthConfig;
  sectionArp?: SectionArpConfig;
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
 * Renders the full project mix (Per-section Synth + Multi-Pad + Arpeggiator + Metronome Click + Voice Cues & Count-in)
 * at 44.1 kHz Stereo using Tone.Offline() with a 1.8s fade-out tail, encoded to 16-bit PCM Stereo WAV.
 */
export async function exportFullProjectMixWav(options: {
  song: Song;
  metronomeSettings: MetronomeSettings;
  synthSettings: SynthBackingSettings;
  onProgress?: (pct: number, stage: string) => void;
}): Promise<{ blob: Blob; filename: string }> {
  const { song, metronomeSettings, synthSettings, onProgress } = options;
  const sampleRate = 44100;
  const timeline = buildSongTimeline(song, {}, null);
  if (!timeline.length) {
    throw new Error('This song has no bars to export.');
  }

  onProgress?.(6, 'Scanning cues & timeline...');

  const neededUrls = new Set<string>();
  const neededCustomIds = new Set<string>();

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

  // 2. Build sample-accurate Beat Schedule + Chord Segments
  let cursorTime = 0.04;
  const beatEvents: OfflineBeatSchedule[] = [];
  const chordSegments: OfflineChordSegment[] = [];

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
            beatDurationSec: beatSec,
            effectiveBpm: bpm,
            chordStr: beatChord,
            semitones: totalTranspose,
            sectionId: step.sectionId,
            sectionBarNumber: step.sectionBarNumber,
            sectionTotalBars: step.sectionTotalBars,
            sectionMultiPad: step.sectionMultiPad,
            sectionSynth: step.sectionSynth,
            sectionArp: step.sectionArp,
          });
        } else if (b === 1) {
          chordSegments.push({
            time: cursorTime,
            durationSec: beatSec * step.beatsPerBar,
            beatDurationSec: beatSec,
            effectiveBpm: bpm,
            chordStr: '-',
            semitones: totalTranspose,
            sectionId: step.sectionId,
            sectionBarNumber: step.sectionBarNumber,
            sectionTotalBars: step.sectionTotalBars,
            sectionMultiPad: step.sectionMultiPad,
            sectionSynth: step.sectionSynth,
            sectionArp: step.sectionArp,
          });
        }
      } else if (b === 1) {
        chordSegments.push({
          time: cursorTime,
          durationSec: beatSec * step.beatsPerBar,
          beatDurationSec: beatSec,
          effectiveBpm: bpm,
          chordStr: step.bar.chord,
          semitones: totalTranspose,
          sectionId: step.sectionId,
          sectionBarNumber: step.sectionBarNumber,
          sectionTotalBars: step.sectionTotalBars,
          sectionMultiPad: step.sectionMultiPad,
          sectionSynth: step.sectionSynth,
          sectionArp: step.sectionArp,
        });
      }

      cursorTime += beatSec;
    }
  }

  const songEndTime = cursorTime;
  const totalRenderDuration = songEndTime + 1.8;

  onProgress?.(45, 'Rendering full stereo mix via Tone.Offline...');

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

      // A. Metronome Click & Voice Cues / Count-in
      for (const ev of beatEvents) {
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

      // B. Per-Section Backing Layers: Tone.js Synth / Multi-Pad / Arpeggiator with Bar-Range Gating
      if (synthSettings.masterEnabled) {
        const synthVol = new Tone.Volume(synthSettings.synth.volumeDb);
        synthVol.mute = synthSettings.synth.muted;
        const synthPan = new Tone.Panner(synthSettings.synth.pan);
        synthVol.chain(synthPan, Tone.getDestination());

        const offlineSynthChains = new Map<SynthPresetId, ToneVoiceChain>();
        const getOfflineSynthChain = (tone: SynthPresetId) => {
          const existing = offlineSynthChains.get(tone);
          if (existing) return existing;
          const chain = createSynthChainForPreset(tone);
          chain.output.connect(synthVol);
          offlineSynthChains.set(tone, chain);
          return chain;
        };

        const padFilter = new Tone.Filter(2600, 'lowpass');
        const padVol = new Tone.Volume(synthSettings.pad.volumeDb);
        padVol.mute = synthSettings.pad.muted;
        const padPan = new Tone.Panner(synthSettings.pad.pan);
        padFilter.chain(padVol, padPan, Tone.getDestination());

        const offlinePadChains = new Map<PadPresetId, ToneVoiceChain>();
        const getOfflinePadChain = (tone: PadPresetId) => {
          const existing = offlinePadChains.get(tone);
          if (existing) return existing;
          const chain = createPadChainForPreset(tone);
          chain.output.connect(padFilter);
          offlinePadChains.set(tone, chain);
          return chain;
        };

        const arpVol = new Tone.Volume(synthSettings.arp.volumeDb);
        arpVol.mute = synthSettings.arp.muted;
        const arpPan = new Tone.Panner(synthSettings.arp.pan);
        arpVol.chain(arpPan, Tone.getDestination());

        const offlineArpChains = new Map<ArpPresetId, ToneVoiceChain>();
        const getOfflineArpChain = (tone: ArpPresetId) => {
          const existing = offlineArpChains.get(tone);
          if (existing) return existing;
          const chain = createArpChainForPreset(tone);
          chain.output.connect(arpVol);
          offlineArpChains.set(tone, chain);
          return chain;
        };

        let lastOfflinePadSectionId: string | null = null;
        let lastOfflineSynthSectionId: string | null = null;
        let lastOfflineArpSectionId: string | null = null;
        let offlineArpStepCursor = 0;

        for (const seg of chordSegments) {
          // 1. Synth with bar-range gate
          const isSynthAllowed =
            !synthSettings.synth.muted &&
            isBarInSectionLayerRange(
              seg.sectionSynth,
              seg.sectionBarNumber,
              seg.sectionTotalBars
            );
          if (lastOfflineSynthSectionId !== null && lastOfflineSynthSectionId !== seg.sectionId) {
            for (const c of offlineSynthChains.values()) c.poly.releaseAll(seg.time);
          }
          lastOfflineSynthSectionId = seg.sectionId;

          if (!isSynthAllowed) {
            for (const c of offlineSynthChains.values()) c.poly.releaseAll(seg.time);
          } else if (seg.sectionSynth) {
            const chain = getOfflineSynthChain(seg.sectionSynth.tone);
            scheduleSectionSynthPattern(chain.poly, {
              chordStr: seg.chordStr,
              semitones: seg.semitones,
              time: seg.time,
              durationSec: seg.durationSec,
              beatDurationSec: seg.beatDurationSec,
              pattern: seg.sectionSynth.pattern,
              tone: seg.sectionSynth.tone,
            });
          }

          // 2. Multi-Pad with bar-range gate
          const isPadAllowed =
            !synthSettings.pad.muted &&
            isBarInSectionLayerRange(
              seg.sectionMultiPad,
              seg.sectionBarNumber,
              seg.sectionTotalBars
            );
          if (lastOfflinePadSectionId !== null && lastOfflinePadSectionId !== seg.sectionId) {
            for (const c of offlinePadChains.values()) c.poly.releaseAll(seg.time);
          }
          lastOfflinePadSectionId = seg.sectionId;

          if (!isPadAllowed) {
            for (const c of offlinePadChains.values()) c.poly.releaseAll(seg.time);
          } else if (seg.sectionMultiPad) {
            const chain = getOfflinePadChain(seg.sectionMultiPad.tone);
            scheduleSectionPadPattern(chain.poly, {
              chordStr: seg.chordStr,
              semitones: seg.semitones,
              time: seg.time,
              durationSec: seg.durationSec,
              beatDurationSec: seg.beatDurationSec,
              pattern: seg.sectionMultiPad.pattern,
            });
          }

          // 3. Arpeggiator with bar-range gate
          const isArpAllowed =
            !synthSettings.arp.muted &&
            isBarInSectionLayerRange(
              seg.sectionArp,
              seg.sectionBarNumber,
              seg.sectionTotalBars
            );
          if (lastOfflineArpSectionId !== null && lastOfflineArpSectionId !== seg.sectionId) {
            for (const c of offlineArpChains.values()) c.poly.releaseAll(seg.time);
            offlineArpStepCursor = 0;
          }
          lastOfflineArpSectionId = seg.sectionId;

          if (!isArpAllowed) {
            for (const c of offlineArpChains.values()) c.poly.releaseAll(seg.time);
            offlineArpStepCursor = 0;
          } else if (seg.sectionArp) {
            const arpTone = seg.sectionArp.tone || DEFAULT_SECTION_ARP.tone;
            const chain = getOfflineArpChain(arpTone);
            offlineArpStepCursor = scheduleSectionArpPattern(chain.poly, {
              chordStr: seg.chordStr,
              semitones: seg.semitones,
              time: seg.time,
              durationSec: seg.durationSec,
              beatDurationSec: seg.beatDurationSec,
              pattern: seg.sectionArp.pattern || DEFAULT_SECTION_ARP.pattern,
              tone: arpTone,
              subdivision:
                seg.sectionArp.subdivision || DEFAULT_SECTION_ARP.subdivision || '8n',
              stepOffset: offlineArpStepCursor,
            });
          }
        }
      } else if (metronomeSettings.chordAudioEnabled && metronomeSettings.chordVolume > 0) {
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

  const wavBlob = encodeAudioBufferToWavBlob(nativeAudioBuffer);
  onProgress?.(100, 'Full mix WAV ready!');

  const slug =
    song.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'chordbook-mix';
  const filename = `${slug}-full-mix-44k1-stereo.wav`;

  return { blob: wavBlob, filename };
}
