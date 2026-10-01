import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import PlayerBar from '@/components/layout/PlayerBar';
import MobileNav from '@/components/layout/MobileNav';
import MobilePlayer from '@/components/layout/MobilePlayer';
import DragContext from '@/components/dnd/DragContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';

interface SiteLayoutProps {
  children: React.ReactNode;
}

export default function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <ErrorBoundary>
      <DragContext>
        <div
          className="h-screen w-screen overflow-hidden bg-spotify-black text-spotify-text flex flex-col md:grid md:grid-cols-[280px_1fr] md:grid-rows-[1fr_90px] [grid-template-areas:'sidebar_main'_'player_player'] select-none relative"
          style={{
            gridTemplateAreas: '"sidebar main" "player player"',
            gridTemplateColumns: '280px 1fr',
            gridTemplateRows: '1fr 90px',
          }}
        >
          {/* Sidebar: Hidden on mobile (display: none), visible on desktop md: and up */}
          <div 
            className="hidden md:flex [grid-area:sidebar] h-full overflow-hidden"
            style={{ gridArea: 'sidebar' }}
          >
            <Sidebar />
          </div>

          {/* Main Content Area: Takes full height minus PlayerBar, MobileNav and safe-areas on mobile, 1fr on desktop */}
          <main
            className="flex-1 w-full overflow-y-auto [grid-area:main] h-[calc(100vh-128px-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))] md:h-full bg-spotify-base md:m-2 md:ml-0 md:rounded-lg pt-[env(safe-area-inset-top,0px)] md:pt-0"
            style={{ gridArea: 'main' }}
          >
            {children}
          </main>

          {/* Desktop PlayerBar: Grid row 2 on desktop (hidden on mobile) */}
          <div
            className="hidden md:block md:static md:bottom-auto md:left-auto md:right-auto md:z-auto md:h-[90px] [grid-area:player]"
            style={{ gridArea: 'player' }}
          >
            <PlayerBar />
          </div>

          {/* Mobile Player: Fixed above 64px MobileNav with Framer Motion drag-to-dismiss */}
          <div className="block md:hidden fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40">
            <MobilePlayer />
          </div>

          {/* MobileNav: Displayed below md, 64px height with safe-area padding */}
          <MobileNav />
        </div>
      </DragContext>
    </ErrorBoundary>
  );
}
