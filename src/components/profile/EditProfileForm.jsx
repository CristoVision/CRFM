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
import { useLanguage } from '@/contexts/LanguageContext';

function EditProfileForm() {
  const { user, profile, refreshUserProfile } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    second_last_name: '',
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
        first_name: profile.first_name || '',
        middle_name: profile.middle_name || '',
        last_name: profile.last_name || '',
        second_last_name: profile.second_last_name || '',
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
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('avatars').upload(fileName, avatarFile, { upsert: true });
    if (error) {
      toast({ title: t('profile.edit.toasts.avatarUploadFailed'), description: error.message, variant: 'destructive' });
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
      const computedFullName = [formData.first_name, formData.middle_name, formData.last_name, formData.second_last_name]
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter(Boolean)
        .join(' ')
        .trim();
      if (computedFullName && computedFullName !== profile?.full_name) {
        updatedFields.full_name = computedFullName;
      }

      if (avatarFile) {
        const newAvatarUrl = await uploadAvatar();
        if (newAvatarUrl) updatedFields.avatar_url = newAvatarUrl;
      }

      if (Object.keys(updatedFields).length > 0) {
        updatedFields.updated_at = new Date().toISOString();
        updatedFields.id = user.id;
        
        const { error } = await supabase.from('profiles').upsert(updatedFields, { onConflict: 'id' });
        if (error) throw error;

        toast({ title: t('profile.edit.toasts.profileUpdatedTitle'), description: t('profile.edit.toasts.profileUpdatedBody') });
        await refreshUserProfile();
        
        if (updatedFields.avatar_url || updatedFields.full_name || updatedFields.first_name || updatedFields.middle_name || updatedFields.last_name || updatedFields.second_last_name) {
            await supabase.auth.updateUser({
              data: {
                avatar_url: updatedFields.avatar_url || profile.avatar_url,
                full_name: updatedFields.full_name || profile.full_name,
                first_name: updatedFields.first_name || profile.first_name || '',
                middle_name: updatedFields.middle_name || profile.middle_name || '',
                last_name: updatedFields.last_name || profile.last_name || '',
                second_last_name: updatedFields.second_last_name || profile.second_last_name || '',
              }
            });
        }
      } else {
        toast({ title: t('profile.edit.toasts.noChangesTitle'), description: t('profile.edit.toasts.noChangesBody') });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: t('profile.edit.toasts.updateFailedTitle'), description: error.message || t('profile.edit.toasts.updateFailedBody'), variant: 'destructive' });
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
        {t('profile.edit.title')}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center space-y-3">
          <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-yellow-400/50 shadow-lg">
            <AvatarImage src={avatarPreview || `https://avatar.vercel.sh/${user.email}.png`} alt={profile?.full_name || user.email} />
            <AvatarFallback className="text-3xl sm:text-4xl bg-gray-700 text-white">
              {(profile?.full_name || user.email).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="relative">
            <Input id="avatar" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            <Button type="button" size="sm" variant="outline" onClick={() => document.getElementById('avatar').click()} className="bg-white/10 border-white/20 text-gray-300 hover:bg-white/20 hover:text-yellow-300">
              <UploadCloud className="w-4 h-4 mr-2" /> {t('profile.edit.changeAvatar')}
            </Button>
          </div>
          <p className="text-xs text-gray-500">{t('profile.edit.avatarHint')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="first_name" className="text-gray-300">{t('profile.edit.firstName')}</Label>
            <Input id="first_name" name="first_name" type="text" value={formData.first_name} onChange={handleInputChange} className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
          <div>
            <Label htmlFor="middle_name" className="text-gray-300">{t('profile.edit.middleNameOptional')}</Label>
            <Input id="middle_name" name="middle_name" type="text" value={formData.middle_name} onChange={handleInputChange} className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
          <div>
            <Label htmlFor="last_name" className="text-gray-300">{t('profile.edit.lastName')}</Label>
            <Input id="last_name" name="last_name" type="text" value={formData.last_name} onChange={handleInputChange} className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
          <div>
            <Label htmlFor="second_last_name" className="text-gray-300">{t('profile.edit.secondLastNameOptional')}</Label>
            <Input id="second_last_name" name="second_last_name" type="text" value={formData.second_last_name} onChange={handleInputChange} className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
          <div>
            <Label htmlFor="username" className="text-gray-300">{t('profile.edit.usernameImmutable')}</Label>
            <Input id="username" type="text" value={profile?.username || t('common.na')} disabled className="mt-1 bg-white/20 border-white/30 text-gray-400 cursor-not-allowed" />
          </div>
        </div>
        
        <div>
          <Label htmlFor="bio" className="text-gray-300">{t('profile.edit.bio')}</Label>
          <Textarea id="bio" name="bio" value={formData.bio} onChange={handleInputChange} rows={3} placeholder={t('profile.edit.bioPlaceholder')} className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="social_link_1" className="text-gray-300">{t('profile.edit.socialLink1')}</Label>
            <Input id="social_link_1" name="social_link_1" type="url" value={formData.social_link_1} onChange={handleInputChange} placeholder={t('profile.edit.socialLink1Placeholder')} className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
          <div>
            <Label htmlFor="social_link_2" className="text-gray-300">{t('profile.edit.socialLink2')}</Label>
            <Input id="social_link_2" name="social_link_2" type="url" value={formData.social_link_2} onChange={handleInputChange} placeholder={t('profile.edit.socialLink2Placeholder')} className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/10 pt-6">
          <div>
            <Label className="text-gray-300">{t('profile.edit.emailImmutable')}</Label>
            <Input type="email" value={user?.email} disabled className="mt-1 bg-white/20 border-white/30 text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <Label className="text-gray-300">{t('profile.edit.walletBalance')}</Label>
              <div className="mt-1 flex items-center h-10 px-3 rounded-md bg-white/20 border-white/30 text-gray-400 cursor-not-allowed">
                <Coins className="w-4 h-4 mr-2 text-yellow-400" /> {profile?.wallet_balance !== undefined ? t('profile.edit.walletBalanceValue', { amount: profile.wallet_balance }) : t('common.na')}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="is_public" className="text-gray-300 cursor-pointer">{t('profile.edit.makePublic')}</Label>
                <Switch id="is_public" checked={formData.is_public} onCheckedChange={(checked) => handleSwitchChange('is_public', checked)} />
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="enable_achievement_notifications" className="text-gray-300 cursor-pointer flex items-center">
                    <Bell className="w-4 h-4 mr-2 text-yellow-400"/>
                    {t('profile.edit.achievementNotifications')}
                </Label>
                <Switch id="enable_achievement_notifications" checked={formData.enable_achievement_notifications} onCheckedChange={(checked) => handleSwitchChange('enable_achievement_notifications', checked)} />
            </div>
        </div>

        <Button type="submit" disabled={isSubmitting || loadingProfile} className="w-full sm:w-auto golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button">
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {t('profile.edit.saveChanges')}
        </Button>
      </form>
    </div>
  );
}
export default EditProfileForm;
