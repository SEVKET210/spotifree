import { NextRequest, NextResponse } from "next/server";

export interface TrackResult {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  streamUrl: string;
  duration: number;
}

function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "Unknown Title";
  return rawTitle
    .replace(
      /\s*[\(\[]\s*[^)\]]*(?:official\s*(?:video|music\s*video|audio)?|video|audio|remastered|lyrics?|visualizer|hd|hq|4k|explicit|clean|prod\.)[^)\]]*[\)\]]/gi,
      ""
    )
    .replace(/\s*-\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanArtist(rawArtist?: string): string {
  if (!rawArtist) return "Unknown Artist";
  return rawArtist
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/VEVO$/i, "")
    .trim();
}

function parseDurationText(lengthText: string): number {
  if (!lengthText) return 180;
  const parts = lengthText.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 180;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    // Direct YouTube InnerTube search from server side (No browser CORS restrictions)
    const ytRes = await fetch("https://www.youtube.com/youtubei/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20240401.01.00",
            hl: "tr",
            gl: "TR",
          },
        },
        query,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!ytRes.ok) {
      throw new Error(`YouTube API HTTP ${ytRes.status}`);
    }

    const data = await ytRes.json();
    const videoRenderers: any[] = [];

    const extractRenderers = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.videoRenderer) {
        videoRenderers.push(node.videoRenderer);
        return;
      }
      for (const key of Object.keys(node)) {
        extractRenderers(node[key]);
      }
    };

    extractRenderers(data);

    const tracks: TrackResult[] = videoRenderers
      .map((v) => {
        const id = v.videoId;
        if (!id) return null;

        const rawTitle = v.title?.runs?.[0]?.text || "";
        const rawArtist = v.ownerText?.runs?.[0]?.text || "";
        const lengthText = v.lengthText?.simpleText || "";
        const duration = parseDurationText(lengthText);

        const thumbnails = v.thumbnail?.thumbnails || [];
        const albumArt =
          thumbnails[thumbnails.length - 1]?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

        return {
          id,
          title: cleanTitle(rawTitle),
          artist: cleanArtist(rawArtist),
          albumArt,
          streamUrl: "",
          duration,
        };
      })
      .filter((t): t is TrackResult => {
        if (!t) return false;
        // Keep valid tracks (duration between 45s and 900s)
        return t.duration >= 45 && t.duration <= 900;
      })
      .slice(0, 20);

    return NextResponse.json({ tracks, count: tracks.length });
  } catch (error: any) {
    console.error("[/api/search] Error searching YouTube:", error?.message || error);

    // Fallback: try Invidious if direct YouTube fails
    try {
      const invRes = await fetch(
        `https://invidious.f5.si/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(4000),
        }
      );
      if (invRes.ok) {
        const invData = await invRes.json();
        if (Array.isArray(invData)) {
          const fallbackTracks: TrackResult[] = invData
            .filter((item: any) => item.type === "video")
            .map((item: any) => ({
              id: item.videoId,
              title: cleanTitle(item.title),
              artist: cleanArtist(item.author),
              albumArt:
                item.videoThumbnails?.[0]?.url ||
                `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
              streamUrl: "",
              duration: Number(item.lengthSeconds) || 180,
            }))
            .slice(0, 15);

          return NextResponse.json({ tracks: fallbackTracks, count: fallbackTracks.length });
        }
      }
    } catch {
      // Fallback failed
    }

    return NextResponse.json({ error: "Arama işlemi tamamlanamadı", tracks: [] }, { status: 500 });
  }
}
