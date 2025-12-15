import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import ForgotPasswordForm from './ForgotPasswordForm';

const AuthModal = ({ isOpen, onOpenChange, initialView = 'login' }) => {
  const [currentView, setCurrentView] = useState(initialView);

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
              <LogIn className="w-4 h-4 mr-2" /> Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" className="tab-button">
              <UserPlus className="w-4 h-4 mr-2" /> Sign Up
            </TabsTrigger>
            <TabsTrigger value="forgot-password" className="tab-button">
              <KeyRound className="w-4 h-4 mr-2" /> Reset
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <DialogHeader className="mb-4">
              <DialogTitle>Sign In to CRFM</DialogTitle>
              <DialogDescription>Access your account to stream, create, and connect.</DialogDescription>
            </DialogHeader>
            <LoginForm 
              onSwitchToSignUp={() => setCurrentView('signup')}
              onSwitchToForgotPassword={() => setCurrentView('forgot-password')}
              onSuccessfulLogin={() => onOpenChange(false)}
            />
          </TabsContent>
          <TabsContent value="signup">
            <DialogHeader className="mb-4">
              <DialogTitle>Join CRFM Streaming</DialogTitle>
              <DialogDescription>Create an account to start your journey with us.</DialogDescription>
            </DialogHeader>
            <SignUpForm 
              onSwitchToLogin={() => setCurrentView('login')}
            />
          </TabsContent>
          <TabsContent value="forgot-password">
            <DialogHeader className="mb-4">
              <DialogTitle>Reset Your Password</DialogTitle>
              <DialogDescription>We'll send a recovery link to your email.</DialogDescription>
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
