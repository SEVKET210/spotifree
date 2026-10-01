'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { db } from '@/lib/db';
import { usePlayerStore } from '@/store/usePlayerStore';
import { 
  AlertTriangle, 
  RotateCcw, 
  Trash2, 
  Download, 
  ChevronDown, 
  ChevronUp,
  Terminal,
  ShieldAlert
} from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  crashLogId: number | null;
  isDetailsOpen: boolean;
  isResetting: boolean;
}

/**
 * Staff-Level Global Error Boundary.
 * Catches unhandled JavaScript exceptions, logs rich diagnostics to IndexedDB,
 * and provides disaster recovery state wipes to prevent unrecoverable bricking.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      crashLogId: null,
      isDetailsOpen: false,
      isResetting: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override async componentDidCatch(error: Error, errorInfo: ErrorInfo): Promise<void> {
    this.setState({ errorInfo });

    try {
      // Extract safe Zustand state snapshot (omitting large queues to preserve storage)
      const playerState = usePlayerStore.getState();
      const stateDump = {
        currentTrack: playerState.currentTrack
          ? {
              id: playerState.currentTrack.id,
              title: playerState.currentTrack.title,
              artist: playerState.currentTrack.artist,
            }
          : null,
        currentIndex: playerState.currentIndex,
        isPlaying: playerState.isPlaying,
        volume: playerState.volume,
        repeatMode: playerState.repeatMode,
        isShuffled: playerState.isShuffled,
        queueLength: playerState.queue ? playerState.queue.length : 0,
      };

      // Write crash telemetry directly to local IndexedDB crashLogs table
      const logId = await db.logCrash({
        timestamp: Date.now(),
        errorName: error.name || 'RuntimeError',
        errorMessage: error.message || 'Unknown error occurred',
        stack: error.stack,
        componentStack: errorInfo.componentStack || undefined,
        stateDump,
        deviceInfo: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          platform: typeof navigator !== 'undefined' ? (navigator as any).userAgentData?.platform || navigator.platform : undefined,
          online: typeof navigator !== 'undefined' ? navigator.onLine : true,
          url: typeof window !== 'undefined' ? window.location.href : '',
          viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
        },
      });

      this.setState({ crashLogId: logId });
    } catch (loggingError) {
      console.error('[ErrorBoundary] Failed to commit crash log to Dexie:', loggingError);
    }
  }

  /**
   * Disaster Recovery: Clears all Dexie tables and localStorage to recover from corrupted state
   */
  handleResetAppState = async (): Promise<void> => {
    this.setState({ isResetting: true });
    try {
      // 1. Wipe IndexedDB collections
      await db.resetAllLocalData();

      // 2. Wipe LocalStorage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // 3. Force clean reload
      window.location.href = '/';
    } catch (err) {
      console.error('[ErrorBoundary] State reset encountered error:', err);
      // Hard fallback reload
      window.location.reload();
    }
  };

  /**
   * Export crash diagnostic report as .json file
   */
  handleDownloadCrashLog = (): void => {
    const { error, errorInfo, crashLogId } = this.state;
    const playerState = usePlayerStore.getState();

    const report = {
      reportId: crashLogId,
      timestamp: new Date().toISOString(),
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
      componentStack: errorInfo?.componentStack,
      playerState: {
        currentTrack: playerState.currentTrack,
        currentIndex: playerState.currentIndex,
        isPlaying: playerState.isPlaying,
        volume: playerState.volume,
        repeatMode: playerState.repeatMode,
        isShuffled: playerState.isShuffled,
        queueLength: playerState.queue?.length || 0,
      },
      environment: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        onLine: navigator.onLine,
        screen: `${window.innerWidth}x${window.innerHeight}`,
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spotifree-crash-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  override render(): ReactNode {
    const { hasError, error, errorInfo, isDetailsOpen, isResetting, crashLogId } = this.state;

    if (hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-screen bg-spotify-black text-spotify-text flex flex-col items-center justify-center p-4 md:p-8 select-none">
          <div className="w-full max-w-lg rounded-2xl bg-spotify-elevated border border-spotify-highlight/80 p-6 md:p-8 shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Badge */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  Something went wrong
                </h1>
                <p className="text-xs md:text-sm text-spotify-subtext mt-0.5">
                  SpotiFree caught an unhandled application exception.
                </p>
              </div>
            </div>

            {/* Error Summary Banner */}
            <div className="rounded-lg bg-spotify-base/80 border border-spotify-highlight p-3.5 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {error?.name || 'Application Error'}: {error?.message || 'Unexpected crash'}
                </p>
                {crashLogId && (
                  <p className="text-[11px] text-spotify-subtext mt-1">
                    Telemetry ID saved in IndexedDB: <span className="font-mono text-spotify-primary">#{crashLogId}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-spotify-primary hover:bg-spotify-hover text-spotify-black font-bold py-3 px-4 text-sm transition-transform active:scale-95 shadow-lg"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetAppState}
                disabled={isResetting}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-3 px-4 text-sm transition-transform active:scale-95 disabled:opacity-50"
                title="Clears localStorage and Dexie.js database in case of data corruption"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isResetting ? 'Wiping State...' : 'Reset App State'}</span>
              </button>
            </div>

            {/* Diagnostic Report Download */}
            <div className="flex items-center justify-between border-t border-spotify-highlight/40 pt-4">
              <button
                type="button"
                onClick={this.handleDownloadCrashLog}
                className="inline-flex items-center gap-1.5 text-xs text-spotify-subtext hover:text-spotify-primary transition-colors font-medium"
              >
                <Download className="h-4 w-4" />
                <span>Export Diagnostics (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => this.setState({ isDetailsOpen: !isDetailsOpen })}
                className="inline-flex items-center gap-1 text-xs text-spotify-subtext hover:text-white transition-colors"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>{isDetailsOpen ? 'Hide Trace' : 'View Trace'}</span>
                {isDetailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Expandable Stack Trace */}
            {isDetailsOpen && (
              <div className="rounded-lg bg-black/60 p-3 text-[11px] font-mono text-zinc-400 max-h-48 overflow-y-auto space-y-2 border border-spotify-highlight/40 select-text">
                <div>
                  <span className="text-red-400 font-bold">Error Stack:</span>
                  <pre className="whitespace-pre-wrap mt-1 leading-relaxed">
                    {error?.stack || 'No stack trace available'}
                  </pre>
                </div>
                {errorInfo?.componentStack && (
                  <div>
                    <span className="text-amber-400 font-bold">Component Stack:</span>
                    <pre className="whitespace-pre-wrap mt-1 leading-relaxed">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
