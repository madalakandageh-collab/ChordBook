import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChordbookAudioEngine } from './audio/AudioEngine';
import {
  loadSynthBackingSettings,
  saveSynthBackingSettings,
  ToneSynthBackingEngine,
} from './audio/synthEngine';
import { BarEditorModal, type BarEditorMode } from './components/BarEditorModal';
import { ChordSheetScreen } from './components/ChordSheetScreen';
import { ExportAudioModal } from './components/ExportAudioModal';
import { LiveModeScreen } from './components/LiveModeScreen';
import { LocalWifiScreen } from './components/LocalWifiScreen';
import { MetronomeModal } from './components/MetronomeModal';
import { NavDrawer } from './components/NavDrawer';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PersistentPlayBar } from './components/PersistentPlayBar';
import { PracticePlayerScreen, PracticeSelectScreen } from './components/PracticeScreens';
import {
  DEFAULT_SECTION_ARP,
  DEFAULT_SECTION_MULTI_PAD,
  DEFAULT_SECTION_SYNTH,
} from './audio/synthEngine';
import { SectionLayerModal, type SectionLayerType } from './components/SectionMultiPadModal';
import { SheetsHomeScreen, type ImportedJsonPayload } from './components/SheetsHomeScreen';
import { SimpleMemberView } from './components/SimpleMemberView';
import { TopBar } from './components/TopBar';
import { INITIAL_SETLISTS, INITIAL_SONGS } from './data/initialSongs';
import { useMediaSession } from './hooks/useMediaSession';
import { useRoomSync } from './hooks/useRoomSync';
import { useWakeLock } from './hooks/useWakeLock';
import type {
  Bar,
  LastBarCuePassRule,
  LyricSection,
  MetronomeSettings,
  RoomSyncState,
  ScreenName,
  SectionArpConfig,
  SectionMultiPadConfig,
  SectionSynthConfig,
  Setlist,
  Song,
  SynthBackingSettings,
  TimeSignature,
} from './types';
import {
  buildSongTimeline,
  createEmptyBar,
  getGlobalDisplayBarNumber,
  normalizeSong,
  normalizeSongsList,
} from './utils/chords';
import {
  exportCustomVoiceCuesAsBase64,
  importCustomVoiceCuesFromBase64,
} from './utils/voiceCues';
import {
  LEADER_THEME_KEY,
  applyDocumentTheme,
  loadThemePreference,
  saveThemePreference,
  type ThemeMode,
} from './utils/theme';

const STORAGE_KEYS = {
  songs: 'chordbook_songs_v1',
  setlists: 'chordbook_setlists_v1',
  settings: 'chordbook_metronome_v1',
  roomId: 'chordbook_room_id_v1',
  activeSongId: 'chordbook_active_song_id_v1',
};

