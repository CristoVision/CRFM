import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, Edit3 } from 'lucide-react';
import { CONTRIBUTOR_ROLES_TEXT } from './AddContributorForms';
import { toast } from '@/components/ui/use-toast';

const ContributorList = ({ contributors, isLoading, onRemove, onUpdate }) => {
  const [editingContributor, setEditingContributor] = useState(null);
  const [editContributionRoleId, setEditContributionRoleId] = useState('');
  const [editRoyaltySharePercent, setEditRoyaltySharePercent] = useState('');

  const startEditing = (contributor) => {
    setEditingContributor(contributor);
    setEditContributionRoleId(contributor.contribution_role_id);
    setEditRoyaltySharePercent(contributor.royalty_share_percent.toString());
  };

  const cancelEditing = () => {
    setEditingContributor(null);
    setEditContributionRoleId('');
    setEditRoyaltySharePercent('');
  };

  const handleUpdateContributor = () => {
    if (!editingContributor || !editContributionRoleId || !editRoyaltySharePercent) {
         toast({ title: 'Missing information', description: 'Role and percentage are required.', variant: 'destructive'});
        return;
    }
    const percentage = parseFloat(editRoyaltySharePercent);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) { 
        toast({ title: 'Invalid percentage', description: 'Percentage must be between 0 and 100.', variant: 'destructive'});
        return;
    }
    onUpdate(editingContributor.internalId, {
      contribution_role_id: editContributionRoleId,
      royalty_share_percent: percentage,
    });
    cancelEditing();
  };

  if (isLoading) {
    return <Loader2 className="animate-spin mx-auto" />;
  }

  if (contributors.length === 0) {
    return <p className="text-gray-400 text-sm">No contributors added yet.</p>;
  }

  return (
    <div className="space-y-3">
      {contributors.map(c => (
        <div key={c.internalId} className="p-3 bg-white/5 rounded-lg space-y-2">
          <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                 {c.profile?.avatar_url ? <img src={c.profile.avatar_url} alt={c.name} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-yellow-400 font-bold">{c.name?.charAt(0).toUpperCase()}</div>}
                 <div>
                    <p className="font-medium text-white">{c.name} {c.contributor_id ? <Badge variant="secondary" className="ml-1 text-xs">User</Badge> : <Badge variant="outline" className="ml-1 text-xs">Invited</Badge>}</p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                 </div>
              </div>
               <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-yellow-300 w-8 h-8" onClick={() => startEditing(c)}><Edit3 size={16}/></Button>
                  <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 w-8 h-8" onClick={() => onRemove(c.internalId)}><Trash2 size={16}/></Button>
              </div>
          </div>
          {editingContributor?.internalId === c.internalId ? (
              <div className="mt-2 p-3 bg-black/20 rounded-md space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <Label htmlFor={`edit-role-${c.internalId}`} className="text-xs text-gray-400">Role</Label>
                          <Select value={editContributionRoleId} onValueChange={setEditContributionRoleId}>
                              <SelectTrigger id={`edit-role-${c.internalId}`} className="bg-white/10 border-white/20"><SelectValue placeholder="Select role" /></SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                  {CONTRIBUTOR_ROLES_TEXT.map(roleText => <SelectItem key={roleText} value={roleText}>{roleText}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div>
                          <Label htmlFor={`edit-percentage-${c.internalId}`} className="text-xs text-gray-400">Royalty Share %</Label>
                          <Input id={`edit-percentage-${c.internalId}`} type="number" value={editRoyaltySharePercent} onChange={(e) => setEditRoyaltySharePercent(e.target.value)} placeholder="e.g., 50" className="bg-white/10 border-white/20" min="0" max="100" step="0.01" />
                      </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                      <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
                      <Button size="sm" className="golden-gradient text-black" onClick={handleUpdateContributor}>Update</Button>
                  </div>
              </div>
          ) : (
             <div className="flex justify-between items-center text-sm pl-12 pt-1">
                  <span className="text-gray-300">{c.contribution_role_id || <span className="text-yellow-500 italic">No role assigned</span>}</span>
                  <span className="text-yellow-400 font-semibold">{typeof c.royalty_share_percent === 'number' ? c.royalty_share_percent.toFixed(2) : '0.00'}%</span>
              </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ContributorList;
