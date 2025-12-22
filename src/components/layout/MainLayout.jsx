import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import ErrorMonitorPanel from '@/components/debug/ErrorMonitorPanel';

function MainLayout() {
  return (
    <div className="min-h-screen page-gradient-bg text-white flex flex-col">
      <Header />
      <main className="flex-grow pt-20" style={{ paddingBottom: 'var(--crfm-player-offset, 0px)' }}> {/* pt-20 for fixed header height */}
        <Outlet />
      </main>
      <ErrorMonitorPanel />
      <div id="player-dock-sentinel" className="h-px w-full" aria-hidden="true" />
      {/* Footer could be added here */}
    </div>
  );
}

export default MainLayout;
