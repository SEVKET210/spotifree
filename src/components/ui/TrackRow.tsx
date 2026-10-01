'use client';

import React from 'react';
import { Play, Pause, Music, Clock } from 'lucide-react';
import type { Track } from '@/types';
import DownloadButton from '@/components/DownloadButton';
import TrackContextMenu from '@/components/ui/TrackContextMenu';
import { DraggableTrackItem } from '@/components/dnd/DragContext';

interface TrackRowProps {
  track: Track;
  index?: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPlay: () => void;
  showIndex?: boolean;
  showCover?: boolean;
  showDuration?: boolean;
  className?: string;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  isActive = false,
  isPlaying = false,
  onPlay,
  showIndex = true,
  showCover = true,
  showDuration = true,
  className = '',
}) => {
  const isThisPlaying = isActive && isPlaying;

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '3:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <TrackContextMenu track={track}>
      <DraggableTrackItem track={track}>
        <div
          onClick={onPlay}
          className={`group flex items-center gap-3 md:gap-4 rounded-md p-2 hover:bg-[#282828] transition-colors cursor-pointer select-none ${
            isActive ? 'bg-[#282828]' : ''
          } ${className}`}
        >
          {/* Index / Play / Pause indicator */}
          {showIndex && (
            <div className="flex w-6 items-center justify-center text-sm font-semibold text-spotify-subtext flex-shrink-0">
              {isThisPlaying ? (
                <Pause className="h-4 w-4 text-spotify-primary fill-current" />
              ) : (
                <>
                  <span className={index !== undefined ? 'group-hover:hidden' : 'hidden'}>
                    {index !== undefined ? index + 1 : ''}
                  </span>
                  <Play className={`h-4 w-4 fill-current text-white ${index !== undefined ? 'hidden group-hover:block' : 'block'}`} />
                </>
              )}
            </div>
          )}

          {/* Cover Art Thumbnail */}
          {showCover && (
            <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded bg-[#282828] shadow">
              {track.albumArt ? (
                <img
                  src={track.albumArt}
                  alt={track.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music className="h-5 w-5 text-spotify-subtext" />
                </div>
              )}
            </div>
          )}

          {/* Strict Separation: Title bold & white on top, Artist gray and smaller BELOW title */}
          <div className="flex flex-col min-w-0 flex-1 justify-center">
            <span
              className={`truncate text-sm font-bold transition-colors ${
                isActive ? 'text-spotify-primary' : 'text-white group-hover:text-spotify-primary'
              }`}
            >
              {track.title}
            </span>
            <span className="truncate text-xs text-spotify-subtext group-hover:text-white transition-colors mt-0.5">
              {track.artist}
            </span>
          </div>

          {/* Action icons & Duration */}
          <div className="flex items-center gap-3 text-xs text-spotify-subtext flex-shrink-0">
            <DownloadButton track={track} size={16} />
            {showDuration && (
              <div className="flex items-center gap-1 font-mono w-12 justify-end text-spotify-subtext group-hover:text-white">
                <Clock className="h-3 w-3 opacity-60" />
                <span>{formatDuration(track.duration)}</span>
              </div>
            )}
          </div>
        </div>
      </DraggableTrackItem>
    </TrackContextMenu>
  );
};

export default TrackRow;
