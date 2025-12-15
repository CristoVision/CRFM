import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Flag } from 'lucide-react';

const FLAG_REASON_CATEGORIES = [
  { value: 'copyright_infringement', label: 'Copyright Infringement' },
  { value: 'inappropriate_content', label: 'Inappropriate Content (Explicit, Hateful, etc.)' },
  { value: 'misleading_information', label: 'Misleading Information or Impersonation' },
  { value: 'spam_scam', label: 'Spam or Scam' },
  { value: 'technical_issue', label: 'Technical Issue with Content' },
  { value: 'other', label: 'Other (Please specify in details)' },
];

const FlagFormModal = ({ isOpen, onOpenChange, contentId, contentType, originalUploaderId, contentTitle }) => {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!reason) newErrors.reason = 'Reason is required.';
    if (!details.trim()) newErrors.details = 'Details cannot be empty.';
    else if (details.trim().length < 10) newErrors.details = 'Details must be at least 10 characters long.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to flag content.', variant: 'destructive' });
      return;
    }
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('content_flags')
        .insert({
          content_id: contentId,
          content_type: contentType,
          flagger_user_id: user.id,
          original_uploader_id: originalUploaderId,
          flag_reason_category: reason,
          flag_description_text: details,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      let updateTable = '';
      if (contentType === 'track') updateTable = 'tracks';
      else if (contentType === 'album') updateTable = 'albums';
      else if (contentType === 'playlist') updateTable = 'playlists';
      else if (contentType === 'creator') updateTable = 'profiles';

      if (updateTable) {
        const { error: updateError } = await supabase
          .from(updateTable)
          .update({ is_public: false })
          .eq('id', contentId);
        
        if (updateError) {
          console.warn(`Failed to set is_public to false for ${contentType} ${contentId}:`, updateError);
        }
      }

      toast({
        title: 'Content Flagged Successfully',
        description: `Thank you for reporting "${contentTitle || contentType}". It will be reviewed shortly.`,
        variant: 'default',
        className: 'bg-green-600 border-green-700 text-white'
      });
      onOpenChange(false);
      setReason('');
      setDetails('');
      setErrors({});
    } catch (error) {
      console.error('Error submitting flag:', error);
      toast({
        title: 'Error Submitting Flag',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setReason('');
        setDetails('');
        setErrors({});
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[480px] glass-effect-light">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Flag className="w-6 h-6 mr-2 text-yellow-400" />
            Report Content
          </DialogTitle>
          <DialogDescription>
            Help us maintain a safe and respectful community. Please provide details about why you are flagging {contentTitle ? `"${contentTitle}"` : `this ${contentType}`}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason" className="text-gray-300">Reason for Flagging</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason" className="w-full bg-black/30 border-white/20 text-white placeholder:text-gray-500">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20 text-white glass-effect">
                {FLAG_REASON_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="hover:bg-yellow-400/20 focus:bg-yellow-400/20">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.reason && <p className="text-sm text-red-400">{errors.reason}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="details" className="text-gray-300">Details</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please provide specific details about your concern. The more information you give, the better we can address the issue."
              className="min-h-[100px] bg-black/30 border-white/20 text-white placeholder:text-gray-500"
            />
            {errors.details && <p className="text-sm text-red-400">{errors.details}</p>}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="text-gray-300 border-gray-600 hover:bg-gray-700 hover:text-white">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="golden-gradient text-black">
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FlagFormModal;
