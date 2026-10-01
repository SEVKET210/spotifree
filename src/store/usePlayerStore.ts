import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track } from '@/types';

/**
 * Modern Fisher-Yates (Knuth) array shuffle algorithm.
 * Guarantees uniform random distribution O(n) without bias.
 */
export function fisherYatesShuffle<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

export type RepeatMode = 'off' | 'track' | 'all';

export interface PlayerState {
  queue: Track[];
  currentIndex: number;
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // 0 to 100
  currentTime: number; // in seconds
  volume: number; // 0 to 100
  repeatMode: RepeatMode;
  isShuffled: boolean;
  originalQueue: Track[]; // Preserves un-shuffled playlist sequence
  requestedSeekTime: number | null;
}

export interface PlayerActions {
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
  seek: (time: number) => void;
  toggleShuffle: () => void;
  setProgress: (progress: number, currentTime: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
}

export type PlayerStore = PlayerState & PlayerActions;

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      // --- Initial State ---
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      isPlaying: false,
      progress: 0,
      currentTime: 0,
      volume: 100,
      repeatMode: 'off',
      isShuffled: false,
      originalQueue: [],
      requestedSeekTime: null,

      // --- Actions ---

      /**
       * Sets active track, resets scrubber progress/time, and starts playback.
       * If a new queue is provided, initializes queue and handles shuffle state.
       */
      playTrack: (track: Track, newQueue?: Track[]) => {
        const { isShuffled } = get();

        if (newQueue && newQueue.length > 0) {
          const originalQueue = [...newQueue];
          let queueToUse = [...newQueue];
          let trackIndex = queueToUse.findIndex((t) => t.id === track.id);

          if (trackIndex === -1) {
            queueToUse.unshift(track);
            originalQueue.unshift(track);
            trackIndex = 0;
          }

          if (isShuffled) {
            // Keep active track at front and shuffle the remaining tracks
            const remainingTracks = queueToUse.filter((t) => t.id !== track.id);
            queueToUse = [track, ...fisherYatesShuffle(remainingTracks)];
            trackIndex = 0;
          }

          set({
            queue: queueToUse,
            originalQueue,
            currentIndex: trackIndex,
            currentTrack: track,
            isPlaying: true,
            progress: 0,
            currentTime: 0,
          });
        } else {
          // Play within existing queue
          const currentQueue = get().queue;
          let trackIndex = currentQueue.findIndex((t) => t.id === track.id);
          let updatedQueue = [...currentQueue];
          let updatedOriginal = [...get().originalQueue];

          if (trackIndex === -1) {
            updatedQueue.push(track);
            updatedOriginal.push(track);
            trackIndex = updatedQueue.length - 1;
          }

          set({
            queue: updatedQueue,
            originalQueue: updatedOriginal,
            currentIndex: trackIndex,
            currentTrack: track,
            isPlaying: true,
            progress: 0,
            currentTime: 0,
          });
        }
      },

      /**
       * Toggles audio playback state.
       */
      togglePlay: () => {
        const { isPlaying, currentTrack, queue } = get();
        if (!currentTrack && queue.length > 0) {
          set({
            currentTrack: queue[0],
            currentIndex: 0,
            isPlaying: true,
            progress: 0,
            currentTime: 0,
          });
          return;
        }
        set({ isPlaying: !isPlaying });
      },

      /**
       * Advances to the next track in the queue according to repeatMode and shuffle state.
       */
      nextTrack: () => {
        const { queue, currentIndex, repeatMode, currentTrack } = get();
        if (queue.length === 0) return;

        // In 'track' repeat mode, replay currently active track from start
        if (repeatMode === 'track' && currentTrack) {
          set({
            isPlaying: true,
            progress: 0,
            currentTime: 0,
          });
          return;
        }

        const isLastTrack = currentIndex >= queue.length - 1;

        if (isLastTrack) {
          if (repeatMode === 'all') {
            const nextIndex = 0;
            set({
              currentIndex: nextIndex,
              currentTrack: queue[nextIndex],
              isPlaying: true,
              progress: 0,
              currentTime: 0,
            });
          } else {
            // 'off': Reached end of queue without looping
            set({
              isPlaying: false,
              progress: 0,
              currentTime: 0,
            });
          }
        } else {
          const nextIndex = currentIndex + 1;
          set({
            currentIndex: nextIndex,
            currentTrack: queue[nextIndex],
            isPlaying: true,
            progress: 0,
            currentTime: 0,
          });
        }
      },

