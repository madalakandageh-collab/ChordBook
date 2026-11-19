import React, { useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  FileAudio,
  FileJson,
  ListMusic,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { SerializedVoiceCue, Setlist, Song } from '../types';
import {
  copyTextToClipboard,
  createEmptyBar,
  createSongJsonTemplate,
  getSongTotalBars,
  transposeKey,
} from '../utils/chords';

export interface ImportedJsonPayload {
  songs?: Song[];
  song?: Song;
  setlists?: Setlist[];
  setlist?: Setlist;
  customVoiceCues?: SerializedVoiceCue[];
}

export interface ImportMergeSummary {
  songsAdded: number;
  songsUpdated: number;
  setlistsAdded: number;
  setlistsUpdated: number;
  cuesImported: number;
}

interface SheetsHomeScreenProps {
  songs: Song[];
  setlists: Setlist[];
  isLocked: boolean;
  onSelectSong: (songId: string) => void;
  onCreateSong: (song: Song) => void;
  onCreateSetlist: (name: string) => void;
  onDeleteSetlist: (setlistId: string) => void;
  onAddSongToSetlist: (setlistId: string, songId: string) => void;
  onRemoveSongFromSetlist: (setlistId: string, songId: string) => void;
  onPlaySongFromSetlist: (songId: string) => void;
  onImportJson: (data: ImportedJsonPayload) => ImportMergeSummary | Promise<ImportMergeSummary>;
  onExportLightweightJson: () => boolean;
  onExportFullBackupJson: () => boolean | Promise<boolean>;
  onExportSetlistJson: (setlistId: string) => boolean;
}

export const SheetsHomeScreen: React.FC<SheetsHomeScreenProps> = ({
  songs,
  setlists,
  isLocked,
  onSelectSong,
  onCreateSong,
  onCreateSetlist,
  onDeleteSetlist,
  onAddSongToSetlist,
  onRemoveSongFromSetlist,
  onPlaySongFromSetlist,
  onImportJson,
  onExportLightweightJson,
  onExportFullBackupJson,
  onExportSetlistJson,
}) => {
  const [activeTab, setActiveTab] = useState<'songs' | 'setlists'>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSetlists, setExpandedSetlists] = useState<Record<string, boolean>>({});
  const [showNewSongModal, setShowNewSongModal] = useState(false);
  const [showNewSetlistModal, setShowNewSetlistModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [addSongTargetSetlistId, setAddSongTargetSetlistId] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // New Song Form State
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newKey, setNewKey] = useState('G');
  const [newBpm, setNewBpm] = useState(92);
  const [newMeter, setNewMeter] = useState<'4/4' | '3/4' | '6/8'>('4/4');

  // New Setlist Form State
  const [newSetlistName, setNewSetlistName] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const showStatusFeedback = (msg: string, durationMs = 3400) => {
    setImportFeedback(msg);
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setImportFeedback(null);
      feedbackTimerRef.current = null;
    }, durationMs);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSongs = songs.filter((song) => {
    if (!normalizedQuery) return true;
    const displayKey = transposeKey(song.key || 'C', song.transpose || 0);
    return (
      (song.title || '').toLowerCase().includes(normalizedQuery) ||
      (song.artist || '').toLowerCase().includes(normalizedQuery) ||
      displayKey.toLowerCase().includes(normalizedQuery)
    );
  });

  const filteredSetlists = setlists.filter((sl) => {
    if (!normalizedQuery) return true;
    return sl.name.toLowerCase().includes(normalizedQuery);
  });

  const handleCopySongTemplate = async () => {
    const ok = await copyTextToClipboard(createSongJsonTemplate());
    if (ok) {
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2400);
    } else {
      showStatusFeedback('Clipboard blocked by browser — try HTTPS or Export JSON');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => {
      showStatusFeedback('Could not read selected file');
    };
    reader.onload = async () => {
      try {
        const rawText = String(reader.result ?? '')
          .replace(/^\uFEFF/, '')
          .trim();
        if (!rawText) {
          showStatusFeedback('Selected JSON file is empty');
          return;
        }
        const parsed = JSON.parse(rawText);

        let payload: ImportedJsonPayload | null = null;
        if (Array.isArray(parsed)) {
          payload = { songs: parsed as Song[] };
        } else if (parsed && typeof parsed === 'object') {
          const obj = parsed as ImportedJsonPayload & Partial<Song> & Partial<Setlist>;
          if (
            !obj.songs &&
            !obj.setlists &&
            !obj.setlist &&
            !obj.song &&
            typeof obj.title === 'string' &&
            obj.title.trim().length > 0
          ) {
            payload = { songs: [obj as Song] };
          } else if (
            !obj.songs &&
            !obj.setlists &&
            !obj.setlist &&
            !obj.song &&
            typeof obj.name === 'string' &&
            obj.name.trim().length > 0 &&
            Array.isArray(obj.songIds)
          ) {
            payload = { setlist: obj as Setlist };
          } else {
            payload = {
              ...obj,
              songs: obj.song ? [obj.song, ...(Array.isArray(obj.songs) ? obj.songs : [])] : obj.songs,
            };
          }
        }

        if (!payload) {
          showStatusFeedback('Unrecognized JSON format');
          return;
        }

        const summary = await onImportJson(payload);
        const totalSongs = summary.songsAdded + summary.songsUpdated;
        const totalSetlists = summary.setlistsAdded + summary.setlistsUpdated;
        const parts: string[] = [];
        if (totalSongs > 0) {
          parts.push(`${totalSongs} ${totalSongs === 1 ? 'song' : 'songs'}`);
        }
        if (totalSetlists > 0) {
          parts.push(`${totalSetlists} ${totalSetlists === 1 ? 'setlist' : 'setlists'}`);
        }
        if (summary.cuesImported > 0) {
          parts.push(
            `${summary.cuesImported} ${summary.cuesImported === 1 ? 'voice cue' : 'voice cues'}`
          );
        }

        showStatusFeedback(
          parts.length > 0
            ? `Merged ${parts.join(', ')}`
            : 'No valid songs or setlists found in JSON'
        );
      } catch {
        showStatusFeedback('Invalid JSON file — check syntax and commas');
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleCreateSongSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const created: Song = {
      id: `song-${Date.now().toString(36)}`,
      title: newTitle.trim(),
      artist: newArtist.trim() || 'Unknown Artist',
      key: newKey,
      bpm: Math.max(20, Math.min(300, Number(newBpm) || 92)),
      timeSignature: newMeter,
      transpose: 0,
      updatedAt: Date.now(),
      sections: [
        {
          id: `sec-intro-${Date.now()}`,
          name: 'Intro',
          bars: [createEmptyBar(newKey), createEmptyBar('-'), createEmptyBar(newKey), createEmptyBar('-')],
        },
        {
          id: `sec-chorus-${Date.now()}`,
          name: 'Chorus',
          bars: [createEmptyBar(newKey), createEmptyBar(newKey), createEmptyBar('-'), createEmptyBar('-')],
        },
      ],
      lyrics: [
        {
          id: `lyr-${Date.now()}`,
          label: 'Chorus',
          lines: ['Add your lyrics here...'],
        },
      ],
    };
    onCreateSong(created);
    setNewTitle('');
    setNewArtist('');
    setShowNewSongModal(false);
  };

  const handleCreateSetlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetlistName.trim()) return;
    onCreateSetlist(newSetlistName.trim());
    setNewSetlistName('');
    setShowNewSetlistModal(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-36">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.26em] text-[var(--text-muted)] uppercase">
            CHORDBOOK
          </p>
          <h1 className="font-serif-display text-[36px] leading-[1.08] font-bold text-[var(--text-primary)] mt-1.5">
            Your sheets
          </h1>
          <p className="text-[14px] text-[var(--text-muted)] mt-2">
            Works offline · saved on this device
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1 shrink-0 relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,text/json,text/plain,.txt"
            onChange={handleFileImport}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-primary)] transition whitespace-nowrap shadow-xs"
          >
            <FileJson className="w-4 h-4 text-[var(--accent-amber-text)]" />
            <span>Import JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExportMenu((v) => !v)}
            aria-label="Export JSON options"
            title="Export JSON"
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition shadow-xs ${
              showExportMenu
                ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
            }`}
          >
            <Download className="w-4 h-4" />
          </button>

          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-1.5 text-sm space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    const ok = onExportLightweightJson();
                    if (ok) {
                      showStatusFeedback(
                        `Exported ${songs.length} ${songs.length === 1 ? 'song' : 'songs'} & ${setlists.length} ${setlists.length === 1 ? 'setlist' : 'setlists'} (Lightweight JSON)`
                      );
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left hover:bg-[var(--bg-elevated)] flex items-start gap-2.5 transition"
                >
                  <FileJson className="w-4 h-4 text-[var(--accent-amber-text)] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Export Songs &amp; Setlists JSON (Lightweight)
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Small editable sheets &amp; setlists without audio blobs
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowExportMenu(false);
                    const ok = await onExportFullBackupJson();
                    if (ok) {
                      showStatusFeedback('Exported Full Backup JSON (with custom audio)');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-left hover:bg-[var(--bg-elevated)] flex items-start gap-2.5 transition"
                >
                  <FileAudio className="w-4 h-4 text-[#6E7BF2] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Export Full Backup JSON (With Custom Audio)
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Includes recorded &amp; imported custom voice cues
                    </p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {importFeedback && (
        <div className="mt-3 px-4 py-2 rounded-xl bg-[var(--accent-amber-tint)] border border-[#E5A958]/50 text-xs text-[var(--accent-amber-text)]">
          {importFeedback}
        </div>
      )}

      {/* Search Bar */}
      <div className="mt-6 relative">
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search songs, artists, keys"
          className="w-full h-12 pl-11 pr-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[#E5A958]/70 focus:outline-none text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] transition shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Segmented Pill Toggle */}
      <div className="mt-4 p-1 rounded-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] grid grid-cols-2 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('songs')}
          className={`py-2.5 rounded-full text-[14px] font-semibold transition whitespace-nowrap tabular-nums ${
            activeTab === 'songs'
              ? 'bg-[#E5A958] text-[#121212] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Songs {songs.length}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('setlists')}
          className={`py-2.5 rounded-full text-[14px] font-semibold transition whitespace-nowrap tabular-nums ${
            activeTab === 'setlists'
              ? 'bg-[#E5A958] text-[#121212] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Setlists {setlists.length}
        </button>
      </div>

      {/* Songs List */}
      {activeTab === 'songs' ? (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSongs.map((song) => {
            const totalBars = getSongTotalBars(song);
            const displayKey = transposeKey(song.key, song.transpose || 0);
            return (
              <button
                key={song.id}
                type="button"
                onClick={() => onSelectSong(song.id)}
                className="w-full flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] active:scale-[0.99] border border-[var(--border-subtle)] text-left transition group shadow-xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[var(--accent-amber-tint-strong)] border border-[#E5A958]/30 text-[var(--accent-amber-text)] font-bold text-[15px] flex items-center justify-center shrink-0">
                    {displayKey}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-serif-display text-[17px] font-bold text-[var(--text-primary)] truncate">
                      {song.title}
                    </h2>
                    <p className="text-[13px] text-[var(--text-muted)] truncate mt-0.5 tabular-nums">
                      {song.artist} · {totalBars} bars · {song.bpm} bpm
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-subtle)] group-hover:text-[var(--text-primary)] shrink-0 transition" />
              </button>
            );
          })}

          {filteredSongs.length === 0 && (
            <div className="md:col-span-2 py-12 text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <p className="text-[var(--text-muted)] text-sm">No songs match &ldquo;{searchQuery}&rdquo;.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {filteredSetlists.map((setlist) => {
            const isExpanded = !!expandedSetlists[setlist.id];
            const setlistSongs = setlist.songIds
              .map((id) => songs.find((s) => s.id === id))
              .filter((s): s is Song => Boolean(s));

            return (
              <div
                key={setlist.id}
                className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden shadow-xs"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSetlists((prev) => ({ ...prev, [setlist.id]: !prev[setlist.id] }))
                  }
                  className="w-full flex items-center justify-between gap-3.5 p-4 hover:bg-[var(--bg-hover)] transition text-left"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent-amber-text)] flex items-center justify-center shrink-0">
                      <ListMusic className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-serif-display text-[18px] font-bold text-[var(--text-primary)] truncate">
                        {setlist.name}
                      </h2>
                      <p className="text-[13px] text-[var(--text-muted)] mt-0.5 tabular-nums">
                        {setlistSongs.length} {setlistSongs.length === 1 ? 'song' : 'songs'}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] space-y-2">
                    {setlistSongs.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] py-2">
                        No songs in this setlist yet.
                      </p>
                    ) : (
                      setlistSongs.map((s, idx) => (
                        <div
                          key={`${setlist.id}-${s.id}-${idx}`}
                          className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)]"
                        >
                          <button
                            type="button"
                            onClick={() => onSelectSong(s.id)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left"
                          >
                            <span className="text-xs text-[var(--text-subtle)] tabular-nums w-4">
                              {idx + 1}.
                            </span>
                            <span className="w-7 h-7 rounded-full bg-[var(--accent-amber-tint-strong)] text-[var(--accent-amber-text)] text-xs font-bold flex items-center justify-center shrink-0">
                              {transposeKey(s.key, s.transpose || 0)}
                            </span>
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                              {s.title}
                            </span>
                            <span className="text-xs text-[var(--text-muted)] tabular-nums hidden sm:inline">
                              {s.bpm} bpm
                            </span>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onPlaySongFromSetlist(s.id)}
                              aria-label={`Play ${s.title}`}
                              className="w-8 h-8 rounded-full bg-[#E5A958]/20 hover:bg-[#E5A958]/30 text-[var(--accent-amber-text)] flex items-center justify-center"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => onRemoveSongFromSetlist(setlist.id, s.id)}
                                aria-label={`Remove ${s.title} from setlist`}
                                className="w-8 h-8 rounded-full hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-500 flex items-center justify-center"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => setAddSongTargetSetlistId(setlist.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--accent-amber-text)]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add song</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const ok = onExportSetlistJson(setlist.id);
                            if (ok) {
                              showStatusFeedback(
                                `Exported setlist "${setlist.name}" (${setlistSongs.length} ${setlistSongs.length === 1 ? 'song' : 'songs'})`
                              );
                            }
                          }}
                          title={`Export ${setlist.name} JSON`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] transition"
                        >
                          <Download className="w-3.5 h-3.5 text-[var(--accent-amber-text)]" />
                          <span>Export Setlist</span>
                        </button>
                      </div>

                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => onDeleteSetlist(setlist.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-red-500/15 text-xs text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-[13px] text-[var(--text-muted)] pt-3 px-1 leading-relaxed">
            Everything stays on this device — saved locally, works without a connection.
          </p>
        </div>
      )}

      {/* Bottom Floating Action Pill */}
      {!isLocked && (
        <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center pointer-events-none px-4">
          <button
            type="button"
            onClick={() =>
              activeTab === 'songs' ? setShowNewSongModal(true) : setShowNewSetlistModal(true)
            }
            className="pointer-events-auto inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#E5A958] hover:bg-[#ecb66c] active:scale-95 text-[#121212] font-semibold text-[15px] shadow-xl shadow-black/25 transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{activeTab === 'songs' ? 'New song' : 'New setlist'}</span>
          </button>
        </div>
      )}

      {/* New Song Modal */}
      {showNewSongModal && (
        <div
          style={{ backgroundColor: 'var(--bg-backdrop)' }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-xs p-0 sm:p-4"
        >
          <form
            onSubmit={handleCreateSongSubmit}
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif-display text-2xl font-bold text-[var(--text-primary)]">New song</h2>
              <button
                type="button"
                onClick={() => setShowNewSongModal(false)}
                className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs tracking-wider uppercase text-[var(--text-muted)] mb-1.5">
                Song title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Raththaran Neth"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:border-[#E5A958] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs tracking-wider uppercase text-[var(--text-muted)] mb-1.5">
                Artist
              </label>
              <input
                type="text"
                value={newArtist}
                onChange={(e) => setNewArtist(e.target.value)}
                placeholder="e.g. Victor Rathnayake"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:border-[#E5A958] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs tracking-wider uppercase text-[var(--text-muted)] mb-1.5">
                  Key
                </label>
                <select
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:border-[#E5A958] focus:outline-none"
                >
                  {['C', 'Cm', 'D', 'Dm', 'Eb', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'Ab', 'A', 'Am', 'Bb', 'Bm', 'B'].map(
                    (k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs tracking-wider uppercase text-[var(--text-muted)] mb-1.5">
                  BPM
                </label>
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={newBpm}
                  onChange={(e) => setNewBpm(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] tabular-nums focus:border-[#E5A958] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs tracking-wider uppercase text-[var(--text-muted)] mb-1.5">
                  Meter
                </label>
                <select
                  value={newMeter}
                  onChange={(e) => setNewMeter(e.target.value as '4/4' | '3/4' | '6/8')}
                  className="w-full h-11 px-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:border-[#E5A958] focus:outline-none"
                >
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="6/8">6/8</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-full bg-[#E5A958] hover:bg-[#ecb66c] text-[#121212] font-semibold text-sm transition"
            >
              Create chord sheet
            </button>

            <button
              type="button"
              onClick={() => void handleCopySongTemplate()}
              className="w-full h-10 rounded-full bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition"
            >
              {copiedTemplate ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--accent-amber-text)]" />
                  <span className="text-[var(--accent-amber-text)]">Song JSON Template Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[var(--accent-amber-text)]" />
                  <span>Copy Song JSON Template</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* New Setlist Modal */}
      {showNewSetlistModal && (
        <div
          style={{ backgroundColor: 'var(--bg-backdrop)' }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-xs p-0 sm:p-4"
        >
          <form
            onSubmit={handleCreateSetlistSubmit}
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif-display text-2xl font-bold text-[var(--text-primary)]">New setlist</h2>
              <button
                type="button"
                onClick={() => setShowNewSetlistModal(false)}
                className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs tracking-wider uppercase text-[var(--text-muted)] mb-1.5">
                Setlist name
              </label>
              <input
                type="text"
                required
                value={newSetlistName}
                onChange={(e) => setNewSetlistName(e.target.value)}
                placeholder="e.g. Friday Wedding Gig"
                className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:border-[#E5A958] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-full bg-[#E5A958] hover:bg-[#ecb66c] text-[#121212] font-semibold text-sm transition"
            >
              Create setlist
            </button>
          </form>
        </div>
      )}

      {/* Add Song to Setlist Picker Modal */}
      {addSongTargetSetlistId && (
        <div
          style={{ backgroundColor: 'var(--bg-backdrop)' }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-xs p-0 sm:p-4"
        >
          <div className="w-full max-w-md max-h-[75vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3">
              <h2 className="font-serif-display text-xl font-bold text-[var(--text-primary)]">
                Add song to setlist
              </h2>
              <button
                type="button"
                onClick={() => setAddSongTargetSetlistId(null)}
                className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto space-y-2 pr-1">
              {songs.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onAddSongToSetlist(addSongTargetSetlistId, s.id);
                    setAddSongTargetSetlistId(null);
                  }}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-[var(--accent-amber-tint-strong)] text-[var(--accent-amber-text)] text-xs font-bold flex items-center justify-center shrink-0">
                      {transposeKey(s.key, s.transpose || 0)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">{s.title}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{s.artist}</div>
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-[var(--accent-amber-text)] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