const DEFAULT_SETTINGS: MetronomeSettings = {
  clickVolume: 70,
  clickBalance: 'Center',
  voiceVolume: 100,
  voiceBalance: 'Center',
  chordVolume: 70,
  chordAudioEnabled: true,
  countInBar: false,
  subdivision: 'Quarter',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const urlMode = urlParams.get('mode');
  const urlRoom = urlParams.get('room');
  const isDedicatedMemberUrl = urlMode === 'member';

  const [songs, setSongs] = useState<Song[]>(() =>
    normalizeSongsList(
      loadFromStorage<unknown>(STORAGE_KEYS.songs, INITIAL_SONGS),
      INITIAL_SONGS
    )
  );
  const [setlists, setSetlists] = useState<Setlist[]>(() =>
    loadFromStorage<Setlist[]>(STORAGE_KEYS.setlists, INITIAL_SETLISTS)
  );
  const [settings, setSettings] = useState<MetronomeSettings>(() =>
    loadFromStorage<MetronomeSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );
  const [synthSettings, setSynthSettings] = useState<SynthBackingSettings>(() =>
    loadSynthBackingSettings()
  );
  const [roomId, setRoomId] = useState<string>(() =>
    (urlRoom || loadFromStorage<string>(STORAGE_KEYS.roomId, '4829')).toUpperCase()
  );
  const [activeSongId, setActiveSongId] = useState<string>(() =>
    loadFromStorage<string>(STORAGE_KEYS.activeSongId, INITIAL_SONGS[0].id)
  );

  const [screen, setScreen] = useState<ScreenName>(
    isDedicatedMemberUrl ? 'member' : 'sheets'
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [leaderTheme, setLeaderTheme] = useState<ThemeMode>(() =>
    loadThemePreference(LEADER_THEME_KEY)
  );

  // Playback & Practice state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCountIn, setIsCountIn] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [speed, setSpeed] = useState<50 | 75 | 100>(100);
  const [loopSectionId, setLoopSectionId] = useState<string | null>(null);
  const [sectionTransposes, setSectionTransposes] = useState<Record<string, number>>({});
  const [playStartedAtServerTime, setPlayStartedAtServerTime] = useState<number | null>(null);
  const [playStartBarIndex, setPlayStartBarIndex] = useState(0);

  // Modals
  const [editingBarTarget, setEditingBarTarget] = useState<{
    sectionId: string;
    barId: string;
  } | null>(null);
  const [barEditorMode, setBarEditorMode] = useState<BarEditorMode>('chords');
  const [showMetronomeModal, setShowMetronomeModal] = useState(false);
  const [showExportAudioModal, setShowExportAudioModal] = useState(false);
  const [cueLibraryVersion, setCueLibraryVersion] = useState(0);
  const [sectionLayerModal, setSectionLayerModal] = useState<{
    sectionId: string;
    layer: SectionLayerType;
  } | null>(null);

  // Member synced state (used when role === 'member' or Preview Member App)
  const [remoteMemberState, setRemoteMemberState] = useState<RoomSyncState | null>(null);

  const activeSong = useMemo(
    () => songs.find((s) => s.id === activeSongId) || songs[0] || INITIAL_SONGS[0],
    [songs, activeSongId]
  );

  const timeline = useMemo(
    () => buildSongTimeline(activeSong, sectionTransposes, loopSectionId),
    [activeSong, sectionTransposes, loopSectionId]
  );

  const currentStep = timeline[Math.max(0, Math.min(activeStepIndex, Math.max(0, timeline.length - 1)))];

  // Configure Member PWA Manifest ("Chordbook Stage") if booted in ?mode=member
  useEffect(() => {
    if (!isDedicatedMemberUrl) return;
    document.title = 'Chordbook Stage';
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.setAttribute('content', 'Chordbook Stage');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', '#121212');
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute(
        'href',
        `/manifest-member.webmanifest?room=${encodeURIComponent(roomId)}`
      );
    }
  }, [isDedicatedMemberUrl, roomId]);

  // Persist to localStorage (Offline-first)
  useEffect(() => {
    if (isDedicatedMemberUrl) return;
    try {
      localStorage.setItem(STORAGE_KEYS.songs, JSON.stringify(songs));
    } catch {
      // Storage quota full
    }
  }, [songs, isDedicatedMemberUrl]);

  useEffect(() => {
    if (isDedicatedMemberUrl) return;
    try {
      localStorage.setItem(STORAGE_KEYS.setlists, JSON.stringify(setlists));
    } catch {
      // Ignore
    }
  }, [setlists, isDedicatedMemberUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  useEffect(() => {
    saveSynthBackingSettings(synthSettings);
  }, [synthSettings]);

  useEffect(() => {
    if (isDedicatedMemberUrl) return;
    try {
      localStorage.setItem(STORAGE_KEYS.roomId, JSON.stringify(roomId));
      localStorage.setItem(STORAGE_KEYS.activeSongId, JSON.stringify(activeSongId));
    } catch {
      // Ignore
    }
  }, [roomId, activeSongId, isDedicatedMemberUrl]);

  // Real-time Sync Engine
  const isMemberRole = isDedicatedMemberUrl || screen === 'member';

  // Persist & apply Band Leader theme whenever Leader UI is active
  useEffect(() => {
    if (isMemberRole) return;
    saveThemePreference(LEADER_THEME_KEY, leaderTheme);
    applyDocumentTheme(leaderTheme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', '#6E7BF2');
    }
  }, [leaderTheme, isMemberRole]);
  const {
    status: syncStatus,
    presence,
    rttMs,
    clockOffsetMs,
    sendState,
  } = useRoomSync({
    roomId,
    role: isMemberRole ? 'member' : 'leader',
    onRemoteState: useCallback((state: RoomSyncState) => {
      setRemoteMemberState(
        state.song ? { ...state, song: normalizeSong(state.song) } : state
      );
    }, []),
  });

  // Broadcast Leader state whenever song/playback/transpose changes
  useEffect(() => {
    if (isMemberRole || !activeSong) return;
    const leaderSyncState: RoomSyncState = {
      roomId,
      song: activeSong,
      transpose: activeSong.transpose || 0,
      sectionTransposes,
      isPlaying,
      activeBarIndex: activeStepIndex,
      activeSectionId: currentStep?.sectionId || activeSong.sections[0]?.id || null,
      speed,
      tempoOverride: null,
      playStartedAtServerTime,
      playStartBarIndex,
      loopSectionId,
      updatedAt: Date.now(),
    };
    sendState(leaderSyncState);
  }, [
    isMemberRole,
    roomId,
    activeSong,
    sectionTransposes,
    isPlaying,
    activeStepIndex,
    currentStep?.sectionId,
    speed,
    playStartedAtServerTime,
    playStartBarIndex,
    loopSectionId,
    sendState,
  ]);

  // Web Audio & Tone Synth Engines
  const audioEngineRef = useRef<ChordbookAudioEngine | null>(null);
  const synthEngineRef = useRef<ToneSynthBackingEngine | null>(null);

  if (!synthEngineRef.current) {
    synthEngineRef.current = new ToneSynthBackingEngine(synthSettings);
  }

  if (!audioEngineRef.current) {
    audioEngineRef.current = new ChordbookAudioEngine(settings, {
      onBarChange: (stepIndex, _displayBarNumber, _sectionId, beat, countIn) => {
        setActiveStepIndex(stepIndex);
        setCurrentBeat(beat);
        setIsCountIn(countIn);
      },
      onBeat: (beat, _totalBeats, countIn) => {
        setCurrentBeat(beat);
        setIsCountIn(countIn);
      },
      onStop: () => {
        synthEngineRef.current?.onPlaybackStop();
        setIsPlaying(false);
        setIsCountIn(false);
        setActiveStepIndex(0);
        setCurrentBeat(1);
        setPlayStartBarIndex(0);
        setPlayStartedAtServerTime(null);
      },
      onPlaybackStart: (rawCtx) => {
        synthEngineRef.current?.onPlaybackStart(rawCtx);
      },
      onChordSchedule: (ev) => {
        synthEngineRef.current?.scheduleChord(ev);
      },
    });
  }

  useEffect(() => {
    audioEngineRef.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    synthEngineRef.current?.updateSettings(synthSettings);
  }, [synthSettings]);

  useEffect(() => {
    audioEngineRef.current?.updateLiveParams({
      speedPercent: speed,
      globalTranspose: activeSong?.transpose || 0,
      timeline,
      loopEnabled: screen === 'practice-player' || loopSectionId !== null,
      suppressBasicChord: synthSettings.masterEnabled,
    });
  }, [speed, activeSong?.transpose, timeline, screen, loopSectionId, synthSettings.masterEnabled]);

  useEffect(() => {
    return () => {
      synthEngineRef.current?.destroy();
      audioEngineRef.current?.destroy();
    };
  }, []);

  const startPlaybackFromIndex = useCallback(
    (startIndex: number, skipCountIn = false) => {
      if (!timeline.length) return;
      const safeStart = Math.max(0, Math.min(startIndex, timeline.length - 1));
      setActiveStepIndex(safeStart);
      setCurrentBeat(1);
      setPlayStartBarIndex(safeStart);
      setPlayStartedAtServerTime(Date.now() + clockOffsetMs);
      setIsPlaying(true);
      audioEngineRef.current?.start({
        timeline,
        startIndex: safeStart,
        speedPercent: speed,
        globalTranspose: activeSong.transpose || 0,
        tempoOverride: null,
        loopEnabled: screen === 'practice-player' || loopSectionId !== null,
        skipCountIn,
      });
    },
    [timeline, clockOffsetMs, speed, activeSong.transpose, screen, loopSectionId]
  );

  const stopPlayback = useCallback(() => {
    synthEngineRef.current?.onPlaybackStop();
    audioEngineRef.current?.stop(false);
    setIsPlaying(false);
    setIsCountIn(false);
    setActiveStepIndex(0);
    setCurrentBeat(1);
    setPlayStartBarIndex(0);
    setPlayStartedAtServerTime(null);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlaybackFromIndex(0);
    }
  }, [isPlaying, stopPlayback, startPlaybackFromIndex]);

  // Keep Screen Wake Lock active while playing (manual hardware screen lock still keeps audio playing)
  useWakeLock(isPlaying && !isMemberRole);

  // Lock-screen & media notification controls via Media Session API
  useMediaSession({
    isPlaying: isPlaying && !isMemberRole,
    song: !isMemberRole ? activeSong : null,
    onPlay: useCallback(() => {
      if (!isPlaying) startPlaybackFromIndex(0);
    }, [isPlaying, startPlaybackFromIndex]),
    onStop: stopPlayback,
  });

  // Song Update Helper
  const updateActiveSong = useCallback(
    (updater: (song: Song) => Song) => {
      setSongs((prev) =>
        prev.map((s) => (s.id === activeSong.id ? { ...updater(s), updatedAt: Date.now() } : s))
      );
      setHasUnsavedChanges(true);
    },
    [activeSong.id]
  );

  const handleSelectSong = useCallback(
    (songId: string, targetScreen: ScreenName = 'song-detail') => {
      stopPlayback();
      setActiveSongId(songId);
      setActiveStepIndex(0);
      setLoopSectionId(null);
      setSectionTransposes({});
      setHasUnsavedChanges(false);
      setScreen(targetScreen);
    },
    [stopPlayback]
  );

  const handleSaveSong = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.songs, JSON.stringify(songs));
    } catch {
      // Ignore
    }
    setHasUnsavedChanges(false);
  }, [songs]);

  const downloadJsonFile = (payload: unknown, filename: string) => {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportLightweightJson = useCallback(() => {
    downloadJsonFile(
      { songs, setlists },
      `chordbook-sheets-${new Date().toISOString().slice(0, 10)}.json`
    );
  }, [songs, setlists]);

  const handleExportFullBackupJson = useCallback(async () => {
    const customVoiceCues = await exportCustomVoiceCuesAsBase64();
    downloadJsonFile(
      { songs, setlists, customVoiceCues },
      `chordbook-full-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
  }, [songs, setlists]);

  const handleExportSetlistJson = useCallback(
    (setlistId: string) => {
      const target = setlists.find((sl) => sl.id === setlistId);
      if (!target) return;
      const setlistSongs = target.songIds
        .map((id) => songs.find((s) => s.id === id))
        .filter((s): s is Song => Boolean(s));
      const slug =
        target.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'setlist';
      downloadJsonFile({ setlist: target, songs: setlistSongs }, `${slug}-setlist.json`);
    },
    [setlists, songs]
  );

  const handleImportJson = useCallback(
    async (data: ImportedJsonPayload) => {
      const songIdMap = new Map<string, string>();

      if (data.songs && Array.isArray(data.songs)) {
        const mergedSongs = [...songs];
        for (const raw of data.songs) {
          if (!raw || !raw.title) continue;
          const incomingId =
            raw.id ||
            `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          const normalizedTitle = raw.title.trim().toLowerCase();

          const matchIdx = mergedSongs.findIndex(
            (x) => x.id === incomingId || x.title.trim().toLowerCase() === normalizedTitle
          );

          const normalizedSong = normalizeSong({
            ...raw,
            id: matchIdx >= 0 ? mergedSongs[matchIdx].id : incomingId,
            title: raw.title.trim(),
            updatedAt: Date.now(),
          });

          songIdMap.set(incomingId, normalizedSong.id);
          if (matchIdx >= 0) {
            mergedSongs[matchIdx] = normalizedSong;
          } else {
            mergedSongs.push(normalizedSong);
          }
        }
        setSongs(mergedSongs);
      }

      const incomingSetlists: Setlist[] = [];
      if (data.setlists && Array.isArray(data.setlists)) {
        incomingSetlists.push(...data.setlists);
      }
      if (data.setlist && typeof data.setlist === 'object') {
        incomingSetlists.push(data.setlist);
      }

      if (incomingSetlists.length > 0) {
        setSetlists((prev) => {
          const merged = [...prev];
          for (const sl of incomingSetlists) {
            if (!sl || !sl.name) continue;
            const incomingSlId = sl.id || `setlist-${Date.now().toString(36)}`;
            const normalizedName = sl.name.trim().toLowerCase();
            const remappedSongIds = Array.from(
              new Set((sl.songIds || []).map((id) => songIdMap.get(id) || id))
            );

            const matchIdx = merged.findIndex(
              (x) => x.id === incomingSlId || x.name.trim().toLowerCase() === normalizedName
            );

            if (matchIdx >= 0) {
              const existing = merged[matchIdx];
              const combinedIds = Array.from(new Set([...existing.songIds, ...remappedSongIds]));
              merged[matchIdx] = { ...existing, songIds: combinedIds };
            } else {
              merged.push({
                id: incomingSlId,
                name: sl.name.trim(),
                songIds: remappedSongIds,
                createdAt: sl.createdAt || Date.now(),
              });
            }
          }
          return merged;
        });
      }

      if (data.customVoiceCues && Array.isArray(data.customVoiceCues)) {
        await importCustomVoiceCuesFromBase64(data.customVoiceCues);
        for (const cue of data.customVoiceCues) {
          if (cue?.id) audioEngineRef.current?.invalidateCustomCueCache(cue.id);
        }
        setCueLibraryVersion((v) => v + 1);
      }
    },
    [songs]
  );

  // Dedicated Member Mode or Preview Member App
  if (isDedicatedMemberUrl || screen === 'member') {
    const previewSyncedState: RoomSyncState =
      remoteMemberState || {
        roomId,
        song: activeSong,
        transpose: activeSong.transpose || 0,
        sectionTransposes,
        isPlaying,
        activeBarIndex: activeStepIndex,
        activeSectionId: currentStep?.sectionId || null,
        speed,
        tempoOverride: null,
        playStartedAtServerTime,
        playStartBarIndex,
        loopSectionId,
        updatedAt: Date.now(),
      };

    return (
      <SimpleMemberView
        roomId={roomId}
        syncStatus={isDedicatedMemberUrl ? syncStatus : 'connected'}
        syncedState={isDedicatedMemberUrl ? remoteMemberState : previewSyncedState}
        fallbackSong={activeSong}
        clockOffsetMs={clockOffsetMs}
        isPreview={!isDedicatedMemberUrl}
        onExitPreview={() => setScreen('local-wifi')}
      />
    );
  }

  // Locate editing bar for BarEditorModal
  const editingSection = editingBarTarget
    ? activeSong.sections.find((s) => s.id === editingBarTarget.sectionId)
    : null;
  const editingBar = editingSection
    ? editingSection.bars.find((b) => b.id === editingBarTarget?.barId)
    : null;
  const editingBarNumber =
    editingBarTarget && editingBar
      ? getGlobalDisplayBarNumber(activeSong, editingBarTarget.sectionId, editingBarTarget.barId)
      : 1;

  const showTopBlueBar = screen !== 'practice-player';

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors">
      {showTopBlueBar && (
        <TopBar
          onOpenMenu={() => setIsDrawerOpen(true)}
          isLocked={isLocked}
          onToggleLock={() => setIsLocked((v) => !v)}
          theme={leaderTheme}
          onToggleTheme={() =>
            setLeaderTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
          }
        />
      )}

      <OfflineIndicator />

      <NavDrawer
        isOpen={isDrawerOpen}
        activeScreen={screen}
        memberCount={presence.memberCount}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={(nextScreen) => {
          setScreen(nextScreen);
        }}
      />

      {screen === 'sheets' && (
        <SheetsHomeScreen
          songs={songs}
          setlists={setlists}
          isLocked={isLocked}
          onSelectSong={(id) => handleSelectSong(id, 'song-detail')}
          onCreateSong={(song) => {
            setSongs((prev) => [song, ...prev]);
            setActiveSongId(song.id);
            setScreen('song-detail');
          }}
          onCreateSetlist={(name) => {
            setSetlists((prev) => [
              ...prev,
              {
                id: `setlist-${Date.now().toString(36)}`,
                name,
                songIds: [],
                createdAt: Date.now(),
              },
            ]);
          }}
          onDeleteSetlist={(setlistId) => {
            setSetlists((prev) => prev.filter((sl) => sl.id !== setlistId));
          }}
          onAddSongToSetlist={(setlistId, songId) => {
            setSetlists((prev) =>
              prev.map((sl) =>
                sl.id === setlistId && !sl.songIds.includes(songId)
                  ? { ...sl, songIds: [...sl.songIds, songId] }
                  : sl
              )
            );
          }}
          onRemoveSongFromSetlist={(setlistId, songId) => {
            setSetlists((prev) =>
              prev.map((sl) =>
                sl.id === setlistId
                  ? { ...sl, songIds: sl.songIds.filter((id) => id !== songId) }
                  : sl
              )
            );
          }}
          onPlaySongFromSetlist={(songId) => {
            handleSelectSong(songId, 'song-detail');
          }}
          onImportJson={handleImportJson}
          onExportLightweightJson={handleExportLightweightJson}
          onExportFullBackupJson={handleExportFullBackupJson}
          onExportSetlistJson={handleExportSetlistJson}
        />
      )}

      {screen === 'song-detail' && activeSong && (
        <ChordSheetScreen
          song={activeSong}
          isLocked={isLocked}
          hasUnsavedChanges={hasUnsavedChanges}
          isPlaying={isPlaying}
          activeBarId={currentStep?.barId || null}
          activeSectionId={currentStep?.sectionId || null}
          activeDisplayBarNumber={currentStep?.displayBarNumber || null}
          barEditorMode={barEditorMode}
          onChangeBarEditorMode={setBarEditorMode}
          onBack={() => setScreen('sheets')}
          onSaveSong={handleSaveSong}
          onOpenExportAudio={() => setShowExportAudioModal(true)}
          onTransposeChange={(delta) =>
            updateActiveSong((s) => ({
              ...s,
              transpose: Math.max(-11, Math.min(11, (s.transpose || 0) + delta)),
            }))
          }
          onTimeSignatureChange={(ts: TimeSignature) =>
            updateActiveSong((s) => ({ ...s, timeSignature: ts }))
          }
          onOpenBarEditor={(sectionId, barId) => {
            if (isLocked) return;
            setEditingBarTarget({ sectionId, barId });
          }}
          onAddBarToSection={(sectionId) => {
            if (isLocked) return;
            updateActiveSong((s) => ({
              ...s,
              sections: s.sections.map((sec) =>
                sec.id === sectionId
                  ? { ...sec, bars: [...sec.bars, createEmptyBar('-')] }
                  : sec
              ),
            }));
          }}
          onPlaySection={(sectionId) => {
            const idx = timeline.findIndex((step) => step.sectionId === sectionId);
            startPlaybackFromIndex(idx >= 0 ? idx : 0, true);
          }}
          onAddSection={(name) => {
            if (isLocked) return;
            updateActiveSong((s) => ({
              ...s,
              sections: [
                ...s.sections,
                {
                  id: `sec-${Date.now().toString(36)}`,
                  name,
                  bars: [
                    createEmptyBar('-'),
                    createEmptyBar('-'),
                    createEmptyBar('-'),
                    createEmptyBar('-'),
                  ],
                },
              ],
            }));
          }}
          onRenameSection={(sectionId, newName) => {
            if (isLocked) return;
            updateActiveSong((s) => ({
              ...s,
              sections: s.sections.map((sec) =>
                sec.id === sectionId ? { ...sec, name: newName } : sec
              ),
            }));
          }}
          onDeleteSection={(sectionId) => {
            if (isLocked) return;
            updateActiveSong((s) => ({
              ...s,
              sections: s.sections.filter((sec) => sec.id !== sectionId),
            }));
          }}
          onUpdateSectionRepeat={(sectionId, patch) => {
            if (isLocked) return;
            updateActiveSong((s) => ({
              ...s,
              sections: s.sections.map((sec) =>
                sec.id === sectionId ? { ...sec, ...patch } : sec
              ),
            }));
          }}
          onMoveSection={(index, direction) => {
            if (isLocked) return;
            updateActiveSong((s) => {
              const targetIdx = index + direction;
              if (targetIdx < 0 || targetIdx >= s.sections.length) return s;
              const next = [...s.sections];
              const [moved] = next.splice(index, 1);
              next.splice(targetIdx, 0, moved);
              return { ...s, sections: next };
            });
          }}
          onDuplicateSection={(sectionId) => {
            if (isLocked) return;
            updateActiveSong((s) => {
              const idx = s.sections.findIndex((sec) => sec.id === sectionId);
              if (idx < 0) return s;
              const src = s.sections[idx];
              const uid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
              const clone = {
                ...src,
                id: `sec-${uid}`,
                bars: src.bars.map((b, bIdx) => ({
                  ...b,
                  id: `bar-${uid}-${bIdx}`,
                  beatChords: b.beatChords ? [...b.beatChords] : undefined,
                })),
              };
              const next = [...s.sections];
              next.splice(idx + 1, 0, clone);
              return { ...s, sections: next };
            });
          }}
          onCopyReferenceSection={(sectionId) => {
            if (isLocked) return;
            updateActiveSong((s) => {
              const idx = s.sections.findIndex((sec) => sec.id === sectionId);
              if (idx < 0) return s;
              const src = s.sections[idx];
              const uid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
              const refBlock = {
                id: `sec-ref-${uid}`,
                name: src.name,
                bars: [],
                isReference: true,
                referenceTargetId: src.referenceTargetId || src.id,
              };
              const next = [...s.sections];
              next.splice(idx + 1, 0, refBlock);
              return { ...s, sections: next };
            });
          }}
          onExportSongProject={() => {
            const slug =
              activeSong.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') || 'chordbook-project';
            downloadJsonFile({ songs: [activeSong], setlists: [] }, `${slug}-project.json`);
          }}
          onUpdateSongMeta={(title, artist, key) => {
            if (isLocked) return;
            updateActiveSong((s) => ({ ...s, title, artist, key }));
          }}
          onUpdateLyrics={(lyrics: LyricSection[]) => {
            if (isLocked) return;
            updateActiveSong((s) => ({ ...s, lyrics }));
          }}
          onDeleteSong={() => {
            if (isLocked) return;
            stopPlayback();
            setSongs((prev) => {
              const next = prev.filter((s) => s.id !== activeSong.id);
              if (next.length > 0) setActiveSongId(next[0].id);
              return next;
            });
            setScreen('sheets');
          }}
          metronomeSettings={settings}
          synthSettings={synthSettings}
          onUpdateSynthSettings={setSynthSettings}
          onSeekToBarId={(sectionId, barId) => {
            const idx = timeline.findIndex(
              (step) => step.sectionId === sectionId && step.barId === barId
            );
            startPlaybackFromIndex(idx >= 0 ? idx : 0, true);
          }}
          onOpenSectionLayer={(sectionId, layer) =>
            setSectionLayerModal({ sectionId, layer })
          }
        />
      )}

      {screen === 'practice-select' && (
        <PracticeSelectScreen
          songs={songs}
          onBack={() => setScreen('sheets')}
          onSelectSong={(id) => handleSelectSong(id, 'practice-player')}
        />
      )}

      {screen === 'practice-player' && activeSong && (
        <PracticePlayerScreen
          song={activeSong}
          timeline={timeline}
          activeStepIndex={activeStepIndex}
          currentBeat={currentBeat}
          isPlaying={isPlaying}
          isLocked={isLocked}
          speed={speed}
          loopSectionId={loopSectionId}
          sectionTransposes={sectionTransposes}
          onBack={() => {
            setLoopSectionId(null);
            setSpeed(100);
            setScreen('practice-select');
          }}
          onToggleLock={() => setIsLocked((v) => !v)}
          onTransposeAll={(delta) =>
            updateActiveSong((s) => ({
              ...s,
              transpose: Math.max(-11, Math.min(11, (s.transpose || 0) + delta)),
            }))
          }
          onSpeedChange={(nextSpeed) => setSpeed(nextSpeed)}
          onLoopSectionChange={(secId) => {
            setLoopSectionId(secId);
            setActiveStepIndex(0);
            if (isPlaying) {
              const nextTimeline = buildSongTimeline(activeSong, sectionTransposes, secId);
              audioEngineRef.current?.start({
                timeline: nextTimeline,
                startIndex: 0,
                speedPercent: speed,
                globalTranspose: activeSong.transpose || 0,
                tempoOverride: null,
                loopEnabled: true,
                skipCountIn: true,
              });
            }
          }}
          onSectionTransposeChange={(secId, delta) => {
            setSectionTransposes((prev) => ({
              ...prev,
              [secId]: Math.max(-11, Math.min(11, (prev[secId] ?? 0) + delta)),
            }));
          }}
          onSeekToBarIndex={(idx) => {
            if (isPlaying) {
              startPlaybackFromIndex(idx, true);
            } else {
              setActiveStepIndex(idx);
            }
          }}
          onOpenSectionLayer={(sectionId, layer) =>
            setSectionLayerModal({ sectionId, layer })
          }
        />
      )}

      {screen === 'live-mode' && activeSong && (
        <LiveModeScreen
          songs={songs}
          activeSong={activeSong}
          timeline={timeline}
          activeStepIndex={activeStepIndex}
          currentBeat={currentBeat}
          isPlaying={isPlaying}
          isLocked={isLocked}
          presence={presence}
          syncStatus={syncStatus}
          onBack={() => setScreen('sheets')}
          onSelectSong={(id) => {
            stopPlayback();
            setActiveSongId(id);
            setActiveStepIndex(0);
            setLoopSectionId(null);
            setSectionTransposes({});
          }}
          onTranspose={(delta) =>
            updateActiveSong((s) => ({
              ...s,
              transpose: Math.max(-11, Math.min(11, (s.transpose || 0) + delta)),
            }))
          }
          onSeekToSection={(secId) => {
            const idx = timeline.findIndex((step) => step.sectionId === secId);
            if (idx >= 0) {
              if (isPlaying) startPlaybackFromIndex(idx, true);
              else setActiveStepIndex(idx);
            }
          }}
          onSeekToBarIndex={(idx) => {
            if (isPlaying) startPlaybackFromIndex(idx, true);
            else setActiveStepIndex(idx);
          }}
          onOpenLocalWifi={() => setScreen('local-wifi')}
          onOpenSectionLayer={(sectionId, layer) =>
            setSectionLayerModal({ sectionId, layer })
          }
        />
      )}

      {screen === 'local-wifi' && (
        <LocalWifiScreen
          roomId={roomId}
          presence={presence}
          syncStatus={syncStatus}
          rttMs={rttMs}
          onChangeRoomId={(next) => setRoomId(next || '4829')}
          onPreviewMemberApp={() => setScreen('member')}
          onBack={() => setScreen('sheets')}
        />
      )}

      {/* Persistent Always-Visible Play/Stop Bar across all Leader screens */}
      {activeSong && (
        <PersistentPlayBar
          bpm={Math.round((currentStep?.effectiveBpm || activeSong.bpm) * (speed / 100))}
          timeSignature={currentStep?.effectiveMeter || activeSong.timeSignature}
          isPlaying={isPlaying}
          isCountIn={isCountIn}
          countInEnabled={settings.countInBar}
          currentBarNumber={currentStep?.displayBarNumber || 1}
          totalBars={timeline.length || 1}
          currentBeat={currentBeat}
          chordAudioEnabled={settings.chordAudioEnabled}
          onTogglePlay={handleTogglePlay}
          onToggleChordAudio={() =>
            setSettings((prev) => ({
              ...prev,
              chordAudioEnabled: !prev.chordAudioEnabled,
            }))
          }
          onOpenMixer={() => setShowMetronomeModal(true)}
        />
      )}

      {/* Bar Editor Modal */}
      {editingBar && editingSection && editingBarTarget && (
        <BarEditorModal
          bar={editingBar}
          barNumber={editingBarNumber}
          sectionName={editingSection.name}
          songBpm={activeSong.bpm}
          songTimeSignature={activeSong.timeSignature}
          mode={barEditorMode}
          libraryVersion={cueLibraryVersion}
          sectionRepeat={Boolean(editingSection.repeat)}
          sectionRepeatCount={editingSection.repeatCount ?? 2}
          sectionLastBarCuePassRule={editingSection.lastBarCuePassRule ?? 'all'}
          isLastBarInSection={
            editingSection.bars[editingSection.bars.length - 1]?.id === editingBar.id
          }
          onUpdateSectionRepeat={(patch: { lastBarCuePassRule?: LastBarCuePassRule }) => {
            updateActiveSong((s) => ({
              ...s,
              sections: s.sections.map((sec) =>
                sec.id === editingBarTarget.sectionId ? { ...sec, ...patch } : sec
              ),
            }));
          }}
          onUpdateBar={(updatedBar: Bar) => {
            updateActiveSong((s) => ({
              ...s,
              sections: s.sections.map((sec) =>
                sec.id === editingBarTarget.sectionId
                  ? {
                      ...sec,
                      bars: sec.bars.map((b) =>
                        b.id === editingBarTarget.barId ? updatedBar : b
                      ),
                    }
                  : sec
              ),
            }));
          }}
          onRemoveBar={() => {
            updateActiveSong((s) => ({
              ...s,
              sections: s.sections.map((sec) =>
                sec.id === editingBarTarget.sectionId
                  ? {
                      ...sec,
                      bars: sec.bars.filter((b) => b.id !== editingBarTarget.barId),
                    }
                  : sec
              ),
            }));
            setEditingBarTarget(null);
          }}
          onPreviewBundledCue={(url) => {
            void audioEngineRef.current?.testVoice(url);
          }}
          onPreviewCustomCue={(cue) => {
            void audioEngineRef.current?.playCustomCue(cue);
          }}
          onCacheInvalidate={(cueId) => {
            audioEngineRef.current?.invalidateCustomCueCache(cueId);
            setCueLibraryVersion((v) => v + 1);
          }}
          onClose={() => setEditingBarTarget(null)}
        />
      )}

      {/* Metronome & Audio Mixer Modal */}
      {showMetronomeModal && activeSong && (
        <MetronomeModal
          settings={settings}
          songTempo={activeSong.bpm}
          isLocked={isLocked}
          libraryVersion={cueLibraryVersion}
          onUpdateSettings={(next) => setSettings(next)}
          onUpdateSongTempo={(bpm) =>
            updateActiveSong((s) => ({ ...s, bpm }))
          }
          onTestVoice={(cueUrl) => {
            void audioEngineRef.current?.testVoice(cueUrl);
          }}
          onPreviewCustomCue={(cue) => {
            void audioEngineRef.current?.playCustomCue(cue);
          }}
          onCacheInvalidate={(cueId) => {
            audioEngineRef.current?.invalidateCustomCueCache(cueId);
            setCueLibraryVersion((v) => v + 1);
          }}
          onClose={() => setShowMetronomeModal(false)}
        />
      )}

      {/* Offline Audio Track Exporter (WAV / MP3 for Cubase & Sharing) */}
      {showExportAudioModal && activeSong && (
        <ExportAudioModal
          song={activeSong}
          settings={settings}
          onClose={() => setShowExportAudioModal(false)}
        />
      )}

      {/* Per-Section Multi-Pad / Synth / Arpeggios Popup */}
      {sectionLayerModal &&
        activeSong &&
        (() => {
          const targetSec = activeSong.sections.find(
            (s) => s.id === sectionLayerModal.sectionId && !s.isReference
          );
          if (!targetSec) return null;
          const firstRealChord =
            targetSec.bars.find((b) => b.chord && b.chord.trim() !== '-')?.chord ||
            activeSong.key ||
            'C';
          return (
            <SectionLayerModal
              key={`${targetSec.id}-${sectionLayerModal.layer}`}
              section={targetSec}
              initialLayer={sectionLayerModal.layer}
              songBpm={activeSong.bpm}
              isLocked={isLocked}
              onUpdatePad={(nextPad: SectionMultiPadConfig) => {
                updateActiveSong((s) => ({
                  ...s,
                  sections: s.sections.map((sec) =>
                    sec.id === targetSec.id ? { ...sec, multiPad: nextPad } : sec
                  ),
                }));
              }}
              onUpdateSynth={(nextSynth: SectionSynthConfig) => {
                updateActiveSong((s) => ({
                  ...s,
                  sections: s.sections.map((sec) =>
                    sec.id === targetSec.id ? { ...sec, synth: nextSynth } : sec
                  ),
                }));
              }}
              onUpdateArp={(nextArp: SectionArpConfig) => {
                updateActiveSong((s) => ({
                  ...s,
                  sections: s.sections.map((sec) =>
                    sec.id === targetSec.id ? { ...sec, arp: nextArp } : sec
                  ),
                }));
              }}
              onPreview={(layer) => {
                if (layer === 'pad') {
                  const cfg = targetSec.multiPad || DEFAULT_SECTION_MULTI_PAD;
                  void synthEngineRef.current?.previewSectionLayer({
                    layer: 'pad',
                    tone: cfg.tone,
                    pattern: cfg.pattern,
                    chordStr: firstRealChord,
                    bpm: activeSong.bpm,
                  });
                } else if (layer === 'synth') {
                  const cfg = targetSec.synth || DEFAULT_SECTION_SYNTH;
                  void synthEngineRef.current?.previewSectionLayer({
                    layer: 'synth',
                    tone: cfg.tone,
                    pattern: cfg.pattern,
                    chordStr: firstRealChord,
                    bpm: activeSong.bpm,
                  });
                } else {
                  const cfg = targetSec.arp || DEFAULT_SECTION_ARP;
                  void synthEngineRef.current?.previewSectionLayer({
                    layer: 'arp',
                    tone: cfg.tone,
                    pattern: cfg.pattern,
                    subdivision: cfg.subdivision,
                    chordStr: firstRealChord,
                    bpm: activeSong.bpm,
                  });
                }
              }}
              onClose={() => setSectionLayerModal(null)}
            />
          );
        })()}
    </div>
  );
}
