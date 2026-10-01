'use client';

import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { 
  ListPlus, 
  Heart, 
  PlusCircle, 
  ChevronRight, 
  Play, 
  Download, 
  Share2,
  FolderPlus
} from 'lucide-react';
import type { Track, Playlist } from '@/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDownloadManager } from '@/hooks/useDownloadManager';

interface TrackContextMenuProps {
  track: Track;
  children: React.ReactNode;
}

/**
 * Staff-Level Radix UI context menu for audio tracks.
 * Uses ContextMenu.Portal to avoid overflow clipping and provides
 * reactive actions for Queue, Liked Songs, and nested Playlists.
 */
export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  track,
  children,
}) => {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const { startDownload, status: downloadStatus } = useDownloadManager(track);

  // Reactive queries for playlists and like status
  const playlists = useLiveQuery(
    async () => await db.playlists.toArray(),
    [],
    [] as Playlist[]
  );

  const isSaved = useLiveQuery(
    async () => {
      const record = await db.savedTracks.get(track.id);
      return !!record;
    },
    [track.id],
    false
  );

  const handleAddToQueue = () => {
    const { queue, originalQueue } = usePlayerStore.getState();
    const alreadyInQueue = queue.some((t) => t.id === track.id);
    if (!alreadyInQueue) {
      usePlayerStore.setState({
        queue: [...queue, track],
        originalQueue: [...originalQueue, track],
      });
    }
  };

  const handleToggleLike = async () => {
    await db.toggleSavedTrack(track);
  };

  const handleAddToPlaylist = async (playlist: Playlist) => {
    const record = await db.playlists.get(playlist.id);
    const existingIds = record ? record.trackIds : playlist.trackIds;
    if (!existingIds.includes(track.id)) {
      await db.playlists.update(playlist.id, {
        trackIds: [...existingIds, track.id],
      });
    }
  };

  const handleCreateNewPlaylistWithTrack = async () => {
    const newPlaylistId = `pl-${Date.now()}`;
    await db.playlists.put({
      id: newPlaylistId,
      name: `Playlist #${playlists.length + 1}`,
      trackIds: [track.id],
      coverArt: track.albumArt,
      isLocal: true,
      createdAt: Date.now(),
    });
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>

      {/* Avoid overflow:hidden clipping by rendering into React Portal */}
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-[220px] bg-spotify-elevated rounded-md p-1 shadow-2xl border border-spotify-highlight text-sm text-spotify-text z-50 animate-in fade-in-50 zoom-in-95 select-none"
        >
          {/* Track Summary Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-spotify-highlight/40 mb-1">
            <img 
              src={track.albumArt} 
              alt={track.title} 
              className="h-7 w-7 rounded object-cover flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-spotify-text">
                {track.title}
              </p>
              <p className="truncate text-[10px] text-spotify-subtext">
                {track.artist}
              </p>
            </div>
          </div>

          {/* Quick Play */}
          <ContextMenu.Item
            onClick={() => playTrack(track)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-sm cursor-pointer outline-none hover:bg-spotify-highlight focus:bg-spotify-highlight text-spotify-text text-xs font-medium transition-colors"
          >
            <Play className="h-4 w-4 text-spotify-primary fill-current" />
            <span>Play Now</span>
          </ContextMenu.Item>

          {/* Add to Queue */}
          <ContextMenu.Item
            onClick={handleAddToQueue}
            className="flex items-center gap-2.5 px-3 py-2 rounded-sm cursor-pointer outline-none hover:bg-spotify-highlight focus:bg-spotify-highlight text-spotify-text text-xs font-medium transition-colors"
          >
            <ListPlus className="h-4 w-4 text-spotify-subtext" />
            <span>Add to Queue</span>
          </ContextMenu.Item>

          {/* Save to Liked Songs */}
          <ContextMenu.Item
            onClick={handleToggleLike}
            className="flex items-center gap-2.5 px-3 py-2 rounded-sm cursor-pointer outline-none hover:bg-spotify-highlight focus:bg-spotify-highlight text-spotify-text text-xs font-medium transition-colors"
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'text-spotify-primary fill-current' : 'text-spotify-subtext'}`} />
            <span>{isSaved ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
          </ContextMenu.Item>

          {/* Nested Sub-Menu: Add to Playlist */}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger
              className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-sm cursor-pointer outline-none hover:bg-spotify-highlight focus:bg-spotify-highlight text-spotify-text text-xs font-medium transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <PlusCircle className="h-4 w-4 text-spotify-subtext" />
                <span>Add to Playlist</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-spotify-subtext" />
            </ContextMenu.SubTrigger>

            <ContextMenu.Portal>
              <ContextMenu.SubContent
                className="min-w-[190px] bg-spotify-elevated rounded-md p-1 shadow-2xl border border-spotify-highlight text-sm text-spotify-text z-50 animate-in fade-in-50 zoom-in-95"
              >
                {/* Create New Playlist option */}
                <ContextMenu.Item
                  onClick={handleCreateNewPlaylistWithTrack}
                  className="flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer outline-none hover:bg-spotify-highlight focus:bg-spotify-highlight text-spotify-primary text-xs font-semibold transition-colors border-b border-spotify-highlight/40 mb-1"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>Create New Playlist</span>
                </ContextMenu.Item>

                {playlists.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-spotify-subtext italic">
                    No custom playlists yet
                  </div>
                ) : (
                  playlists.map((playlist) => {
                    const alreadyContains = playlist.trackIds.includes(track.id);
                    return (
                      <ContextMenu.Item
                        key={playlist.id}
                        onClick={() => handleAddToPlaylist(playlist)}
                        disabled={alreadyContains}
                        className={`flex items-center justify-between px-3 py-2 rounded-sm cursor-pointer outline-none hover:bg-spotify-highlight focus:bg-spotify-highlight text-spotify-text text-xs font-medium transition-colors ${
                          alreadyContains ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <span className="truncate max-w-[130px]">{playlist.name}</span>
                        {alreadyContains && (
                          <span className="text-[10px] text-spotify-primary font-bold">Added</span>
                        )}
                      </ContextMenu.Item>
                    );
                  })
                )}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Separator className="h-[1px] bg-spotify-highlight/60 my-1" />

          {/* Download for Offline */}
          <ContextMenu.Item
            onClick={() => startDownload()}
            disabled={downloadStatus === 'downloaded' || downloadStatus === 'downloading'}
            className="flex items-center gap-2.5 px-3 py-2 rounded-sm cursor-pointer outline-none hover:bg-spotify-highlight focus:bg-spotify-highlight text-spotify-text text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-spotify-subtext" />
            <span>
              {downloadStatus === 'downloaded'
                ? 'Saved Offline (IndexedDB)'
                : downloadStatus === 'downloading'
                ? 'Downloading...'
                : 'Download for Offline'}
            </span>
          </ContextMenu.Item>

          {/* Copy Track Link */}
          <ContextMenu.Item
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(track.streamUrl || track.id);
              }
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-sm cursor-pointer outline-none hover:bg-spotify-highlight focus:bg-spotify-highlight text-spotify-text text-xs font-medium transition-colors"
          >
            <Share2 className="h-4 w-4 text-spotify-subtext" />
            <span>Copy Stream URL</span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

export default TrackContextMenu;
