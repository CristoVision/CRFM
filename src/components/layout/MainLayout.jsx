import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import ErrorMonitorPanel from '@/components/debug/ErrorMonitorPanel';

function MainLayout() {
  return (
    <div className="min-h-screen page-gradient-bg text-white flex flex-col">
      <Header />
      <main className="flex-grow pt-20"> {/* pt-20 for fixed header height */}
        <Outlet />
      </main>
      <ErrorMonitorPanel />
      {/* Footer could be added here */}
    </div>
  );
}

export default MainLayout;
