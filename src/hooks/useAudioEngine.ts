'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { db } from '@/lib/db';
import { extractYouTubeId } from '@/lib/api';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

type PlaybackMode = 'offline' | 'youtube' | 'none';

// Module-level singleton state for the YouTube IFrame player.
// Lives outside React lifecycle so the player is created ONCE
// and reused across all components that call this hook.
let _ytPlayer: any = null;
let _isYtReady = false;
let _pendingVideoId: string | null = null;
let _playbackMode: PlaybackMode = 'none';
let _isTransitioning = false;
let _ytInitStarted = false;

/**
 * Hybrid Audio Engine Hook (Singleton YouTube Player):
 * 1. Offline Mode: HTML5 Audio => plays raw binary Blobs from Dexie.js (IndexedDB).
 * 2. Online Mode: Official YouTube IFrame Player => gapless, no CORS/403/cipher errors.
 * 3. MediaSession API: Full lockscreen + headset control integration.
 *
 * The YouTube player is module-scoped (singleton). Multiple components calling
 * this hook share the same player instance without double-initialization.
 */
export function useAudioEngine() {
  const audioRef = useRef<HTMLAudioElement>(
    typeof Audio !== 'undefined' ? new Audio() : ({} as HTMLAudioElement)
  );

  useEffect(() => {
    if (typeof Audio !== 'undefined' && !(audioRef.current instanceof Audio)) {
      audioRef.current = new Audio();
    }
  }, []);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const requestedSeekTime = usePlayerStore((s) => s.requestedSeekTime);

  // YouTube IFrame API Initialization (runs once per app lifetime)
  useEffect(() => {
    if (typeof window === 'undefined' || _ytInitStarted) return;
    _ytInitStarted = true;

    const CONTAINER_ID = 'spotifree-yt-mount';
    let mount = document.getElementById(CONTAINER_ID);
    if (!mount) {
      mount = document.createElement('div');
      mount.id = CONTAINER_ID;
      mount.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-9999;';
      const playerDiv = document.createElement('div');
      playerDiv.id = 'spotifree-yt-iframe-slot';
      mount.appendChild(playerDiv);
      document.body.appendChild(mount);
    }

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || _ytPlayer) return;
      try {
        _ytPlayer = new window.YT.Player('spotifree-yt-iframe-slot', {
          height: '1',
          width: '1',
          playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, enablejsapi: 1, origin: window.location.origin },
          events: {
            onReady: (event: any) => {
              _isYtReady = true;
              try { event.target.setVolume(usePlayerStore.getState().volume); } catch {}
              if (_pendingVideoId) {
                const vid = _pendingVideoId;
                _pendingVideoId = null;
                try { event.target.loadVideoById({ videoId: vid, startSeconds: 0 }); event.target.playVideo(); usePlayerStore.getState().setIsPlaying(true); } catch {}
              }
            },
            onStateChange: (event: any) => {
              if (event.data === 1) {
                usePlayerStore.getState().setIsPlaying(true);
              } else if (event.data === 2) {
                if (!_isTransitioning) usePlayerStore.getState().setIsPlaying(false);
              } else if (event.data === 0) {
                const { repeatMode } = usePlayerStore.getState();
                if (repeatMode === 'track') {
                  try { event.target.seekTo(0, true); event.target.playVideo(); } catch {}
                } else {
                  usePlayerStore.getState().nextTrack();
                }
              }
            },
            onError: (err: any) => {
              console.warn('[useAudioEngine] YouTube player error code:', err.data);
              usePlayerStore.getState().nextTrack();
            },
          },
        });
      } catch (err) {
        console.error('[useAudioEngine] Failed to initialize YouTube player:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prevCallback) prevCallback(); initPlayer(); };
      if (!document.getElementById('yt-iframe-api-script')) {
        const script = document.createElement('script');
        script.id = 'yt-iframe-api-script';
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Volume Synchronization
  useEffect(() => {
    const audio = audioRef.current;
    if (audio instanceof Audio) audio.volume = Math.max(0, Math.min(1, volume / 100));
    if (_ytPlayer && typeof _ytPlayer.setVolume === 'function' && _isYtReady) {
      try { _ytPlayer.setVolume(volume); } catch {}
    }
  }, [volume]);

  // Track Transition & Loading
  useEffect(() => {
    if (!currentTrack) {
      _playbackMode = 'none';
      if (audioRef.current instanceof Audio) { audioRef.current.pause(); audioRef.current.src = ''; }
      if (_ytPlayer && typeof _ytPlayer.stopVideo === 'function') { try { _ytPlayer.stopVideo(); } catch {} }
      return;
    }

    let isCancelled = false;
    _isTransitioning = true;

    const playCurrentTrack = async () => {
      try {
        let offlineBlobUrl = '';
        try {
          const offlineItem = await db.offlineBlobs.get(currentTrack.id);
          if (offlineItem?.audioBlob) offlineBlobUrl = URL.createObjectURL(offlineItem.audioBlob);
        } catch {}

        if (isCancelled) return;

        if (offlineBlobUrl) {
          _playbackMode = 'offline';
          if (_ytPlayer && typeof _ytPlayer.stopVideo === 'function') { try { _ytPlayer.stopVideo(); } catch {} }
          if (audioRef.current instanceof Audio) {
            audioRef.current.src = offlineBlobUrl;
            audioRef.current.load();
            await audioRef.current.play();
            usePlayerStore.getState().setIsPlaying(true);
          }
          db.recordPlayHistory(currentTrack).catch(() => {});
          return;
        }

        const isDirectAudioUrl =
          Boolean(currentTrack.streamUrl) &&
          (currentTrack.streamUrl.startsWith('http://') || currentTrack.streamUrl.startsWith('https://')) &&
          !currentTrack.streamUrl.includes('youtube.com') &&
          !currentTrack.streamUrl.includes('youtu.be');

        if (isDirectAudioUrl) {
          _playbackMode = 'offline';
          if (_ytPlayer && typeof _ytPlayer.stopVideo === 'function') { try { _ytPlayer.stopVideo(); } catch {} }
          if (audioRef.current instanceof Audio) {
            audioRef.current.src = currentTrack.streamUrl;
            audioRef.current.load();
            await audioRef.current.play();
            usePlayerStore.getState().setIsPlaying(true);
          }
          db.recordPlayHistory(currentTrack).catch(() => {});
          return;
        }

        _playbackMode = 'youtube';
        if (audioRef.current instanceof Audio) { audioRef.current.pause(); audioRef.current.src = ''; }

        const cleanVideoId = extractYouTubeId(currentTrack.id) || currentTrack.id;

        if (_isYtReady && _ytPlayer && typeof _ytPlayer.loadVideoById === 'function') {
          try {
            _ytPlayer.loadVideoById({ videoId: cleanVideoId, startSeconds: 0 });
            _ytPlayer.setVolume(usePlayerStore.getState().volume);
            _ytPlayer.playVideo();
            usePlayerStore.getState().setIsPlaying(true);
          } catch (err) {
            console.warn('[useAudioEngine] YT loadVideoById error:', err);
          }
        } else {
          _pendingVideoId = cleanVideoId;
        }

        db.recordPlayHistory(currentTrack).catch(() => {});
      } catch (err: any) {
        if (!isCancelled && err?.name !== 'AbortError') {
          console.warn('[useAudioEngine] Track playback error:', err?.message || err);
        }
      } finally {
        _isTransitioning = false;
      }
    };

    playCurrentTrack();
    return () => { isCancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);

  // Play / Pause Synchronization
  useEffect(() => {
    if (_playbackMode === 'offline') {
      const audio = audioRef.current;
      if (audio instanceof Audio) {
        if (isPlaying && audio.paused) audio.play().catch(() => {});
        else if (!isPlaying && !audio.paused) audio.pause();
      }
    } else if (_playbackMode === 'youtube') {
      if (_ytPlayer && _isYtReady) {
        try { if (isPlaying) _ytPlayer.playVideo(); else _ytPlayer.pauseVideo(); } catch {}
      }
    }
  }, [isPlaying]);

  // Progress Poller & HTML5 Audio Event Handlers
  useEffect(() => {
    const timer = setInterval(() => {
      const storeState = usePlayerStore.getState();
      if (!storeState.isPlaying || _isTransitioning) return;

      if (_playbackMode === 'youtube') {
        if (_ytPlayer && _isYtReady && typeof _ytPlayer.getCurrentTime === 'function') {
          try {
            const current = _ytPlayer.getCurrentTime() || 0;
            const duration = _ytPlayer.getDuration() || storeState.currentTrack?.duration || 180;
            if (duration > 0) storeState.setProgress(Math.min(100, Math.max(0, (current / duration) * 100)), current);
          } catch {}
        }
      } else if (_playbackMode === 'offline') {
        const audio = audioRef.current;
        if (audio instanceof Audio && !audio.paused) {
          const current = audio.currentTime || 0;
          const duration = audio.duration || storeState.currentTrack?.duration || 180;
          if (duration > 0) storeState.setProgress(Math.min(100, Math.max(0, (current / duration) * 100)), current);
        }
      }
    }, 300);

    const audio = audioRef.current;
    const handleAudioEnded = () => {
      if (_playbackMode !== 'offline') return;
      const { repeatMode } = usePlayerStore.getState();
      if (repeatMode === 'track') {
        if (audio instanceof Audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
      } else {
        usePlayerStore.getState().nextTrack();
      }
    };

    if (audio instanceof Audio) audio.addEventListener('ended', handleAudioEnded);

    return () => {
      clearInterval(timer);
      if (audio instanceof Audio) audio.removeEventListener('ended', handleAudioEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MediaSession Lockscreen & System Metadata
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentTrack) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: 'SpotiFree',
        artwork: [
          { src: currentTrack.albumArt, sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.albumArt, sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.albumArt, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
        ['play', () => usePlayerStore.getState().setIsPlaying(true)],
        ['pause', () => usePlayerStore.getState().setIsPlaying(false)],
        ['previoustrack', () => usePlayerStore.getState().prevTrack()],
        ['nexttrack', () => usePlayerStore.getState().nextTrack()],
        ['seekto', (details) => { if (details.seekTime !== undefined) usePlayerStore.getState().seek(details.seekTime); }],
      ];

      for (const [action, handler] of handlers) { try { navigator.mediaSession.setActionHandler(action, handler); } catch {} }
      return () => { for (const [action] of handlers) { try { navigator.mediaSession.setActionHandler(action, null); } catch {} } };
    } catch {}
  }, [currentTrack]);

  // Seek Synchronization (requestedSeekTime from store)
  useEffect(() => {
    if (requestedSeekTime === null || requestedSeekTime === undefined) return;
    const clamped = Math.max(0, requestedSeekTime);
    if (_playbackMode === 'offline') {
      const audio = audioRef.current;
      if (audio instanceof Audio) audio.currentTime = clamped;
    } else if (_playbackMode === 'youtube') {
      if (_ytPlayer && _isYtReady && typeof _ytPlayer.seekTo === 'function') {
        try { _ytPlayer.seekTo(clamped, true); } catch {}
      }
    }
    usePlayerStore.setState({ requestedSeekTime: null });
  }, [requestedSeekTime]);

  const seekTo = useCallback((seconds: number) => {
    if (!isFinite(seconds)) return;
    usePlayerStore.getState().seek(seconds);
  }, []);

  const togglePlayback = useCallback(() => {
    const { currentTrack: active, queue, togglePlay } = usePlayerStore.getState();
    if (!active && queue.length > 0) { usePlayerStore.getState().playTrack(queue[0]); return; }
    togglePlay();
  }, []);

  return { audioRef, seekTo, togglePlayback };
}
