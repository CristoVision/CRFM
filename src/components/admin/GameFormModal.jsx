import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Loader2, UploadCloud, CheckCircle, AlertTriangle, Info, Link as LinkIcon } from 'lucide-react';

const GameFormModal = ({ isOpen, onClose, onSuccess, gameData, currentUserId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (gameData) {
      setTitle(gameData.title || '');
      setDescription(gameData.description || '');
      setMediaUrl(gameData.media_url || '');
      setSiteUrl(gameData.site_url || '');
      setIsPublic(gameData.is_public !== undefined ? gameData.is_public : true);
    } else {
      setTitle('');
      setDescription('');
      setMediaUrl('');
      setSiteUrl('');
      setIsPublic(true);
    }
    setMediaFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  }, [gameData, isOpen]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit for media
        toast({ title: "File Too Large", description: "Media file should be less than 5MB.", variant: "destructive" });
        return;
      }
      setMediaFile(file);
      setMediaUrl(''); 
    }
  };

  const uploadMediaFile = async () => {
    if (!mediaFile) return mediaUrl; 
    setIsUploading(true);
    setUploadProgress(0);

    // Using 'app-assets' bucket but prefixing with 'game_media/' to keep things organized
    const fileName = `${currentUserId}/${Date.now()}_${mediaFile.name}`;
    const filePath = `game_media/${fileName}`;

    try {
      const { error } = await supabase.storage
        .from('app-assets') // Re-using app-assets bucket
        .upload(filePath, mediaFile, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            setUploadProgress((progress.loaded / progress.total) * 100);
          },
        });

      if (error) throw error;
      
      const { data: publicUrlData } = supabase.storage.from('app-assets').getPublicUrl(filePath);
      setIsUploading(false);
      toast({ title: "Upload Successful", description: "Media file uploaded.", className: "bg-green-600 text-white" });
      return publicUrlData.publicUrl;

    } catch (error) {
      setIsUploading(false);
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
      throw error; 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!siteUrl) {
        toast({ title: "Site URL is required", description: "Please provide a link to the game.", variant: "destructive" });
        return;
    }
    if (!currentUserId) {
      toast({ title: "User not identified", description: "Cannot save game without user ID.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    let finalMediaUrl = mediaUrl;

    try {
      if (mediaFile) {
        finalMediaUrl = await uploadMediaFile();
      }

      const gamePayload = {
        title,
        description,
        media_url: finalMediaUrl,
        site_url: siteUrl,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      };

      let response;
      if (gameData?.id) { 
        gamePayload.updated_by = currentUserId;
        response = await supabase.from('games').update(gamePayload).eq('id', gameData.id).select().single();
      } else { 
        gamePayload.created_by = currentUserId;
        response = await supabase.from('games').insert(gamePayload).select().single();
      }

      const { data, error } = response;

      if (error) throw error;

      toast({ title: gameData?.id ? "Game Updated" : "Game Created", description: `${data.title} saved successfully.`, className: "bg-green-600 text-white" });
      onSuccess();
    } catch (error) {
      console.error("Error saving game:", error);
      toast({ title: "Error Saving Game", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg glass-effect text-white font-montserrat">
        <DialogHeader>
          <DialogTitle className="golden-text text-2xl">{gameData?.id ? 'Edit Game' : 'Create New Game'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div>
            <Label htmlFor="title" className="text-gray-300">Title <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Game Title"
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
              required
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-gray-300">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the game..."
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 min-h-[100px]"
            />
          </div>

           <div>
            <Label htmlFor="siteUrl" className="text-gray-300">Site URL <span className="text-red-500">*</span> <LinkIcon size={12} className="inline ml-1 text-blue-400" /></Label>
            <Input
              id="siteUrl"
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://example.com/play-game"
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="mediaFile" className="text-gray-300">Thumbnail/Cover Media (Max 5MB)</Label>
            <div className="mt-1 flex items-center justify-center px-6 pt-5 pb-6 border-2 border-yellow-400/30 border-dashed rounded-md bg-black/20 hover:border-yellow-400/60 transition-colors">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-yellow-400/70" />
                <div className="flex text-sm text-gray-400">
                  <label
                    htmlFor="mediaFile"
                    className="relative cursor-pointer rounded-md font-medium text-yellow-300 hover:text-yellow-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-yellow-500"
                  >
                    <span>Upload a file</span>
                    <input id="mediaFile" name="mediaFile" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,video/*" />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
              </div>
            </div>
            {mediaFile && !isUploading && (
              <div className="mt-2 text-sm text-green-400 flex items-center">
                <CheckCircle size={16} className="mr-2"/> Selected: {mediaFile.name}
              </div>
            )}
            {isUploading && (
                <div className="mt-2">
                    <div className="w-full bg-neutral-700 rounded-full h-2.5">
                        <div className="bg-yellow-400 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="text-xs text-yellow-300 text-center mt-1">{Math.round(uploadProgress)}% uploaded</p>
                </div>
            )}
          </div>

          <div>
            <Label htmlFor="mediaUrl" className="text-gray-300">Or Enter Media URL (Thumbnail/Cover)</Label>
            <Input
              id="mediaUrl"
              value={mediaUrl}
              onChange={(e) => { setMediaUrl(e.target.value); if (e.target.value) setMediaFile(null); }}
              placeholder="https://example.com/game-cover.png"
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
              disabled={!!mediaFile || isUploading}
            />
             {mediaFile && <p className="text-xs text-yellow-500 mt-1">File upload will take precedence over URL.</p>}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="isPublicGame" className="text-gray-300 flex items-center">
              <Info size={14} className="mr-1.5 text-blue-400" /> Publicly Visible
            </Label>
            <Switch
              id="isPublicGame"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              className="data-[state=checked]:bg-yellow-400"
            />
          </div>
          
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="golden-gradient text-black font-semibold" disabled={isSubmitting || isUploading}>
              {(isSubmitting || isUploading) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isUploading ? 'Uploading...' : (isSubmitting ? 'Saving...' : (gameData?.id ? 'Update Game' : 'Create Game'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GameFormModal;
