import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import { useLanguage } from '@/contexts/LanguageContext';

const AuthModal = ({ isOpen, onOpenChange, initialView = 'login' }) => {
  const [currentView, setCurrentView] = useState(initialView);
  const { t } = useLanguage();

  const handleOpenChange = (open) => {
    if (!open) {
      // Allow modal to close
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md w-full">
        <Tabs value={currentView} onValueChange={setCurrentView} className="w-full">
          <TabsList className="grid w-full grid-cols-3 glass-effect mb-4">
            <TabsTrigger value="login" className="tab-button">
              <LogIn className="w-4 h-4 mr-2" /> {t('auth.modal.tabs.signIn')}
            </TabsTrigger>
            <TabsTrigger value="signup" className="tab-button">
              <UserPlus className="w-4 h-4 mr-2" /> {t('auth.modal.tabs.signUp')}
            </TabsTrigger>
            <TabsTrigger value="forgot-password" className="tab-button">
              <KeyRound className="w-4 h-4 mr-2" /> {t('auth.modal.tabs.reset')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <DialogHeader className="mb-4">
              <DialogTitle>{t('auth.modal.loginTitle')}</DialogTitle>
              <DialogDescription>{t('auth.modal.loginDescription')}</DialogDescription>
            </DialogHeader>
            <LoginForm 
              onSwitchToSignUp={() => setCurrentView('signup')}
              onSwitchToForgotPassword={() => setCurrentView('forgot-password')}
              onSuccessfulLogin={() => onOpenChange(false)}
            />
          </TabsContent>
          <TabsContent value="signup">
            <DialogHeader className="mb-4">
              <DialogTitle>{t('auth.modal.signupTitle')}</DialogTitle>
              <DialogDescription>{t('auth.modal.signupDescription')}</DialogDescription>
            </DialogHeader>
            <SignUpForm 
              onSwitchToLogin={() => setCurrentView('login')}
            />
          </TabsContent>
          <TabsContent value="forgot-password">
            <DialogHeader className="mb-4">
              <DialogTitle>{t('auth.modal.resetTitle')}</DialogTitle>
              <DialogDescription>{t('auth.modal.resetDescription')}</DialogDescription>
            </DialogHeader>
            <ForgotPasswordForm 
              onSwitchToLogin={() => setCurrentView('login')}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
