'use client';

import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Volume2, 
  VolumeX, 
  Heart, 
  Maximize2,
  ListMusic,
  Laptop2
} from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import DownloadButton from '@/components/DownloadButton';

interface PlayerBarProps {
  className?: string;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({ className = '' }) => {
  // Functional audio engine: audioRef, seek helper, and unified togglePlayback
  const { audioRef, seekTo, togglePlayback } = useAudioEngine();

  // Zustand Store Slices
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const volume = usePlayerStore((s) => s.volume);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isShuffled = usePlayerStore((s) => s.isShuffled);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);

  // Reactive IndexedDB Saved Track Query
  const isSavedInDb = useLiveQuery(
    async () => {
      if (!currentTrack) return false;
      const record = await db.savedTracks.get(currentTrack.id);
      return !!record;
    },
    [currentTrack?.id],
    false
  );

  // Unified Play / Pause Handler respecting both YouTube and Offline audio engines
  const handlePlayPauseToggle = () => {
    togglePlayback();
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const audio = audioRef.current;
    const totalDuration = currentTrack.duration || (audio && audio instanceof Audio && audio.duration) || 180;
    const targetSeconds = clickRatio * totalDuration;
    seekTo(targetSeconds);
  };

  const handleToggleLike = async () => {
    if (!currentTrack) return;
    await db.toggleSavedTrack(currentTrack);
  };

  const activeDuration = currentTrack?.duration || (audioRef.current && audioRef.current.duration) || 0;

