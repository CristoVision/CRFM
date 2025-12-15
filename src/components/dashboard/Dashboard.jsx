import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import TracksTab from './TracksTab';
import AlbumsTab from './AlbumsTab';
import PlaylistsTab from './PlaylistsTab';
import { Search, LogOut, Music } from 'lucide-react';

function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <header className="glass-effect border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full golden-gradient flex items-center justify-center">
                <Music className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Lyrics Player</h1>
                <p className="text-sm text-gray-400">Welcome, {user?.email?.split('@')[0] || 'User'}</p>
              </div>
            </div>
            
            <Button
              onClick={logout}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Welcome, <span className="golden-text">{user?.email?.split('@')[0] || 'User'}!</span>
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Discover inspiring music with synchronized lyrics.
          </p>
          
          {/* Search Bar */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracks, albums, playlists, creators..."
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs defaultValue="tracks" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-white/10 border border-white/20">
              <TabsTrigger value="tracks" className="tab-button">
                <Music className="w-4 h-4 mr-2" />
                Tracks
              </TabsTrigger>
              <TabsTrigger value="albums" className="tab-button">
                Albums
              </TabsTrigger>
              <TabsTrigger value="playlists" className="tab-button">
                Playlists
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tracks">
            <TracksTab searchQuery={searchQuery} />
          </TabsContent>
          
          <TabsContent value="albums">
            <AlbumsTab searchQuery={searchQuery} />
          </TabsContent>
          
          <TabsContent value="playlists">
            <PlaylistsTab searchQuery={searchQuery} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default Dashboard;
