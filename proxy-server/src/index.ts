import express, { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy (Nginx / Cloudflare) on Ubuntu
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// --- Strict CORS Configuration ---
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost',
  'https://spotifree.vercel.app',
  'https://spotifree.pages.dev',
  'tauri://localhost',
  'http://tauri.localhost',
  'capacitor://localhost',
];

if (process.env.ALLOWED_ORIGINS) {
  const extraOrigins = process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  allowedOrigins.push(...extraOrigins);
}

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like native mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.some((allowed) => origin === allowed || origin.endsWith('.vercel.app') || origin.endsWith('.pages.dev'))) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by SpotiFree CORS policy`));
  },
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'Authorization'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
  credentials: true,
};

app.use(cors(corsOptions));

// --- Rate Limiting Middleware ---
const streamRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 300, // 300 requests per IP per window (ample for regular playlist streaming)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many stream requests from this IP. Please try again later.',
  },
});

app.use('/api/', streamRateLimiter);

// --- Health Check Endpoint ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

/**
 * GET /api/stream
 * Query Parameters:
 *  - videoId (required): 11-char YouTube Video ID
 *  - mode (optional): 'pipe' (default: masks origin & streams bytes) | 'url' (returns direct CDN URL JSON) | 'redirect' (302 redirect)
 */
app.get('/api/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { videoId, mode = 'pipe' } = req.query;

    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid query parameter "videoId". Must be an 11-character string.',
      });
    }

    const cleanId = videoId.trim();

    // Validate YouTube Video ID format to prevent SSRF / injection
    if (!ytdl.validateID(cleanId) && !/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
      return res.status(400).json({
        error: `Invalid videoId format "${cleanId}". Must be an 11-character YouTube video ID.`,
      });
    }

    // Extract video information & format metadata
    const info = await ytdl.getInfo(cleanId, {
      requestOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      },
    });

    // Filter ONLY audio formats
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');

    if (!audioFormats || audioFormats.length === 0) {
      return res.status(404).json({
        error: `No audio-only streams found for videoId "${cleanId}".`,
      });
    }

    // Select highest quality audio (prefer webm or mp4/m4a, sorted by highest bitrate)
    const sortedAudio = audioFormats
      .filter((f) => f.mimeType?.includes('audio/webm') || f.mimeType?.includes('audio/mp4'))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    const bestAudio = sortedAudio[0] || audioFormats[0];

    // MODE 1: Direct JSON URL metadata
    if (mode === 'url') {
      return res.json({
        success: true,
        videoId: cleanId,
        title: info.videoDetails.title,
        artist: info.videoDetails.author.name,
        duration: Number(info.videoDetails.lengthSeconds),
        streamUrl: bestAudio.url,
        bitrate: bestAudio.bitrate,
        mimeType: bestAudio.mimeType,
        contentLength: bestAudio.contentLength,
      });
    }

    // MODE 2: HTTP 302 Redirect directly to CDN URL
    if (mode === 'redirect') {
      return res.redirect(302, bestAudio.url);
    }

    // MODE 3: Default "pipe" mode (Masks origin completely through server response)
    const mimeType = bestAudio.mimeType?.split(';')[0] || 'audio/webm';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    if (bestAudio.contentLength) {
      res.setHeader('Content-Length', bestAudio.contentLength);
    }

    // Handle range request for scrub seeking
    const rangeHeader = req.headers.range;
    let ytdlOptions: Parameters<typeof ytdl>[1] = {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25, // 32MB high-water mark buffer
    };

    if (rangeHeader && bestAudio.contentLength) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const total = parseInt(bestAudio.contentLength, 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

      if (start < total) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);

        ytdlOptions = {
          ...ytdlOptions,
          range: { start, end },
        };
      }
    }

    const audioStream = ytdl(cleanId, ytdlOptions);

    audioStream.on('error', (streamErr: Error) => {
      console.error(`[Audio Stream Error] (${cleanId}):`, streamErr.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Audio pipeline transmission failed' });
      }
    });

    // Abort stream if client disconnects early
    req.on('close', () => {
      audioStream.destroy();
    });

    audioStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// Centralized Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Internal Server Error]', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Proxy server encountered an unhandled exception.',
      message: err.message,
    });
  }
});

// Graceful Shutdown
const server = app.listen(PORT, () => {
  console.log(`[SpotiFree Audio Proxy] Listening on port ${PORT} (PID: ${process.pid})`);
});

const handleTermination = (signal: string) => {
  console.log(`[SpotiFree Audio Proxy] Received ${signal}. Gracefully shutting down...`);
  server.close(() => {
    console.log('[SpotiFree Audio Proxy] Closed all connections. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleTermination('SIGTERM'));
process.on('SIGINT', () => handleTermination('SIGINT'));

export default app;
