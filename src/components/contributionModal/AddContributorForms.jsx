import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { UserPlus, Mail } from 'lucide-react';

export const CONTRIBUTOR_ROLES_TEXT = ["Artist", "Producer", "Songwriter", "Composer", "Lyricist", "Featured Artist", "Mix Engineer", "Mastering Engineer", "Arranger", "Vocalist", "Musician", "Publisher", "Label", "Remixer", "Other"];

const AddContributorForms = ({ onAddExisting, onInviteNew, existingContributorIds }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [newInvitedName, setNewInvitedName] = useState('');
  const [newInvitedEmail, setNewInvitedEmail] = useState('');
  const [newContributionRoleId, setNewContributionRoleId] = useState('');
  const [newRoyaltySharePercent, setNewRoyaltySharePercent] = useState('');

  const handleSearchUsers = useCallback(async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url, full_name')
        .or(`username.ilike.%${query}%,email.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(5);
      if (error) throw error;
      setSearchResults(data.filter(p => !existingContributorIds.includes(p.id)));
    } catch (error) {
      console.error('Error searching users:', error);
      toast({ title: 'Error searching users', description: error.message, variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  }, [existingContributorIds]);

  useEffect(() => {
    const debounceSearch = setTimeout(() => {
      if (searchQuery) handleSearchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(debounceSearch);
  }, [searchQuery, handleSearchUsers]);

  const handleSelectUser = (profile) => {
    onAddExisting(profile);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleInviteClick = () => {
    if (!newInvitedName.trim() || !newInvitedEmail.trim() || !newContributionRoleId || !newRoyaltySharePercent) {
      toast({ title: 'Missing information', description: 'Name, Email, Role, and Percentage are required for new invitees.', variant: 'destructive' });
      return;
    }
    const percentage = parseFloat(newRoyaltySharePercent);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      toast({ title: 'Invalid percentage', description: 'Percentage must be between 0 and 100.', variant: 'destructive' });
      return;
    }
    onInviteNew({
      name: newInvitedName,
      email: newInvitedEmail,
      role: newContributionRoleId,
      percentage: percentage,
    });
    setNewInvitedName('');
    setNewInvitedEmail('');
    setNewContributionRoleId('');
    setNewRoyaltySharePercent('');
  };

  return (
    <>
      <div className="space-y-3 pt-4 border-t border-white/10">
        <h4 className="text-lg font-semibold text-yellow-300 flex items-center"><UserPlus className="w-5 h-5 mr-2"/>Add Existing User</h4>
        <Command className="rounded-lg border shadow-md bg-white/5 border-white/20">
          <CommandInput 
              placeholder="Search by name, username, or email..." 
              value={searchQuery} 
              onValueChange={setSearchQuery}
              className="text-white placeholder:text-gray-500"
          />
          <CommandList className="max-h-40 custom-scrollbar">
              {isSearching && <CommandEmpty>Searching...</CommandEmpty>}
              {!isSearching && searchResults.length === 0 && searchQuery.length > 1 && <CommandEmpty>No users found.</CommandEmpty>}
              {!isSearching && searchResults.length === 0 && searchQuery.length < 2 && <CommandEmpty>Type to search users.</CommandEmpty>}
              <CommandGroup>
              {searchResults.map(profile => (
                  <CommandItem key={profile.id} onSelect={() => handleSelectUser(profile)} className="flex items-center space-x-2 cursor-pointer hover:bg-white/10">
                      {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.username} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs text-yellow-300">{(profile.username || profile.full_name)?.charAt(0).toUpperCase()}</div>}
                      <span>{profile.full_name || profile.username} ({profile.email})</span>
                  </CommandItem>
              ))}
              </CommandGroup>
          </CommandList>
        </Command>
      </div>

      <div className="space-y-3 pt-4 border-t border-white/10">
        <h4 className="text-lg font-semibold text-yellow-300 flex items-center"><Mail className="w-5 h-5 mr-2"/>Invite New Contributor</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input placeholder="Contributor Name" value={newInvitedName} onChange={(e) => setNewInvitedName(e.target.value)} className="bg-white/10 border-white/20"/>
          <Input type="email" placeholder="Contributor Email" value={newInvitedEmail} onChange={(e) => setNewInvitedEmail(e.target.value)} className="bg-white/10 border-white/20"/>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select value={newContributionRoleId} onValueChange={setNewContributionRoleId}>
            <SelectTrigger className="bg-white/10 border-white/20"><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              {CONTRIBUTOR_ROLES_TEXT.map(roleText => <SelectItem key={roleText} value={roleText}>{roleText}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Royalty Share %" value={newRoyaltySharePercent} onChange={(e) => setNewRoyaltySharePercent(e.target.value)} className="bg-white/10 border-white/20" min="0" max="100" step="0.01"/>
        </div>
        <Button onClick={handleInviteClick} className="w-full md:w-auto golden-gradient text-black" disabled={!newInvitedName || !newInvitedEmail || !newContributionRoleId || !newRoyaltySharePercent}>Add Invitee</Button>
      </div>
    </>
  );
};

export default AddContributorForms;
