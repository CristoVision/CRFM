import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import ConfirmationDialog from '@/components/common/ConfirmationDialog';
import { Megaphone, Trash2, UploadCloud, Link as LinkIcon, Image as ImageIcon, FileAudio, CheckCircle2, AlertTriangle } from 'lucide-react';

function Row({ children }) {
  return <div className="flex flex-col sm:flex-row sm:items-center gap-3">{children}</div>;
}

const AdsTab = () => {
  const { profile } = useAuth();
  const [ads, setAds] = useState([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [creatingAd, setCreatingAd] = useState(false);
  const [savingAd, setSavingAd] = useState(false);
  const [newAd, setNewAd] = useState({
    name: '',
    click_url: '',
    audio_url: '',
    image_url: '',
    is_active: true,
  });
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const bucketName = 'ads';

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmDialogTitle, setConfirmDialogTitle] = useState('');
  const [confirmDialogDescription, setConfirmDialogDescription] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchAds = async () => {
    setLoadingAds(true);
    try {
      const { data, error } = await supabase
        .from('ads')
        .select('id,name,click_url,audio_url,image_url,is_active,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAds(data || []);
    } catch (e) {
      toast({ title: 'Error loading ads', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingAds(false);
    }
  };

  useEffect(() => {
    if (!profile?.is_admin) return;
    fetchAds();
  }, [profile]);

  if (!profile?.is_admin) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl text-white">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mb-4" />
        <h3 className="text-2xl font-semibold text-yellow-300 mb-2">Admin access required</h3>
        <p className="text-gray-400">Only administrators can manage ads.</p>
      </div>
    );
  }

  const uniquePath = (prefix, filename) => {
    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
    return `${prefix}/${crypto.randomUUID()}${ext}`;
  };

  const uploadToBucket = async (file, folder) => {
    const path = uniquePath(folder, file.name || 'upload');
    const { data, error } = await supabase.storage.from(bucketName).upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
    if (error) throw error;
    const { data: pub } = supabase.storage.from(bucketName).getPublicUrl(data.path);
    return pub.publicUrl;
  };

  const createAd = async () => {
    if (!newAd.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter an ad name.', variant: 'destructive' });
      return;
    }
    if (!audioFile) {
      toast({ title: 'Audio required', description: 'Upload an audio file for the ad.', variant: 'destructive' });
      return;
    }
    if (!imageFile) {
      toast({ title: 'Image required', description: 'Upload an image for the ad.', variant: 'destructive' });
      return;
    }
    setCreatingAd(true);
    try {
      const audioUrl = await uploadToBucket(audioFile, 'audio');
      const imageUrl = await uploadToBucket(imageFile, 'images');

      const { data, error } = await supabase.rpc('rpc_admin_upsert_ad', {
        p_admin_id: profile.id,
        p_id: null,
        p_name: newAd.name.trim(),
        p_click_url: newAd.click_url?.trim() || null,
        p_audio_url: audioUrl,
        p_image_url: imageUrl,
        p_is_active: !!newAd.is_active,
      });
      if (error) throw error;

      toast({ title: 'Ad created', description: data?.name || newAd.name, variant: 'success' });
      setNewAd({ name: '', click_url: '', audio_url: '', image_url: '', is_active: true });
      setAudioFile(null);
      setImageFile(null);
      fetchAds();
    } catch (e) {
      toast({ title: 'Create failed', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingAd(false);
    }
  };

  const updateAdField = async (id, field, value) => {
    setSavingAd(true);
    try {
      const adToUpdate = ads.find(a => a.id === id);
      if (!adToUpdate) throw new Error('Ad not found');
      const { error } = await supabase.rpc('rpc_admin_upsert_ad', {
        p_admin_id: profile.id,
        p_id: id,
        p_name: field === 'name' ? value : adToUpdate.name,
        p_click_url: field === 'click_url' ? value : adToUpdate.click_url,
        p_audio_url: field === 'audio_url' ? value : adToUpdate.audio_url,
        p_image_url: field === 'image_url' ? value : adToUpdate.image_url,
        p_is_active: field === 'is_active' ? value : adToUpdate.is_active,
      });
      if (error) throw error;
      setAds(prev => prev.map(a => (a.id === id ? { ...a, [field]: value } : a)));
      toast({ title: 'Updated', description: `${field} saved`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
      fetchAds();
    } finally {
      setSavingAd(false);
    }
  };

  const replaceAdAsset = async (id, type, file) => {
    try {
      if (!file) return;
      const url = await uploadToBucket(file, type === 'audio' ? 'audio' : 'images');
      const field = type === 'audio' ? 'audio_url' : 'image_url';
      const adToUpdate = ads.find(a => a.id === id);
      if (!adToUpdate) throw new Error('Ad not found');
      const { error } = await supabase.rpc('rpc_admin_upsert_ad', {
        p_admin_id: profile.id,
        p_id: id,
        p_name: adToUpdate.name,
        p_click_url: adToUpdate.click_url,
        p_audio_url: field === 'audio_url' ? url : adToUpdate.audio_url,
        p_image_url: field === 'image_url' ? url : adToUpdate.image_url,
        p_is_active: adToUpdate.is_active,
      });
      if (error) throw error;
      setAds(prev => prev.map(a => (a.id === id ? { ...a, [field]: url } : a)));
      toast({ title: 'Asset updated', description: `${type} replaced`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Replace failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteAd = (id) => {
    setConfirmDialogTitle('Delete Ad?');
    setConfirmDialogDescription('Are you sure you want to delete this ad? This action cannot be undone.');
    setConfirmAction(() => async () => {
      try {
        const { error } = await supabase.rpc('rpc_admin_delete_ad', {
          p_admin_id: profile.id,
          p_ad_id: id,
        });
        if (error) throw error;
        setAds(prev => prev.filter(a => a.id !== id));
        toast({ title: 'Ad deleted', variant: 'success' });
      } catch (e) {
        toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
      } finally {
        setIsConfirmDialogOpen(false);
      }
    });
    setIsConfirmDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card className="glass-effect">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center"><Megaphone className="w-5 h-5 mr-2 text-yellow-400" />Create Ad</h2>
          <div className="space-y-4">
            <Row>
              <div className="w-full">
                <Label>Name</Label>
                <Input value={newAd.name} onChange={e => setNewAd(a => ({ ...a, name: e.target.value }))} placeholder="Sponsor name / Campaign" />
              </div>
            </Row>
            <Row>
              <div className="w-full">
                <Label>Click URL (optional)</Label>
                <Input value={newAd.click_url} onChange={e => setNewAd(a => ({ ...a, click_url: e.target.value }))} placeholder="https://sponsor.example/landing" />
              </div>
            </Row>

            <Row>
              <div className="w-full sm:w-1/2">
                <Label>Audio (required)</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                  <FileAudio className="w-5 h-5 text-yellow-400" />
                </div>
                {audioFile && <div className="text-xs text-green-400 mt-1 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" />{audioFile.name}</div>}
              </div>
              <div className="w-full sm:w-1/2">
                <Label>Image (required)</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                  <ImageIcon className="w-5 h-5 text-yellow-400" />
                </div>
                {imageFile && <div className="text-xs text-green-400 mt-1 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" />{imageFile.name}</div>}
              </div>
            </Row>

            <Row>
              <div className="flex items-center gap-2">
                <Switch checked={newAd.is_active} onCheckedChange={v => setNewAd(a => ({ ...a, is_active: v }))} />
                <span className="text-sm text-gray-300">Active</span>
              </div>
            </Row>

            <div className="pt-2">
              <Button className="golden-gradient text-black font-semibold" onClick={createAd} disabled={creatingAd}>
                {creatingAd ? <UploadCloud className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                Create Ad (upload assets)
              </Button>
            </div>

            <div className="text-xs text-gray-400 flex items-start gap-2 mt-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <span>
                Admin note: When a listener clicks an ad link, show a confirmation & disclaimer modal
                (\"External link — CRFM not liable; continue?\") before opening <em>click_url</em>.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-effect">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">Ads</h2>
          {loadingAds ? (
            <div className="text-gray-400">Loading ads…</div>
          ) : ads.length === 0 ? (
            <div className="text-gray-400">No ads found.</div>
          ) : (
            <div className="space-y-4">
              {ads.map(ad => (
                <div key={ad.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{ad.name}</div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteAd(ad.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />Delete
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="text-sm text-gray-300">
                        <div className="mb-2">
                          <span className="text-gray-400">Audio:</span>{' '}
                          <a href={ad.audio_url} target="_blank" rel="noreferrer" className="text-yellow-300 underline break-all">{ad.audio_url}</a>
                        </div>
                        <div className="mb-2">
                          <span className="text-gray-400">Image:</span>{' '}
                          <a href={ad.image_url} target="_blank" rel="noreferrer" className="text-yellow-300 underline break-all">{ad.image_url}</a>
                        </div>
                        <div className="mb-2">
                          <span className="text-gray-400">Click URL:</span>{' '}
                          {ad.click_url ? <a href={ad.click_url} target="_blank" rel="noreferrer" className="text-yellow-300 underline break-all">{ad.click_url}</a> : <span className="text-gray-500">—</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Switch
                            checked={!!ad.is_active}
                            onCheckedChange={(v) => updateAdField(ad.id, 'is_active', v)}
                            disabled={savingAd}
                          />
                          <span className="text-xs text-gray-300">Active</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-gray-300">Replace audio</Label>
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="audio/*" onChange={(e) => replaceAdAsset(ad.id, 'audio', e.target.files?.[0] || null)} />
                          <FileAudio className="w-5 h-5 text-yellow-400" />
                        </div>

                        <Label className="text-xs text-gray-300 mt-3">Replace image</Label>
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="image/*" onChange={(e) => replaceAdAsset(ad.id, 'image', e.target.files?.[0] || null)} />
                          <ImageIcon className="w-5 h-5 text-yellow-400" />
                        </div>

                        <Label className="text-xs text-gray-300 mt-3">Edit Click URL (optional)</Label>
                        <div className="flex items-center gap-2">
                          <Input value={ad.click_url || ''} onChange={(e) => updateAdField(ad.id, 'click_url', e.target.value || null)} placeholder="https://sponsor.example/landing" />
                          <LinkIcon className="w-5 h-5 text-yellow-400" />
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">Updated: {new Date(ad.updated_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        onConfirm={confirmAction}
        title={confirmDialogTitle}
        description={confirmDialogDescription}
      />
    </div>
  );
};

export default AdsTab;
