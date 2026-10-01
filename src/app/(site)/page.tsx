'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Sparkles, 
  Wrench,
  Music,
  Compass,
  Loader2
} from 'lucide-react';
import type { Track } from '@/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import { searchMusic } from '@/lib/api';
import DownloadButton from '@/components/DownloadButton';
import TrackContextMenu from '@/components/ui/TrackContextMenu';
import { DraggableTrackItem } from '@/components/dnd/DragContext';
import DiagnosticsModal from '@/components/developer/DiagnosticsModal';
import Link from 'next/link';
import { useAudioEngine } from '@/hooks/useAudioEngine';

// Default initial seed tracks with verified high-fidelity direct audio streams
const INITIAL_FEATURED_TRACKS: Track[] = [
  {
    id: 'track-starboy',
    title: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    albumArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    duration: 230,
  },
  {
    id: 'track-midnight-city',
    title: 'Midnight City',
    artist: 'M83',
    albumArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3',
    duration: 243,
  },
  {
    id: 'track-synthwave-run',
    title: 'Nightcall',
    artist: 'Kavinsky',
    albumArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3',
    duration: 259,
  },
  {
    id: 'track-resonance',
    title: 'Resonance',
    artist: 'HOME',
    albumArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3',
    duration: 212,
  },
];

