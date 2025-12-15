import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';

export const useContributionManager = ({ isOpen, contentItem, contentType, onContributionsUpdated, onOpenChange }) => {
  const [contributors, setContributors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchContributors = useCallback(async () => {
    if (!contentItem?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_contributions')
        .select('id, content_id, content_type, contributor_id, contribution_role_id, royalty_share_percent, invited_email, invited_name, profiles(id, username, avatar_url, email)')
        .eq('content_id', contentItem.id)
        .eq('content_type', contentType);

      if (error) throw error;
      setContributors(data.map(c => ({
        internalId: c.id || `temp-${Math.random()}`, 
        dbId: c.id,
        content_id: c.content_id,
        content_type: c.content_type,
        contributor_id: c.contributor_id,
        profile: c.profiles,
        invited_email: c.invited_email,
        invited_name: c.invited_name,
        contribution_role_id: c.contribution_role_id,
        royalty_share_percent: parseFloat(c.royalty_share_percent),
        name: c.invited_name || c.profiles?.username,
        email: c.invited_email || c.profiles?.email,
      })));
    } catch (error) {
      toast({ title: 'Error fetching contributors', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [contentItem, contentType]);

  useEffect(() => {
    if (isOpen && contentItem) {
      fetchContributors();
    } else {
      setContributors([]);
    }
  }, [isOpen, contentItem, fetchContributors]);

  const addExistingUser = (profile) => {
    setContributors(prev => [
      ...prev,
      {
        internalId: `new-user-${profile.id}-${Date.now()}`, 
        dbId: null,
        content_id: contentItem.id,
        content_type: contentType,
        contributor_id: profile.id, 
        profile: profile,
        invited_email: null,
        invited_name: null,
        contribution_role_id: '', 
        royalty_share_percent: 0, 
        name: profile.username || profile.full_name,
        email: profile.email,
      }
    ]);
  };

  const inviteNewUser = ({ name, email, role, percentage }) => {
    setContributors(prev => [
      ...prev,
      {
        internalId: `new-invitee-${Date.now()}`,
        dbId: null,
        content_id: contentItem.id,
        content_type: contentType,
        contributor_id: null, 
        profile: null,
        invited_email: email,
        invited_name: name,
        contribution_role_id: role,
        royalty_share_percent: percentage,
        name: name,
        email: email,
      }
    ]);
  };

  const removeContributor = (internalIdToRemove) => {
    setContributors(prev => prev.filter(c => c.internalId !== internalIdToRemove));
  };

  const updateContributor = (internalIdToUpdate, updatedData) => {
    setContributors(prev => prev.map(c => 
        c.internalId === internalIdToUpdate 
        ? { ...c, ...updatedData } 
        : c
    ));
  };

  const totalPercentage = useMemo(() => {
    return contributors.reduce((sum, c) => sum + (c.royalty_share_percent || 0), 0);
  }, [contributors]);

  const existingContributorIds = useMemo(() => {
    return contributors.map(c => c.contributor_id).filter(Boolean);
  }, [contributors]);

  const handleSaveContributions = async () => {
    if (contributors.some(c => !c.contribution_role_id || typeof c.royalty_share_percent !== 'number' || c.royalty_share_percent < 0 || c.royalty_share_percent > 100)) {
        toast({ title: 'Incomplete or Invalid Data', description: 'All contributors must have a role and a valid royalty share percentage (0-100).', variant: 'destructive' });
        return;
    }
    if (Math.abs(totalPercentage - 100) > 0.01 && contributors.length > 0) {
      toast({ title: 'Percentage Mismatch', description: 'Total royalty share percentage must be exactly 100%.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('content_contributions')
        .delete()
        .eq('content_id', contentItem.id)
        .eq('content_type', contentType);

      if (deleteError) throw new Error(`Failed to clear existing contributions: ${deleteError.message}`);

      if (contributors.length > 0) {
        const contributionsToInsert = contributors.map(c => ({
          content_id: contentItem.id,
          content_type: contentType,
          contributor_id: c.contributor_id,
          contribution_role_id: c.contribution_role_id, 
          royalty_share_percent: c.royalty_share_percent,
          invited_email: c.contributor_id ? null : c.invited_email,
          invited_name: c.contributor_id ? null : c.invited_name,
        }));

        const { error: insertError } = await supabase
          .from('content_contributions')
          .insert(contributionsToInsert);

        if (insertError) throw insertError;
      }

      const updateTable = contentType === 'track' ? 'tracks' : 'albums';
      const { error: updateContentError } = await supabase
        .from(updateTable)
        .update({ total_royalty_percentage_allocated: contributors.length > 0 ? totalPercentage : 0 })
        .eq('id', contentItem.id);
      if (updateContentError) throw updateContentError;
      
      toast({ title: 'Contributions Saved', description: 'Royalty splits updated successfully.', variant: 'success' });
      if (onContributionsUpdated) onContributionsUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving contributions:', error);
      toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    contributors,
    isLoading,
    isSaving,
    totalPercentage,
    existingContributorIds,
    addExistingUser,
    inviteNewUser,
    removeContributor,
    updateContributor,
    handleSaveContributions,
  };
};
