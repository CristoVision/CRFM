import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, UserCircle, Wallet, Home, Info, ShieldCheck, BarChartHorizontalBig, Menu, X, LogIn, BookOpen } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { BRAND_LOGO_GIF_URL, CROSSCOIN_ICON_URL } from '@/lib/brandAssets';
import { useLanguage } from '@/contexts/LanguageContext';

function Header() {
  const { user, profile, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUsd, setShowUsd] = useState(false);
  const conversionRate = 0.01; // 1 CC = $0.01 USD (0.5 CC ≈ $0.005 per stream)

  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (user) {
        setLoadingBalance(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') { throw error; }
          setWalletBalance(data?.wallet_balance || 0);
        } catch (error) {
          console.error('Error fetching wallet balance:', error.message);
        } finally {
          setLoadingBalance(false);
        }
      }
    };
    fetchWalletBalance();
  }, [user]);

  const handleOpenAuthModal = (view = 'login') => {
    closeMobileMenu();
    navigate(`/?auth=${view}${location.search.replace(/auth=[^&]*&?/, '')}`);
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const toggleLanguage = () => setLanguage(language === 'en' ? 'es' : 'en');

  const displayBalance = () => {
    if (loadingBalance) return '...';
    if (showUsd) return `$${(walletBalance * conversionRate).toFixed(2)}`;
    return `${walletBalance.toLocaleString()}`;
  };
  
  const mainNavLinks = [
    { to: '/', text: t('nav.home'), icon: <Home className="w-5 h-5" />, auth: null },
    { to: '/hub', text: t('nav.hub'), icon: <BarChartHorizontalBig className="w-5 h-5" />, auth: true },
    { to: '/about', text: t('nav.about'), icon: <Info className="w-5 h-5" />, auth: null },
    { to: '/stories', text: t('nav.stories'), icon: <BookOpen className="w-5 h-5" />, auth: null },
    { to: '/bible', text: t('nav.bible'), icon: <BookOpen className="w-5 h-5" />, auth: null },
    { to: '/admin', text: t('nav.admin'), icon: <ShieldCheck className="w-5 h-5" />, auth: true },
  ];
  const filteredNavLinks = mainNavLinks.filter(link => link.auth === null || (link.auth === true && !!user));

  const NavItem = ({ to, text, icon, onClick }) => (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center space-x-3 px-3 py-3 rounded-md text-base font-medium transition-all duration-200 hover:bg-white/10 hover:text-yellow-400 glass-effect-button-hover ${
          isActive ? 'text-yellow-400 bg-white/10' : 'text-white'
        }`
      }
    >
      {icon}
      <span>{text}</span>
    </NavLink>
  );

  const DesktopNavItem = ({ to, text, icon }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:bg-white/10 hover:text-yellow-400 glass-effect-button-hover ${
          isActive ? 'text-yellow-400 bg-white/10' : 'text-white'
        }`
      }
    >
      {icon}
      <span>{text}</span>
    </NavLink>
  );
      
  return (
    <header className="fixed top-0 left-0 right-0 header-glass-gradient-bg z-50 shadow-lg">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <NavLink to="/" className="flex-shrink-0" onClick={closeMobileMenu}>
              <img
                className="h-12 w-auto"
                src={BRAND_LOGO_GIF_URL}
                alt="CRFM Logo"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/favicon-32x32.png';
                }}
              />
            </NavLink>
          </div>
          
          <nav className="hidden md:flex space-x-1 lg:space-x-2 items-center">
            {filteredNavLinks.map(link => <DesktopNavItem key={link.to} {...link} />)}
          </nav>
          
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <>
                <div className="flex items-center gap-2">
                  <NavLink
                    to="/wallet"
                    className={({ isActive }) =>
                      `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:bg-white/10 hover:text-yellow-400 glass-effect-button-hover ${
                      isActive ? 'text-yellow-400 bg-white/10' : 'text-white'
                    }`
                    }
                  >
                    <img
                      src={CROSSCOIN_ICON_URL}
                      alt="CrossCoin"
                      className="w-5 h-5"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/favicon-32x32.png';
                      }}
                    />
                    <span>{displayBalance()}</span>
                  </NavLink>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUsd(!showUsd)}
                  className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300 h-9 px-3"
                >
                  {showUsd ? t('wallet.cc') : t('wallet.usd')}
                </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleLanguage}
                  className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300 h-9 px-3"
                >
                  {language === 'en' ? 'ES' : 'EN'}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/profile')}
                  className="rounded-full hover:bg-white/10 group"
                >
                  <Avatar className="h-10 w-10 border-2 border-transparent group-hover:border-yellow-400 transition-colors duration-200">
                    <AvatarImage src={profile?.avatar_url || `https://avatar.vercel.sh/${user.email}.png`} alt={user.email || 'User Avatar'} />
                    <AvatarFallback className="bg-gray-700 text-white">
                      {user.email ? user.email.charAt(0).toUpperCase() : <UserCircle className="w-6 h-6" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>

                <Button
                  onClick={logout}
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-500/20 hover:text-red-400 glass-effect-button-hover"
                >
                  <LogOut className="w-4 h-4 mr-1 md:mr-2" />
                  <span className="hidden md:inline">{t('auth.signOut')}</span>
                </Button>
              </>
            ) : (
                <>
                  <Button
                      onClick={() => handleOpenAuthModal('login')}
                      className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity text-sm py-2 px-4 proximity-glow-button h-10"
                  >
                      <LogIn className="w-4 h-4 mr-2" />
                      {t('auth.signInUp')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleLanguage}
                    className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300 h-9 px-3"
                  >
                    {language === 'en' ? 'ES' : 'EN'}
                  </Button>
                </>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <Button
              onClick={toggleMobileMenu}
              variant="ghost"
              size="icon"
              className="text-white hover:text-yellow-400 hover:bg-white/10"
            >
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={isMobileMenuOpen ? 'x' : 'menu'}
                  initial={{ rotate: isMobileMenuOpen ? -90 : 0, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: isMobileMenuOpen ? 0 : 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
                </motion.div>
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-x-0 top-20 z-40 shadow-xl"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30" onClick={closeMobileMenu}></div>
            <div className="relative z-40 pt-2 pb-3 space-y-1 px-2 glass-effect-light border-b border-white/10 rounded-b-lg">
              {user ? (
                <>
                  <div className="px-2 py-3 border-b border-white/10 mb-2">
                    <div className="flex items-center space-x-3">
                       <Avatar className="h-10 w-10 border-2 border-yellow-400">
                        <AvatarImage src={profile?.avatar_url || `https://avatar.vercel.sh/${user.email}.png`} alt={user.email || 'User Avatar'} />
                        <AvatarFallback className="bg-gray-700 text-white">
                          {user.email ? user.email.charAt(0).toUpperCase() : <UserCircle className="w-6 h-6" />}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-white truncate max-w-[150px]">{profile?.full_name || user.email}</p>
                        <div className="flex items-center gap-2">
                          <NavLink
                            to="/wallet"
                            onClick={closeMobileMenu}
                            className="flex items-center text-xs text-yellow-400 hover:text-yellow-300"
                          >
                             <img
                               src={CROSSCOIN_ICON_URL}
                               alt="CrossCoin"
                               className="w-4 h-4 mr-1"
                               onError={(e) => {
                                 e.currentTarget.onerror = null;
                                 e.currentTarget.src = '/favicon-32x32.png';
                               }}
                             />
                            <span>{displayBalance()}</span>
                          </NavLink>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowUsd(!showUsd)}
                            className="h-7 text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300 px-2"
                          >
                            {showUsd ? t('wallet.cc') : t('wallet.usd')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {filteredNavLinks.map(link => <NavItem key={link.to} {...link} onClick={closeMobileMenu} />)}
                  <NavItem to="/profile" text={t('nav.profile')} icon={<UserCircle className="w-5 h-5" />} onClick={closeMobileMenu} />
                  
                  <div className="pt-2 border-t border-white/10">
                    <Button
                      onClick={() => { logout(); closeMobileMenu(); }}
                      variant="ghost"
                      className="w-full justify-start text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center space-x-3 px-3 py-3"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>{t('auth.signOut')}</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <NavItem to="/" text={t('nav.home')} icon={<Home className="w-5 h-5" />} onClick={closeMobileMenu} />
                  <NavItem to="/about" text={t('nav.about')} icon={<Info className="w-5 h-5" />} onClick={closeMobileMenu} />
                  <NavItem to="/stories" text={t('nav.stories')} icon={<BookOpen className="w-5 h-5" />} onClick={closeMobileMenu} />
                  <NavItem to="/bible" text={t('nav.bible')} icon={<BookOpen className="w-5 h-5" />} onClick={closeMobileMenu} />
                  <div className="pt-2 border-t border-white/10">
                    <Button
                      onClick={() => handleOpenAuthModal('login')}
                      variant="ghost"
                      className="w-full justify-start text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300 flex items-center space-x-3 px-3 py-3"
                    >
                      <LogIn className="w-5 h-5" />
                      <span>{t('auth.signInUp')}</span>
                    </Button>
                  </div>
                </>
              )}
              <div className="pt-2 border-t border-white/10">
                <Button
                  onClick={toggleLanguage}
                  variant="ghost"
                  className="w-full justify-start text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300 flex items-center space-x-3 px-3 py-3"
                >
                  <span>{t('language.label')}:</span>
                  <span>{language === 'en' ? t('language.english') : t('language.spanish')}</span>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .glass-effect-button-hover:hover {
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.3), 0 0 5px rgba(255, 215, 0, 0.2);
        }
      `}</style>
    </header>
  );
}

export default Header;
