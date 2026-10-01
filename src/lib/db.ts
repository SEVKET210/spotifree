import Dexie, { type Table } from 'dexie';
import type { Track, Playlist } from '@/types';

export interface SavedTrackRecord {
  id: string;
  track: Track;
  addedAt: number;
}

export interface PlayHistoryRecord {
  id: string;
  trackId: string;
  track: Track;
  playedAt: number;
}

export interface OfflineBlobRecord {
  trackId: string;
  audioBlob: Blob;
  imageBlob: Blob;
  downloadedAt: number;
}

export interface CrashLogRecord {
  id?: number;
  timestamp: number;
  errorName: string;
  errorMessage: string;
  stack?: string;
  componentStack?: string;
  stateDump?: Record<string, unknown>;
  deviceInfo?: {
    userAgent: string;
    platform?: string;
    online: boolean;
    url: string;
    viewport?: string;
  };
}

export class SpotiFreeDB extends Dexie {
  playlists!: Table<Playlist, string>;
  savedTracks!: Table<SavedTrackRecord, string>;
  playHistory!: Table<PlayHistoryRecord, string>;
  offlineBlobs!: Table<OfflineBlobRecord, string>;
  crashLogs!: Table<CrashLogRecord, number>;

  constructor() {
    super('SpotiFreeDatabase');
    
    // Schema Version 1 (Initial schema)
    this.version(1).stores({
      playlists: 'id, name, createdAt',
      savedTracks: 'id, addedAt',
      playHistory: 'id, playedAt',
      offlineBlobs: 'trackId, downloadedAt',
    });

    // Schema Version 2: Added local crash logs telemetry table
    this.version(2).stores({
      playlists: 'id, name, createdAt',
      savedTracks: 'id, addedAt',
      playHistory: 'id, playedAt',
      offlineBlobs: 'trackId, downloadedAt',
      crashLogs: '++id, timestamp, errorName',
    });
  }

  // --- Storage & Offline Synchronization Utilities ---

  async cacheOfflineTrack(trackId: string, audioBlob: Blob, imageBlob: Blob): Promise<string> {
    const record: OfflineBlobRecord = {
      trackId,
      audioBlob,
      imageBlob,
      downloadedAt: Date.now(),
    };
    return await this.offlineBlobs.put(record);
  }

  async getOfflineTrack(trackId: string): Promise<OfflineBlobRecord | undefined> {
    return await this.offlineBlobs.get(trackId);
  }

  async removeOfflineTrack(trackId: string): Promise<void> {
    await this.offlineBlobs.delete(trackId);
  }

  async toggleSavedTrack(track: Track): Promise<boolean> {
    const existing = await this.savedTracks.get(track.id);
    if (existing) {
      await this.savedTracks.delete(track.id);
      return false;
    } else {
      await this.savedTracks.put({
        id: track.id,
        track,
        addedAt: Date.now(),
      });
      return true;
    }
  }

  async recordPlayHistory(track: Track): Promise<string> {
    const historyItem: PlayHistoryRecord = {
      id: `${track.id}-${Date.now()}`,
      trackId: track.id,
      track,
      playedAt: Date.now(),
    };
    return await this.playHistory.put(historyItem);
  }

  // --- Phase 9 Telemetry & Disaster Recovery Utilities ---

  /**
   * Logs a crash report into local IndexedDB
   */
  async logCrash(record: Omit<CrashLogRecord, 'id'>): Promise<number> {
    try {
      return await this.crashLogs.add(record);
    } catch (err) {
      console.error('[SpotiFreeDB] Failed to record crash log:', err);
      return -1;
    }
  }

  /**
   * Clears all crash logs
   */
  async clearCrashLogs(): Promise<void> {
    await this.crashLogs.clear();
  }

  /**
   * Wipes all local database records and resets state (Disaster Recovery)
   */
  async resetAllLocalData(): Promise<void> {
    await Promise.all([
      this.playlists.clear(),
      this.savedTracks.clear(),
      this.playHistory.clear(),
      this.offlineBlobs.clear(),
      this.crashLogs.clear(),
    ]);
  }
}

export const db = new SpotiFreeDB();
