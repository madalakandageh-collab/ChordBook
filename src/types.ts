export type TimeSignature = '4/4' | '3/4' | '6/8';

export type BarMeter = '4/4' | '3/4' | '2/4' | '6/8' | '5/4' | '7/8' | '9/8' | '12/8';

export type BeatUnit = 'Quarter' | 'Eighth' | 'Dotted' | 'Triplet';

export type BalanceSide = 'Left' | 'Center' | 'Right';

export type ScreenName =
  | 'sheets'
  | 'song-detail'
  | 'practice-select'
  | 'practice-player'
  | 'live-mode'
  | 'local-wifi'
  | 'member';

export type ExportAudioMixMode = 'click-cues' | 'full-mix';

export interface Bar {
  id: string;
  chord: string; // e.g. 'G', 'Em', 'D7', or '-' for rest/continue
  beatChords?: string[]; // optional per-beat chord splits (length up to beatsPerBar)
  lyrics?: string; // optional bar-level lyric snippet
  meter?: BarMeter; // undefined means follows the song/section
  tempo?: number; // undefined means follows the song/section
  beatUnit?: BeatUnit;
  cue?: string; // e.g. 'Intro', 'Chorus', 'Bridge'
  customCueId?: string; // ID of a user-recorded custom voice cue in IndexedDB
  voiceCountLocked?: boolean;
  countingSystem?: string; // e.g. '1 1 1 1', '1 2 3 1', '1 2 1 2', or custom
  repeat?: number; // default 1
}

export interface CustomVoiceCue {
  id: string;
  name: string;
  mimeType: string;
  source?: 'recorded' | 'imported';
  audioData: ArrayBuffer;
  durationMs: number;
  createdAt: number;
}

export interface SerializedVoiceCue {
  id: string;
  name: string;
  mimeType: string;
  source?: 'recorded' | 'imported';
  audioBase64: string;
  durationMs: number;
  createdAt: number;
}

export type LastBarCuePassRule = 'all' | 'first' | 'last' | number;

export type SectionPadPattern =
  | 'Sustain'
  | 'Pulse'
  | 'Swell'
  | 'Octave Drone'
  | 'Rhythmic Gate';

export type SectionSynthPattern =
  | 'Full Chord'
  | 'Stabs'
  | 'Off-Beat Comp'
  | 'Bass Root Focus';

export type BarRangeMode = 'all' | 'custom';

export interface SectionMultiPadConfig {
  enabled: boolean;
  pattern: SectionPadPattern;
  tone: PadPresetId;
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
}

export interface SectionSynthConfig {
  enabled: boolean;
  pattern: SectionSynthPattern;
  tone: SynthPresetId;
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
}

export interface SectionArpConfig {
  enabled: boolean;
  pattern: ArpPatternType;
  tone: ArpPresetId;
  subdivision?: '8n' | '16n' | '4n' | '8t';
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
}

export interface Section {
  id: string;
  name: string;
  bars: Bar[];
  transpose?: number;
  repeat?: boolean;
  repeatCount?: number; // default 2 when repeat is true
  lastBarCuePassRule?: LastBarCuePassRule; // default 'all'
  isReference?: boolean;
  referenceTargetId?: string;
  multiPad?: SectionMultiPadConfig;
  synth?: SectionSynthConfig;
  arp?: SectionArpConfig;
}

export interface LyricSection {
  id: string;
  label: string;
  lines: string[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  timeSignature: TimeSignature;
  transpose: number;
  sections: Section[];
  lyrics: LyricSection[];
  updatedAt: number;
}

export interface Setlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
}

export interface MetronomeSettings {
  clickVolume: number; // 0-100
  clickBalance: BalanceSide;
  voiceVolume: number; // 0-100
  voiceBalance: BalanceSide;
  chordVolume: number; // 0-100
  chordAudioEnabled: boolean;
  countInBar: boolean;
  subdivision: BeatUnit;
}

export interface RoomSyncState {
  roomId: string;
  song: Song | null;
  transpose: number;
  sectionTransposes: Record<string, number>;
  isPlaying: boolean;
  activeBarIndex: number;
  activeSectionId: string | null;
  speed: 50 | 75 | 100;
  tempoOverride: number | null;
  playStartedAtServerTime: number | null;
  playStartBarIndex: number;
  loopSectionId: string | null;
  updatedAt: number;
}

export interface RoomMemberInfo {
  clientId: string;
  role: 'leader' | 'member';
  deviceName: string;
  joinedAt: number;
}

