// This file is now deprecated and can be removed in a future step if desired.
// For now, it will remain but App.jsx routes away from it.
// All its functionality has been moved to the new AuthModal and its handler.
import React from 'react';
import AuthLayout from './AuthLayout';
import { useLanguage } from '@/contexts/LanguageContext';

const DeprecatedAuthScreen = () => {
  const { t } = useLanguage();
  return (
    <AuthLayout title={t('auth.deprecated.title')} subtitle={t('auth.deprecated.subtitle')}>
      <div className="text-center text-gray-400">
        {t('auth.deprecated.body')}
      </div>
    </AuthLayout>
  );
};

export default DeprecatedAuthScreen;
