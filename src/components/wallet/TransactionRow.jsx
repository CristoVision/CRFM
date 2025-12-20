import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightCircle, TrendingUp, TrendingDown, Gift, ShoppingCart, Award } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const formatUsdCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return null;
  return `$${(n / 100).toFixed(2)}`;
};

const TransactionRow = ({ transaction }) => {
  const { t, language } = useLanguage();
  const { id, transaction_type, amount, description, related_track_id, created_at, details } = transaction;

  const formattedDate = new Date(created_at).toLocaleString(language === 'es' ? 'es-ES' : 'en-US');
  const numericAmount = Number(amount) || 0;
  const isCredit = numericAmount > 0;
  const displayAmount = Math.abs(numericAmount);

  const usdPaid = details?.amount_usd_cents != null ? formatUsdCents(details.amount_usd_cents) : null;
  const usdFee = details?.fee_usd_cents != null ? formatUsdCents(details.fee_usd_cents) : null;
  const usdNet = details?.net_usd_cents != null ? formatUsdCents(details.net_usd_cents) : null;
  const showStripeBreakdown = details?.kind === 'stripe_topup' && (usdPaid || usdFee || usdNet);
  
  const typeDisplay = {
    'deposit': { text: t('wallet.transactionTypes.deposit'), icon: <TrendingUp className="w-4 h-4 mr-2 text-green-400" />, color: 'text-green-400' },
    'top-up': { text: t('wallet.transactionTypes.topUp'), icon: <TrendingUp className="w-4 h-4 mr-2 text-green-400" />, color: 'text-green-400' },
    'reward': { text: t('wallet.transactionTypes.reward'), icon: <Award className="w-4 h-4 mr-2 text-yellow-400" />, color: 'text-yellow-400' },
    'refund': { text: t('wallet.transactionTypes.refund'), icon: <TrendingUp className="w-4 h-4 mr-2 text-green-400" />, color: 'text-green-400' },
    'manual_credit': { text: t('wallet.transactionTypes.manualCredit'), icon: <Gift className="w-4 h-4 mr-2 text-blue-400" />, color: 'text-blue-400' },
    'interest': { text: t('wallet.transactionTypes.interest'), icon: <TrendingUp className="w-4 h-4 mr-2 text-green-400" />, color: 'text-green-400' },
    'stream_purchase': { text: t('wallet.transactionTypes.streamPurchase'), icon: <ShoppingCart className="w-4 h-4 mr-2 text-red-400" />, color: 'text-red-400' },
    'withdrawal': { text: t('wallet.transactionTypes.withdrawal'), icon: <TrendingDown className="w-4 h-4 mr-2 text-red-400" />, color: 'text-red-400' },
    'fee': { text: t('wallet.transactionTypes.fee'), icon: <TrendingDown className="w-4 h-4 mr-2 text-orange-400" />, color: 'text-orange-400' },
    'manual_debit': { text: t('wallet.transactionTypes.manualDebit'), icon: <TrendingDown className="w-4 h-4 mr-2 text-red-400" />, color: 'text-red-400' },
    'other': { text: t('wallet.transactionTypes.other'), icon: <ArrowRightCircle className="w-4 h-4 mr-2 text-gray-400" />, color: 'text-gray-400' },
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
              ({t('wallet.transactionRow.viewTrack')})
            </Link>
          )}
        </p>
        {showStripeBreakdown && (
          <p className="text-xs text-gray-400 mt-1">
            {usdPaid ? `${t('wallet.transactionRow.paid')} ${usdPaid}` : null}
            {usdFee ? `${usdPaid ? ' · ' : ''}${t('wallet.transactionRow.stripeFee')} ${usdFee}` : null}
            {usdNet ? `${usdPaid || usdFee ? ' · ' : ''}${t('wallet.transactionRow.net')} ${usdNet}` : null}
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
