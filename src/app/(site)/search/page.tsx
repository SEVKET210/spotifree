'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { 
  Search as SearchIcon, 
  X, 
  Music, 
  Loader2, 
  Sparkles,
  Play,
  Pause
} from 'lucide-react';
import { searchMusic } from '@/lib/api';
import type { Track } from '@/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import TrackRow from '@/components/ui/TrackRow';
import { useAudioEngine } from '@/hooks/useAudioEngine';

const QUICK_SEARCH_TAGS = [
  'Daft Punk',
  'The Weeknd',
  'Hans Zimmer',
  'Coldplay',
  'Queen',
  'Interstellar Soundtrack',
  'Synthwave Night Drive',
  'Lofi Hip Hop Chill',
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [, startTransition] = useTransition();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const { togglePlayback } = useAudioEngine();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const tracks = await searchMusic(searchQuery);
      startTransition(() => {
        setResults(tracks);
      });
    } catch (err) {
      console.error('[SearchPage] Search error:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search on query input change
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(trimmed);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlayback();
    } else {
      // Explicitly calls playTrack from Zustand store with full results queue
      playTrack(track, results);
    }
  };

  // Structured breakdown: Top Result card + Songs list + Remaining results
  const topResult = results[0];
  const topSongs = results.slice(0, 4);
  const remainingSongs = results.slice(4);

  const isTopPlaying = currentTrack?.id === topResult?.id && isPlaying;

  return (
    <div className="relative min-h-full w-full bg-[#121212] p-4 md:p-6 text-white select-none">
      {/* Sticky Search Header */}
      <div className="sticky top-0 z-30 pb-4 pt-2 bg-[#121212]/95 backdrop-blur-md">
        <div className="relative max-w-xl">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-spotify-subtext">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-spotify-primary" />
            ) : (
              <SearchIcon className="h-5 w-5" />
            )}
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to play? (Artists, songs, or albums)"
            className="w-full rounded-full bg-[#242424] py-3 pl-11 pr-10 text-sm font-medium text-white placeholder-spotify-subtext outline-none ring-1 ring-transparent focus:ring-2 focus:ring-white transition-all shadow-inner"
            autoFocus
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setHasSearched(false);
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-spotify-subtext hover:text-white transition-colors"
              title="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Quick Search Chips */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-spotify-subtext flex items-center gap-1 font-semibold flex-shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-spotify-primary" />
            Trending:
          </span>
          {QUICK_SEARCH_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setQuery(tag);
                performSearch(tag);
              }}
              className={`rounded-full px-3 py-1 font-medium transition-colors flex-shrink-0 ${
                query === tag
                  ? 'bg-white text-black font-semibold'
                  : 'bg-[#2a2a2a] text-spotify-subtext hover:text-white hover:bg-[#333333]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Main Search View */}
      <div className="mt-5">
        {isLoading && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-spotify-subtext">
            <Loader2 className="h-10 w-10 animate-spin text-spotify-primary mb-4" />
            <p className="text-sm font-medium">Searching YouTube for music streams...</p>
          </div>
        ) : results.length > 0 ? (
          <div>
            {/* Structured Top Section: "Top result" Card + "Songs" List */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
              {/* Top Result Card */}
              {topResult && (
                <div className="lg:col-span-5 flex flex-col">
                  <h2 className="text-xl font-bold text-white mb-3 tracking-tight">
                    Top result
                  </h2>
                  <div
                    onClick={() => handleTrackClick(topResult)}
                    className="group relative flex-1 flex flex-col justify-between rounded-lg bg-[#181818] hover:bg-[#282828] p-5 transition-all duration-300 cursor-pointer shadow-lg border border-[#242424] min-h-[220px]"
                  >
                    <div>
                      <div className="relative h-24 w-24 rounded-md overflow-hidden bg-[#242424] shadow-2xl mb-4">
                        <img
                          src={topResult.albumArt}
                          alt={topResult.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <h3 className="truncate text-2xl md:text-3xl font-extrabold text-white tracking-tight group-hover:text-spotify-primary transition-colors">
                        {topResult.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm font-medium text-spotify-subtext group-hover:text-white transition-colors truncate max-w-[200px]">
                          {topResult.artist}
                        </span>
                        <span className="rounded-full bg-[#121212] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white border border-[#333333]">
                          Song
                        </span>
                      </div>
                    </div>

                    {/* Floating Green Play Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrackClick(topResult);
                      }}
                      className={`absolute right-5 bottom-5 flex h-12 w-12 items-center justify-center rounded-full bg-spotify-primary text-black shadow-2xl transition-all duration-300 ${
                        isTopPlaying
                          ? 'opacity-100 scale-100'
                          : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105'
                      }`}
                      title={isTopPlaying ? 'Pause' : `Play ${topResult.title}`}
                    >
                      {isTopPlaying ? (
                        <Pause className="h-5 w-5 fill-current" />
                      ) : (
                        <Play className="h-5 w-5 fill-current translate-x-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Songs List (Top 4 Songs) */}
              <div className="lg:col-span-7 flex flex-col">
                <h2 className="text-xl font-bold text-white mb-3 tracking-tight">
                  Songs
                </h2>
                <div className="flex flex-col space-y-1">
                  {topSongs.map((track, idx) => (
                    <TrackRow
                      key={`top-song-${track.id}-${idx}`}
                      track={track}
                      index={idx}
                      isActive={currentTrack?.id === track.id}
                      isPlaying={isPlaying}
                      onPlay={() => handleTrackClick(track)}
                      showIndex={true}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Remaining Tracks Section (if more than 4 items) */}
            {remainingSongs.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-white mb-3 tracking-tight">
                  More from this search ({remainingSongs.length})
                </h2>
                <div className="flex flex-col space-y-1">
                  {remainingSongs.map((track, idx) => (
                    <TrackRow
                      key={`remaining-song-${track.id}-${idx}`}
                      track={track}
                      index={idx + 4}
                      isActive={currentTrack?.id === track.id}
                      isPlaying={isPlaying}
                      onPlay={() => handleTrackClick(track)}
                      showIndex={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Music className="h-12 w-12 text-spotify-subtext mb-3 opacity-40" />
            <h3 className="text-lg font-bold text-white mb-1">
              No full songs found for &quot;{query}&quot;
            </h3>
            <p className="text-sm text-spotify-subtext max-w-sm">
              Shorts and snippets under 60 seconds are filtered out. Try searching for an artist or full song title.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#242424] text-spotify-primary mb-4 shadow-lg">
              <SearchIcon className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Search SpotiFree</h3>
            <p className="text-sm text-spotify-subtext max-w-md">
              Stream full music tracks, discover albums, and save offline blobs with zero ad interruptions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
