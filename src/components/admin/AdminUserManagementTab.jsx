import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { Users, Edit3, Search, Loader2, AlertTriangle, Eye, EyeOff, CheckCircle, Filter, RefreshCw, Lock, Unlock, ShieldCheck, RefreshCcw, KeyRound, Send } from 'lucide-react';

    const ITEMS_PER_PAGE = 10;
    const CONVERSION_RATE = 0.01; // 1 CC = $0.01 USD (0.5 CC ≈ $0.005 per stream)

const EditUserModal = ({ user, isOpen, onClose, onSave, adminProfile }) => {
  const [isAdmin, setIsAdmin] = useState(user?.is_admin || false);
  const [isVerifiedCreator, setIsVerifiedCreator] = useState(user?.is_verified_creator || false);
  const [isPublic, setIsPublic] = useState(user?.is_public || true);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [lockUntil, setLockUntil] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [lockLoading, setLockLoading] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyReference, setVerifyReference] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDescription, setSupportDescription] = useState('');
  const [supportPriority, setSupportPriority] = useState('normal');
  const [supportLoading, setSupportLoading] = useState(false);


      useEffect(() => {
        if (user) {
          setIsAdmin(user.is_admin || false);
          setIsVerifiedCreator(user.is_verified_creator || false);
          setIsPublic(user.is_public === undefined ? true : user.is_public);
          setNewPassword('');
          setLockUntil('');
          setLockReason('');
          setVerifyReference('');
          setSupportSubject('');
          setSupportDescription('');
          setSupportPriority('normal');
        }
      }, [user]);

      const handleSaveChanges = async () => {
        if (!user) return;
        const updates = {
          is_admin: isAdmin,
          is_verified_creator: isVerifiedCreator,
          is_public: isPublic,
        };
        await onSave(user.id, updates);
      };

      const handleUpdatePassword = async () => {
        if (!user || !newPassword) {
            toast({ title: "Password cannot be empty.", variant: "destructive" });
            return;
        }
        if (newPassword.length < 6) {
            toast({ title: "Password too short.", description: "Password must be at least 6 characters.", variant: "destructive"});
            return;
        }
        setIsUpdatingPassword(true);
        try {
            const { error } = await supabase.rpc('rpc_admin_update_user_password', {
                p_admin_id: adminProfile?.id,
                p_target_user_id: user.id,
                p_new_password: newPassword
            });

            if (error) throw error;

            toast({ title: "Password Updated", description: `Password updated for ${user.username}.`, variant: "success" });
            setNewPassword('');
        } catch (error) {
            console.error("Error updating password (admin):", error);
            toast({ title: "Password Update Failed", description: error.message || "Could not update password. Ensure the Edge Function 'admin-update-user-password' is set up and has appropriate permissions.", variant: "destructive" });
        } finally {
            setIsUpdatingPassword(false);
        }
      };


      if (!user) return null;

      const callRpc = async (name, payload, successMessage) => {
        try {
          const { error, status, statusText } = await supabase.rpc(name, payload);
          if (error) {
            throw { message: error.message, code: error.code, status };
          }
          toast({ title: successMessage, variant: "success" });
          return { ok: true };
        } catch (error) {
          const detail = error?.message || error?.statusText || 'RPC unavailable (apply latest SQL migrations).';
          toast({ title: "Action failed", description: detail, variant: "destructive" });
          return { ok: false, error };
        }
      };

      const handleLockUser = async (lock) => {
        if (!adminProfile?.id || !user?.id) return;
        setLockLoading(true);
        try {
          await callRpc('admin_lock_user', {
            p_admin_id: adminProfile.id,
            p_target_user_id: user.id,
            p_until: lock ? (lockUntil ? new Date(lockUntil).toISOString() : null) : null,
            p_reason: lockReason || (lock ? 'Locked by admin' : 'Unlocked by admin'),
          }, lock ? 'User locked' : 'User unlocked');
        } finally {
          setLockLoading(false);
        }
      };

      const handleRequirePasswordReset = async () => {
        if (!adminProfile?.id || !user?.id) return;
        setIsUpdatingPassword(true);
        try {
          await callRpc('admin_require_password_reset', {
            p_admin_id: adminProfile.id,
            p_target_user_id: user.id,
            p_reason: 'Admin requested password reset',
          }, 'Password reset required on next login');
        } finally {
          setIsUpdatingPassword(false);
        }
      };

      const handleResetMfa = async () => {
        if (!adminProfile?.id || !user?.id) return;
        setMfaLoading(true);
        try {
          await callRpc('admin_reset_mfa', {
            p_admin_id: adminProfile.id,
            p_target_user_id: user.id,
            p_reason: 'MFA reset by admin',
          }, 'MFA factors cleared');
        } finally {
          setMfaLoading(false);
        }
      };

      const handleVerifyIdentity = async () => {
        if (!adminProfile?.id || !user?.id) return;
        setVerifyLoading(true);
        try {
          await callRpc('admin_update_identity_verification', {
            p_admin_id: adminProfile.id,
            p_target_user_id: user.id,
            p_is_verified: isVerifiedCreator,
            p_reference: verifyReference || null,
          }, 'Identity verification updated');
        } finally {
          setVerifyLoading(false);
        }
      };

      const handleCreateSupportCase = async () => {
        if (!adminProfile?.id || !user?.id) return;
        if (!supportSubject.trim()) {
          toast({ title: "Subject required", variant: "destructive" });
          return;
        }
        setSupportLoading(true);
        try {
          await callRpc('create_support_case', {
            p_user_id: user.id,
            p_subject: supportSubject.trim(),
            p_description: supportDescription || '',
            p_priority: supportPriority,
            p_channel: 'admin_assist',
          }, 'Support case created');
          setSupportSubject('');
          setSupportDescription('');
          setSupportPriority('normal');
        } finally {
          setSupportLoading(false);
        }
      };

      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="sm:max-w-2xl glass-effect text-white font-montserrat max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="golden-text text-2xl">Edit User: {user.username}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 py-2">
              <div className="flex items-center justify-between p-3 rounded-md bg-black/20 border border-yellow-400/20">
                <Label htmlFor="isAdmin" className="text-base text-gray-300">Administrator Privileges</Label>
                <Switch id="isAdmin" checked={isAdmin} onCheckedChange={setIsAdmin} className="data-[state=checked]:bg-yellow-400"/>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-black/20 border border-yellow-400/20">
                <Label htmlFor="isVerifiedCreator" className="text-base text-gray-300">Verified Creator Status</Label>
                <Switch id="isVerifiedCreator" checked={isVerifiedCreator} onCheckedChange={setIsVerifiedCreator} className="data-[state=checked]:bg-yellow-400"/>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-black/20 border border-yellow-400/20">
                <Label htmlFor="isPublic" className="text-base text-gray-300">Public Profile</Label>
                <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} className="data-[state=checked]:bg-yellow-400"/>
              </div>
              
              <div className="space-y-2 pt-4 border-t border-yellow-400/20">
                <Label htmlFor="newPasswordAdmin" className="text-gray-300 text-sm">Reset User Password (Optional)</Label>
                 <div className="relative flex items-center">
                    <Input
                        id="newPasswordAdmin"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 6 chars)"
                        className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 p-1 text-yellow-400/70 hover:text-yellow-300"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !newPassword} variant="outline" size="sm" className="w-full mt-2 text-yellow-400 border-yellow-400/50 hover:border-yellow-400 hover:bg-yellow-400/10">
                  {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Update Password
                </Button>
                <p className="text-xs text-gray-500 mt-1">Requires 'admin-update-user-password' Supabase Edge Function.</p>
              </div>

              <div className="space-y-3 border-t border-yellow-400/20 pt-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-yellow-300" />
                  <Label className="text-gray-200 text-sm">Account Lock</Label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="datetime-local"
                    value={lockUntil}
                    onChange={(e) => setLockUntil(e.target.value)}
                    className="bg-black/20 border-white/10 text-white"
                  />
                  <Input
                    placeholder="Reason (optional)"
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    className="bg-black/20 border-white/10 text-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleLockUser(true)} disabled={lockLoading} className="golden-gradient text-black font-semibold">
                    {lockLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />} Lock
                  </Button>
                  <Button onClick={() => handleLockUser(false)} disabled={lockLoading} variant="outline" className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300">
                    <Unlock className="w-4 h-4 mr-2" /> Unlock
                  </Button>
                </div>
              </div>

              <div className="space-y-3 border-t border-yellow-400/20 pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleRequirePasswordReset} disabled={isUpdatingPassword} variant="outline" className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300 w-full sm:w-auto">
                    {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw className="w-4 h-4 mr-2" />} Require Password Reset
                  </Button>
                  <Button onClick={handleResetMfa} disabled={mfaLoading} variant="outline" className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300 w-full sm:w-auto">
                    {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />} Reset MFA
                  </Button>
                </div>
              </div>

              <div className="space-y-3 border-t border-yellow-400/20 pt-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-yellow-300" />
                  <Label className="text-gray-200 text-sm">Identity Verification</Label>
                </div>
                <Input
                  placeholder="Reference link or note (optional)"
                  value={verifyReference}
                  onChange={(e) => setVerifyReference(e.target.value)}
                  className="bg-black/20 border-white/10 text-white"
                />
                <Button onClick={handleVerifyIdentity} disabled={verifyLoading} className="golden-gradient text-black font-semibold w-full sm:w-auto">
                  {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />} Save Verification
                </Button>
              </div>

              <div className="space-y-3 border-t border-yellow-400/20 pt-4">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-yellow-300" />
                  <Label className="text-gray-200 text-sm">Create Support Case</Label>
                </div>
                <Input
                  placeholder="Subject"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  className="bg-black/20 border-white/10 text-white"
                />
                <Textarea
                  placeholder="Description / context"
                  value={supportDescription}
                  onChange={(e) => setSupportDescription(e.target.value)}
                  className="bg-black/20 border-white/10 text-white min-h-[80px]"
                />
                <div className="flex flex-wrap gap-2">
                  {['low','normal','high','urgent'].map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={supportPriority === p ? 'default' : 'outline'}
                      className={supportPriority === p ? 'golden-gradient text-black' : 'text-yellow-300 border-yellow-400/40'}
                      onClick={() => setSupportPriority(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
                <Button onClick={handleCreateSupportCase} disabled={supportLoading} className="golden-gradient text-black font-semibold w-full sm:w-auto">
                  {supportLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} Create Case
                </Button>
              </div>

            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={handleSaveChanges} className="golden-gradient text-black font-semibold">
                Save Profile Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };
    
    const AdminUserManagementTab = () => {
      const { profile: adminProfile } = useAuth();
      const [users, setUsers] = useState([]);
      const [isLoading, setIsLoading] = useState(true);
      const [searchTerm, setSearchTerm] = useState('');
      const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
      const [isEditModalOpen, setIsEditModalOpen] = useState(false);
      const [currentPage, setCurrentPage] = useState(1);
      const [totalUsers, setTotalUsers] = useState(0);
      const [filterRole, setFilterRole] = useState('all'); // all | admin | creator | public
      const [showUsd, setShowUsd] = useState(false);

      const fetchUsers = useCallback(async (page = 1, search = '', roleFilter = 'all') => {
        setIsLoading(true);
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        let query = supabase
          .from('profiles')
          .select(
            'id, username, full_name, wallet_balance, is_admin, is_verified_creator, is_public, creator_tags, created_at',
            { count: 'exact' }
          );
        
        if (search && search.trim()) {
          query = query.or(
            `username.ilike.%${search}%,full_name.ilike.%${search}%`
          );
        }

        if (roleFilter === 'admin') {
          query = query.eq('is_admin', true);
        } else if (roleFilter === 'creator') {
          query = query.eq('is_verified_creator', true);
        } else if (roleFilter === 'public') {
          query = query.eq('is_public', true);
        }
        
        query = query
          .order('created_at', { ascending: false })
          .range(from, to);
        
        const { data, error, count } = await query;

        if (error) {
          toast({ title: "Failed to load users — check profiles query.", variant: "destructive" });
          setUsers([]);
          setTotalUsers(0);
        } else {
          setUsers(data || []);
          setTotalUsers(count || 0);
        }
        setIsLoading(false);
      }, []);

      useEffect(() => {
        if (!adminProfile?.is_admin) return;
        fetchUsers(currentPage, searchTerm, filterRole);
      }, [fetchUsers, currentPage, searchTerm, filterRole, adminProfile]);

      const handleOpenEditModal = (user) => {
        setSelectedUserForEdit(user);
        setIsEditModalOpen(true);
      };

      const logAdminAction = async (action, targetUserId, details) => {
        if (!adminProfile?.id) return;
        try {
          await supabase.from('admin_audit_logs').insert({
            admin_user_id: adminProfile.id,
            target_user_id: targetUserId,
            action,
            details,
          });
        } catch (err) {
          console.warn('Audit log skipped', err?.message);
        }
      };

      const handleSaveUserEdits = async (userId, updates) => {
        if (!adminProfile?.id) {
          toast({ title: "Admin session missing", variant: "destructive" });
          return;
        }
        const payload = {
          p_admin_id: adminProfile.id,
          p_target_user_id: userId,
          p_is_admin: updates.is_admin,
          p_is_verified_creator: updates.is_verified_creator,
          p_is_public: updates.is_public,
        };

        const { error: rpcError } = await supabase.rpc('admin_update_profile_fields', payload);

        if (rpcError) {
          // Fallback to direct update if policy allows
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              is_admin: updates.is_admin,
              is_verified_creator: updates.is_verified_creator,
              is_public: updates.is_public,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (updateError) {
            const detail = updateError.message || rpcError.message || 'Update failed';
            toast({ title: "Error updating user", description: detail, variant: "destructive" });
            console.error('admin_update_profile_fields failed', { rpcError, updateError });
            return;
          } else {
            toast({ title: "User updated (fallback)", description: "RPC failed, policy update succeeded.", variant: "success" });
          }
        }

        toast({ title: "User updated successfully", variant: "success" });
        await logAdminAction('update_user_profile', userId, updates);
        setIsEditModalOpen(false);
        fetchUsers(currentPage, searchTerm, filterRole); 
      };

      const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
        setCurrentPage(1);
      };

      const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE);
      
      const getRoleBadgeClass = (role, value) => {
        if (value) {
            return role === 'admin' ? 'bg-red-500/30 text-red-300 border-red-500/40' : 'bg-green-500/30 text-green-300 border-green-500/40';
        }
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      };

      if (!adminProfile?.is_admin) {
        return (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl">
            <AlertTriangle className="w-12 h-12 text-yellow-400 mb-4" />
            <h3 className="text-2xl font-semibold text-yellow-300 mb-2">Admin access required</h3>
            <p className="text-gray-400">You must be an administrator to manage users.</p>
          </div>
        );
      }


      const formatWallet = (val) => {
        const cc = val?.toLocaleString() || '0';
        if (showUsd) {
          const usd = ((val || 0) * CONVERSION_RATE).toFixed(2);
          return `$${usd} · ${cc} CC`;
        }
        return `${cc} CC`;
      };

      return (
        <div className="space-y-6 p-1 md:p-4 font-montserrat text-white">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <h2 className="text-3xl font-bold golden-text">User Account Management</h2>
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 w-full md:w-auto">
                  <div className="relative w-full sm:w-72 md:w-80">
                    <Input 
                      type="search" 
                      placeholder="Search (username, name)..." 
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="pl-10 bg-black/20 border-yellow-400/30 focus:border-yellow-400 w-full" 
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-yellow-400/70" />
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => fetchUsers(currentPage, searchTerm, filterRole)}
                      className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300 w-full sm:w-auto"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowUsd(!showUsd)}
                      className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300 w-full sm:w-auto"
                    >
                      {showUsd ? 'Show CC' : 'Show USD'}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center text-sm text-gray-300">
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-4 h-4 text-yellow-300" />
                  <span className="text-gray-400">Filter:</span>
                  <Button
                    size="sm"
                    variant={filterRole === 'all' ? 'default' : 'outline'}
                    className={filterRole === 'all' ? 'golden-gradient text-black' : 'text-yellow-300 border-yellow-400/40'}
                    onClick={() => { setFilterRole('all'); setCurrentPage(1); }}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={filterRole === 'admin' ? 'default' : 'outline'}
                    className={filterRole === 'admin' ? 'golden-gradient text-black' : 'text-yellow-300 border-yellow-400/40'}
                    onClick={() => { setFilterRole('admin'); setCurrentPage(1); }}
                  >
                    Admins
                  </Button>
                  <Button
                    size="sm"
                    variant={filterRole === 'creator' ? 'default' : 'outline'}
                    className={filterRole === 'creator' ? 'golden-gradient text-black' : 'text-yellow-300 border-yellow-400/40'}
                    onClick={() => { setFilterRole('creator'); setCurrentPage(1); }}
                  >
                    Creators
                  </Button>
                  <Button
                    size="sm"
                    variant={filterRole === 'public' ? 'default' : 'outline'}
                    className={filterRole === 'public' ? 'golden-gradient text-black' : 'text-yellow-300 border-yellow-400/40'}
                    onClick={() => { setFilterRole('public'); setCurrentPage(1); }}
                  >
                    Public Profiles
                  </Button>
                </div>
                <span className="text-xs text-gray-400">Showing {users.length} / {totalUsers || 0} users</span>
              </div>
            </div>

          {isLoading && (
            <div className="flex justify-center items-center min-h-[300px]">
              <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
              <p className="ml-4 text-lg">Loading users...</p>
            </div>
          )}

          {!isLoading && users.length === 0 && (
            <div className="text-center py-12 glass-effect rounded-xl">
              <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-2">No Users Found</h3>
              <p className="text-gray-400">
                {searchTerm ? "No users match your search criteria." : "There are currently no users."}
              </p>
            </div>
          )}

          {!isLoading && users.length > 0 && (
            <div className="overflow-x-auto glass-effect rounded-xl p-1 sm:p-4">
              <table className="min-w-full divide-y divide-yellow-400/20">
                <thead className="bg-black/30">
                  <tr>
                    {['Username', 'Full Name', 'Wallet', 'Roles', 'Public', 'Joined', 'Actions'].map(header => (
                       <th key={header} scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-yellow-300">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-400/10 bg-black/10">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-yellow-400/5 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-200 font-medium">{user.username}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">{user.full_name || 'N/A'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-yellow-300">{formatWallet(user.wallet_balance)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {user.is_admin && <Badge className={getRoleBadgeClass('admin', true) + " mr-1 mb-1"}>ADMIN</Badge>}
                        {user.is_verified_creator && <Badge className={getRoleBadgeClass('creator', true) + " mr-1 mb-1"}>CREATOR</Badge>}
                        {!user.is_admin && !user.is_verified_creator && <Badge className={getRoleBadgeClass('user', false)}>USER</Badge>}
                      </td>
                       <td className="whitespace-nowrap px-4 py-3 text-sm">
                         {user.is_public ? <CheckCircle className="w-5 h-5 text-green-400"/> : <AlertTriangle className="w-5 h-5 text-yellow-500"/>}
                       </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400">{format(new Date(user.created_at), 'PP')}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Button onClick={() => handleOpenEditModal(user)} size="sm" variant="outline" className="text-yellow-400 border-yellow-400/50 hover:border-yellow-400 hover:bg-yellow-400/10">
                          <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Profile
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {totalUsers > ITEMS_PER_PAGE && !isLoading && users.length > 0 && (
             <div className="flex justify-between items-center mt-6">
              <Button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                variant="outline" className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-400">Page {currentPage} of {totalPages}</span>
              <Button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages}
                variant="outline" className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
              >
                Next
              </Button>
            </div>
          )}
          {selectedUserForEdit && (
            <EditUserModal
              user={selectedUserForEdit}
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              onSave={handleSaveUserEdits}
              adminProfile={adminProfile}
            />
          )}
        </div>
      );
    };

    export default AdminUserManagementTab;
