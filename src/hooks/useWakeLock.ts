import { useEffect, useState } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

// Reference-counted shared Screen Wake Lock so background tasks (exports, OCR) & playback never drop lock prematurely
let sharedHoldCount = 0;
let sharedSentinel: WakeLockSentinelLike | null = null;
let sharedListenerAttached = false;

async function requestSharedWakeLock(): Promise<void> {
  if (sharedHoldCount <= 0 || typeof navigator === 'undefined') return;
  try {
    const nav = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;
    if (sharedSentinel && !sharedSentinel.released) return;
    const sentinel = await nav.wakeLock.request('screen');
    if (sharedHoldCount > 0) {
      sharedSentinel = sentinel;
    } else {
      await sentinel.release().catch(() => {});
    }
  } catch {
    // Ignore unsupported / visibility rejection errors
  }
}

function handleSharedVisibility(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible' && sharedHoldCount > 0) {
    void requestSharedWakeLock();
  }
}

export async function acquireWakeLock(): Promise<() => void> {
  sharedHoldCount += 1;
  if (!sharedListenerAttached && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleSharedVisibility);
    sharedListenerAttached = true;
  }
  await requestSharedWakeLock();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseWakeLock();
  };
}

export function releaseWakeLock(): void {
  sharedHoldCount = Math.max(0, sharedHoldCount - 1);
  if (sharedHoldCount === 0 && sharedSentinel && !sharedSentinel.released) {
    void sharedSentinel.release().catch(() => {});
    sharedSentinel = null;
  }
}

export function useWakeLock(enabled: boolean) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsActive(false);
      return;
    }

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const requestLock = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
        };
        if (nav.wakeLock && !cancelled) {
          sentinel = await nav.wakeLock.request('screen');
          if (!cancelled) {
            setIsActive(true);
            sentinel.addEventListener?.('release', () => {
              if (!cancelled) setIsActive(false);
            });
          } else {
            await sentinel.release();
          }
        }
      } catch {
        if (!cancelled) setIsActive(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) {
        void requestLock();
      }
    };

    void requestLock();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {});
      }
      setIsActive(false);
    };
  }, [enabled]);

  return isActive;
}
