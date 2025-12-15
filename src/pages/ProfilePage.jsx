import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
    import { Button } from '@/components/ui/button';
    import { User, Mail, Shield, Gift, Edit, UserPlus, Loader2, Link as LinkIcon, Coins, BadgeCheck, Zap, Briefcase } from 'lucide-react';
    import { Link as RouterLink } from 'react-router-dom';
    import EditProfileForm from '@/components/profile/EditProfileForm';
    import InviteFriendsTab from '@/components/profile/InviteFriendsTab';
    import MembershipsAndCodesTab from '@/components/profile/MembershipsAndCodesTab';

    function ProfilePage() {
      const { user, loading: authLoading } = useAuth();
      const [profile, setProfile] = useState(null);
      const [loadingProfile, setLoadingProfile] = useState(true);

      const fetchFullProfile = useCallback(async () => {
        if (!user) return;
        setLoadingProfile(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            setProfile(data);
        } catch (error) {
            toast({ title: "Error fetching profile data", description: error.message, variant: "destructive"});
        } finally {
            setLoadingProfile(false);
        }
      }, [user]);

      useEffect(() => {
        if (user) {
            fetchFullProfile();
        } else if (!authLoading) {
            setLoadingProfile(false); 
        }
      }, [user, authLoading, fetchFullProfile]);


      if (authLoading || loadingProfile) {
        return (
          <div className="container mx-auto px-4 py-8 text-center min-h-[calc(100vh-160px)] flex flex-col justify-center items-center page-gradient-bg"> {/* Applied page-gradient-bg here */}
            <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
            <p className="text-xl text-gray-300 mt-4">Loading Profile...</p>
          </div>
        );
      }
      
      if (!user) {
        return (
          <div className="container mx-auto px-4 py-8 text-center min-h-[calc(100vh-160px)] flex flex-col justify-center items-center page-gradient-bg"> {/* Applied page-gradient-bg here */}
            <User className="w-16 h-16 text-yellow-400 mb-4"/>
            <p className="text-2xl text-gray-200 mb-6">Please log in to view your profile.</p>
            <Button asChild className="golden-gradient text-black font-semibold hover:opacity-90">
                <RouterLink to="/auth">Login / Register</RouterLink>
            </Button>
          </div>
        );
      }
      
      const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0];
      const displayAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || `https://avatar.vercel.sh/${user.email}.png`;

      return (
        <div className="container mx-auto px-2 sm:px-4 py-8 page-gradient-bg"> {/* Applied page-gradient-bg here */}
          <div className="mt-8 mb-12">
            <div className="relative glass-effect-light rounded-xl shadow-xl p-6 sm:p-8">
                <div className="absolute -top-10 sm:-top-12 left-1/2 -translate-x-1/2">
                    <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-yellow-400 shadow-lg">
                        <AvatarImage src={displayAvatar} alt={displayName} />
                        <AvatarFallback className="text-3xl sm:text-4xl bg-gray-700 text-white">
                            {displayName ? displayName.charAt(0).toUpperCase() : <User />}
                        </AvatarFallback>
                    </Avatar>
                </div>
                <div className="text-center pt-10 sm:pt-12">
                    <h1 className="text-3xl sm:text-4xl font-bold golden-text mb-2">
                        {displayName}
                    </h1>
                    {profile?.username && <p className="text-gray-400 text-sm mb-1">@{profile.username}</p>}
                    <p className="text-gray-400 flex items-center justify-center text-sm sm:text-base"><Mail className="w-4 h-4 mr-2"/>{user.email}</p>
                    
                    {profile?.bio && <p className="text-gray-300 mt-3 text-sm max-w-md mx-auto">{profile.bio}</p>}

                    <div className="mt-4 flex flex-wrap justify-center items-center gap-2">
                        <span className="bg-green-500/20 text-green-300 px-3 py-1 text-xs font-medium rounded-full flex items-center">
                            <Shield className="w-3 h-3 mr-1" /> Verified User
                        </span>
                        {profile?.is_verified_creator && (
                             <span className="bg-purple-500/20 text-purple-300 px-3 py-1 text-xs font-medium rounded-full flex items-center">
                                <BadgeCheck className="w-3 h-3 mr-1" /> Verified Creator
                            </span>
                        )}
                         <span className="bg-blue-400/20 text-blue-300 px-3 py-1 text-xs font-medium rounded-full flex items-center">
                            <Gift className="w-3 h-3 mr-1" /> Early Adopter
                        </span>
                        {profile?.is_public === false && (
                             <span className="bg-red-500/20 text-red-300 px-3 py-1 text-xs font-medium rounded-full flex items-center">
                                <Zap className="w-3 h-3 mr-1" /> Private Profile
                            </span>
                        )}
                    </div>
                    <div className="mt-3 flex justify-center space-x-4">
                        {profile?.social_link_1 && <a href={profile.social_link_1} target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:text-yellow-300"><LinkIcon size={18}/></a>}
                        {profile?.social_link_2 && <a href={profile.social_link_2} target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:text-yellow-300"><Briefcase size={18}/></a>}
                    </div>
                </div>
            </div>
          </div>
          
          <Tabs defaultValue="editProfile" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 mb-8 glass-effect p-1 sm:p-2 rounded-lg">
              <TabsTrigger value="editProfile" className="tab-button"><Edit className="w-4 h-4 mr-2"/>Edit Profile</TabsTrigger>
              <TabsTrigger value="inviteFriends" className="tab-button"><UserPlus className="w-4 h-4 mr-2"/>Invite Friends</TabsTrigger>
              <TabsTrigger value="memberships" className="tab-button"><Coins className="w-4 h-4 mr-2"/>Memberships & Codes</TabsTrigger>
            </TabsList>

            <TabsContent value="editProfile">
              <EditProfileForm />
            </TabsContent>
            <TabsContent value="inviteFriends">
              <InviteFriendsTab />
            </TabsContent>
            <TabsContent value="memberships">
              <MembershipsAndCodesTab />
            </TabsContent>
          </Tabs>
        </div>
      );
    }

    export default ProfilePage;
