import React, { useState } from 'react';
import { Check, Crown, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { purchasePro, restorePurchases } from '../utils/capacitorBridge';

interface ProUpgradeModalProps {
  isPro: boolean;
  reasonText?: string | null;
  onUnlocked: () => void;
  onToggleTestPro: () => void;
  onClose: () => void;
}

const PRO_BENEFITS = [
  'Remove All Ads',
  'Unlimited Songs (20+)',
  'Scan Chord Sheet',
  'Synth & Backing',
  'Live Mode & Local Wi-Fi',
];

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({
  isPro,
  reasonText,
  onUnlocked,
  onToggleTestPro,
  onClose,
}) => {
  const [busyAction, setBusyAction] = useState<'purchase' | 'restore' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleGoPro = async () => {
    if (busyAction) return;
    setBusyAction('purchase');
    setFeedback(null);
    const res = await purchasePro(onUnlocked);
    setBusyAction(null);
    if (res.success) {
      onClose();
    } else {
      setFeedback(res.message);
    }
  };

  const handleRestore = async () => {
    if (busyAction) return;
    setBusyAction('restore');
    setFeedback(null);
    const res = await restorePurchases(onUnlocked);
    setBusyAction(null);
    if (res.restored) {
      onClose();
    } else {
      setFeedback(res.message);
    }
  };

  return (
    <div
      style={{ backgroundColor: 'var(--bg-backdrop)' }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#E5A958] text-[#121212] flex items-center justify-center shrink-0 shadow-lg shadow-[#E5A958]/25">
              <Crown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.22em] text-[var(--accent-amber-text)] uppercase">
                CHORDBOOK PRO
              </p>
              <h2 className="font-serif-display text-2xl font-bold text-[var(--text-primary)] leading-tight">
                Upgrade to Pro
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Upgrade to Pro modal"
            className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {reasonText && (
          <div className="px-3.5 py-2.5 rounded-xl bg-[var(--accent-amber-tint)] border border-[#E5A958]/40 text-xs font-medium text-[var(--accent-amber-text)]">
            {reasonText}
          </div>
        )}

        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-2.5">
          {PRO_BENEFITS.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{benefit}</span>
            </div>
          ))}
        </div>

        {feedback && (
          <div className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
            {feedback}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleGoPro()}
            className="w-full h-12 rounded-full bg-[#E5A958] hover:bg-[#ecb66c] active:scale-[0.99] text-[#121212] font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#E5A958]/20 transition disabled:opacity-60"
          >
            {busyAction === 'purchase' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Go Pro</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleRestore()}
            className="w-full h-10 rounded-full bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition disabled:opacity-60"
          >
            {busyAction === 'restore' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking purchases…</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Purchases</span>
              </>
            )}
          </button>

          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onToggleTestPro}
              className="w-full px-3.5 py-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-between gap-2 transition"
            >
              <span>Toggle Test Pro Mode (Dev Only)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  isPro
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-[var(--bg-recessed)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                }`}
              >
                {isPro ? 'PRO ON' : 'FREE'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
