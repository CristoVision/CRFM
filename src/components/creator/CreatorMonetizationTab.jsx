import React from 'react';
import CreatorUploadPreferences from '@/components/creator/CreatorUploadPreferences';
import CreatorDownloadsManager from '@/components/creator/CreatorDownloadsManager';
import CreatorBillingPanel from '@/components/creator/CreatorBillingPanel';
import CreatorWalletPanel from '@/components/creator/CreatorWalletPanel';
import CreatorBulkUploadWorkspace from '@/components/creator/CreatorBulkUploadWorkspace';
import { Button } from '@/components/ui/button';
import { FolderUp } from 'lucide-react';
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
      <div className="glass-effect rounded-xl p-4 sm:p-6 border border-yellow-400/10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
              <FolderUp className="w-5 h-5" />
              Bulk Upload
            </h3>
            <p className="text-sm text-gray-300">
              Upload albums or singles in batches with review, progress tracking, and resumable drafts (metadata).
            </p>
          </div>
          <Button type="button" className="golden-gradient text-black font-semibold" onClick={() => setBulkOpen(true)}>
            <FolderUp className="w-4 h-4 mr-2" />
            Open Bulk Upload
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Note: Safari can’t reliably select folders recursively; use “Select Files” per album folder for best results.
        </p>
      </div>
      <CreatorDownloadsManager />
      <CreatorUploadPreferences />
    </div>
  );
};

export default CreatorMonetizationTab;