      /**
       * Returns to previous track or seeks to 0 if playback has progressed > 3 seconds.
       */
      prevTrack: () => {
        const { queue, currentIndex, currentTime, repeatMode } = get();

        // Standard music player behavior: restart current song if played > 3 seconds
        if (currentTime > 3) {
          set({
            currentTime: 0,
            progress: 0,
            requestedSeekTime: 0,
          });
          return;
        }

        if (queue.length === 0) return;

        if (currentIndex > 0) {
          const prevIndex = currentIndex - 1;
          set({
            currentIndex: prevIndex,
            currentTrack: queue[prevIndex],
            isPlaying: true,
            progress: 0,
            currentTime: 0,
          });
        } else if (repeatMode === 'all') {
          // Wrap around to end of queue
          const prevIndex = queue.length - 1;
          set({
            currentIndex: prevIndex,
            currentTrack: queue[prevIndex],
            isPlaying: true,
            progress: 0,
            currentTime: 0,
          });
        } else {
          // At beginning and repeat is off: seek to 0
          set({
            currentTime: 0,
            progress: 0,
          });
        }
      },

      /**
       * Sets output volume clamped between 0 and 100.
       */
      setVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(100, Math.round(vol)));
        set({ volume: clamped });
      },

      /**
       * Seeks to a specific playback time in seconds and updates calculated progress.
       */
      seek: (time: number) => {
        const { currentTrack } = get();
        const duration = currentTrack?.duration || 0;
        const clampedTime = Math.max(0, duration > 0 ? Math.min(time, duration) : time);
        const progress = duration > 0 ? (clampedTime / duration) * 100 : 0;

        set({
          currentTime: clampedTime,
          progress,
          requestedSeekTime: clampedTime,
        });
      },

      /**
       * Toggles shuffle state using Fisher-Yates on the queue or restores originalQueue.
       */
      toggleShuffle: () => {
        const { isShuffled, queue, originalQueue, currentTrack } = get();

        if (isShuffled) {
          // Restore un-shuffled sequence
          const restoredQueue = originalQueue.length > 0 ? [...originalQueue] : [...queue];
          const newIndex = currentTrack
            ? restoredQueue.findIndex((t) => t.id === currentTrack.id)
            : 0;

          set({
            isShuffled: false,
            queue: restoredQueue,
            currentIndex: newIndex !== -1 ? newIndex : 0,
          });
        } else {
          // Store snapshot of pristine queue sequence
          const original = queue.length > 0 ? [...queue] : [];

          if (original.length <= 1) {
            set({ isShuffled: true, originalQueue: original });
            return;
          }

          let shuffledQueue: Track[];
          let newIndex = 0;

          if (currentTrack) {
            // Keep the active track playing at position 0, shuffle the remainder
            const remainingTracks = queue.filter((t) => t.id !== currentTrack.id);
            shuffledQueue = [currentTrack, ...fisherYatesShuffle(remainingTracks)];
            newIndex = 0;
          } else {
            shuffledQueue = fisherYatesShuffle(queue);
            newIndex = 0;
          }

          set({
            isShuffled: true,
            originalQueue: original,
            queue: shuffledQueue,
            currentIndex: newIndex,
          });
        }
      },

      /**
       * Runtime helpers for audio engine event synchronization
       */
      setProgress: (progress: number, currentTime: number) => {
        set({
          progress: Math.max(0, Math.min(100, progress)),
          currentTime: Math.max(0, currentTime),
        });
      },

      setIsPlaying: (isPlaying: boolean) => {
        set({ isPlaying });
      },

      setRepeatMode: (repeatMode: RepeatMode) => {
        set({ repeatMode });
      },

      cycleRepeatMode: () => {
        const modes: RepeatMode[] = ['off', 'all', 'track'];
        const current = get().repeatMode;
        const nextMode = modes[(modes.indexOf(current) + 1) % modes.length];
        set({ repeatMode: nextMode });
      },
    }),
    {
      name: 'spotifree-player-storage',
      // Explicitly exclude ephemeral playback states: isPlaying, progress, currentTime
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
        currentTrack: state.currentTrack,
        volume: state.volume,
        repeatMode: state.repeatMode,
        isShuffled: state.isShuffled,
        originalQueue: state.originalQueue,
      }),
    }
  )
);
