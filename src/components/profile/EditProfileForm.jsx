import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Edit, UploadCloud, Save, Loader2, Coins, Bell } from 'lucide-react';

function EditProfileForm() {
  const { user, profile, refreshUserProfile } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    social_link_1: '',
    social_link_2: '',
    is_public: true,
    enable_achievement_notifications: true,
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        social_link_1: profile.social_link_1 || '',
        social_link_2: profile.social_link_2 || '',
        is_public: profile.is_public !== undefined ? profile.is_public : true,
        enable_achievement_notifications: profile.enable_achievement_notifications !== undefined ? profile.enable_achievement_notifications : true,
      });
      setAvatarPreview(profile.avatar_url);
      setLoadingProfile(false);
    } else if (user) {
      setLoadingProfile(true);
      refreshUserProfile().then(() => setLoadingProfile(false));
    }
  }, [profile, user, refreshUserProfile]);

  const handleInputChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSwitchChange = (name, checked) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleAvatarChange = e => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return null;
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `public/${user.id}_${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('avatars').upload(fileName, avatarFile, { upsert: true });
    if (error) {
      toast({ title: 'Avatar Upload Failed', description: error.message, variant: 'destructive' });
      throw error;
    }
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    
    let updatedFields = {};
    for (const key in formData) {
      if (formData[key] !== profile[key]) {
        updatedFields[key] = formData[key];
      }
    }

    try {
      if (avatarFile) {
        const newAvatarUrl = await uploadAvatar();
        if (newAvatarUrl) updatedFields.avatar_url = newAvatarUrl;
      }

      if (Object.keys(updatedFields).length > 0) {
        updatedFields.updated_at = new Date().toISOString();
        updatedFields.id = user.id;
        
        const { error } = await supabase.from('profiles').upsert(updatedFields, { onConflict: 'id' });
        if (error) throw error;

        toast({ title: 'Profile Updated!', description: 'Your profile has been successfully updated.' });
        await refreshUserProfile();
        
        if (updatedFields.avatar_url || updatedFields.full_name) {
            await supabase.auth.updateUser({
              data: {
                avatar_url: updatedFields.avatar_url || profile.avatar_url,
                full_name: updatedFields.full_name || profile.full_name,
              }
            });
        }
      } else {
        toast({ title: 'No Changes Detected', description: 'No fields were modified.' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: 'Update Failed', description: error.message || 'Could not update profile.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setAvatarFile(null);
    }
  };

  if (loadingProfile) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-yellow-400" /></div>;
  }

  return (
    <div className="glass-effect-light p-6 sm:p-8 rounded-xl shadow-xl">
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8 flex items-center">
        <Edit className="w-6 h-6 sm:w-7 sm:h-7 mr-3 text-yellow-400" />
        Edit Your Profile
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center space-y-3">
          <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-yellow-400/50 shadow-lg">
            <AvatarImage src={avatarPreview || `https://avatar.vercel.sh/${user.email}.png`} alt={formData.full_name || user.email} />
            <AvatarFallback className="text-3xl sm:text-4xl bg-gray-700 text-white">
              {formData.full_name ? formData.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="relative">
            <Input id="avatar" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            <Button type="button" size="sm" variant="outline" onClick={() => document.getElementById('avatar').click()} className="bg-white/10 border-white/20 text-gray-300 hover:bg-white/20 hover:text-yellow-300">
              <UploadCloud className="w-4 h-4 mr-2" /> Change Avatar
            </Button>
          </div>
          <p className="text-xs text-gray-500">Upload your 'avatars'.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="full_name" className="text-gray-300">Full Name</Label>
            <Input id="full_name" name="full_name" type="text" value={formData.full_name} onChange={handleInputChange} className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
          <div>
            <Label htmlFor="username" className="text-gray-300">Username (Cannot be changed)</Label>
            <Input id="username" type="text" value={profile?.username || 'N/A'} disabled className="mt-1 bg-white/20 border-white/30 text-gray-400 cursor-not-allowed" />
          </div>
        </div>
        
        <div>
          <Label htmlFor="bio" className="text-gray-300">Bio</Label>
          <Textarea id="bio" name="bio" value={formData.bio} onChange={handleInputChange} rows={3} placeholder="Tell us about yourself..." className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="social_link_1" className="text-gray-300">Social Link 1 (e.g., Twitter, Instagram)</Label>
            <Input id="social_link_1" name="social_link_1" type="url" value={formData.social_link_1} onChange={handleInputChange} placeholder="https://twitter.com/yourprofile" className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
          <div>
            <Label htmlFor="social_link_2" className="text-gray-300">Social Link 2 (e.g., Website, YouTube)</Label>
            <Input id="social_link_2" name="social_link_2" type="url" value={formData.social_link_2} onChange={handleInputChange} placeholder="https://yourwebsite.com" className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/10 pt-6">
          <div>
            <Label className="text-gray-300">Email (Cannot be changed)</Label>
            <Input type="email" value={user?.email} disabled className="mt-1 bg-white/20 border-white/30 text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <Label className="text-gray-300">Wallet Balance</Label>
              <div className="mt-1 flex items-center h-10 px-3 rounded-md bg-white/20 border-white/30 text-gray-400 cursor-not-allowed">
                <Coins className="w-4 h-4 mr-2 text-yellow-400" /> {profile?.wallet_balance !== undefined ? `${profile.wallet_balance} CrossCoins` : 'N/A'}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="is_public" className="text-gray-300 cursor-pointer">Make my profile public</Label>
                <Switch id="is_public" checked={formData.is_public} onCheckedChange={(checked) => handleSwitchChange('is_public', checked)} />
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="enable_achievement_notifications" className="text-gray-300 cursor-pointer flex items-center">
                    <Bell className="w-4 h-4 mr-2 text-yellow-400"/>
                    Achievement Notifications on Login
                </Label>
                <Switch id="enable_achievement_notifications" checked={formData.enable_achievement_notifications} onCheckedChange={(checked) => handleSwitchChange('enable_achievement_notifications', checked)} />
            </div>
        </div>

        <Button type="submit" disabled={isSubmitting || loadingProfile} className="w-full sm:w-auto golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button">
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </form>
    </div>
  );
}
export default EditProfileForm;
