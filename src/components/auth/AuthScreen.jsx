// This file is now deprecated and can be removed in a future step if desired.
// For now, it will remain but App.jsx routes away from it.
// All its functionality has been moved to the new AuthModal and its handler.
import React from 'react';
import AuthLayout from './AuthLayout';

const DeprecatedAuthScreen = () => {
  return (
    <AuthLayout title="Page moved" subtitle="Authentication is now handled in a modal.">
      <div className="text-center text-gray-400">
        Please access Sign In, Sign Up, or Password Reset options from the header on the main page.
      </div>
    </AuthLayout>
  );
};

export default DeprecatedAuthScreen;
