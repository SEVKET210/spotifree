import type { Track } from '@/types';

/**
 * Piped API Audio Stream Interfaces
 */
export interface PipedAudioStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  codec: string;
  bitrate: number;
  videoOnly: boolean;
  audioOnly?: boolean;
  contentLength?: number;
}

export interface PipedStreamResponse {
  title: string;
  description: string;
  uploadDate: string;
  uploader: string;
  duration: number;
  audioStreams: PipedAudioStream[];
}

export interface PipedSearchResultItem {
  url: string;
  type: string;
  title: string;
  thumbnail?: string;
  uploaderName?: string;
  duration?: number;
  id?: string;
}

/**
 * Invidious API Interfaces
 */
export interface InvidiousSearchResultItem {
  type: string;
  title: string;
  videoId: string;
  author: string;
  lengthSeconds: number;
  videoThumbnails?: Array<{
    quality?: string;
    url: string;
    width?: number;
    height?: number;
  }>;
}

export interface InvidiousFormat {
  url: string;
  type?: string;
  mimeType?: string;
  bitrate?: string | number;
  itag?: string;
  container?: string;
}

export interface InvidiousVideoResponse {
  title: string;
  videoId: string;
  lengthSeconds: number;
  adaptiveFormats?: InvidiousFormat[];
  formatStreams?: InvidiousFormat[];
}

/**
 * Resilient multi-instance Piped API endpoints
 */
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.smnz.de',
  'https://api.piped.privacydev.net',
] as const;

/**
 * High-reliability Invidious API endpoints (including tested live mirrors)
 */
const INVIDIOUS_INSTANCES = [
  'https://invidious.f5.si',
  'https://invidious.jing.rocks',
  'https://invidious.nerdvpn.de',
  'https://inv.tux.pizza',
] as const;

const PRIVATE_PROXY_URL = process.env.NEXT_PUBLIC_AUDIO_PROXY_URL || '';

/**
 * Cleans metadata noise from track titles (e.g. "(Official Video)", "[Official Audio]", etc.)
 */
export function cleanTrackTitle(rawTitle: string): string {
  if (!rawTitle) return 'Unknown Title';
  return rawTitle
    .replace(/\s*[\(\[]\s*[^)\]]*(?:official|music\s*video|video|audio|remastered|lyrics?|visualizer|hd|hq|4k|explicit|clean|prod\.)[^)\]]*[\)\]]/gi, '')
    .replace(/\s*-\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Cleans YouTube artist channel suffixes (e.g., "Daft Punk - Topic" -> "Daft Punk")
 */
export function cleanArtistName(rawArtist?: string): string {
  if (!rawArtist) return 'Unknown Artist';
  return rawArtist.replace(/\s*-\s*Topic$/i, '').trim();
}

/**
 * Extracts clean YouTube video ID from URL or returns clean string
 */
export function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  const pipedMatch = trimmed.match(/(?:\/watch\?v=|\/streams\/)([a-zA-Z0-9_-]{11})/);
  if (pipedMatch) return pipedMatch[1];

  return null;
}

/**
 * Filters and maps raw Piped search items strictly to the Track interface:
 * 1. Filter out items where duration < 90 or duration > 600 (guarantees standard full songs between 1.5m and 10m).
 * 2. Filter out items where type !== 'stream'.
 * 3. Title cleaned via regex.
 * 4. Artist mapped strictly from item.uploaderName.
 * 5. Slice to a maximum of 15 items to prevent UI overflow.
 */
function processRawPipedItems(items: PipedSearchResultItem[]): Track[] {
  return items
    .filter((item) => {
      if (item.type !== 'stream') return false;
      const duration = Number(item.duration) || 0;
      if (duration < 90 || duration > 600) return false;
      return Boolean(item.url && item.url.includes('/watch?v='));
    })
    .map((item) => {
      const videoId = extractYouTubeId(item.url) || item.url.replace('/watch?v=', '');
      return {
        id: videoId,
        title: cleanTrackTitle(item.title),
        artist: cleanArtistName(item.uploaderName),
        albumArt: item.thumbnail || ('https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'),
        streamUrl: '',
        duration: item.duration || 180,
      };
    })
    .slice(0, 15);
}

/**
 * Direct YouTube Search Engine via native client interface (~200ms latency).
 * 100% resilient to third-party proxy downtime.
 */