export interface RoomPresence {
  roomId: string;
  memberCount: number;
  leaderConnected: boolean;
  members: RoomMemberInfo[];
}

export interface TimelineBar {
  globalBarIndex: number; // index into flattened expanded playback
  displayBarNumber: number; // 1-based bar index in song
  sectionId: string;
  sectionName: string;
  sectionBarNumber: number; // 1-based bar index within the section
  sectionTotalBars: number; // total expanded bars in the section
  barId: string;
  bar: Bar;
  repeatIteration: number;
  repeatTotal: number;
  effectiveBpm: number;
  effectiveMeter: BarMeter;
  beatsPerBar: number;
  sectionTranspose: number;
  sectionPass?: number;
  sectionTotalPasses?: number;
  isLastBarOfSection?: boolean;
  lastBarCuePassRule?: LastBarCuePassRule;
  sectionMultiPad?: SectionMultiPadConfig;
  sectionSynth?: SectionSynthConfig;
  sectionArp?: SectionArpConfig;
}

export type SynthPresetId =
  | 'FM Electric Piano'
  | 'Wurli Reed Keys'
  | 'Soft Pluck'
  | 'Mute Nylon Pluck'
  | 'Funk Clavinet'
  | 'Classic Saw Lead'
  | 'Warm Analog Polysynth'
  | 'Brass Synth Stab'
  | 'Detuned Supersaw'
  | 'Retro 80s Poly'
  | 'Crystal Bell'
  | 'Celesta Sparkle'
  | 'Sub Analog Bass'
  | 'Punchy Synth Bass'
  | 'FM Slap Bass'
  | 'Staccato Strings'
  | 'Choir Vox Hit'
  | 'Gated Synth Chop';

export type PadPresetId =
  | 'Warm Analog Pad'
  | 'Velvet Brass Pad'
  | 'Golden Tape Pad'
  | 'Soft Sub Pad'
  | 'Creamy Juno Chorus Pad'
  | 'Lush String Pad'
  | 'Chamber Strings'
  | 'Ethereal Angel Choir'
  | 'Cathedral Boys Choir'
  | 'Cinematic String Swell'
  | 'Deep Space Pad'
  | 'Shimmer Halo Pad'
  | 'Glassy Horizon Texture'
  | 'Rhythmic Gate Pad'
  | 'Trance Sidechain Gate'
  | 'Soft Organ Pad'
  | 'Gospel B3 Swell'
  | 'Harmonium Drone';

export type ArpPresetId =
  | 'Synth Pluck Arp'
  | 'Acoustic Harp Arp'
  | 'Electric Guitar Clean'
  | 'Muted Strat Pluck'
  | 'Warm Kalimbaphone'
  | 'Soft Marimba'
  | 'Vibraphone Bell'
  | 'Music Box Chime'
  | 'FM Tubular Bell'
  | 'Glass Marimba'
  | '8-Bit Retro'
  | 'Acid 303 Saw Arp'
  | 'Trance Supersaw Arp'
  | 'Rhythmic Gate Pulse'
  | 'FM Percussive Zap'
  | 'Driving Bass Arp'
  | 'Pizzicato String Arp'
  | 'Ambient Dew Texture';

export type ArpPatternType = 'up' | 'down' | 'upDown' | 'alternateUp' | 'random';

export interface SynthLayerConfig {
  preset?: SynthPresetId; // legacy optional field; per-section tone lives on Section.synth
  volumeDb: number; // -36 to +6 dB
  pan: number; // -1 to +1
  muted: boolean;
  fillEmptyBars?: boolean; // default false
}

export interface PadLayerConfig {
  preset?: PadPresetId; // legacy optional field; per-section tone lives on Section.multiPad
  volumeDb: number; // -36 to +6 dB
  pan: number; // -1 to +1
  muted: boolean;
  fillEmptyBars?: boolean; // default false
}

export interface ArpLayerConfig {
  preset?: ArpPresetId; // legacy optional field; per-section tone lives on Section.arp
  pattern?: ArpPatternType;
  volumeDb: number; // -36 to +6 dB
  pan: number; // -1 to +1
  muted: boolean;
  fillEmptyBars?: boolean; // default false
}

export interface SynthBackingSettings {
  masterEnabled: boolean;
  synth: SynthLayerConfig;
  pad: PadLayerConfig;
  arp: ArpLayerConfig;
}


