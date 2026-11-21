import { encodeAudioBufferToMp3Blob, encodeAudioBufferToWavBlob } from '../audio/cubaseClick';
import type { EncodeWorkerRequest, EncodeWorkerResponse } from '../workers/audioEncode.worker';

function runEncodeInWorker(
  request: EncodeWorkerRequest,
  transferables: Transferable[],
  onProgress?: (pct: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/audioEncode.worker.ts', import.meta.url),
      { type: 'module' }
    );

    const cleanup = () => {
      try {
        worker.terminate();
      } catch {
        // Ignore termination errors
      }
    };

    worker.onmessage = (event: MessageEvent<EncodeWorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        onProgress?.(msg.pct);
        return;
      }
      if (msg.type === 'done') {
        cleanup();
        resolve(new Blob([msg.buffer], { type: msg.mimeType }));
        return;
      }
      if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(err.message || 'Audio encoding worker crashed.'));
    };

    worker.postMessage(request, transferables);
  });
}

export async function encodeAudioBufferInBackgroundWorker(
  buffer: AudioBuffer,
  format: 'wav' | 'mp3',
  onProgress?: (pct: number) => void
): Promise<Blob> {
  if (typeof Worker !== 'undefined') {
    try {
      const numChannels = Math.min(2, buffer.numberOfChannels);
      // Clone Float32Array channel buffers so we can safely transfer ownership to the Worker
      const left = new Float32Array(buffer.getChannelData(0));
      const transferables: Transferable[] = [left.buffer];
      let right: Float32Array | undefined;
      if (numChannels > 1) {
        right = new Float32Array(buffer.getChannelData(1));
        transferables.push(right.buffer);
      }

      const request: EncodeWorkerRequest = {
        type: format === 'mp3' ? 'encode-mp3' : 'encode-wav',
        sampleRate: buffer.sampleRate,
        numChannels,
        left,
        right,
      };

      return await runEncodeInWorker(request, transferables, onProgress);
    } catch {
      // Fallback transparently to main-thread encoders if worker bundling is blocked
    }
  }

  if (format === 'mp3') {
    return encodeAudioBufferToMp3Blob(buffer, onProgress);
  }
  onProgress?.(100);
  return encodeAudioBufferToWavBlob(buffer);
}
