'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Heart, 
  ChevronDown, 
  Volume2, 
  VolumeX, 
  MoreHorizontal,
  Share2,
  ListMusic
} from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import DownloadButton from '@/components/DownloadButton';
import { useAudioEngine } from '@/hooks/useAudioEngine';

interface MobilePlayerProps {
  className?: string;
  onSeek?: (seconds: number) => void;
}

/**
 * Mobile Player with 60px mini-bar and Framer Motion fullscreen drawer.
 * Supports drag-to-dismiss gesture, spring physics, and iOS safe-area handling.
 */
export const MobilePlayer: React.FC<MobilePlayerProps> = ({
  className = '',
  onSeek,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Hybrid audio engine (YouTube IFrame + HTML5 Audio)
  const { togglePlayback } = useAudioEngine();

  // Global Player Store State
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const volume = usePlayerStore((s) => s.volume);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isShuffled = usePlayerStore((s) => s.isShuffled);

  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const seek = usePlayerStore((s) => s.seek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);

  // IndexedDB Saved Status
  const isSavedInDb = useLiveQuery(
    async () => {
      if (!currentTrack) return false;
      const record = await db.savedTracks.get(currentTrack.id);
      return !!record;
    },
    [currentTrack?.id],
    false
  );

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // If pulled down far enough or flicked with downward velocity, dismiss
    if (info.offset.y > 100 || info.velocity.y > 400) {
      setIsExpanded(false);
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentTrack) return;
    const targetSeconds = (Number(e.target.value) / 100) * currentTrack.duration;
    if (onSeek) {
      onSeek(targetSeconds);
    } else {
      seek(targetSeconds);
    }
  };

  const activeDuration = currentTrack?.duration || 0;

  if (!currentTrack) return null;

  return (
    <>
      {/* ========================================================
          1. COLLAPSED MINI-BAR (60px high, fixed above MobileNav)
          ======================================================== */}
      {!isExpanded && (
        <div
          onClick={() => setIsExpanded(true)}
          className={`h-[60px] mx-2 rounded-md bg-spotify-elevated/95 backdrop-blur-md border border-spotify-highlight/60 flex items-center justify-between px-3 cursor-pointer shadow-xl select-none transition-all active:scale-[0.99] ${className}`}
        >
          {/* Mini Scrubber Top Line */}
          <div className="absolute top-0 left-2 right-2 h-[2px] bg-spotify-highlight rounded-full overflow-hidden">
            <div
              className="h-full bg-spotify-primary transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-spotify-highlight shadow">
              <img
                src={currentTrack.albumArt}
                alt={currentTrack.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-spotify-text">
                {currentTrack.title}
              </p>
              <p className="truncate text-[10px] text-spotify-subtext">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Mini-bar Quick Actions */}
          <div 
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()} // Prevent expanding when clicking controls
          >
            <button
              type="button"
              onClick={async () => await db.toggleSavedTrack(currentTrack)}
              className={`p-1.5 transition-colors ${
                isSavedInDb ? 'text-spotify-primary' : 'text-spotify-subtext hover:text-spotify-text'
              }`}
            >
              <Heart className={`h-4 w-4 ${isSavedInDb ? 'fill-current' : ''}`} />
            </button>

            <DownloadButton track={currentTrack} size={18} />

            <button
              type="button"
              onClick={togglePlayback}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-spotify-text text-spotify-black ml-1 shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current translate-x-0.5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          2. EXPANDED FULLSCREEN MODAL (Framer Motion Drawer)
          ======================================================== */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="mobile-fullscreen-player"
            drag="y"
            dragConstraints={{ top: 0, bottom: 300 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 280,
            }}
            className="fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-neutral-800 via-spotify-base to-spotify-black text-spotify-text px-6 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] overflow-hidden select-none"
          >
            {/* Top Drag Handle & Header */}
            <div>
              {/* Pill Handle for drag cue */}
              <div className="w-12 h-1.5 bg-spotify-highlight rounded-full mx-auto mb-4 opacity-70" />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-2 text-spotify-subtext hover:text-spotify-text transition-colors"
                  title="Dismiss player"
                >
                  <ChevronDown className="h-6 w-6" />
                </button>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-spotify-subtext">
                    Playing from SpotiFree
                  </p>
                  <p className="text-xs font-semibold text-spotify-text">
                    Local-First Stream
                  </p>
                </div>
                <button
                  type="button"
                  className="p-2 text-spotify-subtext hover:text-spotify-text transition-colors"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Giant Centered Album Artwork */}
            <div className="my-auto flex flex-col items-center">
              <div className="relative aspect-square w-full max-w-[320px] rounded-xl overflow-hidden shadow-2xl bg-spotify-highlight border border-white/5">
                <img
                  src={currentTrack.albumArt}
                  alt={currentTrack.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* Track Info & Scrubber & Controls Container */}
            <div className="flex flex-col gap-4">
              {/* Title, Artist & Like/Download */}
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-4">
                  <h2 className="truncate text-xl font-bold tracking-tight text-spotify-text">
                    {currentTrack.title}
                  </h2>
                  <p className="truncate text-sm text-spotify-subtext mt-0.5">
                    {currentTrack.artist}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DownloadButton track={currentTrack} size={22} />
                  <button
                    type="button"
                    onClick={async () => await db.toggleSavedTrack(currentTrack)}
                    className={`p-2 transition-colors ${
                      isSavedInDb ? 'text-spotify-primary' : 'text-spotify-subtext hover:text-spotify-text'
                    }`}
                  >
                    <Heart className={`h-6 w-6 ${isSavedInDb ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Progress Scrubber Slider */}
              <div className="flex flex-col gap-1.5">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleScrubberChange}
                  className="h-1.5 w-full cursor-pointer accent-spotify-primary bg-spotify-highlight rounded-lg transition-all"
                />
                <div className="flex justify-between text-[11px] font-mono text-spotify-subtext">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(activeDuration)}</span>
                </div>
              </div>

              {/* Playback Button Row */}
              <div className="flex items-center justify-between py-2">
                <button
                  type="button"
                  onClick={toggleShuffle}
                  className={`p-2 transition-colors ${
                    isShuffled ? 'text-spotify-primary relative' : 'text-spotify-subtext hover:text-spotify-text'
                  }`}
                  title="Shuffle"
                >
                  <Shuffle className="h-5 w-5" />
                  {isShuffled && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-spotify-primary" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={prevTrack}
                  className="p-2 text-spotify-subtext hover:text-spotify-text transition-colors active:scale-95"
                  title="Previous"
                >
                  <SkipBack className="h-7 w-7" />
                </button>

                <button
                  type="button"
                  onClick={togglePlayback}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-spotify-text text-spotify-black hover:scale-105 active:scale-95 shadow-2xl transition-all"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-7 w-7 fill-current" />
                  ) : (
                    <Play className="h-7 w-7 fill-current translate-x-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={nextTrack}
                  className="p-2 text-spotify-subtext hover:text-spotify-text transition-colors active:scale-95"
                  title="Next"
                >
                  <SkipForward className="h-7 w-7" />
                </button>

                <button
                  type="button"
                  onClick={cycleRepeatMode}
                  className={`p-2 transition-colors ${
                    repeatMode !== 'off' ? 'text-spotify-primary relative' : 'text-spotify-subtext hover:text-spotify-text'
                  }`}
                  title={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === 'track' ? (
                    <Repeat1 className="h-5 w-5" />
                  ) : (
                    <Repeat className="h-5 w-5" />
                  )}
                  {repeatMode !== 'off' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-spotify-primary" />
                  )}
                </button>
              </div>

              {/* Bottom Extra Controls (Volume & Device) */}
              <div className="flex items-center justify-between pt-1 text-spotify-subtext">
                <button 
                  type="button"
                  className="p-1 hover:text-spotify-text transition-colors"
                >
                  <ListMusic className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-2 w-40">
                  <button
                    type="button"
                    onClick={() => setVolume(volume === 0 ? 80 : 0)}
                    className="hover:text-spotify-text"
                  >
                    {volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="h-1 w-full accent-spotify-primary bg-spotify-highlight rounded-lg"
                  />
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: currentTrack.title,
                        text: `Listening to ${currentTrack.title} on SpotiFree`,
                        url: window.location.href,
                      }).catch(() => {});
                    }
                  }}
                  className="p-1 hover:text-spotify-text transition-colors"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobilePlayer;
