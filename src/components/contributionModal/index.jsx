import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Percent, Save, Loader2, AlertTriangle } from 'lucide-react';
import { useContributionManager } from './useContributionManager';
import ContributorList from './ContributorList';
import AddContributorForms from './AddContributorForms';

const ContributionModal = ({ isOpen, onOpenChange, contentItem, contentType, onContributionsUpdated }) => {
  const {
    contributors,
    isLoading,
    isSaving,
    totalPercentage,
    addExistingUser,
    inviteNewUser,
    removeContributor,
    updateContributor,
    handleSaveContributions,
    existingContributorIds,
  } = useContributionManager({ isOpen, contentItem, contentType, onContributionsUpdated, onOpenChange });

  if (!contentItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl glass-effect-light text-white max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center"><Users className="w-6 h-6 mr-3 text-yellow-400" />Manage Contributors for "{contentItem.title}"</DialogTitle>
          <DialogDescription className="text-gray-400 pt-2">Define roles and royalty splits for this {contentType}.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-4 -mr-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-6 py-4">
            <div>
              <h4 className="text-lg font-semibold text-yellow-300 mb-3">Current Contributors</h4>
              <ContributorList
                contributors={contributors}
                isLoading={isLoading}
                onRemove={removeContributor}
                onUpdate={updateContributor}
              />
            </div>
            <AddContributorForms
              onAddExisting={addExistingUser}
              onInviteNew={inviteNewUser}
              existingContributorIds={existingContributorIds}
            />
          </div>
        </ScrollArea>
        
        <DialogFooter className="sm:justify-between items-center pt-6 border-t border-white/10">
          <div className={`flex items-center space-x-2 ${Math.abs(totalPercentage - 100) > 0.01 && contributors.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {(Math.abs(totalPercentage - 100) > 0.01 && contributors.length > 0) && <AlertTriangle size={18}/>}
            <Percent size={18}/>
            <span className="text-sm font-semibold">Total: {totalPercentage.toFixed(2)}%</span>
          </div>
          <div className="flex space-x-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleSaveContributions} 
              disabled={isSaving || (contributors.length > 0 && Math.abs(totalPercentage - 100) > 0.01) || (contributors.some(c => !c.contribution_role_id || typeof c.royalty_share_percent !== 'number' || c.royalty_share_percent < 0))} 
              className="golden-gradient text-black font-semibold hover:opacity-90"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Contributions
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContributionModal;