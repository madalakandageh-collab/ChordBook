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

export interface BarRange {
  startBar: number;
  endBar: number;
}

export interface PadLayerEntry {
  id: string;
  enabled: boolean;
  pattern: SectionPadPattern;
  tone: PadPresetId;
  volumeDb?: number; // -24 to +6 dB, default 0
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
  barRanges?: BarRange[];
}

export interface SectionMultiPadConfig {
  enabled: boolean;
  pattern: SectionPadPattern;
  tone: PadPresetId;
  volumeDb?: number;
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
  barRanges?: BarRange[];
  layers?: PadLayerEntry[];
}

export interface SynthLayerEntry {
  id: string;
  enabled: boolean;
  pattern: SectionSynthPattern;
  tone: SynthPresetId;
  volumeDb?: number; // -24 to +6 dB, default 0
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
  barRanges?: BarRange[];
}

export interface SectionSynthConfig {
  enabled: boolean;
  pattern: SectionSynthPattern;
  tone: SynthPresetId;
  volumeDb?: number;
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
  barRanges?: BarRange[];
  layers?: SynthLayerEntry[];
}

export interface ArpLayerEntry {
  id: string;
  enabled: boolean;
  pattern: ArpPatternType;
  tone: ArpPresetId;
  subdivision?: '8n' | '16n' | '4n' | '8t';
  volumeDb?: number; // -24 to +6 dB, default 0
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
  barRanges?: BarRange[];
}

export interface SectionArpConfig {
  enabled: boolean;
  pattern: ArpPatternType;
  tone: ArpPresetId;
  subdivision?: '8n' | '16n' | '4n' | '8t';
  volumeDb?: number;
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
  barRanges?: BarRange[];
  layers?: ArpLayerEntry[];
}

export type DrumKitId =
  | 'Acoustic Pop Kit'
  | 'Modern Studio Kit'
  | '808 Electronic Kit'
  | 'Vintage Analog Drum Machine'
  | 'Baila / Sri Lankan Percussion Kit'
  | 'Soft Brush / Ballad Kit';

export type DrumPatternId =
  | 'Straight 8th Pop'
  | 'Driving 16th Rock'
  | 'Half-Time Ballad'
  | 'Upbeat Disco / Funk'
  | '6/8 Baila Groove'
  | '6/8 Dadra / Folk'
  | '4/4 Sinhala Pop / Calypso'
  | 'Tabla-Groove Fusion'
  | 'Four-on-the-Floor Dance'
  | 'Reggaeton / Dembow'
  | 'Lo-Fi Chill Beat'
  | 'Verse Groove'
  | 'Chorus Groove';

export type DrumFillFrequency = 'none' | 'every4' | 'every8' | 'last1' | 'last2';

export type DrumFillStyle =
  | 'Snare Roll Build-up'
  | 'Tom Fill Cascade'
  | 'Stop-Time Silence Break'
  | 'Crash & Kick Accent'
  | 'Baila Percussion Roll';

export interface DrumLayerEntry {
  id: string;
  enabled: boolean;
  kit: DrumKitId;
  pattern: DrumPatternId;
  volumeDb?: number; // -24 to +6 dB, default 0
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
  barRanges?: BarRange[];
  fillFrequency?: DrumFillFrequency;
  customFillBars?: number[];
  fillStyle?: DrumFillStyle;
}

export interface SectionDrumsConfig {
  enabled: boolean; // Section-level Master Drums ON/OFF switch (defaults false)
  kit?: DrumKitId;
  pattern?: DrumPatternId;
  volumeDb?: number;
  barRangeMode?: BarRangeMode;
  startBar?: number;
  endBar?: number;
  barRanges?: BarRange[];
  fillFrequency?: DrumFillFrequency;
  customFillBars?: number[];
  fillStyle?: DrumFillStyle;
  layers?: DrumLayerEntry[];
}

export type FxCategory =
  | 'Risers & Sweeps'
  | 'Reverse & Swells'
  | 'Impacts & Drops'
  | 'Atmosphere / Textures';

export type FxTypeId =
  | 'White Noise Riser'
  | 'Pink Noise Sweep'
  | 'Pitch-Up Synth Riser'
  | 'Filtered Sawtooth Sweep'
  | 'Tension Drone Riser'
  | 'Snare/Percussion Roll Riser'
  | 'Reverse Cymbal'
  | 'Reverse Reverb Swell'
  | 'Ambient Pad Swell'
  | 'Sub Swell'
  | 'Sub Bass Drop'
  | 'Boom/Cinematic Impact'
  | 'Crash/Noise Hit'
  | 'Downlifter / Tape Stop Effect'
  | 'Vinyl Crackle'
  | 'Subtle Wind/Air Texture';

export interface FxLayerEntry {
  id: string;
  enabled: boolean;
  effectType: FxTypeId;
  startBar: number; // 1-based bar inside section
  startBeat: number; // 1-based beat inside that bar
  durationBars: number; // e.g. 0.5, 1, 2, 4, 8
  volumeDb: number; // -24 to +6 dB
}

export interface SectionFxConfig {
  enabled: boolean;
  effects: FxLayerEntry[];
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
  drums?: SectionDrumsConfig;
  fx?: SectionFxConfig;
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
  sectionDrums?: SectionDrumsConfig;
  sectionFx?: SectionFxConfig;
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

export interface DrumBusConfig {
  enabled: boolean; // Global Master Drums ON/OFF switch
  volumeDb: number; // -36 to +6 dB
  pan: number; // -1 to +1
  muted: boolean;
}

export interface FxBusConfig {
  enabled: boolean; // Global Master FX / Risers ON/OFF switch
  volumeDb: number; // -36 to +6 dB
  pan: number; // -1 to +1
  muted: boolean;
}

export interface SynthBackingSettings {
  masterEnabled: boolean;
  showTrackDetailsInSections?: boolean;
  synth: SynthLayerConfig;
  pad: PadLayerConfig;
  arp: ArpLayerConfig;
  drums: DrumBusConfig;
  fx: FxBusConfig;
}

export type AudioExportFormat = 'wav' | 'mp3';

export interface WavExportTrackSelection {
  multiPad: boolean;
  synth: boolean;
  arp: boolean;
  drums: boolean;
  fx: boolean;
  click: boolean;
  voiceCues: boolean;
}

export type ExportAudioTrackSelection = WavExportTrackSelection;

