import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

const transactionTypeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'top-up', label: 'Top-Up' },
  { value: 'reward', label: 'Reward' },
  { value: 'refund', label: 'Refund' },
  { value: 'manual_credit', label: 'Manual Credit' },
  { value: 'interest', label: 'Interest' },
  { value: 'stream_purchase', label: 'Stream Purchase' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'fee', label: 'Fee' },
  { value: 'manual_debit', label: 'Manual Debit' },
  { value: 'other', label: 'Other' },
];

const TransactionFilters = ({ filters, setFilters, onApplyFilters }) => {
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
          placeholder="Search descriptions, types..."
          value={filters.searchQuery}
          onChange={handleInputChange}
          className="bg-white/5 border-white/10 placeholder-gray-400 text-white focus:border-yellow-400"
        />
        <Select value={filters.type || 'all'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus:border-yellow-400">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
            {transactionTypeOptions.map(option => (
              <SelectItem key={option.value} value={option.value} className="hover:bg-neutral-800 focus:bg-neutral-700">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePicker
          date={filters.startDate}
          setDate={(date) => handleDateChange('startDate', date)}
          placeholder="Start Date"
          className="bg-white/5 border-white/10 text-white focus:border-yellow-400"
        />
        <DatePicker
          date={filters.endDate}
          setDate={(date) => handleDateChange('endDate', date)}
          placeholder="End Date"
          className="bg-white/5 border-white/10 text-white focus:border-yellow-400"
        />
        <Select value={filters.flow || 'all'} onValueChange={(val) => setFilters(prev => ({ ...prev, flow: val }))}>
          <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus:border-yellow-400">
            <SelectValue placeholder="Flow" />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
            <SelectItem value="all" className="hover:bg-neutral-800 focus:bg-neutral-700">All Flows</SelectItem>
            <SelectItem value="credit" className="hover:bg-neutral-800 focus:bg-neutral-700">Credits</SelectItem>
            <SelectItem value="debit" className="hover:bg-neutral-800 focus:bg-neutral-700">Debits</SelectItem>
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
            Reset Filters
          </Button>
        )}
        <Button 
          onClick={() => onApplyFilters(filters)} 
          className="w-full sm:w-auto golden-gradient text-black font-semibold"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
};

export default TransactionFilters;
