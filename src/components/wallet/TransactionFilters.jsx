import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const transactionTypeOptions = [
  'all',
  'deposit',
  'top-up',
  'reward',
  'refund',
  'manual_credit',
  'interest',
  'stream_purchase',
  'store_purchase',
  'store_sale',
  'withdrawal',
  'fee',
  'manual_debit',
  'other',
];

const TransactionFilters = ({ filters, setFilters, onApplyFilters }) => {
  const { t } = useLanguage();
  const handleInputChange = (e) => {
    setFilters(prev => ({ ...prev, searchQuery: e.target.value }));
  };

  const handleTypeChange = (value) => {
    setFilters(prev => ({ ...prev, type: value === 'all' ? '' : value }));
  };

  const handleDateChange = (field, date) => {
    setFilters(prev => ({ ...prev, [field]: date }));
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      type: '',
      startDate: null,
      endDate: null,
      flow: 'all',
    });
    onApplyFilters({ searchQuery: '', type: '', startDate: null, endDate: null, flow: 'all' });
  };
  
  const hasActiveFilters = filters.searchQuery || filters.type || filters.startDate || filters.endDate || (filters.flow && filters.flow !== 'all');

  return (
    <div className="p-4 md:p-6 mb-6 bg-black/30 rounded-xl border border-white/10 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <Input
          type="text"
          placeholder={t('wallet.filters.searchPlaceholder')}
          value={filters.searchQuery}
          onChange={handleInputChange}
          className="bg-white/5 border-white/10 placeholder-gray-400 text-white focus:border-yellow-400"
        />
        <Select value={filters.type || 'all'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus:border-yellow-400">
            <SelectValue placeholder={t('wallet.filters.filterByType')} />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
            {transactionTypeOptions.map(option => (
              <SelectItem key={option} value={option} className="hover:bg-neutral-800 focus:bg-neutral-700">
                {option === 'all'
                  ? t('wallet.transactionTypes.all')
                  : t(
                      `wallet.transactionTypes.${
                        option === 'top-up'
                          ? 'topUp'
                          : option === 'manual_credit'
                          ? 'manualCredit'
                          : option === 'stream_purchase'
                          ? 'streamPurchase'
                          : option === 'store_purchase'
                          ? 'storePurchase'
                          : option === 'store_sale'
                          ? 'storeSale'
                          : option === 'manual_debit'
                          ? 'manualDebit'
                          : option
                      }`
                    )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePicker
          date={filters.startDate}
          setDate={(date) => handleDateChange('startDate', date)}
          placeholder={t('wallet.filters.startDate')}
          className="bg-white/5 border-white/10 text-white focus:border-yellow-400"
        />
        <DatePicker
          date={filters.endDate}
          setDate={(date) => handleDateChange('endDate', date)}
          placeholder={t('wallet.filters.endDate')}
          className="bg-white/5 border-white/10 text-white focus:border-yellow-400"
        />
        <Select value={filters.flow || 'all'} onValueChange={(val) => setFilters(prev => ({ ...prev, flow: val }))}>
          <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus:border-yellow-400">
            <SelectValue placeholder={t('wallet.filters.flow')} />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
            <SelectItem value="all" className="hover:bg-neutral-800 focus:bg-neutral-700">{t('wallet.filters.allFlows')}</SelectItem>
            <SelectItem value="credit" className="hover:bg-neutral-800 focus:bg-neutral-700">{t('wallet.flowCredits')}</SelectItem>
            <SelectItem value="debit" className="hover:bg-neutral-800 focus:bg-neutral-700">{t('wallet.flowDebits')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={handleResetFilters}
            className="w-full sm:w-auto text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300"
          >
            <X className="w-4 h-4 mr-2" />
            {t('wallet.filters.resetFilters')}
          </Button>
        )}
        <Button 
          onClick={() => onApplyFilters(filters)} 
          className="w-full sm:w-auto golden-gradient text-black font-semibold"
        >
          {t('wallet.filters.applyFilters')}
        </Button>
      </div>
    </div>
  );
};

export default TransactionFilters;
