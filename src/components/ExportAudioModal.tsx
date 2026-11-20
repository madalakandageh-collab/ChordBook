import React, { useMemo, useState } from 'react';
import { Check, Download, FileAudio, Loader2, X } from 'lucide-react';
import { estimateSongDurationSeconds } from '../audio/cubaseClick';
import { DEFAULT_WAV_TRACK_SELECTION, exportProjectAudio } from '../audio/synthEngine';
import type {
  AudioExportFormat,
  MetronomeSettings,
  Song,
  SynthBackingSettings,
  WavExportTrackSelection,
} from '../types';
import {
  buildExportAudioFilename,
  getNormalizedDrumLayers,
  getNormalizedFxLayers,
  getSongTotalBars,
} from '../utils/chords';

interface ExportAudioModalProps {
  song: Song;
  settings: MetronomeSettings;
  synthSettings: SynthBackingSettings;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ExportAudioModal: React.FC<ExportAudioModalProps> = ({
  song,
  settings,
  synthSettings,
  onClose,
}) => {
  const [trackSelection, setTrackSelection] = useState<WavExportTrackSelection>(
    DEFAULT_WAV_TRACK_SELECTION
  );
  const [format, setFormat] = useState<AudioExportFormat>('wav');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [doneFilename, setDoneFilename] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalBars = useMemo(() => getSongTotalBars(song), [song]);
  const estimatedSec = useMemo(
    () => estimateSongDurationSeconds(song, settings.countInBar),
    [song, settings.countInBar]
  );

  const playableSections = useMemo(
    () => song.sections.filter((sec) => !sec.isReference),
    [song.sections]
  );

  const sectionsWithDrumsCount = useMemo(
    () =>
      playableSections.filter(
        (sec) => sec.drums?.enabled && getNormalizedDrumLayers(sec.drums).some((l) => l.enabled)
      ).length,
    [playableSections]
  );

  const activeFxCount = useMemo(
    () =>
      playableSections.reduce(
        (acc, sec) =>
          sec.fx?.enabled
            ? acc + getNormalizedFxLayers(sec.fx).filter((fx) => fx.enabled).length
            : acc,
        0
      ),
    [playableSections]
  );

  const previewFilename = useMemo(
    () => buildExportAudioFilename(song.title, song.key, song.transpose || 0, format),
    [song.title, song.key, song.transpose, format]
  );

  const selectedTrackCount = Object.values(trackSelection).filter(Boolean).length;

  const trackChecklistItems: {
    key: keyof WavExportTrackSelection;
    label: string;
    detail: string;
    dotClass: string;
  }[] = [
    {
      key: 'synth',
      label: 'Synth',
      detail: 'All active per-section keys, leads & basses',
      dotClass: 'bg-sky-400',
    },
    {
      key: 'multiPad',
      label: 'Multi-Pad',
      detail: 'All active per-section pad layers & bar ranges',
      dotClass: 'bg-emerald-400',
    },
    {
      key: 'arp',
      label: 'Arpeggio',
      detail: 'All active per-section arpeggiator layers',
      dotClass: 'bg-orange-400',
    },
    {
      key: 'drums',
      label: 'Drums',
      detail:
        sectionsWithDrumsCount > 0
          ? `Drums enabled on ${sectionsWithDrumsCount} ${
              sectionsWithDrumsCount === 1 ? 'section' : 'sections'
            }`
          : 'No sections currently have Drums enabled',
      dotClass: 'bg-rose-500',
    },
    {
      key: 'fx',
      label: 'FX / Risers',
      detail:
        activeFxCount > 0
          ? `${activeFxCount} ${activeFxCount === 1 ? 'effect' : 'effects'} scheduled`
          : 'No FX / Risers added to sections',
      dotClass: 'bg-fuchsia-400',
    },
    {
      key: 'click',
      label: 'Metronome / Click',
      detail: `${settings.clickVolume}% (${settings.clickBalance})`,
      dotClass: 'bg-[#E5A958]',
    },
    {
      key: 'voiceCues',
      label: 'Voice Cues & Count-in',
      detail: `${settings.voiceVolume}% (${settings.voiceBalance})${
        settings.countInBar ? ' · Includes Count-in' : ''
      }`,
      dotClass: 'bg-violet-400',
    },
  ];

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
    }, 250);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleExport = async () => {
    if (isExporting || selectedTrackCount === 0) return;
    setErrorMsg(null);
    setDoneFilename(null);
    setIsExporting(true);
    setProgress(4);
    setStageText('Preparing Tone.Offline renderer...');

    try {
      const { blob, filename } = await exportProjectAudio({
        song,
        metronomeSettings: settings,
        synthSettings,
        trackSelection,
        format,
        onProgress: (pct, stage) => {
          setProgress(pct);
          setStageText(stage);
        },
      });

      setProgress(100);
      setStageText(`${format.toUpperCase()} download ready!`);
      setDoneFilename(filename);
      triggerDownload(blob, filename);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to render offline audio track.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{ backgroundColor: 'var(--bg-backdrop)' }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-xs p-0 sm:p-4"
    >
      <div
        className="fixed inset-0"
        onClick={() => !isExporting && onClose()}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 pb-3.5 border-b border-[var(--border-subtle)] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--accent-amber-text)] uppercase">
              FAST OFFLINE RENDERER (TONE.OFFLINE)
            </p>
            <h2 className="font-serif-display text-2xl font-bold text-[var(--text-primary)] mt-0.5">
              Export Audio Track
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums truncate">
              {song.title} · {totalBars} bars · ~{formatDuration(estimatedSec)}
            </p>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            aria-label="Close Export Audio modal"
            className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Format Selector (WAV vs MP3) */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-muted)] uppercase">
              OUTPUT FORMAT
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setFormat('wav')}
                className={`p-3 rounded-2xl border text-left transition disabled:opacity-45 ${
                  format === 'wav'
                    ? 'bg-[var(--accent-amber-tint)] border-[#E5A958]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <p
                  className={`text-xs font-bold ${
                    format === 'wav'
                      ? 'text-[var(--accent-amber-text)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  WAV (Stereo PCM)
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Uncompressed 44.1 kHz 16-bit
                </p>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => setFormat('mp3')}
                className={`p-3 rounded-2xl border text-left transition disabled:opacity-45 ${
                  format === 'mp3'
                    ? 'bg-[var(--accent-amber-tint)] border-[#E5A958]'
                    : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <p
                  className={`text-xs font-bold ${
                    format === 'mp3'
                      ? 'text-[var(--accent-amber-text)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  MP3 (Stereo 192k)
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Compact shareable backing mix
                </p>
              </button>
            </div>
          </div>

          {/* 7-Track Selection Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-muted)] uppercase">
                SELECT EXPORT TRACKS ({selectedTrackCount}/7)
              </p>
            </div>

            {/* Quick Preset Pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={isExporting}
                onClick={() =>
                  setTrackSelection({
                    synth: true,
                    multiPad: true,
                    arp: true,
                    drums: true,
                    fx: true,
                    click: true,
                    voiceCues: true,
                  })
                }
                className="px-2.5 py-1 rounded-full bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition disabled:opacity-45"
              >
                Select All
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() =>
                  setTrackSelection({
                    synth: true,
                    multiPad: true,
                    arp: true,
                    drums: true,
                    fx: true,
                    click: false,
                    voiceCues: false,
                  })
                }
                className="px-2.5 py-1 rounded-full bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition disabled:opacity-45"
              >
                Backing + FX Only
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() =>
                  setTrackSelection({
                    synth: false,
                    multiPad: false,
                    arp: false,
                    drums: false,
                    fx: false,
                    click: true,
                    voiceCues: true,
                  })
                }
                className="px-2.5 py-1 rounded-full bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition disabled:opacity-45"
              >
                Click + Cues Only
              </button>
            </div>

            {/* 7 Track Checkboxes */}
            <div className="space-y-1.5">
              {trackChecklistItems.map((item) => {
                const checked = trackSelection[item.key];
                return (
                  <label
                    key={item.key}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2 cursor-pointer transition ${
                      checked
                        ? 'bg-[var(--bg-recessed)] border-[#E5A958]/60'
                        : 'bg-[var(--bg-recessed)]/50 border-[var(--border-subtle)] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.dotClass}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {item.detail}
                        </p>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      disabled={isExporting}
                      checked={checked}
                      onChange={(e) =>
                        setTrackSelection((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-[#E5A958] rounded cursor-pointer shrink-0"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Automatic Output Filename Preview */}
          <div className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] px-3.5 py-2.5 text-xs space-y-1">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--text-muted)]">
              AUTO OUTPUT FILENAME
            </p>
            <p className="font-medium text-[var(--text-primary)] truncate flex items-center gap-1.5">
              <FileAudio className="w-3.5 h-3.5 text-[var(--accent-amber-text)] shrink-0" />
              <span className="truncate">{previewFilename}</span>
            </p>
          </div>

          {/* Progress Indicator */}
          {(isExporting || progress > 0) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--accent-amber-text)] font-medium">{stageText}</span>
                <span className="text-[var(--text-primary)] tabular-nums">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--bg-recessed)] overflow-hidden border border-[var(--border-subtle)]">
                <div
                  className="h-full bg-[#E5A958] transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {doneFilename && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-xs font-medium text-emerald-400">
              <Check className="w-4 h-4 shrink-0" />
              <span className="truncate">Downloaded {doneFilename}</span>
            </div>
          )}

          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
        </div>

        {/* Sticky Footer */}
        <div className="p-5 pt-3 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="px-4 h-11 rounded-2xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] transition disabled:opacity-40"
          >
            Close
          </button>
          <button
            type="button"
            disabled={isExporting || selectedTrackCount === 0}
            onClick={() => void handleExport()}
            className="flex-1 h-11 rounded-2xl bg-[#E5A958] hover:bg-[#ecb66c] disabled:opacity-50 text-[#121212] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {isExporting
                ? `Rendering ${format.toUpperCase()}...`
                : `Export ${format.toUpperCase()} (${selectedTrackCount} Tracks)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