async function searchYouTubeDirect(cleanQuery: string): Promise<Track[]> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20240401.01.00', hl: 'tr', gl: 'TR' } },
      query: cleanQuery,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error('YouTube direct returned HTTP ' + res.status);
  const data = await res.json();
  const videos: any[] = [];

  function extractVideos(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.videoRenderer) {
      videos.push(obj.videoRenderer);
      return;
    }
    for (const k of Object.keys(obj)) extractVideos(obj[k]);
  }
  extractVideos(data);

  const tracks: Track[] = videos
    .map((v) => {
      const lengthText = v.lengthText?.simpleText || '';
      let duration = 0;
      if (lengthText) {
        const parts = lengthText.split(':').map(Number);
        if (parts.length === 2) duration = parts[0] * 60 + parts[1];
        else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      const title = cleanTrackTitle(v.title?.runs?.[0]?.text || '');
      const artist = cleanArtistName(v.ownerText?.runs?.[0]?.text || '');
      const id = v.videoId;
      const thumbnails = v.thumbnail?.thumbnails || [];
      const albumArt = thumbnails[thumbnails.length - 1]?.url || ('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg');
      return { id, title, artist, albumArt, streamUrl: '', duration: duration || 180 };
    })
    .filter((t) => t.id && t.duration >= 90 && t.duration <= 600)
    .slice(0, 15);

  if (tracks.length > 0) return tracks;
  throw new Error('No valid tracks returned from YouTube direct');
}

/**
 * High-performance music search:
 * 1. Primary: Server-side YouTube InnerTube endpoint (/api/search) with zero CORS issues
 * 2. Fallback: Concurrent Invidious/Piped public endpoints
 */
export const searchMusic = async (query: string): Promise<Track[]> => {
  if (!query || !query.trim()) return [];

  const cleanQuery = query.trim();

  // 1. Primary: Query the high-performance server-side /api/search route
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(cleanQuery)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const tracks: Track[] = Array.isArray(data) ? data : data.tracks || [];
      if (tracks.length > 0) {
        return tracks;
      }
    }
  } catch (err) {
    console.warn('[/api/search] Primary search failed, attempting fallback mirrors:', err);
  }

  // 2. Direct YouTube search promise
  const ytDirectPromise = searchYouTubeDirect(cleanQuery);

  // 3. Map over Invidious instances
  const invidiousPromises = INVIDIOUS_INSTANCES.map(async (instance) => {
    const res = await fetch(
      instance + '/api/v1/search?q=' + encodeURIComponent(cleanQuery) + '&type=video',
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) throw new Error('Invidious ' + instance + ' failed with status: ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Invidious ' + instance + ' returned non-array');

    const invidiousItems: InvidiousSearchResultItem[] = data;
    const tracks: Track[] = invidiousItems
      .filter((item) => {
        if (item.type !== 'video') return false;
        const duration = Number(item.lengthSeconds) || 0;
        return duration >= 45 && duration <= 600;
      })
      .map((item) => ({
        id: item.videoId,
        title: cleanTrackTitle(item.title),
        artist: cleanArtistName(item.author),
        albumArt: item.videoThumbnails?.[0]?.url || ('https://i.ytimg.com/vi/' + item.videoId + '/hqdefault.jpg'),
        streamUrl: '',
        duration: Number(item.lengthSeconds) || 180,
      }))
      .slice(0, 15);

    if (tracks.length > 0) return tracks;
    throw new Error('Invidious ' + instance + ' returned no valid tracks');
  });

  // 4. Map over Piped instances
  const pipedPromises = PIPED_INSTANCES.map(async (instance) => {
    const res = await fetch(
      instance + '/search?q=' + encodeURIComponent(cleanQuery) + '&filter=all',
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) throw new Error('Piped ' + instance + ' failed with status: ' + res.status);
    const data = await res.json();
    const rawItems: PipedSearchResultItem[] = Array.isArray(data) ? data : data.items || [];
    const tracks = processRawPipedItems(rawItems);
    if (tracks.length > 0) return tracks;
    throw new Error('Piped ' + instance + ' returned no valid tracks');
  });

  // Race all fallback instances concurrently
  try {
    return await Promise.any([ytDirectPromise, ...invidiousPromises, ...pipedPromises]);
  } catch (error) {
    console.error('[searchMusic] All search instances failed:', error);
    return [];
  }
};

