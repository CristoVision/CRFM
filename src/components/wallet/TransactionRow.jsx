import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRightCircle, TrendingUp, TrendingDown, Gift, ShoppingCart, Award } from 'lucide-react';

const formatUsdCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return null;
  return `$${(n / 100).toFixed(2)}`;
};

const TransactionRow = ({ transaction }) => {
  const { id, transaction_type, amount, description, related_track_id, created_at, details } = transaction;

  const formattedDate = format(new Date(created_at), 'MMM dd, yyyy - HH:mm');
  const numericAmount = Number(amount) || 0;
  const isCredit = numericAmount > 0;
  const displayAmount = Math.abs(numericAmount);

  const usdPaid = details?.amount_usd_cents != null ? formatUsdCents(details.amount_usd_cents) : null;
  const usdFee = details?.fee_usd_cents != null ? formatUsdCents(details.fee_usd_cents) : null;
  const usdNet = details?.net_usd_cents != null ? formatUsdCents(details.net_usd_cents) : null;
  const showStripeBreakdown = details?.kind === 'stripe_topup' && (usdPaid || usdFee || usdNet);
  
  const typeDisplay = {
    'deposit': { text: 'Deposit', icon: <TrendingUp className="w-4 h-4 mr-2 text-green-400" />, color: 'text-green-400' },
    'top-up': { text: 'Top-Up', icon: <TrendingUp className="w-4 h-4 mr-2 text-green-400" />, color: 'text-green-400' },
    'reward': { text: 'Reward', icon: <Award className="w-4 h-4 mr-2 text-yellow-400" />, color: 'text-yellow-400' },
    'refund': { text: 'Refund', icon: <TrendingUp className="w-4 h-4 mr-2 text-green-400" />, color: 'text-green-400' },
    'manual_credit': { text: 'Manual Credit', icon: <Gift className="w-4 h-4 mr-2 text-blue-400" />, color: 'text-blue-400' },
    'interest': { text: 'Interest', icon: <TrendingUp className="w-4 h-4 mr-2 text-green-400" />, color: 'text-green-400' },
    'stream_purchase': { text: 'Stream Purchase', icon: <ShoppingCart className="w-4 h-4 mr-2 text-red-400" />, color: 'text-red-400' },
    'withdrawal': { text: 'Withdrawal', icon: <TrendingDown className="w-4 h-4 mr-2 text-red-400" />, color: 'text-red-400' },
    'fee': { text: 'Fee', icon: <TrendingDown className="w-4 h-4 mr-2 text-orange-400" />, color: 'text-orange-400' },
    'manual_debit': { text: 'Manual Debit', icon: <TrendingDown className="w-4 h-4 mr-2 text-red-400" />, color: 'text-red-400' },
    'other': { text: 'Other', icon: <ArrowRightCircle className="w-4 h-4 mr-2 text-gray-400" />, color: 'text-gray-400' },
  };

  const displayInfo = typeDisplay[transaction_type.toLowerCase()] || typeDisplay['other'];

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-black/20 hover:bg-white/5 rounded-lg transition-colors duration-200">
      <div className="flex-1 mb-2 sm:mb-0">
        <div className={`flex items-center font-semibold ${displayInfo.color} mb-1`}>
          {displayInfo.icon}
          <span>{displayInfo.text}</span>
        </div>
        <p className="text-sm text-gray-300 truncate max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl">
          {description}
          {related_track_id && (
            <Link to={`/track/${related_track_id}`} className="ml-2 text-yellow-400 hover:text-yellow-300 underline text-xs">
              (View Track)
            </Link>
          )}
        </p>
        {showStripeBreakdown && (
          <p className="text-xs text-gray-400 mt-1">
            {usdPaid ? `Paid ${usdPaid}` : null}
            {usdFee ? `${usdPaid ? ' · ' : ''}Stripe fee ${usdFee}` : null}
            {usdNet ? `${usdPaid || usdFee ? ' · ' : ''}Net ${usdNet}` : null}
          </p>
        )}
      </div>
      <div className="text-left sm:text-right w-full sm:w-auto">
        <p className={`text-lg font-bold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
          {isCredit ? '+' : '-'}{displayAmount.toLocaleString()} CC
        </p>
        <p className="text-xs text-gray-500">{formattedDate}</p>
      </div>
    </div>
  );
};

export default TransactionRow;
