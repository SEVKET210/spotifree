'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Search, 
  Library, 
  Plus, 
  Heart, 
  HardDrive, 
  Music2, 
  ListMusic,
  Upload
} from 'lucide-react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Playlist } from '@/types';
import { DroppablePlaylistItem } from '@/components/dnd/DragContext';

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const pathname = usePathname();

  // Reactive Dexie query
  const playlists = useLiveQuery(
    async () => await db.playlists.toArray(),
    [],
    [] as Playlist[]
  );

  const savedTracksCount = useLiveQuery(
    async () => await db.savedTracks.count(),
    [],
    0
  );

  const offlineBlobsCount = useLiveQuery(
    async () => await db.offlineBlobs.count(),
    [],
    0
  );

  const handleCreatePlaylist = async () => {
    const newId = `pl-${Date.now()}`;
    await db.playlists.put({
      id: newId,
      name: `My Playlist #${(playlists?.length || 0) + 1}`,
      trackIds: [],
      isLocal: true,
      createdAt: Date.now(),
    });
  };

  return (
    <aside 
      className={`h-full w-full flex flex-col gap-2 p-2 bg-[#000000] text-spotify-subtext select-none ${className}`}
      aria-label="Sidebar navigation"
    >
      {/* Brand & Main Navigation Block */}
      <div className="flex flex-col gap-4 rounded-lg bg-[#121212] p-4">
        <Link 
          href="/" 
          className="flex items-center gap-2 px-1 text-white hover:text-spotify-primary transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-spotify-primary text-black">
            <Music2 className="h-5 w-5 fill-current" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">SpotiFree</span>
          <span className="ml-auto rounded bg-[#282828] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-spotify-primary">
            v2.0 PWA
          </span>
        </Link>

        <nav className="flex flex-col gap-1 text-sm font-semibold">
          <Link
            href="/"
            className={`flex items-center gap-4 rounded-md px-3 py-2 transition-colors ${
              pathname === '/' 
                ? 'text-white bg-[#282828]' 
                : 'text-spotify-subtext hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Home className="h-6 w-6" />
            <span>Home</span>
          </Link>
          <Link
            href="/search"
            className={`flex items-center gap-4 rounded-md px-3 py-2 transition-colors ${
              pathname === '/search' 
                ? 'text-white bg-[#282828]' 
                : 'text-spotify-subtext hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Search className="h-6 w-6" />
            <span>Search</span>
          </Link>
          <Link
            href="/import"
            className={`flex items-center gap-4 rounded-md px-3 py-2 transition-colors ${
              pathname === '/import' 
                ? 'text-white bg-[#282828]' 
                : 'text-spotify-subtext hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Upload className="h-6 w-6" />
            <span>Import</span>
          </Link>
        </nav>
      </div>

      {/* Library & Playlists Block */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-[#121212] p-2">
        <div className="flex items-center justify-between px-3 py-2">
          <Link 
            href="/library"
            className={`flex items-center gap-3 text-sm font-semibold transition-colors ${
              pathname === '/library' ? 'text-white' : 'text-spotify-subtext hover:text-white'
            }`}
          >
            <Library className="h-6 w-6" />
            <span>Your Library</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCreatePlaylist}
              className="rounded-full p-1.5 text-spotify-subtext hover:bg-[#282828] hover:text-white transition-colors"
              title="Create new playlist"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Filter Tags */}
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium">
          <Link 
            href="/library"
            className="cursor-pointer rounded-full bg-[#242424] px-3 py-1.5 text-white hover:bg-[#333333] transition-colors"
          >
            Playlists
          </Link>
          <Link 
            href="/library"
            className="cursor-pointer rounded-full bg-[#242424] px-3 py-1.5 text-white hover:bg-[#333333] transition-colors"
          >
            Offline ({offlineBlobsCount})
          </Link>
        </div>

        {/* Playlists List with Droppable Targets */}
        <div className="mt-2 flex-1 overflow-y-auto px-1 space-y-1">
          {/* Liked Songs Auto-Playlist */}
          <Link 
            href="/library"
            className="group flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-[#1a1a1a] transition-colors"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-700 to-emerald-700 text-white shadow-md">
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white group-hover:text-spotify-primary">
                Liked Songs
              </p>
              <p className="text-xs text-spotify-subtext">{savedTracksCount} tracks</p>
            </div>
          </Link>

          {/* Offline Blobs Indicator Item */}
          <Link 
            href="/library"
            className="group flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-[#1a1a1a] transition-colors"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-[#242424] text-spotify-subtext group-hover:text-white">
              <HardDrive className="h-5 w-5 text-spotify-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white group-hover:text-spotify-primary">
                Local Storage Library
              </p>
              <p className="text-xs text-spotify-subtext">{offlineBlobsCount} tracks cached</p>
            </div>
          </Link>

          {/* User Playlists from IndexedDB */}
          {playlists.map((playlist) => (
            <DroppablePlaylistItem key={playlist.id} playlist={playlist}>
              <Link
                href="/library"
                className="group flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-[#242424] text-spotify-subtext group-hover:text-white overflow-hidden">
                  {playlist.coverArt ? (
                    <img 
                      src={playlist.coverArt} 
                      alt={playlist.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ListMusic className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white group-hover:text-spotify-primary">
                    {playlist.name}
                  </p>
                  <p className="text-xs text-spotify-subtext">
                    Playlist • {playlist.trackIds.length} tracks
                  </p>
                </div>
              </Link>
            </DroppablePlaylistItem>
          ))}
        </div>

        {/* Offline Cache Status Indicator */}
        <div className="mt-auto border-t border-[#282828] pt-2 px-3 pb-1">
          <div className="flex items-center justify-between text-[11px] text-spotify-subtext">
            <span>Offline Dexie Storage</span>
            <span className="font-mono text-spotify-primary font-bold">
              {offlineBlobsCount} Blobs
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
