import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import AuthModalHandler from '@/components/auth/AuthModalHandler';
import ResetPasswordScreen from '@/components/auth/ResetPasswordScreen';
import MainLayout from '@/components/layout/MainLayout';
import HomePage from '@/pages/HomePage';

import HubPage from '@/pages/Hub/HubPage';
import AboutPage from '@/pages/AboutPage';
import AdminPage from '@/pages/AdminPage';
import WalletPage from '@/pages/WalletPage';
import ProfilePage from '@/pages/ProfilePage';
import TrackDetailPage from '@/pages/TrackDetailPage';
import AlbumDetailPage from '@/pages/AlbumDetailPage';
import PlaylistDetailPage from '@/pages/PlaylistDetailPage';
import CreatorDetailPage from '@/pages/CreatorDetailPage';
import VideoDetailPage from '@/pages/VideoDetailPage';
import NotFoundPage from '@/pages/NotFoundPage';

import EmbedTrackPage from '@/pages/embed/EmbedTrackPage';
import EmbedAlbumPage from '@/pages/embed/EmbedAlbumPage';
import EmbedPlaylistPage from '@/pages/embed/EmbedPlaylistPage';
import EmbedCreatorPage from '@/pages/embed/EmbedCreatorPage';

import MusicPlayer from '@/components/player/MusicPlayer';
import FloatingLyricsOverlay from '@/components/player/FloatingLyricsOverlay';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { QueueProvider } from '@/contexts/QueueContext';
import { VideoPlayerProvider } from '@/contexts/VideoPlayerContext';
import { Helmet } from 'react-helmet-async';
import UnauthenticatedRadio from '@/components/player/UnauthenticatedRadio';

function FullScreenSpinner() {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="text-center">
        <img
          src="/favicon-32x32.png"
          alt="CRFM Logo Loading"
          className="h-32 w-auto mx-auto mb-8"
        />
        <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-white text-xl font-semibold">Loading CRFM...</p>
        <p className="text-yellow-300 text-sm mt-1">Connecting to the Ministry of Music</p>
      </div>
    </div>
  );
}

// A new component to handle redirects for deprecated auth pages
function DeprecatedAuthRedirect() {
    const location = useLocation();
    const { user } = useAuth();

    // If user is already logged in, send them to home
    if (user) {
        return <Navigate to="/" replace />;
    }

    // For guests, redirect to home and trigger the auth modal
    const view = location.pathname.substring(1); // e.g., 'login', 'signup'
    return <Navigate to={`/?auth=${view}`} replace />;
}


function AppContent() {
  const { user, profile, initialAuthCheckComplete } = useAuth();

  if (!initialAuthCheckComplete) return <FullScreenSpinner />;

  return (
    <>
      <Helmet>
        <title>CRFM - Christian Radio & Music</title>
        <meta
          name="description"
          content="CRFM is a platform for Christian artists to share their music and for listeners to discover faith-based content with synchronized lyrics."
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a202c" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Helmet>

      <Routes>
        {/* Deprecated standalone auth routes now redirect */}
        <Route path="/login" element={<DeprecatedAuthRedirect />} />
        <Route path="/signup" element={<DeprecatedAuthRedirect />} />
        <Route path="/forgot-password" element={<DeprecatedAuthRedirect />} />
        <Route path="/auth" element={<DeprecatedAuthRedirect />} />

        {/* This route remains for password recovery links */}
        <Route path="/reset-password" element={<ResetPasswordScreen />} />

        {/* Public embeds */}
        <Route path="/embed/track/:id" element={<EmbedTrackPage />} />
        <Route path="/embed/album/:id" element={<EmbedAlbumPage />} />
        <Route path="/embed/playlist/:id" element={<EmbedPlaylistPage />} />
        <Route path="/embed/creator/:id" element={<EmbedCreatorPage />} />

        {/* Main app routes are now under a single layout */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          
          {/* Protected Routes */}
          <Route path="hub" element={user ? <HubPage /> : <Navigate to="/?auth=login" />} />
          <Route
            path="admin"
            element={
              user
                ? profile?.is_admin
                  ? <AdminPage />
                  : <Navigate to="/" replace />
                : <Navigate to="/?auth=login" />
            }
          />
          <Route path="wallet" element={user ? <WalletPage /> : <Navigate to="/?auth=login" />} />
          <Route path="profile" element={user ? <ProfilePage /> : <Navigate to="/?auth=login" />} />
          
          {/* Detail pages can be public, with features disabled for guests */}
          <Route path="track/:id" element={<TrackDetailPage />} />
          <Route path="album/:id" element={<AlbumDetailPage />} />
          <Route path="playlist/:id" element={<PlaylistDetailPage />} />
          <Route path="creator/:id" element={<CreatorDetailPage />} />
          <Route path="video/:id" element={<VideoDetailPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      {/* Auth Modal is triggered via query param, handled globally */}
      <AuthModalHandler />

      {/* Show music player for logged-in users, radio for guests */}
      {user ? (
        <>
          <MusicPlayer />
          <FloatingLyricsOverlay />
        </>
      ) : (
        <UnauthenticatedRadio />
      )}
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <QueueProvider>
          <PlayerProvider>
            <VideoPlayerProvider>
              <AppContent />
            </VideoPlayerProvider>
          </PlayerProvider>
        </QueueProvider>
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;
