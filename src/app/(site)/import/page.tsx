'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Link2,
  ListMusic,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  Music2,
  ChevronRight,
  AlertCircle,
  Youtube,
  Sparkles,
  ClipboardList,
  Zap,
  X,
} from 'lucide-react';
import {
  parseBulkTextList,
  fetchYouTubePlaylist,
  fetchSpotifyPlaylistTracks,
  extractYouTubePlaylistId,
  searchMusic,
  type PlaylistTrackItem,
} from '@/lib/api';
import type { Track } from '@/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useAudioEngine } from '@/hooks/useAudioEngine';

type ImportMode = 'text' | 'youtube' | 'spotify';
type TrackStatus = 'pending' | 'searching' | 'found' | 'failed';

interface ImportedTrack {
  raw: PlaylistTrackItem;
  status: TrackStatus;
  resolvedTrack?: Track;
  error?: string;
}

const CONCURRENCY = 3;

async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onProgress: (index: number, result: T | Error) => void
): Promise<void> {
  let idx = 0;
  const pool: Promise<void>[] = [];
  async function worker() {
    while (idx < tasks.length) {
      const current = idx++;
      try {
        const result = await tasks[current]();
        onProgress(current, result);
      } catch (e) {
        onProgress(current, e instanceof Error ? e : new Error(String(e)));
      }
    }
  }
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    pool.push(worker());
  }
  await Promise.all(pool);
}

