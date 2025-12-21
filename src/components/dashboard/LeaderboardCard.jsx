import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Music, Disc, ListMusic, User, Headphones } from 'lucide-react';

const LeaderboardCard = ({ item, itemType, rank }) => {
  const navigate = useNavigate();

  const getCreatorId = () => {
    return itemType === 'playlist' ? item.creator_id : item.uploader_id;
  };

  const getDetailPagePath = () => {
    switch (itemType) {
      case 'track': return `/track/${item.id}`;
      case 'album': return `/album/${item.id}`;
      case 'playlist': return `/playlist/${item.id}`;
      case 'music_video': return `/video/${item.id}`;
      case 'creator': return `/creator/${item.id}`;
      default: return '/';
    }
  };

  const handleCardClick = () => {
    navigate(getDetailPagePath());
  };

  const handleCreatorClick = (e) => {
    e.stopPropagation();
    const creatorId = getCreatorId();
    if (creatorId) {
      navigate(`/creator/${creatorId}`);
    }
  };

  const rankColors = {
    1: 'bg-yellow-400 text-yellow-900',
    2: 'bg-gray-300 text-gray-800',
    3: 'bg-yellow-600 text-yellow-100',
  };

  const rankBorderColors = {
    1: 'border-yellow-400',
    2: 'border-gray-300',
    3: 'border-yellow-600',
  };

  const displayTitle = itemType === 'creator'
    ? (item.username || item.full_name || 'Creator')
    : item.title;

  const coverArt = itemType === 'creator'
    ? item.avatar_url
    : item.cover_art_url;

  const defaultCovers = {
    track: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    album: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500',
    playlist: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
    music_video: 'https://images.unsplash.com/photo-1516280440614-3793959696b4?w=500',
    creator: 'https://avatar.vercel.sh/creator.png?text=CR',
  };

  return (
    <Card 
      className={`w-full glass-effect-hoverable cursor-pointer border-2 ${rankBorderColors[rank] || 'border-transparent'}`}
      onClick={handleCardClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center space-x-4">
          <div className="relative flex-shrink-0">
            <img
              src={coverArt || defaultCovers[itemType]}
              alt={displayTitle}
              className="w-20 h-20 rounded-lg object-cover"
            />
            <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shadow-lg ${rankColors[rank]}`}>
              {rank}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">
              {displayTitle}
            </p>
            {itemType !== 'creator' && (
              <div 
                className="flex items-center text-sm text-gray-400 hover:text-yellow-300 transition-colors cursor-pointer mt-1"
                onClick={handleCreatorClick}
              >
                <User className="w-3 h-3 mr-1.5" />
                <span className="truncate">{item.creator_display_name || 'Unknown Creator'}</span>
              </div>
            )}
            {item.total_streams !== undefined && (
              <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Headphones className="w-3 h-3 mr-1.5" />
                  <span>{item.total_streams.toLocaleString()} streams</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaderboardCard;
