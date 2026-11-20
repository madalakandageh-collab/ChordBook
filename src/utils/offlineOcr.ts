import { createWorker, PSM } from 'tesseract.js';

export interface CropRectNormalized {
  x: number; // 0..1 relative to rotated image width
  y: number; // 0..1 relative to rotated image height
  width: number; // 0..1
  height: number; // 0..1
}

export interface OfflineOcrProgress {
  status: string;
  progress: number; // 0..100
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode selected image.'));
    img.src = src;
  });
}

/**
 * Renders the rotated full image onto an offscreen canvas so crop preview & extraction
 * share exact pixel dimensions.
 */
export async function renderRotatedImageToCanvas(
  imageSrc: string,
  rotationDeg: number
): Promise<HTMLCanvasElement> {
  const img = await loadImageElement(imageSrc);
  const normRot = ((rotationDeg % 360) + 360) % 360;
  const swapDims = normRot === 90 || normRot === 270;
  const targetW = swapDims ? img.naturalHeight : img.naturalWidth;
  const targetH = swapDims ? img.naturalWidth : img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetW);
  canvas.height = Math.max(1, targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((normRot * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();

  return canvas;
}

/**
 * Extracts the cropped region and optionally applies grayscale contrast enhancement
 * tailored for handwritten pen/pencil chord sheets on paper.
 */
export async function prepareCroppedOcrCanvas(params: {
  imageSrc: string;
  rotationDeg: number;
  crop: CropRectNormalized;
  enhanceHandwriting: boolean;
}): Promise<HTMLCanvasElement> {
  const rotatedCanvas = await renderRotatedImageToCanvas(params.imageSrc, params.rotationDeg);

  const sx = Math.max(0, Math.round(params.crop.x * rotatedCanvas.width));
  const sy = Math.max(0, Math.round(params.crop.y * rotatedCanvas.height));
  const sw = Math.max(20, Math.round(params.crop.width * rotatedCanvas.width));
  const sh = Math.max(20, Math.round(params.crop.height * rotatedCanvas.height));

  const clampedW = Math.min(sw, rotatedCanvas.width - sx);
  const clampedH = Math.min(sh, rotatedCanvas.height - sy);

  // Upscale smaller phone/cropped regions so Tesseract LSTM sees crisp 30px+ glyph height
  const targetMinWidth = 1500;
  const maxDimension = 2600;
  let scale = 1;
  if (clampedW < targetMinWidth) {
    scale = Math.min(2.5, targetMinWidth / Math.max(1, clampedW));
  }
  if (clampedW * scale > maxDimension || clampedH * scale > maxDimension) {
    scale = Math.min(maxDimension / clampedW, maxDimension / clampedH);
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = Math.max(1, Math.round(clampedW * scale));
  outCanvas.height = Math.max(1, Math.round(clampedH * scale));
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) throw new Error('Canvas 2D context unavailable');

  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(
    rotatedCanvas,
    sx,
    sy,
    clampedW,
    clampedH,
    0,
    0,
    outCanvas.width,
    outCanvas.height
  );

  if (params.enhanceHandwriting) {
    enhanceHandwritingContrast(outCtx, outCanvas.width, outCanvas.height);
  }

  return outCanvas;
}

/**
 * Enhances handwritten chord contrast on lined/unlined paper using luminance conversion,
 * percentile black/white level stretching, and soft shadow darkening.
 */
function enhanceHandwritingContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const totalPixels = width * height;
  if (totalPixels === 0) return;

  const gray = new Uint8Array(totalPixels);
  const histogram = new Uint32Array(256);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    gray[p] = lum;
    histogram[lum] += 1;
  }

  // Find 3rd percentile (dark ink) and 85th percentile (paper background)
  const lowTarget = Math.floor(totalPixels * 0.03);
  const highTarget = Math.floor(totalPixels * 0.85);
  let lowVal = 0;
  let highVal = 255;
  let acc = 0;

  for (let v = 0; v < 256; v++) {
    acc += histogram[v];
    if (acc >= lowTarget) {
      lowVal = v;
      break;
    }
  }

  acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += histogram[v];
    if (acc >= highTarget) {
      highVal = v;
      break;
    }
  }

  const range = Math.max(24, highVal - lowVal);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    // Stretch contrast and apply mild gamma to sharpen pen strokes against paper
    let norm = (gray[p] - lowVal) / range;
    norm = Math.max(0, Math.min(1, norm));
    // Push bright paper to white, keep dark/mid ink crisp
    const curved = norm > 0.72 ? 1 : Math.pow(norm / 0.72, 1.35) * 0.88;
    const out = Math.max(0, Math.min(255, Math.round(curved * 255)));
    data[i] = out;
    data[i + 1] = out;
    data[i + 2] = out;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Runs 100% offline Tesseract.js OCR using strictly local bundled worker, WASM core,
 * and gzipped English traineddata stored in /public/ocr/.
 */
export async function runOfflineChordOcr(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: OfflineOcrProgress) => void
): Promise<string> {
  const origin = window.location.origin;

  const formatStatus = (rawStatus: string): string => {
    switch (rawStatus) {
      case 'loading tesseract core':
        return 'Loading offline OCR engine…';
      case 'initializing tesseract':
        return 'Initializing offline recognizer…';
      case 'loading language traineddata':
        return 'Loading local English language model…';
      case 'initializing api':
        return 'Preparing chord scanner…';
      case 'recognizing text':
        return 'Reading handwritten chords…';
      default:
        return rawStatus || 'Processing offline…';
    }
  };

  onProgress?.({ status: 'Starting offline OCR engine…', progress: 5 });

  const worker = await createWorker('eng', 1, {
    workerPath: `${origin}/ocr/worker.min.js`,
    corePath: `${origin}/ocr/core`,
    langPath: `${origin}/ocr/lang`,
    workerBlobURL: false,
    gzip: true,
    logger: (msg) => {
      const pct = Math.max(0, Math.min(100, Math.round((msg.progress || 0) * 100)));
      onProgress?.({
        status: formatStatus(msg.status || ''),
        progress: pct,
      });
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });

    const result = await worker.recognize(canvas);
    return result?.data?.text || '';
  } finally {
    await worker.terminate();
  }
}
