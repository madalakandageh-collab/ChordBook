import React, { useEffect, useState } from 'react';
import {
  ADMOB_ANDROID_BANNER_ID,
  isNativeCapacitorAndroid,
  removeAdMobBanner,
  showAdMobBanner,
} from '../utils/capacitorBridge';

interface AdBannerSlotProps {
  isPro: boolean;
  onUpgradeClick: () => void;
  onBannerHeightChange?: (height: number) => void;
}

export const AdBannerSlot: React.FC<AdBannerSlotProps> = ({
  isPro,
  onUpgradeClick,
  onBannerHeightChange,
}) => {
  const isNative = isNativeCapacitorAndroid();
  const [nativeBannerHeight, setNativeBannerHeight] = useState(56);

  useEffect(() => {
    if (isPro) {
      onBannerHeightChange?.(0);
      void removeAdMobBanner();
      return;
    }

    onBannerHeightChange?.(nativeBannerHeight);
  }, [isPro, nativeBannerHeight, onBannerHeightChange]);

  useEffect(() => {
    if (isPro) {
      void removeAdMobBanner();
      return;
    }

    let cancelled = false;
    let sizeHandle: { remove: () => Promise<void> } | null = null;

    if (isNative) {
      void (async () => {
        try {
          const { AdMob, BannerAdPluginEvents } = await import('@capacitor-community/admob');
          try {
            const adaptive = await AdMob.getAdaptiveBannerSize();
            if (!cancelled && adaptive.height > 0) {
              setNativeBannerHeight(adaptive.height);
            }
          } catch {
            // Adaptive size fallback remains 56px until SizeChanged fires
          }
          const handle = await AdMob.addListener(
            BannerAdPluginEvents.SizeChanged,
            (size) => {
              if (!cancelled && size.height > 0) {
                setNativeBannerHeight(size.height);
              }
            }
          );
          if (cancelled) {
            void handle.remove().catch(() => {});
          } else {
            sizeHandle = handle;
          }
        } catch {
          // Ignore outside Android runtime
        }
        if (!cancelled) {
          await showAdMobBanner({
            adId: ADMOB_ANDROID_BANNER_ID,
            isTesting: true,
          });
        }
      })();
    }

    return () => {
      cancelled = true;
      void sizeHandle?.remove().catch(() => {});
      void removeAdMobBanner();
    };
  }, [isPro, isNative]);

  if (isPro) return null;

  return (
    <div
      aria-label="Advertisement banner space"
      style={{
        height: isNative
          ? `calc(${nativeBannerHeight}px + env(safe-area-inset-bottom, 0px))`
          : 'calc(56px + env(safe-area-inset-bottom, 0px))',
      }}
      className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] bg-[var(--bg-recessed)] border-t border-[var(--border-subtle)] flex items-center justify-between px-4"
    >
      {isNative ? (
        <span className="text-[11px] text-[var(--text-subtle)] mx-auto">AdMob Test Banner</span>
      ) : (
        <>
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
              AD
            </span>
            <span className="text-xs text-[var(--text-muted)] truncate">
              Banner ad space reserved for free users
            </span>
          </div>
          <button
            type="button"
            onClick={onUpgradeClick}
            className="px-2.5 py-1 rounded-full bg-[var(--accent-amber-tint)] border border-[#E5A958]/50 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-amber-text)] shrink-0 hover:bg-[#E5A958] hover:text-[#121212] transition"
          >
            Remove Ads
          </button>
        </>
      )}
    </div>
  );
};
