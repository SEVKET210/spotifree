'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CrashLogRecord } from '@/lib/db';
import { 
  Bug, 
  Download, 
  Trash2, 
  X, 
  Terminal, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  FileJson
} from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Developer Diagnostics Tool.
 * Displays local IndexedDB crash telemetry and exports diagnostic JSON logs
 * for troubleshooting native Tauri (.exe) and Capacitor (.apk) builds.
 */
export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedLog, setSelectedLog] = useState<CrashLogRecord | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Live query of crash logs sorted descending by timestamp
  const logs = useLiveQuery(
    async () => {
      const records = await db.crashLogs.toArray();
      return records.sort((a, b) => b.timestamp - a.timestamp);
    },
    [],
    [] as CrashLogRecord[]
  );

  if (!isOpen) return null;

  /**
   * Export all crash logs as a downloadable JSON diagnostic bundle
   */
  const handleExportDiagnostics = () => {
    const diagnosticBundle = {
      app: 'SpotiFree PWA / Native',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      totalCrashes: logs.length,
      device: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
      },
      crashLogs: logs,
    };

    const jsonString = JSON.stringify(diagnosticBundle, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spotifree-diagnostics-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Clear all crash telemetry from Dexie
   */
  const handleClearLogs = async () => {
    if (confirm('Clear all local crash telemetry logs?')) {
      await db.clearCrashLogs();
      setSelectedLog(null);
    }
  };

  /**
   * Trigger intentional synthetic exception to test ErrorBoundary
   */
  const handleTriggerTestCrash = () => {
    throw new Error('[Test Exception] Synthetic crash triggered by developer diagnostics.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl bg-spotify-elevated border border-spotify-highlight shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-spotify-text">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-spotify-highlight/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-spotify-highlight text-spotify-primary">
              <Bug className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Local Crash Telemetry & Diagnostics
                <span className="rounded-full bg-spotify-highlight px-2 py-0.5 text-[10px] font-mono text-spotify-primary">
                  Dexie.js v2
                </span>
              </h2>
              <p className="text-xs text-spotify-subtext">
                Native debug reports for Android .apk & Windows .exe
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-spotify-highlight text-spotify-subtext hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-spotify-base/50 border-b border-spotify-highlight/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Logged Incidents:</span>
            <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold ${
              logs.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {logs.length} Total
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportDiagnostics}
              disabled={logs.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-spotify-primary hover:bg-spotify-hover text-black font-semibold px-3 py-1.5 transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download all crash logs as .json file"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export .json</span>
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-spotify-highlight hover:bg-red-500/20 hover:text-red-400 text-spotify-subtext font-medium px-3 py-1.5 transition-colors disabled:opacity-40"
              title="Wipe logs from IndexedDB"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerTestCrash}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium"
              title="Verify ErrorBoundary behavior"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Simulate Crash</span>
            </button>
          </div>
        </div>

        {/* Content: Crash Logs List & Detail Viewer */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {logs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-spotify-subtext space-y-2">
              <CheckCircle className="h-10 w-10 text-spotify-primary opacity-60" />
              <p className="text-sm font-semibold text-white">No crash incidents detected</p>
              <p className="text-xs max-w-sm">
                SpotiFree is operating normally. Any caught runtime exceptions will be logged here for offline inspection.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isSelected = selectedLog?.id === log.id;
              const dateStr = new Date(log.timestamp).toLocaleString();

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(isSelected ? null : log)}
                  className={`rounded-lg border p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-spotify-primary bg-spotify-highlight'
                      : 'border-spotify-highlight/80 bg-spotify-base/60 hover:bg-spotify-highlight/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-red-400">
                          {log.errorName}
                        </span>
                        <span className="text-[10px] text-spotify-subtext flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {dateStr}
                        </span>
                      </div>
                      <p className="truncate text-xs text-white font-medium mt-1">
                        {log.errorMessage}
                      </p>
                    </div>

                    <span className="text-[10px] font-mono text-spotify-subtext px-2 py-0.5 rounded bg-black/40">
                      ID #{log.id}
                    </span>
                  </div>

                  {/* Expanded Stack Trace Details */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-spotify-highlight/40 space-y-2 text-[11px] font-mono">
                      <div>
                        <span className="text-spotify-primary font-bold">Stack Trace:</span>
                        <pre className="mt-1 p-2 rounded bg-black/60 text-zinc-300 whitespace-pre-wrap max-h-40 overflow-y-auto select-text">
                          {log.stack || 'No stack available'}
                        </pre>
                      </div>

                      {log.stateDump && (
                        <div>
                          <span className="text-amber-400 font-bold">Zustand State Snapshot:</span>
                          <pre className="mt-1 p-2 rounded bg-black/60 text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto select-text">
                            {JSON.stringify(log.stateDump, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.deviceInfo && (
                        <div className="text-[10px] text-spotify-subtext flex flex-wrap gap-x-4 pt-1">
                          <span>URL: {log.deviceInfo.url}</span>
                          <span>Online: {String(log.deviceInfo.online)}</span>
                          <span>Viewport: {log.deviceInfo.viewport}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-spotify-highlight/40 bg-spotify-base flex items-center justify-between text-xs text-spotify-subtext">
          <span>Zero external telemetry (100% stored in local IndexedDB)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-spotify-highlight hover:bg-[#333333] text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticsModal;
