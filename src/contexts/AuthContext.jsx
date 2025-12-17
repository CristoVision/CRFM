import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { loginUser, registerUser, logoutUser, sendPasswordResetEmailProvider, updateUserPasswordProvider } from './authContext/authService';
import { upsertUserProfile, fetchUserProfileById } from './authContext/profileService';
import { fetchFavorites, addFavoriteItem, removeFavoriteItem } from './authContext/favoritesService';
import { startOrResumeStream, spendCrossCoinsOnVideo } from './authContext/walletService';
import { reportClientError } from '@/lib/errorReporter';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [authTestResult, setAuthTestResult] = useState(null);
  const [authTestError, setAuthTestError] = useState(null);
  const [authTestErrorDetails, setAuthTestErrorDetails] = useState(null);
  const [authTestLoading, setAuthTestLoading] = useState(false);
  const [authTestLastRun, setAuthTestLastRun] = useState(null);
  const navigate = useNavigate();

  const normalizeProfile = useCallback((rawProfile) => {
    if (!rawProfile) return null;
    const role = rawProfile.role || rawProfile.user_role || rawProfile.account_role;
    const derivedAdmin = typeof role === 'string' && role.toLowerCase().includes('admin');
    return {
      ...rawProfile,
      is_admin: rawProfile.is_admin !== undefined ? rawProfile.is_admin : derivedAdmin,
    };
  }, []);

  // auth-test Edge Function disabled until deployed
  const runAuthTest = useCallback(async () => {
    setAuthTestLoading(false);
    setAuthTestError(null);
    setAuthTestErrorDetails(null);
    setAuthTestResult(null);
    return { success: false, error: 'auth-test-disabled' };
  }, []);

  const handleAuthStateChange = useCallback(async (event, session) => {
setLoading(true);
const currentUser = session?.user || null;
setUser(currentUser);

  if (currentUser) {
  const userProfile = await fetchUserProfileById(currentUser.id);
  setProfile(normalizeProfile(userProfile));
  if (userProfile) {
    const userFavorites = await fetchFavorites(currentUser.id);
    setFavorites(userFavorites);
  } else {
    setFavorites([]);
  }
} else {
  setProfile(null);
  setFavorites([]);
}
setLoading(false);
if (!initialAuthCheckComplete) {
    setInitialAuthCheckComplete(true);
}

  if (currentUser) {
  // Run the auth-test Edge Function automatically after a successful login or session refresh
  // NOTE: auth-test edge function is currently disabled (404). Re-enable when deployed.
  } else {
  setAuthTestResult(null);
  setAuthTestError(null);
}
  }, [initialAuthCheckComplete, runAuthTest]);

  useEffect(() => {
const checkInitialSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await handleAuthStateChange('INITIAL_SESSION', session);
    setInitialAuthCheckComplete(true);
};

checkInitialSession();

const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event !== 'INITIAL_SESSION') {
        await handleAuthStateChange(event, session);
    }
});

return () => {
  subscription?.unsubscribe();
};
  }, [handleAuthStateChange]);


  const performLogin = async (email, password) => {
setLoading(true);
const result = await loginUser(email, password);
setLoading(false);
return result;
  };

  const performRegister = async (email, password, fullName, avatarFile) => {
    setLoading(true);
    try {
      const { success, user: newUser, avatarUrl, error } = await registerUser(email, password, fullName, avatarFile);

      // If email confirmation is enabled, Supabase returns a user but no active session.
      // In that case, skip profile upsert (it will 401). A DB trigger should create the profile row.
      if (success && newUser) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user?.id) {
            await upsertUserProfile(newUser, { full_name: fullName, avatar_url: avatarUrl });
          }
        } catch (profileErr) {
          const status = profileErr?.status ?? profileErr?.statusCode;
          if (status !== 401) {
            console.error('Profile upsert failed during signup:', profileErr);
          }
        }
      }

      return { success, error };
    } finally {
      setLoading(false);
    }
  };

  const performLogout = async () => {
setLoading(true);
await logoutUser();
navigate('/');
toast({
  title: "Logged out",
  description: "You have been successfully logged out.",
  className: "bg-blue-600 border-blue-700 text-white",
});
setLoading(false);
  };

  const addFavorite = async (contentType, contentId) => {
if (!user) return;
const success = await addFavoriteItem(user.id, contentType, contentId);
if (success) {
  setFavorites(prev => [...prev, { content_id: contentId, content_type: contentType }]);
}
  };

  const removeFavorite = async (contentType, contentId) => {
if (!user) return;
const success = await removeFavoriteItem(user.id, contentType, contentId);
if (success) {
  setFavorites(prev => prev.filter(f => !(f.content_id === contentId && f.content_type === contentType)));
}
  };

  const refreshUserProfile = useCallback(async () => {
    if (user) {
      setLoading(true);
      const userProfile = await fetchUserProfileById(user.id);
      setProfile(normalizeProfile(userProfile));
      setLoading(false);
    }
  }, [user, normalizeProfile]);

  const spendCrossCoins = async (trackId) => {
const { success, error } = await startOrResumeStream(trackId);
if (success) {
    await refreshUserProfile();
    return true;
}
if(error === 'Insufficient funds or track has no cost.') {
    toast({
        title: "Insufficient CrossCoins",
        description: "You don't have enough CrossCoins to play this track. Visit your wallet to get more.",
        variant: "destructive",
    });
} else if (error) {
    toast({
        title: "Payment Error",
        description: "Could not process payment for this track.",
        variant: "destructive",
    });
}
return false;
  };

  const spendCrossCoinsForVideo = async (videoId, amount) => {
    if (!videoId) return { success: false, error: 'Missing video id.' };

    const cost = Number(amount ?? 0);
    const { success, error, details } = await spendCrossCoinsOnVideo(videoId, cost);

    if (success) {
      await refreshUserProfile();
      return { success: true };
    }

    const friendlyError =
      error ||
      (cost > 0
        ? `We could not charge ${cost} CrossCoins.`
        : 'Could not process payment for this video.');

    if (error === 'Insufficient funds or video has no cost.') {
      toast({
        title: "Insufficient CrossCoins",
        description: `This video costs ${cost} CrossCoins. Please top up your wallet and try again.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Error",
        description: friendlyError,
        variant: "destructive",
      });
    }

    if (profile && cost > 0 && profile.wallet_balance >= cost) {
      console.warn('Charge failed but profile wallet_balance seems sufficient', {
        wallet_balance: profile.wallet_balance,
        cost,
        details,
      });
      reportClientError({
        source: 'video_charge_mismatch',
        message: friendlyError,
        context: { cost, wallet_balance: profile.wallet_balance, details },
      });
    }

    return { success: false, error: friendlyError, details };
  };

  const value = {
user,
profile,
loading,
initialAuthCheckComplete,
favorites,
authTestResult,
authTestError,
authTestErrorDetails,
authTestLoading,
authTestLastRun,
runAuthTest,
login: performLogin,
register: performRegister,
logout: performLogout,
sendPasswordResetEmail: sendPasswordResetEmailProvider,
updateUserPassword: updateUserPasswordProvider,
addFavorite,
removeFavorite,
spendCrossCoins,
spendCrossCoinsForVideo,
fetchUserProfile: fetchUserProfileById,
refreshUserProfile,
  };

  return (
<AuthContext.Provider value={value}>
  {children}
</AuthContext.Provider>
  );
}
