'use client';

import React, { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { db } from '@/lib/db';
import type { Track, Playlist } from '@/types';
import { Music2 } from 'lucide-react';

interface DragContextProps {
  children: React.ReactNode;
}

/**
 * Staff-Level Drag & Drop Context.
 * Orchestrates cross-component drag-and-drop between tracks and playlists,
 * updating Dexie.js offline database collections on drop.
 */
export const DragContext: React.FC<DragContextProps> = ({ children }) => {
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);

  // Require 8px drag distance before activating to avoid hijacking normal clicks
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleDragStart = (event: DragStartEvent) => {
    const track = event.active.data.current?.track as Track | undefined;
    if (track) {
      setActiveTrack(track);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTrack(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Detect dropping a Track onto a Playlist
    if (activeData?.type === 'track' && overData?.type === 'playlist') {
      const track = activeData.track as Track;
      const playlist = overData.playlist as Playlist;

      if (track && playlist) {
        try {
          const currentRecord = await db.playlists.get(playlist.id);
          const currentTrackIds = currentRecord ? currentRecord.trackIds : playlist.trackIds;

          if (!currentTrackIds.includes(track.id)) {
            const updatedTrackIds = [...currentTrackIds, track.id];
            await db.playlists.update(playlist.id, {
              trackIds: updatedTrackIds,
            });
          }
        } catch (error) {
          console.error(`[DragContext] Failed to add track ${track.id} to playlist ${playlist.id}:`, error);
        }
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}

      {/* Visual Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeTrack ? (
          <div className="flex items-center gap-3 rounded-lg bg-spotify-elevated/95 p-3 shadow-2xl border border-spotify-primary/60 text-spotify-text backdrop-blur-md cursor-grabbing scale-105 pointer-events-none z-50">
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-spotify-highlight">
              {activeTrack.albumArt ? (
                <img
                  src={activeTrack.albumArt}
                  alt={activeTrack.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Music2 className="h-6 w-6 m-auto text-spotify-subtext" />
              )}
            </div>
            <div className="min-w-0 pr-4">
              <p className="truncate text-xs font-bold text-spotify-text">
                {activeTrack.title}
              </p>
              <p className="truncate text-[10px] text-spotify-subtext">
                {activeTrack.artist}
              </p>
            </div>
            <span className="rounded bg-spotify-primary/20 px-2 py-0.5 text-[10px] font-semibold text-spotify-primary uppercase">
              Drop on Playlist
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

/**
 * Draggable Track Wrapper component.
 */
export const DraggableTrackItem: React.FC<{
  track: Track;
  children: React.ReactNode;
  className?: string;
}> = ({ track, children, className = '' }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `track-${track.id}`,
    data: {
      type: 'track',
      track,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`${className} ${isDragging ? 'opacity-40 scale-[0.98]' : ''} transition-transform`}
      style={{ touchAction: 'pan-y' }}
    >
      {children}
    </div>
  );
};

/**
 * Droppable Playlist Item component for Sidebar & Library.
 */
export const DroppablePlaylistItem: React.FC<{
  playlist: Playlist;
  children: React.ReactNode;
  className?: string;
}> = ({ playlist, children, className = '' }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `playlist-${playlist.id}`,
    data: {
      type: 'playlist',
      playlist,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${
        isOver
          ? 'ring-2 ring-spotify-primary bg-spotify-highlight/80 scale-[1.02]'
          : ''
      } transition-all duration-150 rounded-md`}
    >
      {children}
    </div>
  );
};

export default DragContext;
