import { Mp3Encoder } from '@breezystack/lamejs';

export type EncodeWorkerRequest =
  | {
      type: 'encode-wav';
      sampleRate: number;
      numChannels: number;
      left: Float32Array;
      right?: Float32Array;
    }
  | {
      type: 'encode-mp3';
      sampleRate: number;
      numChannels: number;
      left: Float32Array;
      right?: Float32Array;
    };

export type EncodeWorkerResponse =
  | {
      type: 'progress';
      pct: number;
    }
  | {
      type: 'done';
      mimeType: string;
      buffer: ArrayBuffer;
    }
  | {
      type: 'error';
      message: string;
    };

function floatTo16BitIntArray(floatData: Float32Array): Int16Array {
  const out = new Int16Array(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    const s = Math.max(-1, Math.min(1, floatData[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function encodeWavBytes(
  sampleRate: number,
  numChannels: number,
  left: Float32Array,
  right?: Float32Array
): ArrayBuffer {
  const channels = Math.min(2, Math.max(1, numChannels));
  const length = left.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const rightData = channels > 1 && right ? right : left;
  let offset = 44;

  for (let i = 0; i < length; i++) {
    const lSample = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(offset, lSample < 0 ? lSample * 0x8000 : lSample * 0x7fff, true);
    offset += 2;
    if (channels > 1) {
      const rSample = Math.max(-1, Math.min(1, rightData[i]));
      view.setInt16(offset, rSample < 0 ? rSample * 0x8000 : rSample * 0x7fff, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

function encodeMp3Bytes(
  sampleRate: number,
  numChannels: number,
  left: Float32Array,
  right?: Float32Array
): ArrayBuffer {
  const channels = Math.min(2, Math.max(1, numChannels));
  const encoder = new Mp3Encoder(channels, sampleRate, 192);
  const leftInt = floatTo16BitIntArray(left);
  const rightInt = channels > 1 && right ? floatTo16BitIntArray(right) : leftInt;

  const blockSize = 1152 * 32;
  const parts: Uint8Array[] = [];
  let totalLen = 0;

  for (let i = 0; i < leftInt.length; i += blockSize) {
    const leftChunk = leftInt.subarray(i, i + blockSize);
    const rightChunk = rightInt.subarray(i, i + blockSize);
    const encoded =
      channels > 1 ? encoder.encodeBuffer(leftChunk, rightChunk) : encoder.encodeBuffer(leftChunk);
    if (encoded.length > 0) {
      const copy = new Uint8Array(encoded);
      parts.push(copy);
      totalLen += copy.byteLength;
    }
    const pct = Math.min(98, 78 + Math.round((i / Math.max(1, leftInt.length)) * 20));
    self.postMessage({ type: 'progress', pct } satisfies EncodeWorkerResponse);
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    const copy = new Uint8Array(flushed);
    parts.push(copy);
    totalLen += copy.byteLength;
  }

  const combined = new Uint8Array(totalLen);
  let cursor = 0;
  for (const part of parts) {
    combined.set(part, cursor);
    cursor += part.byteLength;
  }
  return combined.buffer;
}

self.onmessage = (e: MessageEvent<EncodeWorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'encode-wav') {
      self.postMessage({ type: 'progress', pct: 90 } satisfies EncodeWorkerResponse);
      const buffer = encodeWavBytes(req.sampleRate, req.numChannels, req.left, req.right);
      self.postMessage({ type: 'progress', pct: 100 } satisfies EncodeWorkerResponse);
      const msg: EncodeWorkerResponse = { type: 'done', mimeType: 'audio/wav', buffer };
      self.postMessage(msg, { transfer: [buffer] });
      return;
    }

    if (req.type === 'encode-mp3') {
      const buffer = encodeMp3Bytes(req.sampleRate, req.numChannels, req.left, req.right);
      self.postMessage({ type: 'progress', pct: 100 } satisfies EncodeWorkerResponse);
      const msg: EncodeWorkerResponse = { type: 'done', mimeType: 'audio/mpeg', buffer };
      self.postMessage(msg, { transfer: [buffer] });
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Background worker audio encoding failed.',
    } satisfies EncodeWorkerResponse);
  }
};
