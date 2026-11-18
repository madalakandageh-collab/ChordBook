import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  appName?: string;
  variant?: 'drawer' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  appName = 'CHORDBOOK',
  variant = 'drawer',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          variant === 'banner'
            ? 'w-full flex items-center justify-center gap-2 rounded-xl bg-[#E5A958] text-[#121212] font-semibold px-4 py-2.5 text-sm shadow-md hover:bg-[#ecb66c] transition active:scale-[0.98]'
            : 'w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[#E5A958]/40 text-[var(--accent-amber-text)] font-medium px-4 py-2.5 text-sm transition'
        }
      >
        <Download className="w-4 h-4" />
        <span>Add {appName} to Home Screen</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'banner'
              ? 'w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[#E5A958]/50 text-[var(--accent-amber-text)] font-medium px-4 py-2.5 text-sm hover:bg-[var(--bg-elevated)] transition'
              : 'w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition'
          }
        >
          <Smartphone className="w-4 h-4 text-[var(--accent-amber-text)]" />
          <span>Install {appName} on iPhone</span>
        </button>

        {showIOSGuide && (
          <div
            style={{ backgroundColor: 'var(--bg-backdrop)' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-serif-display text-xl font-bold text-[var(--text-primary)]">
                  Add {appName}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-[var(--text-muted)]">
                <li>
                  1. Tap the <strong className="text-[var(--text-primary)]">Share</strong> button in
                  Safari&apos;s toolbar.
                </li>
                <li>
                  2. Scroll down and tap{' '}
                  <strong className="text-[var(--text-primary)]">Add to Home Screen</strong>.
                </li>
                <li>
                  3. Tap <strong className="text-[var(--text-primary)]">Add</strong> to launch{' '}
                  {appName} full-screen offline.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#E5A958] py-2.5 text-sm font-semibold text-[#121212]"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