/**
 * Extracts direct playable audio stream URL concurrently via Promise.any.
 * STRICT DIRECTIVES:
 * 1. ONLY accept streams where audioOnly === true (or !s.videoOnly with audio mimeType).
 * 2. Sort by bitrate descending to select highest audio quality.
 * 3. CRITICAL: Filter out streams with very short contentLength if longer ones exist (FULL track, not snippet).
 * 4. Concurrent race across all Piped and Invidious endpoints with 5000ms timeout.
 */
export const getAudioStream = async (videoId: string): Promise<string> => {
  if (!videoId) throw new Error('Missing videoId');

  const cleanInput = videoId.trim();

  // If already a direct playable audio URL or blob URL, return immediately
  if (
    cleanInput.startsWith('http://') ||
    cleanInput.startsWith('https://') ||
    cleanInput.startsWith('blob:')
  ) {
    if (!cleanInput.includes('youtube.com') && !cleanInput.includes('youtu.be')) {
      return cleanInput;
    }
  }

  // 1. Check private audio proxy microservice if configured (evaluated first)
  if (PRIVATE_PROXY_URL) {
    try {
      const proxyEndpoint = PRIVATE_PROXY_URL + '?videoId=' + cleanInput + '&mode=url';
      const res = await fetch(proxyEndpoint, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const proxyData = await res.json();
        if (proxyData.streamUrl) return proxyData.streamUrl;
      }
    } catch {
      // Continue to concurrent public race
    }
  }

  const cleanId = extractYouTubeId(cleanInput) || cleanInput;

  /**
   * Helper to strictly filter and select the highest quality full audio stream from Piped
   */
  const selectBestFullAudioStream = (audioStreams: PipedAudioStream[]): string | null => {
    if (!audioStreams || !Array.isArray(audioStreams) || audioStreams.length === 0) {
      return null;
    }

    const candidateStreams = audioStreams.filter((s) => {
      const isAudioOnly = s.audioOnly === true || s.videoOnly === false;
      const isAudioMime = s.mimeType?.startsWith('audio/') || s.mimeType?.includes('audio');
      return isAudioOnly && isAudioMime && Boolean(s.url);
    });

    if (candidateStreams.length === 0) return null;

    const maxContentLength = Math.max(...candidateStreams.map((s) => s.contentLength || 0), 0);
    const fullStreams = maxContentLength > 800000
      ? candidateStreams.filter((s) => (s.contentLength || 0) >= maxContentLength * 0.4)
      : candidateStreams;

    fullStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    return fullStreams[0]?.url || candidateStreams[0]?.url || null;
  };

  /**
   * Helper to extract the highest bitrate audio URL from Invidious adaptiveFormats
   */
  const selectBestInvidiousAudio = (formats?: InvidiousFormat[]): string | null => {
    if (!formats || !Array.isArray(formats) || formats.length === 0) return null;

    const audioFormats = formats.filter((f) => {
      const typeStr = (f.type || f.mimeType || '').toLowerCase();
      const isAudio = typeStr.includes('audio/webm') || typeStr.includes('audio/mp4') || typeStr.startsWith('audio/');
      return isAudio && Boolean(f.url);
    });

    if (audioFormats.length === 0) return null;

    audioFormats.sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));
    return audioFormats[0]?.url || null;
  };

  // 2. Build concurrent stream promises across all Piped instances
  const pipedStreamPromises = PIPED_INSTANCES.map(async (instance) => {
    const res = await fetch(instance + '/streams/' + cleanId, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('Piped stream ' + instance + ' failed with status: ' + res.status);
    const data: PipedStreamResponse = await res.json();
    const bestUrl = selectBestFullAudioStream(data.audioStreams);
    if (bestUrl) return bestUrl;
    throw new Error('Piped stream ' + instance + ' returned no valid audio streams');
  });

  // 3. Build concurrent stream promises across all Invidious instances
  const invidiousStreamPromises = INVIDIOUS_INSTANCES.map(async (instance) => {
    const res = await fetch(instance + '/api/v1/videos/' + cleanId, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('Invidious video ' + instance + ' failed with status: ' + res.status);
    const data: InvidiousVideoResponse = await res.json();
    const bestUrl = selectBestInvidiousAudio(data.adaptiveFormats) || selectBestInvidiousAudio(data.formatStreams);
    if (bestUrl) return bestUrl;
    throw new Error('Invidious video ' + instance + ' returned no valid audio formats');
  });

  // 4. Concurrent race across all instances; fastest valid stream URL wins
  try {
    return await Promise.any([...pipedStreamPromises, ...invidiousStreamPromises]);
  } catch (error) {
    console.warn('[getAudioStream] All concurrent public instances failed, falling back to local proxy:', error);
  }

  // 5. Fallback direct stream endpoint or local audio proxy
  return 'http://localhost:5000/api/stream?videoId=' + cleanId + '&mode=pipe';
};

/**
 * Backwards compatibility alias
 */
export const fetchAudioStream = getAudioStream;

// ─── Playlist & Bulk Import APIs ─────────────────────────────────────────────

export interface PlaylistTrackItem {
  title: string;
  artist: string;
  videoId?: string;
  duration?: number;
  albumArt?: string;
}

/**
 * Fetches all tracks from a YouTube playlist via Invidious API.
 * Falls back across all Invidious instances concurrently.
 */
export async function fetchYouTubePlaylist(playlistId: string): Promise<PlaylistTrackItem[]> {
  const cleanId = playlistId.trim();

  const promises = INVIDIOUS_INSTANCES.map(async (instance) => {
    const res = await fetch(
      `${instance}/api/v1/playlists/${cleanId}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`Invidious playlist ${instance} failed: ${res.status}`);
    const data = await res.json();
    const videos: any[] = data.videos || [];
    if (videos.length === 0) throw new Error(`Invidious ${instance}: empty playlist`);

    return videos.map((v: any): PlaylistTrackItem => ({
      title: cleanTrackTitle(v.title || 'Unknown'),
      artist: cleanArtistName(v.author || ''),
      videoId: v.videoId,
      duration: Number(v.lengthSeconds) || 0,
      albumArt: v.videoThumbnails?.[0]?.url ||
        (v.videoId ? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` : undefined),
    }));
  });

  try {
    return await Promise.any(promises);
  } catch {
    throw new Error('YouTube playlist fetch failed on all Invidious instances');
  }
}

