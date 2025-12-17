import React from 'react';
import CreatorUploadPreferences from '@/components/creator/CreatorUploadPreferences';
import CreatorDownloadsManager from '@/components/creator/CreatorDownloadsManager';
import CreatorBillingPanel from '@/components/creator/CreatorBillingPanel';
import CreatorWalletPanel from '@/components/creator/CreatorWalletPanel';

const CreatorMonetizationTab = () => {
  return (
    <div className="space-y-6">
      <CreatorWalletPanel />
      <CreatorBillingPanel />
      <CreatorDownloadsManager />
      <CreatorUploadPreferences />
    </div>
  );
};

export default CreatorMonetizationTab;
