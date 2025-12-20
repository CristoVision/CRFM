import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2, Copy, Send, Users, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
function InviteFriendsTab() {
  const {
    user
  } = useAuth();
  const { t, language } = useLanguage();
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [sentInvites, setSentInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const fetchInviteCodeAndReferrals = useCallback(async () => {
    if (!user) return;
    setLoadingInvites(true);
    try {
      const {
        data: profileData,
        error: profileError
      } = await supabase.from('profiles').select('my_personal_invite_code').eq('id', user.id).single();
      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      if (profileData?.my_personal_invite_code) {
        setInviteCode(profileData.my_personal_invite_code);
        const currentOrigin = window.location.origin;
        setInviteLink(`${currentOrigin}/auth?invite_code=${profileData.my_personal_invite_code}`);
      } else {
        toast({
          title: t('profile.invite.toasts.inviteCodeMissing'),
          description: t('profile.invite.toasts.inviteCodeMissingBody'),
          variant: "destructive"
        });
      }
      const {
        data: referralsData,
        error: referralsError
      } = await supabase.from('referrals').select('invitee_email, status, created_at, accepted_at').eq('inviter_user_id', user.id).order('created_at', {
        ascending: false
      });
      if (referralsError) throw referralsError;
      setSentInvites(referralsData || []);
    } catch (error) {
      toast({
        title: t('profile.invite.toasts.errorFetching'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingInvites(false);
    }
  }, [user, t]);
  useEffect(() => {
    fetchInviteCodeAndReferrals();
  }, [fetchInviteCodeAndReferrals]);
  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => toast({
      title: t('profile.invite.toasts.linkCopied'),
      description: t('profile.invite.toasts.linkCopiedBody')
    })).catch(() => toast({
      title: t('profile.invite.toasts.copyFailed'),
      description: t('profile.invite.toasts.copyFailedBody'),
      variant: 'destructive'
    }));
  };
  const handleSendInvite = async e => {
    e.preventDefault();
    if (!inviteeEmail || !inviteCode || !user) {
      toast({
        title: t('profile.invite.toasts.missingInfo'),
        description: t('profile.invite.toasts.missingInfoBody'),
        variant: 'destructive'
      });
      return;
    }
    setIsSendingInvite(true);
    try {
      const {
        data,
        error
      } = await supabase.from('referrals').insert({
        inviter_user_id: user.id,
        invitee_email: inviteeEmail,
        invite_code: inviteCode,
        status: 'pending'
      }).select();
      if (error) throw error;
      toast({
        title: t('profile.invite.toasts.inviteSentTitle'),
        description: t('profile.invite.toasts.inviteSentBody', { email: inviteeEmail })
      });
      setInviteeEmail('');
      fetchInviteCodeAndReferrals();
    } catch (error) {
      toast({
        title: t('profile.invite.toasts.failedSend'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSendingInvite(false);
    }
  };
  const formatDate = dateString => {
    if (!dateString) return t('common.na');
    return new Date(dateString).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  return <div className="glass-effect-light p-6 sm:p-8 rounded-xl shadow-xl space-y-8">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 flex items-center">
                        <UserPlus className="w-6 h-6 sm:w-7 sm:h-7 mr-3 text-yellow-400" />
                        {t('profile.invite.title')}
                    </h2>
                    <p className="text-gray-300 mb-6">{t('profile.invite.description')}</p>
                
                    <div className="space-y-3 mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                        <Label htmlFor="inviteCodeDisplay" className="text-gray-300 font-semibold">{t('profile.invite.personalCodeLabel')}</Label>
                        <Input id="inviteCodeDisplay" type="text" value={inviteCode || t('common.loading')} readOnly className="bg-white/20 border-white/30 text-yellow-300 font-mono tracking-wider text-lg cursor-not-allowed" />
                    </div>

                    <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
                        <Label htmlFor="referralLink" className="text-gray-300 font-semibold">{t('profile.invite.shareableLinkLabel')}</Label>
                        <div className="flex items-center space-x-2">
                            <Input id="referralLink" type="text" value={inviteLink || t('common.loading')} readOnly className="flex-grow bg-white/20 border-white/30 text-gray-400 cursor-not-allowed" />
                            <Button onClick={handleCopyLink} disabled={!inviteLink} variant="outline" className="bg-white/10 border-white/20 text-gray-300 hover:bg-white/20 hover:text-yellow-300">
                                <Copy className="w-4 h-4 mr-2" /> {t('profile.invite.copy')}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8">
                    <h3 className="text-xl font-semibold text-white mb-4">{t('profile.invite.sendEmailTitle')}</h3>
                    <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                        <div className="flex-grow w-full sm:w-auto">
                            <Label htmlFor="inviteeEmail" className="text-gray-300">{t('profile.invite.friendEmailLabel')}</Label>
                            <Input id="inviteeEmail" type="email" value={inviteeEmail} onChange={e => setInviteeEmail(e.target.value)} placeholder={t('profile.invite.friendEmailPlaceholder')} required className="mt-1 bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
                        </div>
                        <Button type="submit" disabled={isSendingInvite || !inviteCode} className="w-full sm:w-auto golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button">
                            {isSendingInvite ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            {t('profile.invite.sendInvite')}
                        </Button>
                    </form>
                </div>

                <div className="border-t border-white/10 pt-8">
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center"><Users className="w-5 h-5 mr-2 text-yellow-400" />{t('profile.invite.sentInvitations')}</h3>
                    {loadingInvites ? <div className="flex justify-center items-center h-32"><Loader2 className="w-6 h-6 animate-spin text-yellow-400" /></div> : sentInvites.length === 0 ? <p className="text-gray-400">{t('profile.invite.noneSent')}</p> : <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                            {sentInvites.map((invite, index) => <div key={index} className="p-3 bg-white/5 rounded-md border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="truncate">
                                        <p className="text-gray-200 font-medium truncate">{invite.invitee_email}</p>
                                        <p className="text-xs text-gray-500">{t('profile.invite.sentLabel')} {formatDate(invite.created_at)}</p>
                                    </div>
                                    <div className="flex items-center space-x-2 text-xs">
                                        <span className={`px-2 py-0.5 rounded-full font-medium
                                            ${invite.status === 'accepted' ? 'bg-green-500/20 text-green-300' : invite.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-500/20 text-gray-300'}`}>
                                            {invite.status === 'accepted'
                                              ? t('profile.invite.status.accepted')
                                              : invite.status === 'pending'
                                                ? t('profile.invite.status.pending')
                                                : t('profile.invite.status.other')}
                                        </span>
                                        {invite.status === 'accepted' && invite.accepted_at && <span className="text-gray-400 flex items-center"><CheckCircle className="w-3 h-3 mr-1 text-green-400" />{t('profile.invite.acceptedLabel')} {formatDate(invite.accepted_at)}</span>}
                                    </div>
                                </div>)}
                        </div>}
                </div>
            </div>;
}
export default InviteFriendsTab;
