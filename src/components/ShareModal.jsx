import React, { useState, useEffect, useRef } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Link, Share2, Code, Copy, MessageSquare, Loader2, AlertTriangle, Eye, EyeOff, Film } from 'lucide-react';

    const ShareModal = ({ entityType, entityId, isOpen, onClose }) => {
      const { user } = useAuth();
      const [shareCounts, setShareCounts] = useState({ total: 0, link: 0, embed: 0, social: 0 });
      const [loadingCounts, setLoadingCounts] = useState(false);
      const [currentTab, setCurrentTab] = useState('link');
      const [showCopyFallback, setShowCopyFallback] = useState(false);
      const [fallbackText, setFallbackText] = useState('');
      const [clipboardPermissionDenied, setClipboardPermissionDenied] = useState(false);
      const fallbackInputRef = useRef(null);

      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/${entityType}/${entityId}`;
      
      const getInitialEmbedCode = () => {
        if (!entityType || !entityId) return '';
        // For videos, let's use a slightly different default height, or make it configurable.
        const embedHeight = entityType === 'video' ? '315' : '400'; // Example: YouTube small embed height
        const embedUrl = `${baseUrl}/embed/${entityType}/${entityId}`;
        return `<iframe src="${embedUrl}" width="100%" height="${embedHeight}" style="border:none; overflow:hidden; border-radius: 8px;" allowtransparency="true" allow="encrypted-media; autoplay" title="CRFM Embed - ${entityType}: ${entityId}"></iframe>`;
      }
      
      const [currentEmbedCode, setCurrentEmbedCode] = useState('');
      const [showEmbedPreview, setShowEmbedPreview] = useState(true);


      useEffect(() => {
        if (isOpen && entityType && entityId) {
          fetchShareCounts();
          checkClipboardPermission();
          setCurrentEmbedCode(getInitialEmbedCode()); 
        } else {
          setShowCopyFallback(false); 
          setFallbackText('');
          setShowEmbedPreview(true); 
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [isOpen, entityType, entityId]);

      const checkClipboardPermission = async () => {
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const permissionStatus = await navigator.permissions.query({ name: 'clipboard-write' });
            if (permissionStatus.state === 'denied') {
              setClipboardPermissionDenied(true);
            } else {
              setClipboardPermissionDenied(false);
            }
          } catch (err) {
            console.warn('Clipboard permission query failed:', err);
            setClipboardPermissionDenied(false);
          }
        } else {
          setClipboardPermissionDenied(false);
        }
      };


      const fetchShareCounts = async () => {
        setLoadingCounts(true);
        try {
          const { data, error } = await supabase.rpc('get_share_counts', {
            p_entity_type: entityType,
            p_entity_id: entityId,
          });

          if (error) throw error;
          
          setShareCounts({
            total: data.total_shares || 0,
            link: data.link_shares || 0,
            embed: data.embed_shares || 0,
            social: data.social_shares || 0,
          });
        } catch (error) {
          toast({
            title: 'Error fetching share counts',
            description: error.message,
            variant: 'destructive',
          });
        } finally {
          setLoadingCounts(false);
        }
      };

      const logShareEvent = async (method) => {
        if (!user) {
          toast({ title: "Login Required", description: "Please log in to share.", variant: "destructive" });
          return false;
        }
        try {
          const { error } = await supabase.from('share_events').insert({
            user_id: user.id,
            entity_type: entityType,
            entity_id: entityId,
            method: method,
          });
          if (error) throw error;
          fetchShareCounts(); 
          return true;
        } catch (error) {
          toast({
            title: 'Error logging share event',
            description: error.message,
            variant: 'destructive',
          });
          return false;
        }
      };

      const handleCopyToClipboard = (textToCopy, shareMethod) => {
        logShareEvent(shareMethod);

        if (clipboardPermissionDenied) {
          setFallbackText(textToCopy);
          setShowCopyFallback(true);
          toast({ title: 'Clipboard permission denied', description: 'Please copy the text manually.', variant: 'warning' });
          setTimeout(() => fallbackInputRef.current?.select(), 0);
          return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy)
            .then(() => {
              toast({ title: 'Copied to clipboard!', variant: 'success' });
              setShowCopyFallback(false);
            })
            .catch(err => {
              console.error('Clipboard API copy failed:', err);
              setFallbackText(textToCopy);
              setShowCopyFallback(true);
              toast({ title: 'Automatic copy failed', description: 'Please copy the text manually.', variant: 'warning' });
              setTimeout(() => fallbackInputRef.current?.select(), 0);
            });
        } else {
          setFallbackText(textToCopy);
          setShowCopyFallback(true);
          toast({ title: 'Automatic copy unavailable', description: 'Please copy the text manually.', variant: 'warning' });
          setTimeout(() => fallbackInputRef.current?.select(), 0);
        }
      };
      

      const handleSocialShare = async (platform) => {
        const logged = await logShareEvent('social');
        if (!logged) return;

        let url = '';
        const text = `Check out this ${entityType}! ${shareUrl}`;
        switch (platform) {
          case 'twitter':
            url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            break;
          case 'facebook':
            url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            break;
          case 'linkedin':
             url = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(`Check out this ${entityType}`)}&summary=${encodeURIComponent(text)}`;
            break;
          default:
            toast({ title: 'Platform not supported', variant: 'destructive'});
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        toast({ title: `Shared to ${platform}!`, variant: 'success' });
      };
      
      const SocialButton = ({ platform, icon, children }) => (
        <Button variant="outline" className="w-full justify-start bg-white/5 border-white/10 hover:bg-white/15" onClick={() => handleSocialShare(platform)}>
          {icon}
          {children}
        </Button>
      );

      const renderCopySection = (textToCopy, shareMethod) => (
        <>
          <p className="text-sm text-gray-400 mb-2">
            {shareMethod === 'link' ? "Copy the link to share directly:" : "Copy the embed code for your website:"}
          </p>
          <div className="flex space-x-2">
            {shareMethod === 'embed' ? (
              <Textarea 
                readOnly 
                value={currentEmbedCode}
                onChange={(e) => setCurrentEmbedCode(e.target.value)}
                className="bg-white/5 border-white/10 text-white h-24 resize-none font-mono text-xs"
                onClick={(e) => e.target.select()}
              />
            ) : (
              <Input 
                readOnly 
                value={textToCopy} 
                className="bg-white/5 border-white/10 text-white"
                onClick={(e) => e.target.select()}
              />
            )}
            <Button onClick={() => handleCopyToClipboard(shareMethod === 'embed' ? currentEmbedCode : textToCopy, shareMethod)} className="golden-gradient text-black">
              <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>
          </div>
          {showCopyFallback && fallbackText === (shareMethod === 'embed' ? currentEmbedCode : textToCopy) && (
            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
              <div className="flex items-center text-yellow-300">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <p className="text-sm font-semibold">Manual Copy Required</p>
              </div>
              <p className="text-xs text-yellow-400 mt-1 mb-2">
                {clipboardPermissionDenied 
                  ? "Permission to access clipboard was denied. Please copy the text below manually."
                  : "Could not copy to clipboard automatically. Please select the text below and press Ctrl+C (or Cmd+C on Mac) to copy."
                }
              </p>
              {shareMethod === 'embed' ? (
                <Textarea
                  ref={fallbackInputRef}
                  readOnly
                  value={fallbackText}
                  className="bg-black/20 border-yellow-500/50 text-white selection:bg-yellow-500 selection:text-black h-24 resize-none font-mono text-xs"
                  onFocus={(e) => e.target.select()}
                />
              ) : (
                <Input
                  ref={fallbackInputRef}
                  readOnly
                  value={fallbackText}
                  className="bg-black/20 border-yellow-500/50 text-white selection:bg-yellow-500 selection:text-black"
                  onFocus={(e) => e.target.select()}
                />
              )}
            </div>
          )}
          {shareMethod === 'embed' && (
            <>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowEmbedPreview(!showEmbedPreview)} className="bg-white/10 border-white/20 text-gray-300 hover:bg-white/20">
                  {showEmbedPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {showEmbedPreview ? 'Hide Preview' : 'Show Preview'}
                </Button>
              </div>
              {showEmbedPreview && (
                <div className="mt-3 p-3 bg-black/20 rounded-md border border-white/10">
                  <h4 className="text-xs text-gray-400 mb-2">Embed Preview:</h4>
                  <div className={`w-full max-w-md mx-auto bg-gray-800 rounded overflow-hidden ${entityType === 'video' ? 'aspect-video' : 'aspect-[3/4]'}`}>
                    <iframe
                      srcDoc={currentEmbedCode}
                      className="w-full h-full"
                      sandbox="allow-scripts allow-same-origin allow-presentation" 
                      allow="autoplay; encrypted-media"
                      title="Embed Preview"
                    />
                  </div>
                   <p className="text-xs text-yellow-400 mt-2 text-center">Note: Actual appearance may vary. Ensure the embed URL is correct.</p>
                </div>
              )}
            </>
          )}
        </>
      );

      const getEntityTypeIcon = () => {
        switch(entityType) {
          case 'track': return <Share2 className="w-6 h-6 mr-2" />; // Assuming default for track
          case 'album': return <Share2 className="w-6 h-6 mr-2" />; // Assuming default for album
          case 'playlist': return <Share2 className="w-6 h-6 mr-2" />; // Assuming default for playlist
          case 'creator': return <Share2 className="w-6 h-6 mr-2" />; // Assuming default for creator
          case 'video': return <Film className="w-6 h-6 mr-2" />;
          default: return <Share2 className="w-6 h-6 mr-2" />;
        }
      }

      return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setShowCopyFallback(false); setShowEmbedPreview(true); } onClose(open); }}>
          <DialogContent className="sm:max-w-lg glass-effect text-white">
            <DialogHeader>
              <DialogTitle className="golden-text flex items-center">
                {getEntityTypeIcon()} Share this {entityType}
              </DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="link" value={currentTab} onValueChange={(value) => { setCurrentTab(value); setShowCopyFallback(false); }} className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-3 bg-black/20">
                <TabsTrigger value="link" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 text-gray-300">
                  <Link className="w-4 h-4 mr-2" /> Link
                </TabsTrigger>
                <TabsTrigger value="embed" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 text-gray-300">
                  <Code className="w-4 h-4 mr-2" /> Embed
                </TabsTrigger>
                <TabsTrigger value="social" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 text-gray-300">
                  <MessageSquare className="w-4 h-4 mr-2" /> Social
                </TabsTrigger>
              </TabsList>

              <TabsContent value="link" className="mt-4">
                {renderCopySection(shareUrl, 'link')}
              </TabsContent>

              <TabsContent value="embed" className="mt-4">
                {renderCopySection(currentEmbedCode, 'embed')}
              </TabsContent>

              <TabsContent value="social" className="mt-4">
                <p className="text-sm text-gray-400 mb-3">Share directly to social media:</p>
                <div className="space-y-2">
                   <SocialButton platform="twitter" icon={<Share2 className="w-4 h-4 mr-2"/>}>Share on X (Twitter)</SocialButton>
                   <SocialButton platform="facebook" icon={<Share2 className="w-4 h-4 mr-2"/>}>Share on Facebook</SocialButton>
                   <SocialButton platform="linkedin" icon={<Share2 className="w-4 h-4 mr-2"/>}>Share on LinkedIn</SocialButton>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Share Statistics</h3>
              {loadingCounts ? (
                <div className="flex justify-center items-center h-10">
                  <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white/5 p-2 rounded text-center">
                    <p className="text-gray-400">Total</p>
                    <p className="text-yellow-400 font-bold text-lg">{shareCounts.total}</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded text-center">
                    <p className="text-gray-400">Links</p>
                    <p className="text-white font-bold text-lg">{shareCounts.link}</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded text-center">
                    <p className="text-gray-400">Embeds</p>
                    <p className="text-white font-bold text-lg">{shareCounts.embed}</p>
                  </div>
                  <div className="bg-white/5 p-2 rounded text-center">
                    <p className="text-gray-400">Social</p>
                    <p className="text-white font-bold text-lg">{shareCounts.social}</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button variant="outline" className="bg-white/10 border-white/20 text-gray-300 hover:bg-white/20">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default ShareModal;
