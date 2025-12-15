import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthModal from './AuthModal';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

const AuthModalHandler = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialView, setInitialView] = useState('login');
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Magic Link / Recovery Link handler
  useEffect(() => {
    let cancelled = false;
    
    const handleAuthCallback = async () => {
      // Wait for user session to be potentially restored from hash
      await new Promise(resolve => setTimeout(resolve, 500));

      if (cancelled) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) { // If there's no session, it might be an expired link.
          toast({
            title: "Link processing failed",
            description: "The sign-in link may be invalid or expired. Please try again.",
            variant: "destructive"
          });
          // Clear the hash to prevent re-triggering
          navigate(location.pathname, { replace: true });
          return;
      }
      
      // If the URL still contains recovery info, redirect.
      if (window.location.hash.includes('type=recovery')) {
        navigate('/reset-password', { replace: true });
      } else {
        // Successful login, go home.
        toast({ title: "Successfully signed in!", className: "bg-green-600 text-white" });
        navigate('/', { replace: true });
      }
    };
    
    // This effect runs when the app detects Supabase-specific tokens in the URL hash.
    if (window.location.hash.includes('access_token') && window.location.hash.includes('refresh_token')) {
        handleAuthCallback();
    }
    
    return () => {
        cancelled = true;
    };
  }, [navigate]);


  // Auth Modal trigger
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authAction = params.get('auth');
    if (authAction && !user) {
      setInitialView(authAction === 'signup' ? 'signup' : authAction === 'forgot-password' ? 'forgot-password' : 'login');
      setIsModalOpen(true);
    } else {
      setIsModalOpen(false);
    }
  }, [location.search, user]);

  const handleModalClose = () => {
    setIsModalOpen(false);
    const params = new URLSearchParams(location.search);
    params.delete('auth');
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  return (
    <AuthModal
      isOpen={isModalOpen}
      onOpenChange={handleModalClose}
      initialView={initialView}
    />
  );
};

export default AuthModalHandler;
