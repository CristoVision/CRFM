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

const AppFormModal = ({ isOpen, onClose, onSuccess, appData, currentUserId }) => {
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
    if (appData) {
      setTitle(appData.title || '');
      setDescription(appData.description || '');
      setMediaUrl(appData.media_url || '');
      setSiteUrl(appData.site_url || '');
      setIsPublic(appData.is_public !== undefined ? appData.is_public : true);
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
  }, [appData, isOpen]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File Too Large", description: "Media file should be less than 5MB.", variant: "destructive" });
        return;
      }
      setMediaFile(file);
      setMediaUrl(''); 
    }
  };

  const isValidUrl = (urlString) => {
    if (!urlString) return true; // Allow empty URL
    try {
      new URL(urlString);
      return true;
    } catch (e) {
      return false;
    }
  };

  const uploadMediaFile = async () => {
    if (!mediaFile) return mediaUrl; 
    setIsUploading(true);
    setUploadProgress(0);

    const fileName = `${currentUserId}/${Date.now()}_${mediaFile.name}`;
    const filePath = `app_media/${fileName}`;

    try {
      const { error } = await supabase.storage
        .from('app-assets') 
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
      toast({ title: "Upload Successful", description: "Media file uploaded.", variant: "success" });
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
    if (siteUrl && !isValidUrl(siteUrl)) {
      toast({ title: "Invalid Live URL", description: "Please enter a valid URL (e.g., https://example.com).", variant: "destructive" });
      return;
    }
    if (!currentUserId) {
      toast({ title: "User not identified", description: "Cannot save app without user ID.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    let finalMediaUrl = mediaUrl;

    try {
      if (mediaFile) {
        finalMediaUrl = await uploadMediaFile();
      }

      let response;
      if (appData?.id) { 
        const appPayload = {
          title,
          description,
          media_url: finalMediaUrl,
          site_url: siteUrl || null,
          is_public: isPublic,
          updated_by: currentUserId,
          updated_at: new Date().toISOString(), 
        };
        response = await supabase.from('apps').update(appPayload).eq('id', appData.id).select().single();
      } else { 
        const appPayload = {
          title,
          description,
          media_url: finalMediaUrl,
          site_url: siteUrl || null,
          is_public: isPublic,
          created_by: currentUserId,
          updated_by: currentUserId,
        };
        response = await supabase.from('apps').insert(appPayload).select().single();
      }

      const { data, error } = response;

      if (error) throw error;

      toast({ title: appData?.id ? "App Updated" : "App Created", description: `${data.title} saved successfully.`, variant: "success" });
      onSuccess();
    } catch (error) {
      console.error("Error saving app:", error);
      const errorMessage = error.message.includes("null value in column \"created_by\"") || error.message.includes("null value in column \"updated_by\"")
        ? "Failed to save app — check that created_by and updated_by are being passed."
        : error.message;
      toast({ title: "Error Saving App", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg glass-effect text-white font-montserrat">
        <DialogHeader>
          <DialogTitle className="golden-text text-2xl">{appData?.id ? 'Edit App' : 'Create New App'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div>
            <Label htmlFor="title" className="text-gray-300">Title <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="App Title"
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
              placeholder="Brief description of the app..."
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 min-h-[100px]"
            />
          </div>

          <div>
            <Label htmlFor="siteUrlApp" className="text-gray-300">Live URL <LinkIcon size={12} className="inline ml-1 text-blue-400" /></Label>
            <Input
              id="siteUrlApp"
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://example.com/my-app"
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
            />
          </div>
          
          <div>
            <Label htmlFor="mediaFileApp" className="text-gray-300">Media (Image/Video - Max 5MB)</Label>
            <div className="mt-1 flex items-center justify-center px-6 pt-5 pb-6 border-2 border-yellow-400/30 border-dashed rounded-md bg-black/20 hover:border-yellow-400/60 transition-colors">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-yellow-400/70" />
                <div className="flex text-sm text-gray-400">
                  <label
                    htmlFor="mediaFileApp"
                    className="relative cursor-pointer rounded-md font-medium text-yellow-300 hover:text-yellow-200 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-yellow-500"
                  >
                    <span>Upload a file</span>
                    <input id="mediaFileApp" name="mediaFileApp" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,video/*" />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF, MP4 up to 5MB</p>
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
            <Label htmlFor="mediaUrlApp" className="text-gray-300">Or Enter Media URL</Label>
            <Input
              id="mediaUrlApp"
              value={mediaUrl}
              onChange={(e) => { setMediaUrl(e.target.value); if (e.target.value) setMediaFile(null); }}
              placeholder="https://example.com/image.png"
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
              disabled={!!mediaFile || isUploading}
            />
             {mediaFile && <p className="text-xs text-yellow-500 mt-1">File upload will take precedence over URL.</p>}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="isPublicApp" className="text-gray-300 flex items-center">
              <Info size={14} className="mr-1.5 text-blue-400" /> Publicly Visible
            </Label>
            <Switch
              id="isPublicApp"
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
              {isUploading ? 'Uploading...' : (isSubmitting ? 'Saving...' : (appData?.id ? 'Update App' : 'Create App'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AppFormModal;
