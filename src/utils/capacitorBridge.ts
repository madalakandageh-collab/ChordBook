import { Capacitor } from '@capacitor/core';

export const IS_PRO_STORAGE_KEY = 'chordbook_is_pro_v1';
export const PRO_PRODUCT_ID = 'chordbook_pro_unlock';

// Replace with production AdMob Android App & Ad Unit IDs before Play Store release
export const ADMOB_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
export const ADMOB_ANDROID_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
export const ADMOB_ANDROID_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

export const FREE_SONG_LIMIT = 20;
const INTERSTITIAL_OPEN_COUNT_KEY = 'chordbook_interstitial_open_count_v1';
const INTERSTITIAL_COOLDOWN_MS = 45_000;
const INTERSTITIAL_EXPIRY_MS = 55 * 60_000;

interface CdvTransactionLike {
  products?: Array<{ id?: string }>;
  finish?: () => Promise<void> | void;
  verify?: () => Promise<void> | void;
}

interface CdvProductLike {
  id: string;
  owned?: boolean;
  pricing?: { price?: string };
  getOffer?: () => { order?: () => Promise<{ isError?: boolean; message?: string } | undefined> } | undefined;
}

interface CdvStoreLike {
  register?: (product: { id: string; type: string; platform: string }) => void;
  when?: () => {
    approved?: (cb: (tx: CdvTransactionLike) => void) => unknown;
    verified?: (cb: (receipt: unknown) => void) => unknown;
    updated?: (cb: (product: CdvProductLike) => void) => unknown;
  };
  initialize?: (platforms: string[]) => Promise<unknown>;
  restorePurchases?: () => Promise<unknown>;
  get?: (id: string) => CdvProductLike | undefined;
  owned?: (id: string) => boolean;
}

interface WindowWithCdvPurchase extends Window {
  CdvPurchase?: {
    store?: CdvStoreLike;
    ProductType?: { NON_CONSUMABLE?: string };
    Platform?: { GOOGLE_PLAY?: string };
  };
}

let admobInitialized = false;
let admobInitPromise: Promise<boolean> | null = null;
let storeInitialized = false;
let interstitialPrepared = false;
let interstitialPreparedAt = 0;
let interstitialPreparingPromise: Promise<boolean> | null = null;
let lastInterstitialShownAt = 0;