  return (
    <footer
      className={`w-full bg-[#181818]/95 backdrop-blur-md border-t border-[#282828] text-white select-none ${className}`}
      aria-label="Audio player controls"
    >
      {/* Mobile Top Scrubber Line */}
      <div 
        className="block md:hidden w-full h-[3px] bg-[#282828] overflow-hidden cursor-pointer"
        onClick={handleScrubberClick}
      >
        <div 
          className="h-full bg-spotify-primary transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex h-full items-center justify-between px-3 md:px-5">
        {/* Left Section: Active Track Info */}
        <div className="flex items-center gap-3 min-w-0 w-auto md:w-[30%]">
          {currentTrack ? (
            <>
              <div className="relative h-11 w-11 md:h-14 md:w-14 flex-shrink-0 overflow-hidden rounded bg-[#282828] shadow-md">
                <img 
                  src={currentTrack.albumArt} 
                  alt={currentTrack.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 max-w-[120px] sm:max-w-[180px] md:max-w-[220px]">
                <p className="truncate text-xs md:text-sm font-semibold text-white hover:underline cursor-pointer">
                  {currentTrack.title}
                </p>
                <p className="truncate text-[11px] md:text-xs text-spotify-subtext hover:text-white hover:underline cursor-pointer transition-colors">
                  {currentTrack.artist}
                </p>
              </div>
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  onClick={handleToggleLike}
                  className={`p-1.5 transition-colors ${
                    isSavedInDb ? 'text-spotify-primary' : 'text-spotify-subtext hover:text-white'
                  }`}
                  title={isSavedInDb ? 'Saved in Library' : 'Save to Liked Songs'}
                >
                  <Heart className={`h-4 w-4 md:h-5 md:w-5 ${isSavedInDb ? 'fill-current' : ''}`} />
                </button>
                <DownloadButton track={currentTrack} size={18} />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 text-xs text-spotify-subtext">
              <div className="h-11 w-11 md:h-14 md:w-14 rounded bg-[#282828]/50 flex items-center justify-center">
                <ListMusic className="h-5 w-5 text-spotify-subtext/60" />
              </div>
              <p className="text-spotify-subtext">No track selected</p>
            </div>
          )}
        </div>

        {/* Center Section: Controls & Scrubber */}
        <div className="flex flex-col items-center justify-center max-w-[50%] md:max-w-[40%] flex-1">
          <div className="flex items-center gap-3 md:gap-6">
            {/* Shuffle Button */}
            <button
              type="button"
              onClick={toggleShuffle}
              className={`hidden sm:inline-flex p-1 transition-colors ${
                isShuffled ? 'text-spotify-primary relative' : 'text-spotify-subtext hover:text-white'
              }`}
              title={isShuffled ? 'Shuffle active' : 'Enable shuffle'}
            >
              <Shuffle className="h-4 w-4" />
              {isShuffled && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-spotify-primary" />}
            </button>

            {/* Previous Track Button */}
            <button
              type="button"
              onClick={prevTrack}
              disabled={!currentTrack}
              className="text-spotify-subtext hover:text-white disabled:opacity-40 transition-colors"
              title="Previous"
            >
              <SkipBack className="h-5 w-5 fill-current" />
            </button>

            {/* Play / Pause Toggle Button */}
            <button
              type="button"
              onClick={handlePlayPauseToggle}
              disabled={!currentTrack}
              className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-white text-black hover:scale-105 hover:bg-[#f0f0f0] disabled:opacity-40 transition-all duration-150 shadow-md"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 md:h-5 md:w-5 fill-current" />
              ) : (
                <Play className="h-4 w-4 md:h-5 md:w-5 fill-current translate-x-0.5" />
              )}
            </button>

            {/* Next Track Button */}
            <button
              type="button"
              onClick={nextTrack}
              disabled={!currentTrack}
              className="text-spotify-subtext hover:text-white disabled:opacity-40 transition-colors"
              title="Next"
            >
              <SkipForward className="h-5 w-5 fill-current" />
            </button>

            {/* Repeat Mode Button */}
            <button
              type="button"
              onClick={cycleRepeatMode}
              className={`hidden sm:inline-flex p-1 transition-colors ${
                repeatMode !== 'off' ? 'text-spotify-primary relative' : 'text-spotify-subtext hover:text-white'
              }`}
              title={`Repeat mode: ${repeatMode}`}
            >
              {repeatMode === 'track' ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
              {repeatMode !== 'off' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-spotify-primary" />
              )}
            </button>
          </div>

          {/* Desktop Scrubber Bar */}
          <div className="hidden md:flex w-full items-center gap-2 text-xs text-spotify-subtext mt-1.5">
            <span className="w-9 text-right font-mono text-[11px] text-spotify-subtext">{formatTime(currentTime)}</span>
            <div 
              className="group relative flex-1 h-3 flex items-center cursor-pointer"
              onClick={handleScrubberClick}
            >
              <div className="h-1 w-full rounded-full bg-[#3e3e3e] group-hover:h-1.5 transition-all">
                <div 
                  className="h-full rounded-full bg-white group-hover:bg-spotify-primary transition-all relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white opacity-0 group-hover:opacity-100 shadow" />
                </div>
              </div>
            </div>
            <span className="w-9 font-mono text-[11px] text-spotify-subtext">{formatTime(activeDuration)}</span>
          </div>
        </div>

        {/* Right Section: Volume & Queue */}
        <div className="hidden md:flex items-center justify-end gap-3 w-[30%] text-spotify-subtext">
          <button 
            type="button" 
            className="hover:text-white transition-colors"
            title="Queue"
          >
            <ListMusic className="h-5 w-5" />
          </button>
          <button 
            type="button" 
            className="hover:text-white transition-colors"
            title="Local Audio Engine Ready"
          >
            <Laptop2 className="h-5 w-5 text-spotify-primary" />
          </button>
          <div className="flex items-center gap-2 w-32">
            <button
              type="button"
              onClick={() => setVolume(volume === 0 ? 80 : 0)}
              className="hover:text-white transition-colors"
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 w-full cursor-pointer accent-spotify-primary bg-[#3e3e3e] hover:accent-spotify-hover rounded-lg transition-colors"
              title="Volume"
            />
          </div>
          <button 
            type="button" 
            className="hover:text-white transition-colors"
            title="Full screen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default PlayerBar;
