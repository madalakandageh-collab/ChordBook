import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Crop,
  Image as ImageIcon,
  RotateCw,
  ScanLine,
  Sparkles,
  SwitchCamera,
  Upload,
  X,
} from 'lucide-react';
import type { Song, TimeSignature } from '../types';
import {
  buildScannedSongObject,
  parseFormattedChordTextToSongSections,
  postProcessOcrText,
} from '../utils/chordOcrParser';
import {
  prepareCroppedOcrCanvas,
  renderRotatedImageToCanvas,
  runOfflineChordOcr,
  type CropRectNormalized,
  type OfflineOcrProgress,
} from '../utils/offlineOcr';
import { formatBarChordsSummary } from '../utils/chords';

interface ScanChordSheetModalProps {
  onSaveSong: (song: Song) => void;
  onClose: () => void;
}

type ModalStep = 'source' | 'camera' | 'crop' | 'scanning' | 'review';
type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const DEFAULT_CROP: CropRectNormalized = {
  x: 0.05,
  y: 0.08,
  width: 0.9,
  height: 0.84,
};

const SONG_KEYS = ['C', 'Cm', 'D', 'Dm', 'Eb', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'Ab', 'A', 'Am', 'Bb', 'Bm', 'B'];

export const ScanChordSheetModal: React.FC<ScanChordSheetModalProps> = ({
  onSaveSong,
  onClose,
}) => {
  const [step, setStep] = useState<ModalStep>('source');
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [rotatedPreviewUrl, setRotatedPreviewUrl] = useState<string | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [crop, setCrop] = useState<CropRectNormalized>(DEFAULT_CROP);
  const [enhanceHandwriting, setEnhanceHandwriting] = useState(true);

  // Camera state
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File inputs
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Cropper drag state
  const cropStageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    handle: DragHandle;
    startClientX: number;
    startClientY: number;
    startCrop: CropRectNormalized;
    stageW: number;
    stageH: number;
  } | null>(null);

  // OCR scanning & output state
  const [ocrProgress, setOcrProgress] = useState<OfflineOcrProgress>({
    status: 'Preparing offline scanner…',
    progress: 0,
  });
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [correctionsList, setCorrectionsList] = useState<string[]>([]);

  // Song metadata state
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songKey, setSongKey] = useState('C');
  const [songBpm, setSongBpm] = useState(92);
  const [songTimeSig, setSongTimeSig] = useState<TimeSignature>('4/4');
  const [reviewTab, setReviewTab] = useState<'edit' | 'preview'>('edit');
  const [titleError, setTitleError] = useState<string | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Revoke object URLs when replaced/unmounted
  useEffect(() => {
    return () => {
      if (rawImageUrl && rawImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(rawImageUrl);
      }
    };
  }, [rawImageUrl]);

  // Keep rotated preview image in sync with rawImageUrl & rotationDeg
  useEffect(() => {
    let cancelled = false;
    if (!rawImageUrl) {
      setRotatedPreviewUrl(null);
      return;
    }
    if (rotationDeg % 360 === 0) {
      setRotatedPreviewUrl(rawImageUrl);
      return;
    }
    void renderRotatedImageToCanvas(rawImageUrl, rotationDeg)
      .then((canvas) => {
        if (!cancelled) {
          setRotatedPreviewUrl(canvas.toDataURL('image/jpeg', 0.92));
        }
      })
      .catch(() => {
        if (!cancelled) setRotatedPreviewUrl(rawImageUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [rawImageUrl, rotationDeg]);

  const startLiveCamera = useCallback(
    async (facing: 'environment' | 'user') => {
      setCameraError(null);
      stopCameraStream();
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Live viewfinder is unavailable in this browser. Use "Device Camera" or "Choose from Gallery" below.'
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        setStep('camera');
        window.requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play().catch(() => {});
          }
        });
      } catch {
        setCameraError(
          'Camera permission was declined or unavailable. You can still use "Device Camera" or pick a photo from Gallery.'
        );
      }
    },
    [stopCameraStream]
  );

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
    stopCameraStream();
    setRawImageUrl(dataUrl);
    setRotationDeg(0);
    setCrop(DEFAULT_CROP);
    setOcrError(null);
    setStep('crop');
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stopCameraStream();
    const url = URL.createObjectURL(file);
    setRawImageUrl(url);
    setRotationDeg(0);
    setCrop(DEFAULT_CROP);
    setOcrError(null);
    setStep('crop');
  };

  // Cropper pointer interactions
  const handleCropPointerDown = (handle: DragHandle, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = cropStageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCrop: { ...crop },
      stageW: rect.width,
      stageH: rect.height,
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startClientX) / drag.stageW;
    const dy = (e.clientY - drag.startClientY) / drag.stageH;
    const s = drag.startCrop;
    const minSize = 0.1;

    if (drag.handle === 'move') {
      const nextX = Math.max(0, Math.min(1 - s.width, s.x + dx));
      const nextY = Math.max(0, Math.min(1 - s.height, s.y + dy));
      setCrop({ ...s, x: nextX, y: nextY });
      return;
    }

    let left = s.x;
    let top = s.y;
    let right = s.x + s.width;
    let bottom = s.y + s.height;

    if (drag.handle === 'nw' || drag.handle === 'sw') {
      left = Math.max(0, Math.min(right - minSize, s.x + dx));
    }
    if (drag.handle === 'ne' || drag.handle === 'se') {
      right = Math.min(1, Math.max(left + minSize, s.x + s.width + dx));
    }
    if (drag.handle === 'nw' || drag.handle === 'ne') {
      top = Math.max(0, Math.min(bottom - minSize, s.y + dy));
    }
    if (drag.handle === 'sw' || drag.handle === 'se') {
      bottom = Math.min(1, Math.max(top + minSize, s.y + s.height + dy));
    }

    setCrop({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  };

  const handleCropPointerUp = () => {
    dragStateRef.current = null;
  };

  const handleRunScan = async () => {
    if (!rawImageUrl) return;
    setOcrError(null);
    setOcrProgress({ status: 'Preparing cropped image…', progress: 5 });
    setStep('scanning');

    try {
      const croppedCanvas = await prepareCroppedOcrCanvas({
        imageSrc: rawImageUrl,
        rotationDeg,
        crop,
        enhanceHandwriting,
      });
      setCroppedPreviewUrl(croppedCanvas.toDataURL('image/png'));

      const rawText = await runOfflineChordOcr(croppedCanvas, (p) => {
        setOcrProgress(p);
      });
      setRawOcrText(rawText);

      const parsed = postProcessOcrText(rawText);
      const fallbackText =
        parsed.formattedText ||
        (rawText.trim()
          ? `Intro\n${rawText.trim()}`
          : 'Intro\n| C | G | Am | F |');

      setEditedText(fallbackText);
      setCorrectionsList(parsed.correctionsApplied);
      if (parsed.detectedKey) {
        setSongKey(
          SONG_KEYS.includes(parsed.detectedKey) ? parsed.detectedKey : 'C'
        );
      }
      setReviewTab('edit');
      setStep('review');
    } catch (err) {
      setOcrError(
        err instanceof Error
          ? err.message
          : 'Offline OCR failed to read this image. Try cropping tighter around the chords.'
      );
      setStep('crop');
    }
  };

  const handleReRunAutoFix = () => {
    const parsed = postProcessOcrText(editedText);
    if (parsed.formattedText) {
      setEditedText(parsed.formattedText);
      setCorrectionsList(parsed.correctionsApplied);
    }
  };

  const parsedSections = useMemo(
    () => parseFormattedChordTextToSongSections(editedText, songTimeSig),
    [editedText, songTimeSig]
  );

  const totalParsedBars = useMemo(
    () => parsedSections.reduce((sum, s) => sum + s.bars.length, 0),
    [parsedSections]
  );

  const handleSaveScannedSong = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = songTitle.trim();
    if (!cleanTitle) {
      setTitleError('Please enter a song title (Sinhala or English).');
      return;
    }
    setTitleError(null);

    const newSong = buildScannedSongObject({
      title: cleanTitle,
      artist: songArtist.trim(),
      key: songKey,
      bpm: songBpm,
      timeSignature: songTimeSig,
      sections: parsedSections,
    });

    stopCameraStream();
    onSaveSong(newSong);
    onClose();
  };

  const handleClose = () => {
    stopCameraStream();
    onClose();
  };

  return (
    <div
      style={{ backgroundColor: 'var(--bg-backdrop)' }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="fixed inset-0" onClick={handleClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-amber-tint-strong)] border border-[#E5A958]/40 text-[var(--accent-amber-text)] flex items-center justify-center shrink-0">
              <ScanLine className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif-display text-xl font-bold text-[var(--text-primary)] truncate">
                Scan Chord Sheet
              </h2>
              <p className="text-xs text-[var(--text-muted)] truncate">
                100% offline OCR · Crop handwritten chart &amp; save to Songs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close scanner"
            className="w-11 h-11 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          className="sr-only"
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="sr-only"
        />

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {/* STEP 1: CHOOSE SOURCE */}
          {step === 'source' && (
            <div className="space-y-4">
              {cameraError && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void startLiveCamera(cameraFacing)}
                  className="min-h-[112px] p-4 rounded-2xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[#E5A958]/60 text-left flex flex-col justify-between gap-3 transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#E5A958] text-[#121212] flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Take Photo (Live Camera)
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Point camera at your handwritten chord chart
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="min-h-[112px] p-4 rounded-2xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[#E5A958]/60 text-left flex flex-col justify-between gap-3 transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-amber-tint-strong)] border border-[#E5A958]/40 text-[var(--accent-amber-text)] flex items-center justify-center">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Choose from Gallery
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Pick an existing photo or screenshot from device
                    </p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center gap-2 transition"
              >
                <Upload className="w-4 h-4 text-[var(--accent-amber-text)]" />
                <span>Or open native mobile camera app</span>
              </button>

              <div className="rounded-2xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] p-4 space-y-1.5">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Tips for clean handwritten scans
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Hold the camera steady over well-lit paper, crop tightly around just the chord grid, and keep section headers like Intro, Verse, or Chorus visible. Recognition runs completely offline on your device.
                </p>
              </div>
            </div>
          )}

          {/* STEP 1B: LIVE CAMERA VIEWFINDER */}
          {step === 'camera' && (
            <div className="space-y-4">
              <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-[var(--border-subtle)] aspect-[4/3] flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="pointer-events-none absolute inset-5 border border-dashed border-[#E5A958]/70 rounded-xl" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setStep('source');
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] transition"
                >
                  Back
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
                      setCameraFacing(nextFacing);
                      void startLiveCamera(nextFacing);
                    }}
                    className="min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition"
                  >
                    <SwitchCamera className="w-4 h-4" />
                    <span>Flip</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="min-h-[44px] px-5 rounded-xl bg-[#E5A958] hover:bg-[#ecb66c] text-[#121212] text-sm font-semibold flex items-center gap-2 transition"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Photo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: IMAGE CROPPER */}
          {step === 'crop' && rotatedPreviewUrl && (
            <div className="space-y-4">
              {ocrError && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{ocrError}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                  <Crop className="w-3.5 h-3.5 text-[var(--accent-amber-text)]" />
                  <span>Drag corners or frame to select only the chord chart</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRotationDeg((r) => (r + 90) % 360)}
                    className="min-h-[40px] px-3 rounded-lg bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rotate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrop({ x: 0, y: 0, width: 1, height: 1 })}
                    className="min-h-[40px] px-3 rounded-lg bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] transition"
                  >
                    Full Image
                  </button>
                </div>
              </div>

              {/* Tightly wrapped crop stage so container matches exact image pixels */}
              <div className="w-full rounded-2xl bg-[#0B0B0B] border border-[var(--border-subtle)] p-2 flex items-center justify-center overflow-hidden">
                <div
                  ref={cropStageRef}
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={handleCropPointerUp}
                  onPointerCancel={handleCropPointerUp}
                  className="relative inline-block touch-none select-none"
                >
                  <img
                    src={rotatedPreviewUrl}
                    alt="Captured chord sheet preview"
                    className="block max-w-full max-h-[46vh] w-auto h-auto rounded-lg select-none pointer-events-none"
                    draggable={false}
                  />

                  {/* Dimmed outer mask around crop rectangle */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'rgba(0,0,0,0.55)',
                      clipPath: `polygon(
                        0% 0%, 100% 0%, 100% 100%, 0% 100%,
                        0% ${crop.y * 100}%,
                        ${crop.x * 100}% ${crop.y * 100}%,
                        ${crop.x * 100}% ${(crop.y + crop.height) * 100}%,
                        ${(crop.x + crop.width) * 100}% ${(crop.y + crop.height) * 100}%,
                        ${(crop.x + crop.width) * 100}% ${crop.y * 100}%,
                        0% ${crop.y * 100}%
                      )`,
                    }}
                  />

                  {/* Interactive Crop Box */}
                  <div
                    onPointerDown={(e) => handleCropPointerDown('move', e)}
                    style={{
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.width * 100}%`,
                      height: `${crop.height * 100}%`,
                    }}
                    className="absolute border-2 border-[#E5A958] cursor-move shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
                  >
                    {/* Rule-of-thirds alignment guides */}
                    <div className="absolute inset-x-0 top-1/3 border-t border-white/20 pointer-events-none" />
                    <div className="absolute inset-x-0 top-2/3 border-t border-white/20 pointer-events-none" />
                    <div className="absolute inset-y-0 left-1/3 border-l border-white/20 pointer-events-none" />
                    <div className="absolute inset-y-0 left-2/3 border-l border-white/20 pointer-events-none" />

                    {/* 4 Corner Handles with generous touch target */}
                    {(
                      [
                        { id: 'nw', pos: '-top-3 -left-3 cursor-nwse-resize' },
                        { id: 'ne', pos: '-top-3 -right-3 cursor-nesw-resize' },
                        { id: 'sw', pos: '-bottom-3 -left-3 cursor-nesw-resize' },
                        { id: 'se', pos: '-bottom-3 -right-3 cursor-nwse-resize' },
                      ] as const
                    ).map((h) => (
                      <div
                        key={h.id}
                        onPointerDown={(e) => handleCropPointerDown(h.id, e)}
                        className={`absolute ${h.pos} w-7 h-7 flex items-center justify-center touch-none`}
                      >
                        <div className="w-3.5 h-3.5 rounded-sm bg-[#E5A958] border-2 border-[#121212] shadow-md" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    Enhance Handwriting Contrast
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Darkens pen/pencil ink and clears lined paper background before OCR
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={enhanceHandwriting}
                  onChange={(e) => setEnhanceHandwriting(e.target.checked)}
                  className="w-5 h-5 accent-[#E5A958] rounded cursor-pointer"
                />
              </label>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('source')}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] transition"
                >
                  Change Photo
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunScan()}
                  className="min-h-[44px] px-5 rounded-xl bg-[#E5A958] hover:bg-[#ecb66c] text-[#121212] text-sm font-semibold flex items-center gap-2 transition"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Scan Cropped Area</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: OFFLINE OCR SCANNING PROGRESS */}
          {step === 'scanning' && (
            <div className="py-6 space-y-5">
              {croppedPreviewUrl && (
                <div className="w-full max-h-48 rounded-2xl bg-white/95 border border-[var(--border-subtle)] p-2 flex items-center justify-center overflow-hidden">
                  <img
                    src={croppedPreviewUrl}
                    alt="Cropped chord chart being scanned"
                    className="max-h-44 w-auto object-contain rounded"
                  />
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text-primary)]">
                    {ocrProgress.status}
                  </span>
                  <span className="tabular-nums font-semibold text-[var(--accent-amber-text)]">
                    {ocrProgress.progress}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[var(--bg-recessed)] border border-[var(--border-subtle)] overflow-hidden">
                  <div
                    className="h-full bg-[#E5A958] transition-all duration-150"
                    style={{ width: `${Math.max(4, ocrProgress.progress)}%` }}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] text-center">
                  Running Tesseract offline engine locally — no internet required
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: EDITABLE OUTPUT & SAVE TO SONGS */}
          {step === 'review' && (
            <form onSubmit={handleSaveScannedSong} className="space-y-4">
              {/* Song Title Input (Sinhala & English) */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                  Song Title (English or Sinhala) *
                </label>
                <input
                  type="text"
                  value={songTitle}
                  onChange={(e) => {
                    setSongTitle(e.target.value);
                    if (titleError) setTitleError(null);
                  }}
                  placeholder="e.g. හන්තානට පායන සඳ or Hanthanata Payana Sanda"
                  className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] focus:border-[#E5A958] focus:outline-none font-sinhala text-sm text-[var(--text-primary)]"
                />
                {titleError && (
                  <p className="text-xs text-red-400 mt-1">{titleError}</p>
                )}
              </div>

              {/* Song Metadata Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Artist (Optional)
                  </label>
                  <input
                    type="text"
                    value={songArtist}
                    onChange={(e) => setSongArtist(e.target.value)}
                    placeholder="Artist"
                    className="w-full h-10 px-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] focus:border-[#E5A958] focus:outline-none font-sinhala text-xs text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Key
                  </label>
                  <select
                    value={songKey}
                    onChange={(e) => setSongKey(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] focus:border-[#E5A958] focus:outline-none text-xs text-[var(--text-primary)]"
                  >
                    {SONG_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    BPM
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={300}
                    value={songBpm}
                    onChange={(e) => setSongBpm(Number(e.target.value) || 92)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] focus:border-[#E5A958] focus:outline-none text-xs text-[var(--text-primary)] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Meter
                  </label>
                  <select
                    value={songTimeSig}
                    onChange={(e) => setSongTimeSig(e.target.value as TimeSignature)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] focus:border-[#E5A958] focus:outline-none text-xs text-[var(--text-primary)]"
                  >
                    <option value="4/4">4/4</option>
                    <option value="3/4">3/4</option>
                    <option value="6/8">6/8</option>
                  </select>
                </div>
              </div>

              {/* Smart Corrections Summary */}
              {correctionsList.length > 0 && (
                <div className="px-3.5 py-2.5 rounded-xl bg-[var(--accent-amber-tint)] border border-[#E5A958]/40 text-xs text-[var(--accent-amber-text)]">
                  <span className="font-semibold">Auto-corrected: </span>
                  <span className="text-[var(--text-primary)]">
                    {correctionsList.slice(0, 6).join(' · ')}
                    {correctionsList.length > 6 ? ` · +${correctionsList.length - 6} more` : ''}
                  </span>
                </div>
              )}

              {/* Editor / Preview Switcher */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="inline-flex p-1 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setReviewTab('edit')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        reviewTab === 'edit'
                          ? 'bg-[#E5A958] text-[#121212]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Edit Chords Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewTab('preview')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition ${
                        reviewTab === 'preview'
                          ? 'bg-[#E5A958] text-[#121212]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Grid Preview ({totalParsedBars} bars)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleReRunAutoFix}
                    className="min-h-[36px] px-3 rounded-lg bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--accent-amber-text)] flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Fix Chords</span>
                  </button>
                </div>

                {reviewTab === 'edit' ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      rows={8}
                      spellCheck={false}
                      placeholder={'Intro\n| A | F#m | D | E7 |\n\nVerse\n| A | A/F#m | D | E |'}
                      className="w-full p-3.5 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] focus:border-[#E5A958] focus:outline-none font-mono text-sm leading-relaxed text-[var(--text-primary)] resize-y"
                    />
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
                      <span>Use section names (Intro, Verse, Chorus) &amp; &ldquo;|&rdquo; between bars</span>
                      <span>
                        {parsedSections.length} {parsedSections.length === 1 ? 'section' : 'sections'} ·{' '}
                        {totalParsedBars} {totalParsedBars === 1 ? 'bar' : 'bars'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-3 p-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)]">
                    {parsedSections.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                        No chord bars parsed yet — switch to Edit Chords Text to add bars.
                      </p>
                    ) : (
                      parsedSections.map((sec) => (
                        <div key={sec.id} className="space-y-1.5">
                          <p className="text-xs font-semibold text-[var(--accent-amber-text)]">
                            {sec.name} ({sec.bars.length} bars)
                          </p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {sec.bars.map((bar, bIdx) => (
                              <div
                                key={bar.id}
                                className="px-2 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center"
                              >
                                <span className="block text-[10px] text-[var(--text-subtle)] tabular-nums">
                                  {bIdx + 1}
                                </span>
                                <span className="font-serif-display text-sm font-bold text-[var(--text-primary)]">
                                  {formatBarChordsSummary(bar)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {rawOcrText.trim() && (
                  <details className="text-xs text-[var(--text-muted)]">
                    <summary className="cursor-pointer hover:text-[var(--text-primary)] select-none py-1">
                      View raw OCR text before auto-correction
                    </summary>
                    <pre className="mt-1.5 p-3 rounded-xl bg-[var(--bg-recessed)] border border-[var(--border-subtle)] font-mono text-[11px] whitespace-pre-wrap text-[var(--text-muted)] max-h-32 overflow-y-auto">
                      {rawOcrText.trim()}
                    </pre>
                  </details>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setStep('crop')}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-recessed)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] transition"
                >
                  Re-crop / Rescan
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-[#E5A958] hover:bg-[#ecb66c] text-[#121212] text-sm font-semibold flex items-center gap-2 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Save to Songs</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
