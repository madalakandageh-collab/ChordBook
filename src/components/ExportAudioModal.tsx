import React, { useMemo, useState } from 'react';
import { Download, FileAudio, Music2, Radio, X } from 'lucide-react';
import {
  encodeAudioBufferToMp3Blob,
  encodeAudioBufferToWavBlob,
  estimateSongDurationSeconds,
  renderSongAudioOffline,
} from '../audio/cubaseClick';
import type { ExportAudioMixMode, MetronomeSettings, Song } from '../types';
import { getSongTotalBars } from '../utils/chords';

interface ExportAudioModalProps {
  song: Song;
  settings: MetronomeSettings;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function slugifyFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'chordbook-track'
  );
}

export const ExportAudioModal: React.FC<ExportAudioModalProps> = ({
  song,
  settings,
  onClose,
}) => {
  const [mixMode, setMixMode] = useState<ExportAudioMixMode>('click-cues');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3' | null>(null);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalBars = useMemo(() => getSongTotalBars(song), [song]);
  const estimatedSec = useMemo(
    () => estimateSongDurationSeconds(song, settings.countInBar),
    [song, settings.countInBar]
  );

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleExport = async (format: 'wav' | 'mp3') => {
    if (isExporting) return;
    setErrorMsg(null);
    setIsExporting(true);
    setExportFormat(format);
    setProgress(5);
    setStageText('Preparing offline render...');

    try {
      const renderedBuffer = await renderSongAudioOffline({
        song,
        settings,
        mixMode,
        onProgress: (pct, stage) => {
          setProgress(pct);
          setStageText(stage);
        },
      });

      const baseSlug = slugifyFilename(song.title);
      const modeSuffix = mixMode === 'click-cues' ? 'click-cues' : 'full-mix';

      if (format === 'wav') {
        setStageText('Encoding Stereo PCM WAV...');
        setProgress(90);
        await new Promise((r) => setTimeout(r, 15));
        const wavBlob = encodeAudioBufferToWavBlob(renderedBuffer);
        setProgress(100);
        setStageText('WAV download started!');
        triggerDownload(wavBlob, `${baseSlug}-${modeSuffix}.wav`);
      } else {
        setStageText('Encoding Stereo MP3...');
        const mp3Blob = await encodeAudioBufferToMp3Blob(renderedBuffer, (pct) => {
          setProgress(pct);
        });
        setProgress(100);
        setStageText('MP3 download started!');
        triggerDownload(mp3Blob, `${baseSlug}-${modeSuffix}.mp3`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to render offline audio track.');
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportFormat(null);
      }, 900);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4">
      <div className="fixed inset-0" onClick={() => !isExporting && onClose()} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#181716] border border-[#2D2B2A] p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.2em] text-[#E5A958] uppercase">
              OFFLINE AUDIO RENDERER
            </p>
            <h2 className="font-serif-display text-2xl font-bold text-[#F5F2EE] mt-0.5">
              Export Audio Track
            </h2>
            <p className="text-xs text-[#9C968F] mt-1 tabular-nums">
              {song.title} · {totalBars} bars · ~{formatDuration(estimatedSec)}
            </p>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            aria-label="Close Export Audio modal"
            className="w-9 h-9 rounded-full bg-[#242220] text-[#F5F2EE] flex items-center justify-center disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mix Mode Toggle */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-[0.2em] text-[#9C968F] uppercase">
            TRACK MIX MODE
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => setMixMode('click-cues')}
              className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 ${
                mixMode === 'click-cues'
                  ? 'bg-[#252019] border-[#E5A958]'
                  : 'bg-[#141312] border-[#2D2B2A] hover:bg-[#1C1B1A]'
              }`}
            >
              <Radio
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  mixMode === 'click-cues' ? 'text-[#E5A958]' : 'text-[#9C968F]'
                }`}
              />
              <div>
                <p
                  className={`text-sm font-semibold ${
                    mixMode === 'click-cues' ? 'text-[#E5A958]' : 'text-[#F5F2EE]'
                  }`}
                >
                  Click + Voice Cues Only (Default)
                </p>
                <p className="text-xs text-[#9C968F] mt-0.5">
                  Cubase-style click track + voice cues &amp; 1–7 counts for DAW backing tracks
                </p>
              </div>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => setMixMode('full-mix')}
              className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 ${
                mixMode === 'full-mix'
                  ? 'bg-[#252019] border-[#E5A958]'
                  : 'bg-[#141312] border-[#2D2B2A] hover:bg-[#1C1B1A]'
              }`}
            >
              <Music2
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  mixMode === 'full-mix' ? 'text-[#E5A958]' : 'text-[#9C968F]'
                }`}
              />
              <div>
                <p
                  className={`text-sm font-semibold ${
                    mixMode === 'full-mix' ? 'text-[#E5A958]' : 'text-[#F5F2EE]'
                  }`}
                >
                  Full Mix (Click + Cues + Chords)
                </p>
                <p className="text-xs text-[#9C968F] mt-0.5">
                  Includes synthesized chord accompaniment alongside click and voice cues
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Active Mixer Snapshot */}
        <div className="rounded-2xl bg-[#141312] border border-[#2D2B2A] px-4 py-3 text-xs text-[#9C968F] space-y-1 tabular-nums">
          <div className="flex justify-between">
            <span>Cubase Click ({settings.clickBalance})</span>
            <span className="text-[#F5F2EE] font-medium">{settings.clickVolume}%</span>
          </div>
          <div className="flex justify-between">
            <span>Voice Cues &amp; Counts ({settings.voiceBalance})</span>
            <span className="text-[#F5F2EE] font-medium">{settings.voiceVolume}%</span>
          </div>
          <div className="flex justify-between">
            <span>Count-in Bar</span>
            <span className="text-[#F5F2EE] font-medium">
              {settings.countInBar ? 'Included' : 'Off'}
            </span>
          </div>
        </div>

        {/* Progress Indicator */}
        {(isExporting || progress > 0) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#E5A958] font-medium">{stageText}</span>
              <span className="text-[#F5F2EE] tabular-nums">{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#141312] overflow-hidden border border-[#2D2B2A]">
              <div
                className="h-full bg-[#E5A958] transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}

        {/* Export Format Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => void handleExport('wav')}
            className="h-12 px-4 rounded-full bg-[#E5A958] hover:bg-[#ecb66c] disabled:opacity-50 text-[#121212] font-semibold text-sm flex items-center justify-center gap-2 transition"
          >
            <FileAudio className="w-4 h-4" />
            <span>
              {isExporting && exportFormat === 'wav' ? 'Rendering...' : 'WAV (Cubase PCM)'}
            </span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => void handleExport('mp3')}
            className="h-12 px-4 rounded-full bg-[#242220] hover:bg-[#2D2B2A] disabled:opacity-50 border border-[#E5A958]/40 text-[#F5F2EE] font-semibold text-sm flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-[#E5A958]" />
            <span>
              {isExporting && exportFormat === 'mp3' ? 'Encoding...' : 'MP3 (Stereo)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
