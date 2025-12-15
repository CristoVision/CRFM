import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const AchievementNotificationModal = ({ isOpen, onClose, notifications }) => {
  const navigate = useNavigate();

  const handleCreatorClick = (creatorId) => {
    onClose();
    navigate(`/creator/${creatorId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-effect-light border-yellow-400/30 text-white">
        <DialogHeader>
          <DialogTitle className="golden-text flex items-center text-2xl">
            <Trophy className="w-6 h-6 mr-3 text-yellow-400" />
            Recent Achievements!
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Check out these recent milestones from creators in the community.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4 max-h-[60vh] overflow-y-auto pr-2">
          {notifications.map((notif) => (
            <div
              key={notif.user_achievement_id}
              className="p-4 rounded-lg bg-black/20 border border-white/10 flex items-start space-x-4 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => handleCreatorClick(notif.creator_id)}
            >
              <Avatar className="w-12 h-12 border-2 border-yellow-400/50">
                <AvatarImage src={notif.creator_avatar_url} alt={notif.creator_username} />
                <AvatarFallback>
                  {notif.creator_username ? notif.creator_username.charAt(0).toUpperCase() : <User />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-yellow-300">
                  {notif.creator_username} unlocked: {notif.achievement_name}
                </p>
                <p className="text-sm text-gray-400">{notif.achievement_description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(notif.unlocked_at), { addSuffix: true })}
                </p>
              </div>
              {notif.achievement_icon_url && (
                <img src={notif.achievement_icon_url} alt="Achievement Icon" className="w-10 h-10" />
              )}
            </div>
          ))}
        </div>
        <Button onClick={onClose} className="w-full golden-gradient text-black font-semibold">
          Awesome!
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default AchievementNotificationModal;