/**
 * Extracts a YouTube playlist ID from a URL or raw ID string.
 */
export function extractYouTubePlaylistId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Raw ID (no slashes or protocol)
  if (/^PL[a-zA-Z0-9_-]{16,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Fetches track metadata from a Spotify playlist URL by routing through
 * a Next.js API route to avoid browser CORS restrictions.
 * Returns raw title+artist pairs without any Spotify auth.
 */
export async function fetchSpotifyPlaylistTracks(spotifyUrl: string): Promise<PlaylistTrackItem[]> {
  const match = spotifyUrl.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error('Invalid Spotify playlist URL');
  const playlistId = match[1];

  // Route through our Next.js API to avoid CORS
  const res = await fetch(`/api/spotify-playlist?id=${playlistId}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Spotify fetch failed: ${res.status}`);
  }

  const data = await res.json();
  const tracks: PlaylistTrackItem[] = data.tracks || [];
  if (tracks.length === 0) throw new Error('Spotify playlist bos veya erisim saglanamadi.');
  return tracks;
}

/**
 * Parses a bulk plain-text song list (newline-separated) into title/artist pairs.
 * Supports formats: "Artist - Title", "Title by Artist", or just "Title".
 */
export function parseBulkTextList(rawText: string): PlaylistTrackItem[] {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 2)
    .map((line): PlaylistTrackItem => {
      // Format: "Artist - Title"
      const dashMatch = line.match(/^(.+?)\s+-\s+(.+)$/);
      if (dashMatch) {
        return { artist: dashMatch[1].trim(), title: cleanTrackTitle(dashMatch[2].trim()) };
      }
      // Format: "Title by Artist"
      const byMatch = line.match(/^(.+?)\s+by\s+(.+)$/i);
      if (byMatch) {
        return { title: cleanTrackTitle(byMatch[1].trim()), artist: byMatch[2].trim() };
      }
      // Fallback: treat whole line as title
      return { title: cleanTrackTitle(line), artist: '' };
    })
    .slice(0, 100); // Safety cap
}

