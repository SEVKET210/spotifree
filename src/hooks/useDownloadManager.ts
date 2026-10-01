'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Track } from '@/types';
import { db } from '@/lib/db';
import { fetchAudioStream } from '@/lib/api';
import { useLiveQuery } from 'dexie-react-hooks';

export type DownloadStatus = 'idle' | 'downloading' | 'downloaded' | 'error';

export interface UseDownloadManagerReturn {
  status: DownloadStatus;
  progress: number;
  startDownload: () => Promise<void>;
  deleteDownload: () => Promise<void>;
  error: string | null;
}

/**
 * Staff-Level offline download manager hook.
 * Manages downloading audio stream and artwork binaries into IndexedDB Blobs.
 */
export function useDownloadManager(track: Track): UseDownloadManagerReturn {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Reactive IndexedDB check for offline presence
  const offlineRecord = useLiveQuery(
    async () => {
      if (!track?.id) return null;
      return await db.offlineBlobs.get(track.id);
    },
    [track?.id]
  );

  // Synchronize status with IndexedDB record
  useEffect(() => {
    if (offlineRecord) {
      setStatus('downloaded');
      setProgress(100);
      setError(null);
    } else if (status !== 'downloading') {
      setStatus('idle');
      setProgress(0);
    }
  }, [offlineRecord, status]);

  const startDownload = useCallback(async () => {
    if (!track?.id) return;

    try {
      setError(null);

      // 1. Verify if track is already stored offline
      const existing = await db.offlineBlobs.get(track.id);
      if (existing) {
        setStatus('downloaded');
        setProgress(100);
        return;
      }

      setStatus('downloading');
      setProgress(10);

      // 2. Resolve audio stream URL via Piped API or direct URI
      const resolvedUrl = await fetchAudioStream(track.streamUrl || track.id);
      setProgress(25);

      // 3. Fetch audio stream as ArrayBuffer with progress chunking
      const audioResponse = await fetch(resolvedUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio stream: HTTP ${audioResponse.status}`);
      }

      const contentLengthHeader = audioResponse.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      let audioBlob: Blob;

      if (audioResponse.body && totalBytes > 0) {
        const reader = audioResponse.body.getReader();
        let receivedLength = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          // Scale download progress between 25% and 80%
          const percentage = 25 + Math.round((receivedLength / totalBytes) * 55);
          setProgress(Math.min(80, percentage));
        }

        const combinedBuffer = new Uint8Array(receivedLength);
        let offset = 0;
        for (const chunk of chunks) {
          combinedBuffer.set(chunk, offset);
          offset += chunk.length;
        }

        const mime = audioResponse.headers.get('content-type') || 'audio/webm';
        audioBlob = new Blob([combinedBuffer], { type: mime });
      } else {
        const buffer = await audioResponse.arrayBuffer();
        const mime = audioResponse.headers.get('content-type') || 'audio/webm';
        audioBlob = new Blob([buffer], { type: mime });
        setProgress(80);
      }

      // 4. Fetch the track's albumArt as a Blob
      let imageBlob: Blob;
      try {
        const imgResponse = await fetch(track.albumArt);
        if (imgResponse.ok) {
          imageBlob = await imgResponse.blob();
        } else {
          imageBlob = new Blob([], { type: 'image/jpeg' });
        }
      } catch {
        imageBlob = new Blob([], { type: 'image/jpeg' });
      }
      setProgress(95);

      // 5. Store binary Blobs into Dexie IndexedDB
      await db.offlineBlobs.put({
        trackId: track.id,
        audioBlob,
        imageBlob,
        downloadedAt: Date.now(),
      });

      setStatus('downloaded');
      setProgress(100);
    } catch (err) {
      console.error(`[DownloadManager] Download failed for track ${track.id}:`, err);
      setError((err as Error).message);
      setStatus('error');
      setProgress(0);
    }
  }, [track]);

  const deleteDownload = useCallback(async () => {
    if (!track?.id) return;
    try {
      await db.offlineBlobs.delete(track.id);
      setStatus('idle');
      setProgress(0);
      setError(null);
    } catch (err) {
      console.error(`[DownloadManager] Failed to delete offline record:`, err);
    }
  }, [track?.id]);

  return {
    status,
    progress,
    startDownload,
    deleteDownload,
    error,
  };
}
