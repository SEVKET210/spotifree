import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side Spotify playlist scraper.
 * Fetches the Spotify embed page from the server (no CORS) and extracts
 * track metadata from the embedded __NEXT_DATA__ JSON.
 * No Spotify API key required.
 *
 * Spotify trackList item structure (as of 2025):
 * {
 *   uri: "spotify:track:xxx",
 *   title: "Song Name",
 *   subtitle: "Artist Name",
 *   duration: 181270, // ms
 *   isExplicit: boolean,
 *   ...
 * }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get("id");

  if (!playlistId || !/^[a-zA-Z0-9]+$/.test(playlistId)) {
    return NextResponse.json({ error: "Invalid playlist ID" }, { status: 400 });
  }

  try {
    const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;

    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://open.spotify.com/",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Spotify returned ${res.status}` },
        { status: res.status }
      );
    }

    const html = await res.text();

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      return NextResponse.json(
        { error: "Spotify sayfa yapisi degisti, __NEXT_DATA__ bulunamadi" },
        { status: 422 }
      );
    }

    let nextData: any;
    try {
      nextData = JSON.parse(nextDataMatch[1]);
    } catch {
      return NextResponse.json({ error: "Spotify JSON parse hatasi" }, { status: 422 });
    }

    // trackList is the top-level array in the entity
    const rawTracks: any[] =
      nextData?.props?.pageProps?.state?.data?.entity?.trackList || [];

    if (rawTracks.length === 0) {
      return NextResponse.json(
        { error: "Playlist bos ya da sarkiler alinamadi" },
        { status: 404 }
      );
    }

    // Spotify trackList item shape: { title, subtitle (artist), duration (ms) }
    const tracks = rawTracks
      .map((item: any) => {
        const title: string = item?.title || "";
        const artist: string = item?.subtitle || "";
        const durationMs: number = item?.duration || 0;
        if (!title) return null;
        return {
          title,
          artist,
          duration: Math.round(durationMs / 1000),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ tracks, count: tracks.length });
  } catch (err: any) {
    console.error("[spotify-playlist API]", err);
    return NextResponse.json(
      { error: err?.message || "Bilinmeyen sunucu hatasi" },
      { status: 500 }
    );
  }
}
