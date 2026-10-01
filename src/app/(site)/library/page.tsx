'use client';

import React, { useState } from 'react';
import { 
  Library as LibraryIcon, 
  Heart, 
  HardDrive, 
  Plus, 
  Play, 
  Pause, 
  Music, 
  Trash2,
  FolderPlus
} from 'lucide-react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Playlist, Track } from '@/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import DownloadButton from '@/components/DownloadButton';
import { useAudioEngine } from '@/hooks/useAudioEngine';

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'playlists' | 'liked' | 'offline'>('all');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const { togglePlayback } = useAudioEngine();

  // Live Dexie.js queries
  const playlists = useLiveQuery(
    async () => await db.playlists.toArray(),
    [],
    [] as Playlist[]
  );

  const savedTracks = useLiveQuery(
    async () => await db.savedTracks.toArray(),
    [],
    [] as Array<{ id: string; track: Track; savedAt: number }>
  );

  const offlineBlobs = useLiveQuery(
    async () => await db.offlineBlobs.toArray(),
    [],
    [] as Array<{ trackId: string; audioBlob: Blob; downloadedAt: number }>
  );

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    await db.playlists.put({
      id: `pl-${Date.now()}`,
      name: newPlaylistName.trim(),
      trackIds: [],
      isLocal: true,
      createdAt: Date.now(),
    });

    setNewPlaylistName('');
    setIsCreating(false);
  };

  const handleDeletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.playlists.delete(id);
  };

  const handleTrackClick = (track: Track, queue: Track[]) => {
    if (currentTrack?.id === track.id) {
      togglePlayback();
    } else {
      playTrack(track, queue);
    }
  };

  const likedTracksList = savedTracks.map((item) => item.track);

  return (
    <div className="relative min-h-full w-full bg-[#121212] p-4 md:p-6 text-white select-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#242424] text-spotify-primary shadow">
            <LibraryIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Your Library
            </h1>
            <p className="text-xs md:text-sm text-spotify-subtext">
              Locally stored in IndexedDB (Dexie.js) • Zero cloud requirement
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-full bg-spotify-primary px-4 py-2 text-xs md:text-sm font-bold text-black hover:bg-spotify-hover hover:scale-105 transition-all shadow-md self-start md:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Create Playlist</span>
        </button>
      </div>

      {/* Create Playlist Modal / Form */}
      {isCreating && (
        <form
          onSubmit={handleCreatePlaylist}
          className="mb-6 rounded-lg bg-[#242424] p-4 border border-[#333333] max-w-md shadow-lg"
        >
          <div className="flex items-center gap-2 mb-3 text-sm font-bold text-white">
            <FolderPlus className="h-4 w-4 text-spotify-primary" />
            <span>New Local Playlist</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="e.g. Chill Synthwave"
              className="flex-1 rounded bg-[#181818] px-3 py-2 text-sm text-white placeholder-spotify-subtext outline-none ring-1 ring-[#3e3e3e] focus:ring-2 focus:ring-spotify-primary"
              autoFocus
            />
            <button
              type="submit"
              className="rounded bg-spotify-primary px-4 py-2 text-xs font-bold text-black hover:bg-spotify-hover"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded bg-[#333333] px-3 py-2 text-xs font-semibold text-spotify-subtext hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 text-xs font-semibold overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`rounded-full px-4 py-1.5 transition-colors ${
            activeTab === 'all'
              ? 'bg-white text-black'
              : 'bg-[#242424] text-spotify-subtext hover:text-white hover:bg-[#333333]'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('playlists')}
          className={`rounded-full px-4 py-1.5 transition-colors ${
            activeTab === 'playlists'
              ? 'bg-white text-black'
              : 'bg-[#242424] text-spotify-subtext hover:text-white hover:bg-[#333333]'
          }`}
        >
          Playlists ({playlists.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('liked')}
          className={`rounded-full px-4 py-1.5 transition-colors ${
            activeTab === 'liked'
              ? 'bg-white text-black'
              : 'bg-[#242424] text-spotify-subtext hover:text-white hover:bg-[#333333]'
          }`}
        >
          Liked Songs ({savedTracks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('offline')}
          className={`rounded-full px-4 py-1.5 transition-colors ${
            activeTab === 'offline'
              ? 'bg-white text-black'
              : 'bg-[#242424] text-spotify-subtext hover:text-white hover:bg-[#333333]'
          }`}
        >
          Offline Blobs ({offlineBlobs.length})
        </button>
      </div>

      {/* Playlists & Collections Grid */}
      {(activeTab === 'all' || activeTab === 'playlists') && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-3 text-white">Your Playlists</h2>
          {playlists.length === 0 ? (
            <p className="text-sm text-spotify-subtext">No user playlists yet. Click &quot;Create Playlist&quot; above to create one.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* Liked Songs Featured Tile */}
              <div 
                onClick={() => likedTracksList.length > 0 && playTrack(likedTracksList[0], likedTracksList)}
                className="group relative flex flex-col rounded-lg bg-gradient-to-br from-indigo-900/60 to-emerald-900/60 p-4 hover:scale-[1.02] transition-all cursor-pointer shadow-md border border-indigo-700/30"
              >
                <div className="flex h-28 w-full items-center justify-center rounded bg-gradient-to-br from-indigo-700 to-emerald-700 text-white shadow-inner mb-3">
                  <Heart className="h-10 w-10 fill-current" />
                </div>
                <h3 className="text-sm font-bold text-white truncate">Liked Songs</h3>
                <p className="text-xs text-spotify-subtext mt-0.5">{savedTracks.length} tracks</p>
              </div>

              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="group relative flex flex-col rounded-lg bg-[#181818] p-4 hover:bg-[#282828] transition-all cursor-pointer shadow-md border border-[#282828]"
                >
                  <div className="flex h-28 w-full items-center justify-center rounded bg-[#242424] text-spotify-subtext group-hover:text-white mb-3">
                    <Music className="h-10 w-10" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-spotify-primary">
                        {playlist.name}
                      </h3>
                      <p className="text-xs text-spotify-subtext mt-0.5">
                        {playlist.trackIds.length} tracks
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                      className="p-1 text-spotify-subtext hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete playlist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Liked Songs Table */}
      {(activeTab === 'all' || activeTab === 'liked') && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Heart className="h-5 w-5 text-spotify-primary fill-current" />
              <span>Liked Songs ({savedTracks.length})</span>
            </h2>
          </div>

          {savedTracks.length === 0 ? (
            <p className="text-sm text-spotify-subtext">You haven&apos;t liked any songs yet. Heart a song to save it locally.</p>
          ) : (
            <div className="space-y-1">
              {likedTracksList.map((track, idx) => {
                const isThisActive = currentTrack?.id === track.id;
                const isThisPlaying = isThisActive && isPlaying;

                return (
                  <div
                    key={track.id}
                    onClick={() => handleTrackClick(track, likedTracksList)}
                    className={`group flex items-center gap-3 md:gap-4 rounded-md p-2 hover:bg-[#282828] transition-colors cursor-pointer ${
                      isThisActive ? 'bg-[#282828]' : ''
                    }`}
                  >
                    <div className="flex w-6 items-center justify-center text-sm font-semibold text-spotify-subtext">
                      {isThisPlaying ? (
                        <Pause className="h-4 w-4 text-spotify-primary fill-current" />
                      ) : (
                        <span className="group-hover:hidden">{idx + 1}</span>
                      )}
                      {!isThisPlaying && (
                        <Play className="hidden h-4 w-4 fill-current text-white group-hover:block" />
                      )}
                    </div>

                    <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded bg-[#333333]">
                      <img
                        src={track.albumArt}
                        alt={track.title}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${isThisActive ? 'text-spotify-primary' : 'text-white'}`}>
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-spotify-subtext group-hover:text-white">
                        {track.artist}
                      </p>
                    </div>

                    <DownloadButton track={track} size={16} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Offline Blobs Tab */}
      {(activeTab === 'all' || activeTab === 'offline') && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
            <HardDrive className="h-5 w-5 text-spotify-primary" />
            <span>Offline Blob Cache ({offlineBlobs.length})</span>
          </h2>
          {offlineBlobs.length === 0 ? (
            <p className="text-sm text-spotify-subtext">No tracks downloaded yet. Click the download icon on any track to store its binary audio locally.</p>
          ) : (
            <p className="text-xs text-spotify-subtext">
              {offlineBlobs.length} tracks saved directly in browser IndexedDB. Playable 100% offline with zero network connection.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
