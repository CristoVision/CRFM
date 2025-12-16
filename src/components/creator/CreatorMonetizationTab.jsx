import React from 'react';
import CreatorUploadPreferences from '@/components/creator/CreatorUploadPreferences';
import CreatorDownloadsManager from '@/components/creator/CreatorDownloadsManager';
import CreatorBillingPanel from '@/components/creator/CreatorBillingPanel';

const CreatorMonetizationTab = () => {
  return (
    <div className="space-y-6">
      <CreatorBillingPanel />
      <CreatorDownloadsManager />
      <CreatorUploadPreferences />
    </div>
  );
};

export default CreatorMonetizationTab;