export function loadIsProFromStorage(): boolean {
  try {
    return localStorage.getItem(IS_PRO_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveIsProToStorage(value: boolean): void {
  try {
    localStorage.setItem(IS_PRO_STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}

export function isNativeCapacitorAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export async function initializeBillingStore(onProUnlocked: () => void): Promise<void> {
  if (storeInitialized || typeof window === 'undefined') return;
  const cdv = (window as WindowWithCdvPurchase).CdvPurchase;
  const store = cdv?.store;
  if (!store) return;

  try {
    storeInitialized = true;
    const productType = cdv.ProductType?.NON_CONSUMABLE ?? 'non consumable';
    const platform = cdv.Platform?.GOOGLE_PLAY ?? 'android-playstore';

    store.register?.({
      id: PRO_PRODUCT_ID,
      type: productType,
      platform,
    });

    const whenChain = store.when?.();
    if (whenChain?.approved) {
      whenChain.approved((tx) => {
        const hasProProduct = tx.products?.some((p) => p.id === PRO_PRODUCT_ID);
        if (hasProProduct || !tx.products?.length) {
          saveIsProToStorage(true);
          onProUnlocked();
        }
        if (tx.verify) {
          void tx.verify();
        } else {
          void tx.finish?.();
        }
      });
    }

    if (whenChain?.updated) {
      whenChain.updated((product) => {
        if (product.id === PRO_PRODUCT_ID && product.owned) {
          saveIsProToStorage(true);
          onProUnlocked();
        }
      });
    }

    await store.initialize?.([platform]);

    if (store.owned?.(PRO_PRODUCT_ID)) {
      saveIsProToStorage(true);
      onProUnlocked();
    }
  } catch {
    // Billing store unavailable outside Play Store native shell
  }
}

/**
 * Triggers Google Play In-App Purchase when running inside Android Capacitor shell,
 * or executes the placeholder Pro unlock action on Web preview.
 */
export async function purchasePro(
  onProUnlocked?: () => void
): Promise<{ success: boolean; message: string }> {
  const cdv = typeof window !== 'undefined' ? (window as WindowWithCdvPurchase).CdvPurchase : undefined;
  const store = cdv?.store;

  if (store && isNativeCapacitorAndroid()) {
    try {
      const product = store.get?.(PRO_PRODUCT_ID);
      const offer = product?.getOffer?.();
      if (offer?.order) {
        const result = await offer.order();
        if (result?.isError) {
          return {
            success: false,
            message: result.message || 'Google Play purchase was cancelled or failed.',
          };
        }
        saveIsProToStorage(true);
        onProUnlocked?.();
        return { success: true, message: 'Chordbook Pro unlocked!' };
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unable to start Google Play purchase.',
      };
    }
  }

  // Placeholder Go Pro flow (Web preview / dev mode)
  saveIsProToStorage(true);
  onProUnlocked?.();
  return {
    success: true,
    message: 'Chordbook Pro unlocked! All ads removed and Pro features enabled.',
  };
}

export async function restorePurchases(
  onProUnlocked?: () => void
): Promise<{ restored: boolean; message: string }> {
  const cdv = typeof window !== 'undefined' ? (window as WindowWithCdvPurchase).CdvPurchase : undefined;
  const store = cdv?.store;

  if (store && isNativeCapacitorAndroid()) {
    try {
      await store.restorePurchases?.();
      if (store.owned?.(PRO_PRODUCT_ID)) {
        saveIsProToStorage(true);
        onProUnlocked?.();
        return { restored: true, message: 'Your Chordbook Pro purchase has been restored.' };
      }
      return { restored: false, message: 'No previous Google Play Pro purchase found.' };
    } catch {
      return { restored: false, message: 'Could not connect to Google Play to restore purchases.' };
    }
  }

  if (loadIsProFromStorage()) {
    onProUnlocked?.();
    return { restored: true, message: 'Chordbook Pro is active on this device.' };
  }

  return {
    restored: false,
    message: 'No saved Pro purchase found on this browser. Tap "Go Pro" to unlock.',
  };
}

/**
 * Initializes the Google Mobile Ads SDK on startup with test mode enabled.
 * Safe to call multiple times; deduplicates concurrent initialization calls.
 */
export async function initializeAdMob(): Promise<boolean> {
  if (!isNativeCapacitorAndroid()) return false;
  if (admobInitialized) return true;
  if (admobInitPromise) return admobInitPromise;

  admobInitPromise = (async () => {
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.initialize({
        initializeForTesting: true,
      });
      admobInitialized = true;
      if (!loadIsProFromStorage()) {
        void prepareInterstitialAd();
      }
      return true;
    } catch {
      admobInitPromise = null;
      return false;
    }
  })();

  return admobInitPromise;
}

/**
 * Preloads an AdMob Interstitial ad ahead of time so it displays smoothly on transition.
 */
export async function prepareInterstitialAd(): Promise<boolean> {
  if (!isNativeCapacitorAndroid() || loadIsProFromStorage()) return false;
  if (interstitialPrepared && Date.now() - interstitialPreparedAt < INTERSTITIAL_EXPIRY_MS) {
    return true;
  }
  if (interstitialPreparingPromise) return interstitialPreparingPromise;

  interstitialPreparingPromise = (async () => {
    try {
      const ready = await initializeAdMob();
      if (!ready) return false;
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.prepareInterstitial({
        adId: ADMOB_ANDROID_INTERSTITIAL_ID,
        isTesting: true,
      });
      interstitialPrepared = true;
      interstitialPreparedAt = Date.now();
      return true;
    } catch {
      interstitialPrepared = false;
      return false;
    } finally {
      interstitialPreparingPromise = null;
    }
  })();

  return interstitialPreparingPromise;
}

/**
 * Displays a prepared AdMob Interstitial ad and waits until the user dismisses it
 * (or settles cleanly if unavailable). Immediately preloads the next interstitial after close.
 */
export async function showInterstitialAd(): Promise<void> {
  if (!isNativeCapacitorAndroid() || loadIsProFromStorage()) return;

  try {
    const ready = await prepareInterstitialAd();
    if (!ready) return;

    const { AdMob, InterstitialAdPluginEvents } = await import('@capacitor-community/admob');

    await new Promise<void>((resolve) => {
      let settled = false;
      let dismissedHandle: { remove: () => Promise<void> } | null = null;
      let failedHandle: { remove: () => Promise<void> } | null = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        interstitialPrepared = false;
        void dismissedHandle?.remove().catch(() => {});
        void failedHandle?.remove().catch(() => {});
        if (!loadIsProFromStorage()) {
          void prepareInterstitialAd();
        }
        resolve();
      };

      void Promise.all([
        AdMob.addListener(InterstitialAdPluginEvents.Dismissed, finish).then((h) => {
          dismissedHandle = h;
        }),
        AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, finish).then((h) => {
          failedHandle = h;
        }),
      ])
        .then(() => {
          lastInterstitialShownAt = Date.now();
          return AdMob.showInterstitial();
        })
        .catch(() => {
          finish();
        });
    });
  } catch {
    interstitialPrepared = false;
  }
}

/**
 * Triggers an Interstitial ad occasionally for Free users:
 * - 'open_song': every 3rd time a song is opened
 * - 'save_new_song': after saving a newly created song
 * Respects a minimum cooldown so ads never appear back-to-back.
 */
export async function maybeShowInterstitialAd(
  trigger: 'open_song' | 'save_new_song'
): Promise<void> {
  if (loadIsProFromStorage()) return;

  let shouldShow = trigger === 'save_new_song';

  if (trigger === 'open_song') {
    let nextCount = 1;
    try {
      const prev = Number.parseInt(localStorage.getItem(INTERSTITIAL_OPEN_COUNT_KEY) || '0', 10);
      nextCount = Number.isFinite(prev) && prev >= 0 ? prev + 1 : 1;
      localStorage.setItem(INTERSTITIAL_OPEN_COUNT_KEY, String(nextCount));
    } catch {
      // Ignore storage errors
    }
    shouldShow = nextCount % 3 === 0;
  }

  if (!shouldShow) {
    void prepareInterstitialAd();
    return;
  }

  if (Date.now() - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {
    return;
  }

  await showInterstitialAd();
}

/**
 * Triggers a full-screen AdMob Rewarded Video Ad on Android before exporting WAV/MP3,
 * returning a Promise that resolves only after the ad closes (or immediately when Pro / offline).
 */
export async function showExportVideoAd(): Promise<void> {
  if (loadIsProFromStorage()) {
    return;
  }

  if (!isNativeCapacitorAndroid()) {
    // Placeholder delay in web preview simulating full-screen video ad completion
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 600);
    });
    return;
  }

  try {
    const ready = await initializeAdMob();
    if (!ready) return;
    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');

    await AdMob.prepareRewardVideoAd({
      adId: ADMOB_ANDROID_REWARDED_ID,
      isTesting: true,
    });

    await new Promise<void>((resolve) => {
      let settled = false;
      let dismissedHandle: { remove: () => Promise<void> } | null = null;
      let failedHandle: { remove: () => Promise<void> } | null = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        void dismissedHandle?.remove().catch(() => {});
        void failedHandle?.remove().catch(() => {});
        resolve();
      };

      void Promise.all([
        AdMob.addListener(RewardAdPluginEvents.Dismissed, finish).then((h) => {
          dismissedHandle = h;
        }),
        AdMob.addListener(RewardAdPluginEvents.FailedToShow, finish).then((h) => {
          failedHandle = h;
        }),
      ])
        .then(() => AdMob.showRewardVideoAd())
        .catch(() => {
          finish();
        });
    });
  } catch {
    // Allow export to proceed if device is offline or ad inventory is unavailable
  }
}