function ModeTab({
  mode, current, icon: Icon, label, desc, onClick,
}: {
  mode: ImportMode; current: ImportMode; icon: React.ElementType; label: string; desc: string; onClick: () => void;
}) {
  const active = mode === current;
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl p-4 text-center transition-all duration-200 border ${active ? 'bg-[#1db954]/10 border-[#1db954]/40 text-white shadow-lg shadow-[#1db954]/10' : 'bg-[#181818] border-[#2a2a2a] text-spotify-subtext hover:border-[#444] hover:text-white hover:bg-[#1e1e1e]'}`}
    >
      <Icon className={`h-5 w-5 ${active ? 'text-[#1db954]' : ''}`} />
      <span className="text-sm font-bold">{label}</span>
      <span className="text-[10px] opacity-60 leading-tight">{desc}</span>
    </button>
  );
}

function TrackStatusBadge({ status }: { status: TrackStatus }) {
  if (status === 'searching') return <Loader2 className="h-4 w-4 animate-spin text-[#1db954] flex-shrink-0" />;
  if (status === 'found') return <CheckCircle2 className="h-4 w-4 text-[#1db954] flex-shrink-0" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />;
  return <div className="h-4 w-4 rounded-full bg-[#3a3a3a] flex-shrink-0" />;
}

export default function ImportPage() {
  const [mode, setMode] = useState<ImportMode>('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [tracks, setTracks] = useState<ImportedTrack[]>([]);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'resolving' | 'done'>('idle');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fetchedPlaylistName, setFetchedPlaylistName] = useState<string | null>(null);
  const abortRef = useRef(false);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const { togglePlayback } = useAudioEngine();

  const updateTrack = useCallback((index: number, patch: Partial<ImportedTrack>) => {
    setTracks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const resolveItems = useCallback(async (items: PlaylistTrackItem[]) => {
    abortRef.current = false;
    const initial: ImportedTrack[] = items.map((raw) => ({ raw, status: 'pending' }));
    setTracks(initial);
    setPhase('resolving');

    const tasks = items.map((item, i) => async () => {
      if (abortRef.current) return null;
      updateTrack(i, { status: 'searching' });
      const query = item.videoId ? item.videoId : item.artist ? `${item.artist} ${item.title}` : item.title;
      try {
        const results = await searchMusic(query);
        if (results.length === 0) throw new Error('No results');
        updateTrack(i, { status: 'found', resolvedTrack: results[0] });
        return results[0];
      } catch (e) {
        updateTrack(i, { status: 'failed', error: (e as Error).message });
        return null;
      }
    });
    await runConcurrent(tasks, CONCURRENCY, () => {});
    setPhase('done');
  }, [updateTrack]);

  const handleImport = useCallback(async () => {
    setGlobalError(null);
    setTracks([]);
    setFetchedPlaylistName(null);
    try {
      if (mode === 'text') {
        if (!textInput.trim()) { setGlobalError('Lutfen en az bir sarki adi girin.'); return; }
        const items = parseBulkTextList(textInput);
        if (items.length === 0) { setGlobalError('Gecerli sarki bulunamadi.'); return; }
        await resolveItems(items);
      } else if (mode === 'youtube') {
        const playlistId = extractYouTubePlaylistId(urlInput);
        if (!playlistId) { setGlobalError("Gecerli bir YouTube playlist URL'si girin."); return; }
        setPhase('fetching');
        const items = await fetchYouTubePlaylist(playlistId);
        setFetchedPlaylistName(`YouTube Playlist (${items.length} sarki)`);
        await resolveItems(items);
      } else if (mode === 'spotify') {
        if (!urlInput.includes('spotify.com/playlist/')) { setGlobalError("Gecerli bir Spotify playlist URL'si girin."); return; }
        setPhase('fetching');
        const items = await fetchSpotifyPlaylistTracks(urlInput);
        setFetchedPlaylistName(`Spotify Playlist (${items.length} sarki)`);
        await resolveItems(items);
      }
    } catch (e) {
      setGlobalError((e as Error).message || 'Bilinmeyen hata olustu.');
      setPhase('idle');
    }
  }, [mode, textInput, urlInput, resolveItems]);

  const handleCancel = () => { abortRef.current = true; setPhase('done'); };

  const resolvedTracks = tracks.filter((t) => t.status === 'found' && t.resolvedTrack).map((t) => t.resolvedTrack as Track);

  const handlePlayAll = () => { if (resolvedTracks.length === 0) return; playTrack(resolvedTracks[0], resolvedTracks); };

  const handlePlayTrack = (track: Track) => {
    if (currentTrack?.id === track.id) { togglePlayback(); }
    else { playTrack(track, resolvedTracks.length > 0 ? resolvedTracks : [track]); }
  };

  const foundCount = tracks.filter((t) => t.status === 'found').length;
  const failedCount = tracks.filter((t) => t.status === 'failed').length;
  const pendingCount = tracks.filter((t) => t.status === 'pending' || t.status === 'searching').length;
  const isProcessing = phase === 'fetching' || phase === 'resolving';

  return (
    <div className="min-h-full w-full bg-[#121212] text-white select-none">
      <div className="sticky top-0 z-20 bg-gradient-to-b from-[#1a0a2e] to-[#121212] px-5 pt-6 pb-4 backdrop-blur-md border-b border-[#1e1e1e]">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1db954]/20 border border-[#1db954]/30">
            <Upload className="h-5 w-5 text-[#1db954]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Toplu Ice Aktarma</h1>
            <p className="text-xs text-spotify-subtext">Sarki listesi veya playlist linki ile kuyruga ekle</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 max-w-3xl mx-auto space-y-5">
        <div className="flex gap-2">
          <ModeTab mode="text" current={mode} icon={ClipboardList} label="Metin Listesi" desc="Satir satir sarki adi" onClick={() => { setMode('text'); setGlobalError(null); }} />
          <ModeTab mode="youtube" current={mode} icon={Youtube} label="YouTube" desc="Playlist linki" onClick={() => { setMode('youtube'); setGlobalError(null); }} />
          <ModeTab mode="spotify" current={mode} icon={Music2} label="Spotify" desc="Playlist linki" onClick={() => { setMode('spotify'); setGlobalError(null); }} />
        </div>

        <div className="rounded-xl bg-[#181818] border border-[#2a2a2a] p-4 space-y-3">
          {mode === 'text' ? (
            <>
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-white">Sarki Listesi</label>
                <span className="text-[10px] text-spotify-subtext bg-[#2a2a2a] px-2 py-0.5 rounded-full">Her satira bir sarki</span>
              </div>
              <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)}
                placeholder={"Ornekler:\nDaft Punk - Get Lucky\nThe Weeknd - Blinding Lights\nEminem - Lose Yourself\nLofi Hip Hop Chill"}
                rows={8}
                className="w-full rounded-lg bg-[#242424] border border-[#333] px-4 py-3 text-sm text-white placeholder-[#555] outline-none focus:border-[#1db954]/50 focus:ring-1 focus:ring-[#1db954]/30 resize-none font-mono leading-relaxed transition-all"
              />
              {textInput && <p className="text-[11px] text-spotify-subtext">{parseBulkTextList(textInput).length} sarki algilandi</p>}
            </>
          ) : (
            <>
              <label className="text-sm font-bold text-white">{mode === 'youtube' ? 'YouTube Playlist Linki' : 'Spotify Playlist Linki'}</label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-spotify-subtext" />
                <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                  placeholder={mode === 'youtube' ? 'https://www.youtube.com/playlist?list=PLxxxxxx' : 'https://open.spotify.com/playlist/xxxxxx'}
                  className="w-full rounded-lg bg-[#242424] border border-[#333] pl-10 pr-4 py-3 text-sm text-white placeholder-[#555] outline-none focus:border-[#1db954]/50 transition-all"
                />
                {urlInput && <button type="button" onClick={() => setUrlInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-spotify-subtext hover:text-white"><X className="h-4 w-4" /></button>}
              </div>
              {mode === 'spotify' && (
                <p className="text-[11px] text-amber-400/80 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  Spotify sarki adlarini arar; direkt stream icin YouTube'dan eslestirir.
                </p>
              )}
            </>
          )}
        </div>

        {globalError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{globalError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="button" onClick={handleImport} disabled={isProcessing}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1db954] px-6 py-3 text-sm font-bold text-black hover:bg-[#1ed760] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#1db954]/20"
          >
            {isProcessing ? (<><Loader2 className="h-4 w-4 animate-spin" />{phase === 'fetching' ? 'Playlist yukleniyor...' : 'Sarkiler araniyor...'}</>) : (<><Zap className="h-4 w-4" />Ice Aktar</>)}
          </button>
          {isProcessing && <button type="button" onClick={handleCancel} className="rounded-full border border-[#444] px-4 py-3 text-sm font-semibold text-spotify-subtext hover:text-white hover:border-white transition-colors">Iptal</button>}
          {resolvedTracks.length > 0 && phase === 'done' && (
            <button type="button" onClick={handlePlayAll} className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-white/20 transition-all">
              <Play className="h-4 w-4 fill-current" />Tumunu Oynat ({resolvedTracks.length})
            </button>
          )}
        </div>

        {tracks.length > 0 && (
          <div className="rounded-xl bg-[#181818] border border-[#2a2a2a] p-4 space-y-3">
            {fetchedPlaylistName && <div className="flex items-center gap-2 text-sm font-bold text-white"><ListMusic className="h-4 w-4 text-[#1db954]" />{fetchedPlaylistName}</div>}
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-[#1db954]"><CheckCircle2 className="h-3.5 w-3.5" /><span className="font-bold">{foundCount}</span> bulundu</span>
              {failedCount > 0 && <span className="flex items-center gap-1.5 text-red-400"><XCircle className="h-3.5 w-3.5" /><span className="font-bold">{failedCount}</span> bulunamadi</span>}
              {pendingCount > 0 && <span className="flex items-center gap-1.5 text-spotify-subtext"><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="font-bold">{pendingCount}</span> bekliyor</span>}
            </div>
            {isProcessing && tracks.length > 0 && (
              <div className="h-1 rounded-full bg-[#2a2a2a] overflow-hidden">
                <div className="h-full bg-[#1db954] rounded-full transition-all duration-300" style={{ width: `${((foundCount + failedCount) / tracks.length) * 100}%` }} />
              </div>
            )}
          </div>
        )}

        {tracks.length > 0 && (
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#1db954]" />Sarkiler ({tracks.length})</h2>
            {tracks.map((item, i) => {
              const track = item.resolvedTrack;
              const isActive = track && currentTrack?.id === track.id;
              const isThisPlaying = isActive && isPlaying;
              return (
                <div key={i} onClick={() => track && handlePlayTrack(track)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all cursor-pointer ${isActive ? 'bg-[#1db954]/10 border border-[#1db954]/20' : 'hover:bg-[#1e1e1e] border border-transparent'} ${item.status === 'failed' ? 'opacity-50 cursor-default' : ''}`}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                    {track ? (
                      <div className="relative">
                        <img src={track.albumArt} alt={track.title} className="h-8 w-8 rounded object-cover" />
                        <div className={`absolute inset-0 flex items-center justify-center rounded bg-black/60 ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                          {isThisPlaying ? <Pause className="h-3.5 w-3.5 fill-current text-white" /> : <Play className="h-3.5 w-3.5 fill-current text-white translate-x-px" />}
                        </div>
                      </div>
                    ) : <span className="text-xs font-mono text-spotify-subtext">{i + 1}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${isActive ? 'text-[#1db954]' : track ? 'text-white' : 'text-spotify-subtext'}`}>{track?.title || item.raw.title}</p>
                    <p className="truncate text-xs text-spotify-subtext">{track?.artist || item.raw.artist || '—'}</p>
                  </div>
                  <TrackStatusBadge status={item.status} />
                  {track && <ChevronRight className="h-4 w-4 text-spotify-subtext opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        {tracks.length === 0 && phase === 'idle' && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-spotify-subtext">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1db954]/10 border border-[#1db954]/20 mb-4">
              <Upload className="h-8 w-8 text-[#1db954]/60" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Ice Aktarmaya Hazir</h3>
            <p className="text-sm max-w-xs leading-relaxed">
              {mode === 'text' ? 'Sarki listeni yapistir ve "Ice Aktar" butonuna bas. Her sarki otomatik aranir.'
               : mode === 'youtube' ? 'YouTube playlist linkini yapistir. Tum sarkiler otomatik yuklenir.'
               : "Spotify playlist linkini yapistir. Sarki adlari cekilerek YouTube'da aranir."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
