import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2, TrendingUp, TrendingDown, Gift, Edit } from 'lucide-react';

const transactionTypeOptions = [
  { value: 'admin_credit_top_up', label: 'Admin: Top-Up (Credit)', icon: <TrendingUp className="w-4 h-4 mr-2 text-green-400" /> },
  { value: 'admin_credit_adjustment', label: 'Admin: Adjustment (Credit)', icon: <Gift className="w-4 h-4 mr-2 text-blue-400" /> },
  { value: 'admin_credit_reward', label: 'Admin: Reward (Credit)', icon: <Gift className="w-4 h-4 mr-2 text-yellow-400" /> },
  { value: 'admin_credit_bonus', label: 'Admin: Bonus (Credit)', icon: <Gift className="w-4 h-4 mr-2 text-purple-400" /> },
  { value: 'admin_debit_adjustment', label: 'Admin: Adjustment (Debit)', icon: <TrendingDown className="w-4 h-4 mr-2 text-red-400" /> },
  { value: 'admin_debit_correction', label: 'Admin: Correction (Debit)', icon: <Edit className="w-4 h-4 mr-2 text-orange-400" /> },
  { value: 'admin_debit_fee', label: 'Admin: Manual Fee (Debit)', icon: <TrendingDown className="w-4 h-4 mr-2 text-red-400" /> },
  { value: 'stream_cost', label: 'Stream Cost (Debit)', icon: <TrendingDown className="w-4 h-4 mr-2 text-red-500" /> },
  { value: 'stream_earning', label: 'Stream Earning (Credit)', icon: <TrendingUp className="w-4 h-4 mr-2 text-green-500" /> },
  { value: 'purchase_coins', label: 'Purchase Coins (Credit)', icon: <TrendingUp className="w-4 h-4 mr-2 text-teal-400" /> },
  { value: 'content_purchase', label: 'Content Purchase (Debit)', icon: <TrendingDown className="w-4 h-4 mr-2 text-pink-500" /> },
  { value: 'content_sale_earning', label: 'Content Sale Earning (Credit)', icon: <TrendingUp className="w-4 h-4 mr-2 text-lime-500" /> },
];

const ManageFundsModal = ({ user, isOpen, onClose, onFundsManaged }) => {
  const { user: adminUser } = useAuth();
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setTransactionType('');
      setDescription('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !amount || !transactionType || !description) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (!adminUser?.id) {
      toast({ title: "Admin session missing", description: "Please re-login.", variant: "destructive" });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
      toast({ title: "Invalid amount", description: "Amount must be a number.", variant: "destructive" });
      return;
    }
    
    // Ensure numericAmount is not zero if your logic requires it
    if (numericAmount === 0) {
        toast({ title: "Invalid amount", description: "Amount cannot be zero.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_adjust_wallet', {
        p_admin_id: adminUser.id,
        p_target_user_id: user.id,
        p_amount: numericAmount,
        p_reason: description
      });

      if (error) throw error;

      const newBalance = Array.isArray(data) && data.length > 0 ? data[0].new_balance : undefined;
      toast({
        title: "Funds Managed Successfully",
        description: `Transaction recorded for ${user.username}.${newBalance !== undefined ? ` New balance: ${newBalance}` : ''}`,
        className: "bg-green-600 text-white"
      });
      // Audit trail (best-effort; ignore failures)
      try {
        await supabase.from('admin_audit_logs').insert({
          admin_user_id: adminUser.id,
          target_user_id: user.id,
          action: 'wallet_adjustment',
          details: { amount: numericAmount, transaction_type: transactionType, description },
        });
      } catch (logErr) {
        console.warn('Audit log skipped', logErr?.message);
      }
      onFundsManaged(); 
      onClose();
    } catch (error) {
      console.error("Error managing funds:", error);
      toast({ title: "Error Managing Funds", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg glass-effect text-white font-montserrat max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="golden-text text-2xl">Manage Funds for: {user.username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div>
            <Label htmlFor="amount" className="text-gray-300">Amount (CrossCoins)</Label>
            <Input
              id="amount"
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 100 to add, -50 to subtract"
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Enter a positive amount to add coins, or a negative amount to subtract coins from the user’s wallet. The Transaction Type is for reporting purposes only.</p>
          </div>
          
          <div>
            <Label htmlFor="transactionType" className="text-gray-300">Transaction Type</Label>
            <Select onValueChange={setTransactionType} value={transactionType} required>
              <SelectTrigger className="w-full bg-black/20 border-white/10 text-white focus:border-yellow-400">
                <SelectValue placeholder="Select transaction type..." />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                {transactionTypeOptions.filter(opt => opt.value.startsWith('admin_')).map(option => (
                  <SelectItem key={option.value} value={option.value} className="hover:bg-neutral-800 focus:bg-neutral-700 flex items-center">
                    {option.icon} {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description" className="text-gray-300">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reason for transaction (e.g., Welcome bonus, Manual correction for issue #123)"
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 min-h-[100px]"
              required
            />
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="golden-gradient text-black font-semibold" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManageFundsModal;
