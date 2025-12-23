import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, UserCircle, Wallet, Home, Info, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Header() {
  const { user, profile, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setWalletBalance(data?.wallet_balance || 0);
      });
  }, [user]);

  return (
    <header className="w-full border-b bg-background">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          <span className="font-bold">CRFM</span>
        </NavLink>

        <nav className="flex items-center gap-3">
          <NavLink to="/about">
            <Button variant="ghost" size="sm">
              <Info className="h-4 w-4 mr-1" />
              {t('nav.about')}
            </Button>
          </NavLink>

          {profile?.is_admin && (
            <NavLink to="/admin">
              <Button variant="ghost" size="sm">
                <ShieldCheck className="h-4 w-4 mr-1" />
                Admin
              </Button>
            </NavLink>
          )}

          {user ? (
            <>
              <Button variant="outline" size="sm">
                <Wallet className="h-4 w-4 mr-1" />
                {walletBalance}
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => navigate('/?auth=login')}>
              <UserCircle className="h-4 w-4 mr-1" />
              Login
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
