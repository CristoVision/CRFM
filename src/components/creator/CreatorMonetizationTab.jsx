import React from 'react';
import CreatorUploadPreferences from '@/components/creator/CreatorUploadPreferences';
import CreatorDownloadsManager from '@/components/creator/CreatorDownloadsManager';
import CreatorBillingPanel from '@/components/creator/CreatorBillingPanel';
import CreatorWalletPanel from '@/components/creator/CreatorWalletPanel';
import CreatorBulkUploadWorkspace from '@/components/creator/CreatorBulkUploadWorkspace';
import { useLocation, useNavigate } from 'react-router-dom';

const CreatorMonetizationTab = () => {
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    if (params.get('bulk_upload') !== '1') return;
    setBulkOpen(true);
    params.delete('bulk_upload');
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate]);

  return (
    <div className="space-y-6">
      <CreatorBulkUploadWorkspace open={bulkOpen} onOpenChange={setBulkOpen} />
      <CreatorWalletPanel />
      <CreatorBillingPanel />
      <CreatorDownloadsManager />
      <CreatorUploadPreferences />
    </div>
  );
};

export default CreatorMonetizationTab;
