import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, LogIn, Loader2, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const LoginForm = ({ onSwitchToSignUp, onSwitchToForgotPassword, onSuccessfulLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading } = useAuth();
  const { t } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { success } = await login(email, password);
    if (success) {
      onSuccessfulLogin?.();
    }
  };
  
  const handleForgotPassword = (e) => {
    e.preventDefault();
    onSwitchToForgotPassword();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 relative">
        <Label htmlFor="email-login" className="text-gray-300 text-sm">{t('auth.login.emailLabel')}</Label>
        <Mail className="absolute left-3 top-10 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
        <Input
          id="email-login"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 focus:border-yellow-400 h-11"
          placeholder={t('auth.login.emailPlaceholder')}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2 relative">
        <Label htmlFor="password-login" className="text-gray-300 text-sm">{t('auth.login.passwordLabel')}</Label>
        <Lock className="absolute left-3 top-10 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
        <Input
          id="password-login"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 pr-10 focus:border-yellow-400 h-11"
          placeholder={t('auth.login.passwordPlaceholder')}
          required
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-10 transform -translate-y-1/2 text-yellow-400/70 hover:text-yellow-300 focus:outline-none"
          aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
          disabled={loading}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <div className="text-right">
        <a 
            href="#" 
            onClick={handleForgotPassword} 
            className="text-xs text-yellow-400 hover:text-yellow-300 hover:underline"
        >
            {t('auth.login.forgotPassword')}
        </a>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full golden-gradient text-black font-semibold hover:opacity-90 transition-opacity text-base py-3 proximity-glow-button h-11"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <LogIn className="w-5 h-5 mr-2" />}
        {t('auth.login.signInButton')}
      </Button>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-400">
          {t('auth.login.noAccountPrompt')}{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="font-semibold text-yellow-400 hover:text-yellow-300 hover:underline"
            disabled={loading}
          >
            {t('auth.login.signUpLink')}
          </button>
        </p>
      </div>
    </form>
  );
};

export default LoginForm;
