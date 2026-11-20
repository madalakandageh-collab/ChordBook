import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Download, Loader2, Printer, X } from 'lucide-react';
import type { Bar, Section, Song } from '../types';
import {
  formatBarChordsSummary,
  formatLastBarCuePassPrintBadge,
  transposeKey,
} from '../utils/chords';
import { downloadSongChordSheetPdf } from '../utils/pdfExport';
import { ChordDisplay } from './ChordDisplay';

interface PrintableChordSheetModalProps {
  song: Song;
  onClose: () => void;
}

function chunkBars(bars: Bar[], size = 4): Bar[][] {
  const rows: Bar[][] = [];
  for (let i = 0; i < bars.length; i += size) {
    rows.push(bars.slice(i, i + size));
  }
  return rows;
}

export const PrintableChordSheetModal: React.FC<PrintableChordSheetModalProps> = ({
  song,
  onClose,
}) => {
  const [includeLyrics, setIncludeLyrics] = useState(true);
  const [includeCues, setIncludeCues] = useState(true);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('printing-chord-sheet');
    return () => {
      document.body.classList.remove('printing-chord-sheet');
    };
  }, []);

  const handleSavePdf = async () => {
    if (isSavingPdf) return;
    setIsSavingPdf(true);
    setPdfError(null);
    setPdfNotice(null);
    try {
      const filename = await downloadSongChordSheetPdf(song, {
        includeCues,
        includeLyrics,
      });
      setPdfNotice(`Saved ${filename}`);
      setTimeout(() => setPdfNotice((cur) => (cur === `Saved ${filename}` ? null : cur)), 3500);
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Unable to generate PDF file on this device.'
      );
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handlePrintSheet = () => {
    setPdfError(null);
    try {
      window.print();
    } catch {
      setPdfError('Direct print is unavailable here — use Save PDF instead.');
    }
  };

  const displayKey = transposeKey(song.key, song.transpose || 0);

  return createPortal(
    <div className="print-modal-wrapper fixed inset-0 z-50 bg-black/80 backdrop-blur-xs overflow-y-auto p-3 sm:p-6">
      {/* Non-printed Action Toolbar */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] px-4 py-3 shadow-xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close PDF print sheet"
              className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Printable A4 Chord Sheet
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Two-column classic band chart · Download .PDF offline or print directly
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIncludeCues((v) => !v)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                includeCues
                  ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              {includeCues ? 'Cues: Shown' : 'Cues: Hidden'}
            </button>

            {song.lyrics.length > 0 && (
              <button
                type="button"
                onClick={() => setIncludeLyrics((v) => !v)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                  includeLyrics
                    ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {includeLyrics ? 'Lyrics: Shown' : 'Lyrics: Hidden'}
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintSheet}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold text-xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              disabled={isSavingPdf}
              onClick={() => void handleSavePdf()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E5A958] hover:bg-[#ecb66c] disabled:opacity-60 text-[#121212] font-semibold text-xs shadow-md transition"
            >
              {isSavingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isSavingPdf ? 'Saving PDF...' : 'Save PDF'}</span>
            </button>
          </div>
        </div>

        {pdfNotice && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-xs font-medium text-emerald-400">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{pdfNotice}</span>
          </div>
        )}

        {pdfError && (
          <div className="rounded-xl bg-red-500/15 border border-red-500/40 px-3 py-2 text-xs font-medium text-red-400">
            {pdfError}
          </div>
        )}
      </div>

      {/* White A4 Paper Sheet */}
      <div className="print-sheet-paper max-w-[210mm] min-h-[297mm] mx-auto bg-white text-[#111827] rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-10 font-sinhala">
        {/* Centered Song Title with Highlighter Underline Effect */}
        <header className="text-center pb-5 mb-5 border-b border-slate-300">
          <h1 className="font-serif-display font-sinhala text-[28px] sm:text-[32px] font-bold tracking-tight text-[#111827] leading-tight">
            <span className="pdf-title-highlight">{song.title}</span>
          </h1>
          <p className="mt-2 text-xs sm:text-[13px] text-slate-600 font-medium tabular-nums">
            {song.artist} &nbsp;·&nbsp; Key {displayKey} &nbsp;·&nbsp; {song.bpm} BPM &nbsp;·&nbsp;{' '}
            {song.timeSignature}
          </p>
        </header>

        {/* Two-Column Classic Band Chord Grid */}
        <div className="pdf-two-column-flow">
          {song.sections.map((section: Section) => {
            if (section.isReference) {
              return (
                <div key={section.id} className="pdf-section-block pt-1 pb-2">
                  <div className="inline-block font-serif-display font-sinhala text-[14px] font-bold text-[#111827] border border-slate-300 rounded px-2.5 py-1 bg-slate-50">
                    ({section.name})
                  </div>
                </div>
              );
            }

            const rows = chunkBars(section.bars, 4);
            const secTranspose = (song.transpose || 0) + (section.transpose || 0);
            const isRepeat = Boolean(section.repeat);
            const repeatCount = Math.max(2, section.repeatCount ?? 2);
            const passBadge = isRepeat
              ? formatLastBarCuePassPrintBadge(section.lastBarCuePassRule, repeatCount)
              : null;

            return (
              <div key={section.id} className="pdf-section-block">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <h2 className="font-serif-display font-sinhala text-[15px] font-bold text-[#111827]">
                    {section.name}
                  </h2>
                  {isRepeat && (
                    <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                      ×{repeatCount}
                      {passBadge ? ` ${passBadge}` : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {rows.map((rowBars, rowIdx) => {
                    const isFirstRow = rowIdx === 0;
                    const isLastRow = rowIdx === rows.length - 1;

                    return (
                      <div key={rowIdx} className="flex items-stretch">
                        {/* Left Bar Line / Repeat Open ||: */}
                        <div className="flex items-center justify-center w-5 shrink-0 font-mono text-[14px] font-bold text-[#111827] select-none">
                          {isFirstRow && isRepeat ? '||:' : '|'}
                        </div>

                        {/* Strict 4-bars-per-line Grid */}
                        <div className="flex-1 grid grid-cols-4 border-y border-slate-300 bg-white">
                          {[0, 1, 2, 3].map((colIdx) => {
                            const bar = rowBars[colIdx];
                            const hasRightSeparator = colIdx < 3;
                            if (!bar) {
                              return (
                                <div
                                  key={colIdx}
                                  className={`px-1.5 py-2 min-h-[38px] ${
                                    hasRightSeparator ? 'border-r border-slate-300' : ''
                                  }`}
                                />
                              );
                            }

                            const chordText = formatBarChordsSummary(
                              bar,
                              secTranspose,
                              displayKey
                            );
                            const printableChord = chordText === '—' ? '-' : chordText;
                            const barRepeat = bar.repeat && bar.repeat > 1 ? bar.repeat : 1;

                            return (
                              <div
                                key={bar.id}
                                className={`px-1.5 py-1.5 min-h-[38px] flex flex-col items-center justify-center text-center overflow-hidden ${
                                  hasRightSeparator ? 'border-r border-slate-400' : ''
                                }`}
                              >
                                <div className="flex items-baseline justify-center gap-0.5 max-w-full">
                                  <ChordDisplay
                                    chordText={printableChord}
                                    size="xs"
                                    className="font-bold text-[13px] text-[#111827] leading-tight max-w-full"
                                  />
                                  {barRepeat > 1 && (
                                    <span className="text-[9px] font-semibold text-slate-600 tabular-nums shrink-0">
                                      ×{barRepeat}
                                    </span>
                                  )}
                                </div>

                                {includeCues && (bar.cue || bar.voiceCountLocked) && (
                                  <span className="text-[8.5px] font-medium text-amber-800 leading-tight truncate max-w-full mt-0.5">
                                    {bar.cue ? bar.cue : 'count'}
                                  </span>
                                )}

                                {bar.lyrics && (
                                  <span className="text-[9px] font-sinhala text-slate-700 leading-tight truncate max-w-full mt-0.5">
                                    {bar.lyrics}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Right Bar Line / Repeat Close :|| + Pass Badge */}
                        <div className="flex items-center justify-start pl-1 min-w-[20px] shrink-0 font-mono text-[13px] font-bold text-[#111827] whitespace-nowrap select-none">
                          {isLastRow && isRepeat ? (
                            <span className="inline-flex items-center gap-1">
                              <span>:||</span>
                              {passBadge && (
                                <span className="font-sans text-[9px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded px-1 py-0.5 leading-none">
                                  {passBadge}
                                </span>
                              )}
                            </span>
                          ) : (
                            '|'
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Optional Lyrics Section with full Sinhala Unicode support */}
        {includeLyrics && song.lyrics.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-300">
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-slate-500 mb-3">
              Lyrics
            </h3>
            <div className="pdf-two-column-flow">
              {song.lyrics.map((lyr) => (
                <div key={lyr.id} className="pdf-section-block">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-sinhala">
                    {lyr.label}
                  </p>
                  <div className="font-sinhala text-[13px] leading-[1.65] text-[#111827] space-y-0.5">
                    {lyr.lines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
