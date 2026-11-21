import React from 'react';
import { BookOpen, GraduationCap, Lock, Radio, Wifi, X } from 'lucide-react';
import type { ScreenName } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface NavDrawerProps {
  isOpen: boolean;
  activeScreen: ScreenName;
  memberCount: number;
  isPro: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenName) => void;
  onRequirePro: (reason: string) => void;
  onOpenProModal: () => void;
}

export const NavDrawer: React.FC<NavDrawerProps> = ({
  isOpen,
  activeScreen,
  memberCount,
  isPro,
  onClose,
  onNavigate,
  onRequirePro,
  onOpenProModal,
}) => {
  if (!isOpen) return null;

  const navItems: Array<{
    id: ScreenName;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    proLocked?: boolean;
    proReason?: string;
  }> = [
    {
      id: 'sheets',
      label: 'Your sheets',
      icon: <BookOpen className="w-5 h-5 text-[var(--accent-amber-text)]" />,
    },
    {
      id: 'live-mode',
      label: 'Live mode',
      icon: <Radio className="w-5 h-5 text-[var(--accent-amber-text)]" />,
      badge: isPro && memberCount > 0 ? `${memberCount} synced` : undefined,
      proLocked: !isPro,
      proReason: 'Live Mode is a Chordbook Pro feature. Upgrade to unlock live stage mode.',
    },
    {
      id: 'practice-select',
      label: 'Practice',
      icon: <GraduationCap className="w-5 h-5 text-[var(--accent-amber-text)]" />,
    },
    {
      id: 'local-wifi',
      label: 'Local Wi-Fi',
      icon: <Wifi className="w-5 h-5 text-[var(--accent-amber-text)]" />,
      proLocked: !isPro,
      proReason: 'Local Wi-Fi band sync is a Chordbook Pro feature. Upgrade to sync band devices.',
    },
  ];

  const isHighlighted = (id: ScreenName) => {
    if (id === 'sheets' && (activeScreen === 'sheets' || activeScreen === 'song-detail')) return true;
    if (id === 'practice-select' && (activeScreen === 'practice-select' || activeScreen === 'practice-player')) return true;
    return activeScreen === id;
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        style={{ backgroundColor: 'var(--bg-backdrop)' }}
        className="fixed inset-0 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="relative z-10 w-[290px] max-w-[82vw] h-full bg-[var(--bg-drawer)] border-r border-[var(--border-subtle)] flex flex-col p-6 shadow-2xl"
        aria-label="Navigation Drawer"
      >
        <div className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium tracking-[0.28em] text-[var(--text-muted)] uppercase">
              CHORDBOOK
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProModal();
              }}
              className={`px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase transition ${
                isPro
                  ? 'bg-[#E5A958] text-[#121212] hover:bg-[#ecb66c]'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--accent-amber-text)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {isPro ? 'PRO' : 'FREE · UPGRADE'}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const active = isHighlighted(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onClose();
                  if (item.proLocked) {
                    onRequirePro(item.proReason || 'Upgrade to Pro to unlock this feature.');
                  } else {
                    onNavigate(item.id);
                  }
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-3.5 rounded-xl text-left transition ${
                  active
                    ? 'bg-[var(--accent-amber-tint)] text-[var(--text-primary)]'
                    : 'text-[var(--text-primary)]/90 hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <span className="flex items-center gap-4 min-w-0">
                  <span className="shrink-0">{item.icon}</span>
                  <span className="text-[16px] font-medium whitespace-nowrap truncate">{item.label}</span>
                </span>
                {item.proLocked ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent-amber-tint-strong)] border border-[#E5A958]/40 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-amber-text)] shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    PRO
                  </span>
                ) : (
                  item.badge && (
                    <span className="text-[11px] font-medium text-[var(--accent-amber-text)] tabular-nums shrink-0">
                      {item.badge}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-6">
          <PWAInstallButton variant="drawer" />
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
          <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
            Everything is stored on this device — songs, setlists and settings work without a connection.
          </p>
        </div>
      </aside>
    </div>
  );
};
