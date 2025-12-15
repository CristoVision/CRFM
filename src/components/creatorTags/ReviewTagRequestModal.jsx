import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check } from 'lucide-react';
import { format } from 'date-fns';

const ReviewTagRequestModal = ({ request, isOpen, onClose, onReviewed }) => {
    const [status, setStatus] = useState(request?.status || 'pending');
    const [adminNotes, setAdminNotes] = useState(request?.admin_notes || '');
    const [isLoading, setIsLoading] = useState(false);
    const { user, profile } = useAuth();

    useEffect(() => {
        if (request) {
            setStatus(request.status || 'pending');
            setAdminNotes(request.admin_notes || '');
        }
    }, [request]);

    const handleSubmitReview = async () => {
        if (!profile?.id) {
            toast({ title: "Authentication Error", description: "Admin ID not found.", variant: "error" });
            return;
        }
        if (!request || !request.id) {
            toast({ title: "Request Error", description: "Request data is missing.", variant: "error" });
            return;
        }
        setIsLoading(true);
        try {
            if (status === 'approved') {
                const { error } = await supabase
                    .from('creator_tag_requests')
                    .update({ 
                        status: 'approved', 
                        admin_notes: adminNotes,
                        reviewed_by: profile.id,
                        reviewed_at: new Date().toISOString()
                    })
                    .eq('id', request.id);
                if (error) throw error;
                toast({ title: "Request Approved", description: `Request from ${request.requester_profile?.username || 'user'} approved.`, variant: "success" });
            } else if (status === 'denied') {
                const { error } = await supabase
                    .from('creator_tag_requests')
                    .update({ 
                        status: 'denied', 
                        admin_notes: adminNotes,
                        reviewed_by: profile.id,
                        reviewed_at: new Date().toISOString()
                    })
                    .eq('id', request.id);
                if (error) throw error;
                toast({ title: "Request Denied", description: `Request from ${request.requester_profile?.username || 'user'} denied.`, variant: "info" });
            } else {
                 toast({ title: "No Action Taken", description: "Status was not changed to 'approved' or 'denied'.", variant: "info" });
                 setIsLoading(false);
                 onClose();
                 return;
            }
            onReviewed();
            onClose();
        } catch (error) {
            toast({ title: "Review Submission Failed", description: error.message, variant: "error" });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!request) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="glass-effect-light text-white max-w-lg">
                <DialogHeader>
                    <DialogTitle className="golden-text text-2xl">Review Tag Request</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Reviewing request from <span className="font-semibold text-yellow-400">{request.requester_profile?.username || request.user_id}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="p-3 bg-black/20 rounded-md border border-yellow-400/20">
                        <p className="text-sm text-gray-400">User ID: <span className="text-yellow-300">{request.user_id}</span></p>
                        <p className="text-sm text-gray-400">Requested At: <span className="text-yellow-300">{format(new Date(request.created_at), 'PPpp')}</span></p>
                    </div>
                    <div>
                        <Label className="text-gray-300">Requested Tags</Label>
                        <div className="flex flex-wrap gap-2 mt-1 p-2 bg-black/10 rounded-md border border-yellow-400/10">
                            {(request.requested_tags || []).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-sm bg-yellow-400/20 text-yellow-200 border-yellow-400/40">{tag}</Badge>
                            ))}
                        </div>
                    </div>
                    {request.additional_info && (
                        <div>
                            <Label className="text-gray-300">Additional Information</Label>
                            <p className="text-sm text-gray-300 mt-1 p-2 bg-black/10 rounded-md border border-yellow-400/10 whitespace-pre-wrap">{request.additional_info}</p>
                        </div>
                    )}
                    <div>
                        <Label htmlFor="status" className="text-gray-300">Set Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger id="status" className="w-full mt-1 bg-black/20 border-white/10 text-white focus:border-yellow-400">
                                <SelectValue placeholder="Select status..." />
                            </SelectTrigger>
                            <SelectContent className="glass-effect-dark">
                                <SelectItem value="pending" className="text-gray-300 hover:!bg-yellow-400/10 hover:!text-yellow-200">Pending</SelectItem>
                                <SelectItem value="approved" className="text-green-400 hover:!bg-green-500/10 hover:!text-green-300">Approved</SelectItem>
                                <SelectItem value="denied" className="text-red-400 hover:!bg-red-500/10 hover:!text-red-300">Denied</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="adminNotes" className="text-gray-300">Admin Notes (Optional)</Label>
                        <Textarea
                            id="adminNotes"
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Add notes for the user or internal records..."
                            className="mt-1 bg-black/20 border-white/10 text-white focus:border-yellow-400 min-h-[100px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">Cancel</Button>
                    <Button onClick={handleSubmitReview} disabled={isLoading || status === request.status} className="golden-gradient text-black font-semibold hover:opacity-90">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Submit Review
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReviewTagRequestModal;
