import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';

export const upsertUserProfile = async (user, additionalData = {}) => {
    if (!user) return null;
  
    const defaultUsername = user.email ? user.email.split('@')[0] : `user_${user.id.substring(0, 8)}`;
    const discordUsername = user.user_metadata?.full_name || user.user_metadata?.name || defaultUsername; 
    const discordAvatar = user.user_metadata?.avatar_url; 
    const discordProviderId = user.app_metadata?.provider === 'discord' ? user.id : null;

    const generateInviteCode = () => {
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    };
    
    const profileData = {
      id: user.id,
      username: additionalData.username || discordUsername || defaultUsername,
      full_name: additionalData.full_name || user.user_metadata?.full_name || '',
      avatar_url: additionalData.avatar_url || discordAvatar || null,
      wallet_balance: additionalData.wallet_balance === undefined ? 0 : additionalData.wallet_balance,
      is_public: additionalData.is_public === undefined ? true : additionalData.is_public,
      is_verified_creator: additionalData.is_verified_creator === undefined ? false : additionalData.is_verified_creator,
      updated_at: new Date().toISOString(),
      discord_provider_id: discordProviderId || additionalData.discord_provider_id,
      discord_username: discordProviderId ? (user.user_metadata?.custom_claims?.global_name || user.user_metadata?.name) : additionalData.discord_username,
      discord_avatar_url: discordProviderId ? discordAvatar : additionalData.discord_avatar_url,
    };

    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, my_personal_invite_code, wallet_balance, is_public, is_verified_creator')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') { 
        console.error('Error fetching profile:', fetchError);
        throw fetchError;
    }
    
    if (!existingProfile) {
        profileData.created_at = new Date().toISOString();
        profileData.my_personal_invite_code = generateInviteCode();
    } else {
        profileData.my_personal_invite_code = existingProfile.my_personal_invite_code || generateInviteCode();
        profileData.wallet_balance = additionalData.wallet_balance === undefined ? existingProfile.wallet_balance : additionalData.wallet_balance;
        profileData.is_public = additionalData.is_public === undefined ? existingProfile.is_public : additionalData.is_public;
        profileData.is_verified_creator = additionalData.is_verified_creator === undefined ? existingProfile.is_verified_creator : additionalData.is_verified_creator;
    }
  
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id', ignoreDuplicates: false })
      .select()
      .single();
  
    if (error) {
      console.error('Error upserting profile:', error);
      throw error;
    }
    return data;
  };

export const fetchUserProfileById = async (userId) => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  };
