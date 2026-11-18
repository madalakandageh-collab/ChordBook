import { useEffect, useRef } from 'react';
import type { Song } from '../types';

interface UseMediaSessionOptions {
  isPlaying: boolean;
  song: Song | null;
  onPlay: () => void;
  onStop: () => void;
}

export function useMediaSession({
  isPlaying,
  song,
  onPlay,
  onStop,
}: UseMediaSessionOptions): void {
  const onPlayRef = useRef(onPlay);
  const onStopRef = useRef(onStop);

  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  // Register lock-screen / media notification action handlers
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;
    const setHandler = (action: MediaSessionAction, handler: (() => void) | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Unsupported MediaSessionAction on this platform
      }
    };

    setHandler('play', () => onPlayRef.current());
    setHandler('pause', () => onStopRef.current());
    setHandler('stop', () => onStopRef.current());

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('stop', null);
    };
  }, []);

  // Sync MediaMetadata and playbackState with active song and Play/Stop status
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;

    if (song && typeof MediaMetadata !== 'undefined') {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      try {
        ms.metadata = new MediaMetadata({
          title: song.title,
          artist: song.artist || 'CHORDBOOK',
          album: 'CHORDBOOK Live',
          artwork: [
            {
              src: `${origin}/pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${origin}/pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        });
      } catch {
        // Ignore metadata registration errors on restricted browsers
      }
    }

    try {
      ms.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      // Ignore playbackState errors
    }
  }, [isPlaying, song]);
}
