import { useEffect, useRef } from 'react';
import type { Song } from '../types';

interface UseMediaSessionOptions {
  isPlaying: boolean;
  song: Song | null;
  onPlay: () => void;
  onPause?: () => void;
  onStop: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
}

export function useMediaSession({
  isPlaying,
  song,
  onPlay,
  onPause,
  onStop,
  onNextTrack,
  onPreviousTrack,
}: UseMediaSessionOptions): void {
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause ?? onStop);
  const onStopRef = useRef(onStop);
  const onNextTrackRef = useRef(onNextTrack);
  const onPreviousTrackRef = useRef(onPreviousTrack);

  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);

  useEffect(() => {
    onPauseRef.current = onPause ?? onStop;
  }, [onPause, onStop]);

  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  useEffect(() => {
    onNextTrackRef.current = onNextTrack;
  }, [onNextTrack]);

  useEffect(() => {
    onPreviousTrackRef.current = onPreviousTrack;
  }, [onPreviousTrack]);

  // Register lock-screen / notification media action handlers
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
    setHandler('pause', () => onPauseRef.current());
    setHandler('stop', () => onStopRef.current());
    setHandler('nexttrack', () => onNextTrackRef.current?.());
    setHandler('previoustrack', () => onPreviousTrackRef.current?.());

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('stop', null);
      setHandler('nexttrack', null);
      setHandler('previoustrack', null);
    };
  }, []);

  // Sync MediaMetadata and playbackState with active song and Play/Pause/Stop status
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;

    if (song && typeof MediaMetadata !== 'undefined') {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      try {
        ms.metadata = new MediaMetadata({
          title: song.title || 'Untitled Song',
          artist: song.artist ? `${song.artist} · CHORDBOOK` : 'CHORDBOOK',
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
    } else if (!song) {
      try {
        ms.metadata = null;
      } catch {
        // Ignore
      }
    }

    try {
      ms.playbackState = !song ? 'none' : isPlaying ? 'playing' : 'paused';
    } catch {
      // Ignore playbackState errors
    }
  }, [isPlaying, song]);
}
