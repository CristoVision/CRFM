import React from 'react';
import CreatorUploadPreferences from '@/components/creator/CreatorUploadPreferences';
import CreatorDownloadsManager from '@/components/creator/CreatorDownloadsManager';

const CreatorMonetizationTab = () => {
  return (
    <div className="space-y-6">
      <CreatorDownloadsManager />
      <CreatorUploadPreferences />
    </div>
  );
};

export default CreatorMonetizationTab;
