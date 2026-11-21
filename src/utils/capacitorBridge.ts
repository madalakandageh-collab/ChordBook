import { Capacitor } from '@capacitor/core';

export const IS_PRO_STORAGE_KEY = 'chordbook_is_pro_v1';
export const PRO_PRODUCT_ID = 'chordbook_pro_unlock';

// Replace with production AdMob Android App & Ad Unit IDs before Play Store release
export const ADMOB_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
export const ADMOB_ANDROID_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
export const ADMOB_ANDROID_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

export const FREE_SONG_LIMIT = 20;

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
let admobBannerVisible = false;
let storeInitialized = false;

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
      return true;
    } catch {
      admobInitPromise = null;
      return false;
    }
  })();

  return admobInitPromise;
}

export async function showAdMobBanner(options?: {
  adId?: string;
  isTesting?: boolean;
}): Promise<void> {
  if (!isNativeCapacitorAndroid()) return;
  try {
    const ready = await initializeAdMob();
    if (!ready) return;
    const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob');
    if (!admobBannerVisible) {
      await AdMob.showBanner({
        adId: options?.adId ?? ADMOB_ANDROID_BANNER_ID,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: options?.isTesting ?? true,
      });
      admobBannerVisible = true;
    } else {
      await AdMob.resumeBanner();
    }
  } catch {
    // Ignore when running outside Android runtime
  }
}

export async function removeAdMobBanner(): Promise<void> {
  if (!isNativeCapacitorAndroid()) return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    if (admobBannerVisible) {
      await AdMob.removeBanner();
      admobBannerVisible = false;
    }
  } catch {
    // Ignore
  }
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
