import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import AuthLayout from './AuthLayout';
import { Lock, CheckCircle, Loader2, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const PasswordRequirement = ({ met, text }) => (
  <li className={`flex items-center text-xs ${met ? 'text-green-400' : 'text-gray-400'}`}>
    {met ? <CheckCircle className="w-3 h-3 mr-1.5 flex-shrink-0" /> : <AlertCircle className="w-3 h-3 mr-1.5 flex-shrink-0 text-yellow-500" />}
    {text}
  </li>
);

const ResetPasswordScreen = () => {
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const { updateUserPassword, loading, user, initialAuthCheckComplete } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    lowercase: false,
    uppercase: false,
    number: false,
    symbol: false,
  });

  const validatePassword = (currentPassword) => {
    setPasswordValidation({
      minLength: currentPassword.length >= 8,
      lowercase: /[a-z]/.test(currentPassword),
      uppercase: /[A-Z]/.test(currentPassword),
      number: /[0-9]/.test(currentPassword),
      symbol: /[^A-Za-z0-9]/.test(currentPassword),
    });
  };

  const handleNewPasswordChange = (e) => {
    const currentPassword = e.target.value;
    setNewPassword(currentPassword);
    validatePassword(currentPassword);
  };

  const isRecoverySessionActive = user && user.aud === 'authenticated';
  const canReset = initialAuthCheckComplete && isRecoverySessionActive;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: t('auth.reset.passwordMismatch'), variant: 'destructive' });
      return;
    }
    const allValid = Object.values(passwordValidation).every(Boolean);
    if (!allValid) {
      toast({ title: t('auth.reset.passwordRequirementsTitle'), description: t('auth.reset.passwordRequirementsDescription'), variant: 'destructive' });
      return;
    }

    const { success, error } = await updateUserPassword(newPassword);
    if (success) {
      setPasswordUpdated(true);
    } else if (error) {
      toast({ title: t('auth.reset.updateFailed'), description: error, variant: 'destructive' });
    }
  };

  if (!initialAuthCheckComplete) {
    return (
      <AuthLayout title={t('auth.reset.securingTitle')} subtitle={t('auth.reset.securingSubtitle')}>
        <div className="flex items-center justify-center py-12 text-gray-300">
          <Loader2 className="w-6 h-6 mr-2 animate-spin" />
          {t('auth.reset.processingLink')}
        </div>
      </AuthLayout>
    );
  }

  if (passwordUpdated) {
    return (
      <AuthLayout title={t('auth.reset.successTitle')} subtitle={t('auth.reset.successSubtitle')}>
        <div className="text-center space-y-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <p className="text-gray-300">{t('auth.reset.successBody')}</p>
          <Button
            onClick={() => navigate('/login')}
            className="w-full golden-gradient text-black font-semibold hover:opacity-90 transition-opacity text-base py-3 proximity-glow-button h-11"
          >
            <LogIn className="w-5 h-5 mr-2" /> {t('auth.reset.backToSignIn')}
          </Button>
        </div>
      </AuthLayout>
    );
  }
  
  if (!canReset) {
    return (
      <AuthLayout title={t('auth.reset.invalidTitle')} subtitle={t('auth.reset.invalidSubtitle')}>
        <div className="text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-300">{t('auth.reset.invalidBody')}</p>
          <Button
            onClick={() => navigate('/login')}
            className="w-full golden-gradient text-black font-semibold hover:opacity-90 transition-opacity text-base py-3 proximity-glow-button h-11"
          >
            <LogIn className="w-5 h-5 mr-2" /> {t('auth.reset.backToSignIn')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1 relative">
          <Label htmlFor="newPassword-reset" className="text-gray-300 text-sm">{t('auth.reset.newPasswordLabel')}</Label>
          <Lock className="absolute left-3 top-8 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
          <Input
            id="newPassword-reset"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={handleNewPasswordChange}
            className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 pr-10 focus:border-yellow-400 h-11"
            placeholder={t('auth.reset.newPasswordPlaceholder')}
            required
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-8 transform -translate-y-1/2 text-yellow-400/70 hover:text-yellow-300 focus:outline-none"
            aria-label={showNewPassword ? t('auth.reset.hidePassword') : t('auth.reset.showPassword')}
            disabled={loading}
          >
            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <ul className="mt-1 space-y-0.5 px-1">
          <PasswordRequirement met={passwordValidation.minLength} text={t('auth.passwordRules.minLength')} />
          <PasswordRequirement met={passwordValidation.lowercase} text={t('auth.passwordRules.lowercase')} />
          <PasswordRequirement met={passwordValidation.uppercase} text={t('auth.passwordRules.uppercase')} />
          <PasswordRequirement met={passwordValidation.number} text={t('auth.passwordRules.number')} />
          <PasswordRequirement met={passwordValidation.symbol} text={t('auth.passwordRules.symbol')} />
          <li className="text-xs text-gray-500 mt-1">{t('auth.passwordRules.breachNotice')}</li>
        </ul>

        <div className="space-y-1 relative">
          <Label htmlFor="confirmPassword-reset" className="text-gray-300 text-sm">{t('auth.reset.confirmPasswordLabel')}</Label>
          <Lock className="absolute left-3 top-8 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
          <Input
            id="confirmPassword-reset"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 pr-10 focus:border-yellow-400 h-11"
            placeholder={t('auth.reset.confirmPasswordPlaceholder')}
            required
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-8 transform -translate-y-1/2 text-yellow-400/70 hover:text-yellow-300 focus:outline-none"
            aria-label={showConfirmPassword ? t('auth.reset.hidePassword') : t('auth.reset.showPassword')}
            disabled={loading}
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <Button
          type="submit"
          disabled={loading || !Object.values(passwordValidation).every(Boolean) || newPassword !== confirmPassword}
          className="w-full golden-gradient text-black font-semibold hover:opacity-90 transition-opacity text-base py-3 proximity-glow-button h-11"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Lock className="w-5 h-5 mr-2" />}
          {t('auth.reset.submitButton')}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPasswordScreen;
