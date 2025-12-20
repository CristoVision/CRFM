import React, { useState } from 'react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { useAuth } from '@/contexts/AuthContext';
    import { Mail, Send, Loader2, ArrowLeft } from 'lucide-react';
    import { useLanguage } from '@/contexts/LanguageContext';

    const ForgotPasswordForm = ({ onSwitchToLogin }) => {
      const [email, setEmail] = useState('');
      const { sendPasswordResetEmail, loading } = useAuth();
      const { t } = useLanguage();

      const handleSubmit = async (e) => {
        e.preventDefault();
        const { success } = await sendPasswordResetEmail(email);
        if (success) {
          setEmail(''); // Clear field on success
        }
        // Toast messages are handled in AuthContext
      };

      return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center mb-4">
                <h2 className="text-xl font-semibold golden-text">{t('auth.forgot.title')}</h2>
                <p className="text-sm text-gray-400">{t('auth.forgot.subtitle')}</p>
            </div>
          <div className="space-y-2 relative">
            <Label htmlFor="email-forgot" className="text-gray-300 text-sm">{t('auth.forgot.emailLabel')}</Label>
            <Mail className="absolute left-3 top-10 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
            <Input
              id="email-forgot"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 focus:border-yellow-400 h-11"
              placeholder={t('auth.forgot.emailPlaceholder')}
              required
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full golden-gradient text-black font-semibold hover:opacity-90 transition-opacity text-base py-3 proximity-glow-button"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
            {t('auth.forgot.sendLink')}
          </Button>
          
          <div className="mt-6 text-center">
            <button
                type="button"
                onClick={onSwitchToLogin}
                className="flex items-center justify-center w-full text-sm text-yellow-400 hover:text-yellow-300 hover:underline"
                disabled={loading}
            >
                <ArrowLeft className="w-4 h-4 mr-1" /> {t('auth.forgot.backToSignIn')}
            </button>
          </div>
        </form>
      );
    };

    export default ForgotPasswordForm;
