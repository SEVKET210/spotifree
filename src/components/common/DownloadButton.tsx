'use client';

import React from 'react';
import { CheckCircle2, ArrowDownCircle, Loader2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import type { Track } from '@/types';

interface DownloadButtonProps {
  track: Track;
  className?: string;
  size?: number;
}

/**
 * Staff-Level offline download button.
 * Reactive live query against IndexedDB offlineBlobs store with real-time feedback.
 */
export const DownloadButton: React.FC<DownloadButtonProps> = ({
  track,
  className = '',
  size = 20,
}) => {
  const { status, progress, startDownload, deleteDownload } = useDownloadManager(track);

  // Live query checking if trackId exists in IndexedDB offlineBlobs
  const isOffline = useLiveQuery(
    async () => {
      if (!track?.id) return false;
      const record = await db.offlineBlobs.get(track.id);
      return !!record;
    },
    [track?.id],
    false
  );

  const isDownloading = status === 'downloading';

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent card or track row selection trigger

    if (isOffline) {
      // Toggle remove offline cache
      await deleteDownload();
    } else if (!isDownloading) {
      await startDownload();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDownloading}
      className={`relative inline-flex items-center justify-center p-1 rounded-full transition-transform active:scale-90 hover:scale-105 disabled:cursor-not-allowed ${className}`}
      title={
        isOffline
          ? 'Downloaded for offline playback (Click to remove)'
          : isDownloading
          ? `Downloading audio & art: ${progress}%`
          : 'Download for offline playback'
      }
      aria-label={
        isOffline
          ? 'Offline downloaded'
          : isDownloading
          ? 'Downloading'
          : 'Download track'
      }
    >
      {/* 1. Offline Available: Solid Spotify-Green Check Circle */}
      {isOffline && (
        <CheckCircle2
          style={{ width: size, height: size }}
          className="text-spotify-primary fill-spotify-primary text-black transition-colors"
        />
      )}

      {/* 2. In Progress: Spinning Loader */}
      {!isOffline && isDownloading && (
        <div className="relative flex items-center justify-center">
          <Loader2
            style={{ width: size, height: size }}
            className="animate-spin text-spotify-primary"
          />
        </div>
      )}

      {/* 3. Not Downloaded: Hollow Arrow-Down Circle */}
      {!isOffline && !isDownloading && (
        <ArrowDownCircle
          style={{ width: size, height: size }}
          className="text-spotify-subtext hover:text-spotify-text transition-colors"
        />
      )}
    </button>
  );
};

export default DownloadButton;