export default function HomePage() {
  const [featuredTracks, setFeaturedTracks] = useState<Track[]>(INITIAL_FEATURED_TRACKS);
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const { togglePlayback } = useAudioEngine();

  // Fetch real trending tracks from API on initial load
  useEffect(() => {
    let isMounted = true;
    const loadRealTracks = async () => {
      setIsLiveLoading(true);
      try {
        const liveTracks = await searchMusic('Top Hits');
        if (isMounted && liveTracks.length > 0) {
          setFeaturedTracks(liveTracks.slice(0, 12));
        }
      } catch (err) {
        console.warn('[HomePage] Initial trending fetch failed, using fallback:', err);
      } finally {
        if (isMounted) setIsLiveLoading(false);
      }
    };

    loadRealTracks();
    return () => {
      isMounted = false;
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlayback();
    } else {
      // Explicitly calls playTrack from Zustand store with full queue
      playTrack(track, featuredTracks);
    }
  };

  return (
    <div className="relative min-h-full w-full bg-gradient-to-b from-emerald-950/40 via-[#121212] to-[#121212] p-4 md:p-6 text-white select-none">
      {/* Diagnostics Modal for Developer Telemetry Export */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      {/* Top Bar Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button 
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-[#282828] transition-colors"
            title="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button 
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-[#282828] transition-colors"
            title="Go forward"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="flex items-center gap-2 rounded-full bg-[#242424] px-4 py-1.5 text-xs font-semibold text-spotify-subtext hover:text-white hover:bg-[#333333] transition-colors border border-[#333333]"
          >
            <Music className="h-3.5 w-3.5 text-spotify-primary" />
            <span>Search All Music</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="hidden sm:flex items-center gap-2 rounded-full bg-[#242424] px-3 py-1.5 text-xs font-medium text-spotify-subtext border border-[#333333] hover:text-white hover:border-spotify-primary/60 transition-colors"
            title="Open local crash telemetry & diagnostics tool"
          >
            <Wrench className="h-3.5 w-3.5 text-spotify-primary" />
            <span>Diagnostics</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#282828] hover:scale-105 border border-[#333333] transition-all"
            title="Open Settings"
          >
            <User className="h-5 w-5 text-spotify-subtext hover:text-white" />
          </button>
        </div>
      </header>

      {/* Greeting Title */}
      <div className="mt-4 mb-6 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
          {getGreeting()}
        </h1>
        {isLiveLoading && (
          <div className="flex items-center gap-2 text-xs text-spotify-subtext">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-spotify-primary" />
            <span>Updating live feed...</span>
          </div>
        )}
      </div>

      {/* Quick Play Shortcuts */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {featuredTracks.slice(0, 6).map((track) => {
          const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;

          return (
            <div
              key={`quick-${track.id}`}
              onClick={() => handleTrackClick(track)}
              className="group relative flex items-center gap-4 overflow-hidden rounded bg-[#242424]/60 hover:bg-[#282828] transition-all duration-200 cursor-pointer shadow border border-[#282828]/50"
            >
              <div className="h-16 w-16 md:h-20 md:w-20 flex-shrink-0 bg-[#282828]">
                {track.albumArt ? (
                  <img
                    src={track.albumArt}
                    alt={track.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#282828]">
                    <Compass className="h-6 w-6 text-spotify-subtext" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pr-14">
                <span className="block truncate text-sm md:text-base font-semibold text-white group-hover:text-spotify-primary">
                  {track.title}
                </span>
                <span className="block truncate text-xs text-spotify-subtext">
                  {track.artist}
                </span>
              </div>
              <button
                type="button"
                className={`absolute right-3 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-spotify-primary text-black shadow-xl transition-all duration-200 ${
                  isThisTrackPlaying
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105'
                }`}
                title={isThisTrackPlaying ? 'Pause' : `Play ${track.title}`}
              >
                {isThisTrackPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current translate-x-0.5" />
                )}
              </button>
            </div>
          );
        })}
      </section>

      {/* Featured Tracks Grid */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Featured For Today
            </h2>
            <p className="text-xs md:text-sm text-spotify-subtext">
              Real audio streams • Right-click for options • Drag to sidebar playlists
            </p>
          </div>
          <Link 
            href="/search"
            className="text-xs font-bold uppercase tracking-wider text-spotify-subtext hover:text-white hover:underline transition-colors"
          >
            Show All
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {featuredTracks.map((track) => {
            const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;

            return (
              <TrackContextMenu key={track.id} track={track}>
                <DraggableTrackItem track={track}>
                  <div
                    onClick={() => handleTrackClick(track)}
                    className={`group relative flex flex-col rounded-lg bg-[#181818] hover:bg-[#282828] p-3.5 transition-all duration-200 cursor-pointer shadow-md select-none border border-[#242424] ${
                      currentTrack?.id === track.id ? 'ring-1 ring-spotify-primary/60 bg-[#282828]' : ''
                    }`}
                  >
                    <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-md bg-[#282828] shadow-lg">
                      <img
                        src={track.albumArt}
                        alt={track.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        className={`absolute right-2 bottom-2 flex h-10 w-10 items-center justify-center rounded-full bg-spotify-primary text-black shadow-2xl transition-all duration-200 ${
                          isThisTrackPlaying
                            ? 'opacity-100 translate-y-0 scale-100'
                            : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105'
                        }`}
                        title={isThisTrackPlaying ? 'Pause' : `Play ${track.title}`}
                      >
                        {isThisTrackPlaying ? (
                          <Pause className="h-5 w-5 fill-current" />
                        ) : (
                          <Play className="h-5 w-5 fill-current translate-x-0.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-bold ${
                          currentTrack?.id === track.id ? 'text-spotify-primary' : 'text-white group-hover:text-spotify-primary'
                        }`}>
                          {track.title}
                        </p>
                        <p className="truncate text-xs text-spotify-subtext mt-0.5 group-hover:text-white transition-colors">
                          {track.artist}
                        </p>
                      </div>
                      <DownloadButton track={track} size={18} />
                    </div>
                  </div>
                </DraggableTrackItem>
              </TrackContextMenu>
            );
          })}
        </div>
      </section>

      {/* Local-First Architecture Callout */}
      <section className="mb-10 rounded-xl bg-gradient-to-r from-[#1f1f1f] via-[#181818] to-[#181818] p-4 md:p-6 border border-[#282828]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-spotify-primary text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              <span>SpotiFree Native PWA Audio Engine</span>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white">
              Zero-Cost Local Streaming & IndexedDB Storage
            </h3>
            <p className="text-xs md:text-sm text-spotify-subtext max-w-xl">
              Zero monthly subscriptions, zero audio ads. Direct streaming via Piped APIs, offline caching with IndexedDB Blobs, and cross-platform native execution.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/search"
              className="flex items-center gap-2 rounded-full bg-spotify-primary px-5 py-2.5 text-xs md:text-sm font-bold text-black hover:bg-spotify-hover hover:scale-105 transition-all shadow-md"
            >
              <Music className="h-4 w-4" />
              <span>Start Searching</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
