import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const VideoPlayerModal = ({ isOpen, onClose, video, playbackUrl, loadingUrl, errorText }) => {
  if (!video) return null;

  const viewError = errorText || (!playbackUrl && !loadingUrl ? 'Video not available.' : '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-4xl w-full p-0 glass-effect text-white border-yellow-500/30 rounded-none sm:rounded-2xl min-h-[60vh] sm:min-h-0">
        <DialogHeader className="p-4 border-b border-white/10 flex flex-row justify-between items-center">
          <DialogTitle className="text-lg font-semibold golden-text truncate pr-8">
            {video.title || "Music Video"}
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-yellow-300">
              <X className="w-5 h-5" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="aspect-video bg-black flex items-center justify-center">
          {loadingUrl ? (
            <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
          ) : viewError ? (
            <div className="flex flex-col items-center justify-center text-red-400 px-4 text-center">
              <AlertTriangle className="w-12 h-12 mb-2" />
              <p className="font-semibold">Playback Error</p>
              <p className="text-sm text-center">{viewError}</p>
            </div>
          ) : playbackUrl ? (
            <video
              src={playbackUrl}
              controls
              autoPlay
              className="w-full h-full"
              onError={(e) => {
                console.error("Video player error:", e.target.error);
                toast({ title: "Video Playback Error", description: "Could not play the video.", variant: "destructive" });
              }}
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="text-gray-400">Video not available.</div>
          )}
        </div>
        <div className="p-4 bg-black/20">
          <h3 className="text-base font-medium text-gray-200">Description:</h3>
          <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">
            {video.description || "No description provided."}
          </p>
          <div className="mt-3 text-xs text-gray-500 flex justify-between">
            <span>Uploaded by: {video.creator_display_name || "Unknown Creator"}</span>
            <span>Published: {new Date(video.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoPlayerModal;
