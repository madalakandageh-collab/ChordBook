import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Copy,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import type { LastBarCuePassRule, Section } from '../types';
import { formatLastBarCuePassRuleLabel, formatPassOrdinal } from '../utils/chords';

interface ArrangeSectionsModalProps {
  songTitle: string;
  sections: Section[];
  isLocked: boolean;
  onMoveSection: (index: number, direction: -1 | 1) => void;
  onDuplicateSection: (sectionId: string) => void;
  onCopyReferenceSection: (sectionId: string) => void;
  onUpdateSectionRepeat: (
    sectionId: string,
    patch: {
      repeat?: boolean;
      repeatCount?: number;
      lastBarCuePassRule?: LastBarCuePassRule;
    }
  ) => void;
  onDeleteSection: (sectionId: string) => void;
  onClose: () => void;
}

export const ArrangeSectionsModal: React.FC<ArrangeSectionsModalProps> = ({
  songTitle,
  sections,
  isLocked,
  onMoveSection,
  onDuplicateSection,
  onCopyReferenceSection,
  onUpdateSectionRepeat,
  onDeleteSection,
  onClose,
}) => {
  // Precompute live auto-recalculated bar ranges across current section order
  let runningBar = 0;
  const barRanges = sections.map((sec) => {
    if (sec.isReference || !Array.isArray(sec.bars) || sec.bars.length === 0) {
      return { start: 0, end: 0, span: 0 };
    }
    const span = sec.bars.reduce(
      (acc, b) => acc + (b.repeat && b.repeat > 1 ? b.repeat : 1),
      0
    );
    const start = runningBar + 1;
    const end = runningBar + span;
    runningBar += span;
    return { start, end, span };
  });

  return (
    <div
      style={{ backgroundColor: 'var(--bg-backdrop)' }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] shadow-2xl">
        {/* Drag Handle */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--drag-handle)]" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between border-b border-[var(--border-subtle)] shrink-0">
          <div>
            <p className="text-[11px] font-medium tracking-[0.22em] text-[var(--accent-amber-text)] uppercase">
              SONG STRUCTURE · {sections.length} {sections.length === 1 ? 'SECTION' : 'SECTIONS'}
            </p>
            <h2 className="font-serif-display text-2xl font-bold text-[var(--text-primary)] mt-0.5">
              Arrange Sections
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
              {songTitle} · Reorder, duplicate, reference or set ||: :|| repeat passes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Arrange modal"
            className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLocked && (
          <div className="mx-5 mt-3 rounded-2xl bg-[var(--accent-amber-banner)] border border-[#E5A958]/50 px-4 py-2.5 text-xs text-[var(--accent-amber-text)]">
            Screen lock is on — unlock the top padlock to modify section arrangement.
          </div>
        )}

        {/* Section List */}
        <div className="overflow-y-auto px-5 py-4 space-y-3 pb-6">
          {sections.map((section, idx) => {
            const range = barRanges[idx];
            const isRef = Boolean(section.isReference);
            const isRepeatOn = Boolean(section.repeat && !isRef);
            const repeatCount = Math.max(2, section.repeatCount ?? 2);
            const passRule = section.lastBarCuePassRule ?? 'all';

            return (
              <div
                key={section.id}
                className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-subtle)] tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-serif-display text-lg font-bold text-[var(--text-primary)] truncate">
                        {isRef ? `(${section.name})` : section.name}
                      </h3>
                      {isRef ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                          Reference
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)] tabular-nums">
                          {range.span > 0
                            ? `Bars ${range.start}–${range.end} (${range.span} ${range.span === 1 ? 'bar' : 'bars'})`
                            : '0 bars'}
                        </span>
                      )}
                      {isRepeatOn && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent-amber-tint)] border border-[#E5A958]/60 text-[11px] font-bold text-[var(--accent-amber-text)] tabular-nums">
                          ||: :|| ×{repeatCount}
                        </span>
                      )}
                    </div>
                    {isRepeatOn && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">
                        Last-bar voice cue / count: <span className="text-[var(--accent-amber-text)] font-medium">{formatLastBarCuePassRuleLabel(passRule, repeatCount)}</span>
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isLocked || idx === 0}
                      onClick={() => onMoveSection(idx, -1)}
                      aria-label={`Move ${section.name} up`}
                      title="Move up"
                      className="w-9 h-9 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center transition"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isLocked || idx === sections.length - 1}
                      onClick={() => onMoveSection(idx, 1)}
                      aria-label={`Move ${section.name} down`}
                      title="Move down"
                      className="w-9 h-9 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center transition"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => onDeleteSection(section.id)}
                      aria-label={`Delete ${section.name}`}
                      title="Delete section"
                      className="w-9 h-9 rounded-xl bg-[var(--bg-recessed)] hover:bg-red-500/15 disabled:opacity-30 border border-[var(--border-subtle)] text-red-500 flex items-center justify-center transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Duplicate / Copy Reference / Repeat Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => onDuplicateSection(section.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-[var(--accent-amber-text)]" />
                    <span>Duplicate</span>
                  </button>

                  {!isRef && (
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => onCopyReferenceSection(section.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] disabled:opacity-40 border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] transition"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-[var(--accent-amber-text)]" />
                      <span>Copy Reference</span>
                    </button>
                  )}

                  {!isRef && (
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() =>
                        onUpdateSectionRepeat(section.id, {
                          repeat: !isRepeatOn,
                          repeatCount: !isRepeatOn ? Math.max(2, section.repeatCount ?? 2) : section.repeatCount,
                          lastBarCuePassRule: section.lastBarCuePassRule ?? 'all',
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition disabled:opacity-40 ${
                        isRepeatOn
                          ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                          : 'bg-[var(--bg-recessed)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>Repeat ||: :||</span>
                    </button>
                  )}
                </div>

                {/* Expanded Repeat Count & Last-Bar Voice Count Pass Selector */}
                {isRepeatOn && (
                  <div className="rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-medium tracking-[0.16em] text-[var(--text-muted)] uppercase">
                        REPEAT PASSES
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isLocked || repeatCount <= 2}
                          onClick={() => {
                            const next = Math.max(2, repeatCount - 1);
                            const nextRule =
                              typeof passRule === 'number' && passRule > next ? 'last' : passRule;
                            onUpdateSectionRepeat(section.id, {
                              repeatCount: next,
                              lastBarCuePassRule: nextRule,
                            });
                          }}
                          className="w-7 h-7 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] disabled:opacity-35 flex items-center justify-center text-sm"
                        >
                          −
                        </button>
                        <span className="text-xs font-bold text-[var(--accent-amber-text)] tabular-nums min-w-[30px] text-center">
                          ×{repeatCount}
                        </span>
                        <button
                          type="button"
                          disabled={isLocked || repeatCount >= 8}
                          onClick={() =>
                            onUpdateSectionRepeat(section.id, {
                              repeatCount: Math.min(8, repeatCount + 1),
                            })
                          }
                          className="w-7 h-7 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] disabled:opacity-35 flex items-center justify-center text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--text-muted)] uppercase mb-1.5">
                        LAST-BAR VOICE COUNT / CUE PLAYBACK
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() =>
                            onUpdateSectionRepeat(section.id, { lastBarCuePassRule: 'all' })
                          }
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                            passRule === 'all'
                              ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          All times
                        </button>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() =>
                            onUpdateSectionRepeat(section.id, { lastBarCuePassRule: 'first' })
                          }
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                            passRule === 'first' || passRule === 1
                              ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          1st time only
                        </button>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() =>
                            onUpdateSectionRepeat(section.id, { lastBarCuePassRule: 'last' })
                          }
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                            passRule === 'last' || passRule === repeatCount
                              ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {repeatCount === 2
                            ? '2nd time only (Last time)'
                            : `${formatPassOrdinal(repeatCount)} time only (Last time)`}
                        </button>

                        {repeatCount > 2 &&
                          Array.from({ length: repeatCount }, (_, i) => i + 1)
                            .filter((p) => p > 1 && p < repeatCount)
                            .map((passNum) => (
                              <button
                                key={passNum}
                                type="button"
                                disabled={isLocked}
                                onClick={() =>
                                  onUpdateSectionRepeat(section.id, {
                                    lastBarCuePassRule: passNum,
                                  })
                                }
                                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium tabular-nums transition ${
                                  passRule === passNum
                                    ? 'bg-[var(--accent-amber-tint)] border-[#E5A958] text-[var(--accent-amber-text)]'
                                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {formatPassOrdinal(passNum)} pass
                              </button>
                            ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border-subtle)] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 h-11 rounded-full bg-[#E5A958] hover:bg-[#ecb66c] text-[#121212] font-semibold text-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
