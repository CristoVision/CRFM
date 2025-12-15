import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import WalletActionModal from '@/components/wallet/WalletActionModal';
import { CreditCard, DollarSign, Activity, Gift, RefreshCw, Loader2, ListChecks, LayoutList as ListCollapse, Download, Printer, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TransactionRow from '@/components/wallet/TransactionRow';
import TransactionFilters from '@/components/wallet/TransactionFilters';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
const ITEMS_PER_PAGE_RECENT = 10;
const ITEMS_PER_PAGE_ALL = 25;
function WalletPage() {
  const {
    user
  } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [viewMode, setViewMode] = useState('recent'); // 'recent' or 'all'
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const initialFilters = {
    searchQuery: '',
    type: '',
    startDate: null,
    endDate: null,
    flow: 'all', // all | credit | debit
  };
  const [filters, setFilters] = useState(initialFilters);
  const [activeFilters, setActiveFilters] = useState(initialFilters);
  const [graphData, setGraphData] = useState([]);
  const [activeAction, setActiveAction] = useState(null);
  const [showUsd, setShowUsd] = useState(false);

  const conversionRate = 0.01; // 1 CC = $0.01 USD (0.5 CC ≈ $0.005 per stream)
  const fetchWalletBalance = useCallback(async () => {
    if (!user) return;
    try {
      const {
        data: profileData,
        error: profileError
      } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single();
      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      if (profileData) {
        setBalance(profileData.wallet_balance || 0);
      } else {
        // This case should ideally not happen if user profile is created on signup
        // For safety, we can attempt to insert, but it might be redundant
        console.warn("Profile not found for balance, attempting to initialize.");
        const {
          error: insertError
        } = await supabase.from('profiles').insert({
          id: user.id,
          wallet_balance: 0
        }).select('wallet_balance').single();
        if (insertError) throw insertError;
        setBalance(0);
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error.message);
      toast({
        title: 'Wallet Balance Error',
        description: 'Could not fetch wallet balance.',
        variant: 'destructive'
      });
    }
  }, [user]);
  const fetchTransactions = useCallback(async (page = 1, mode = viewMode, currentFilters = activeFilters) => {
    if (!user) return;
    setLoadingTransactions(true);
    let query = supabase.from('wallet_transactions').select('id, transaction_type, amount, description, related_track_id, created_at', {
      count: 'exact'
    }).eq('user_id', user.id);
    if (currentFilters.searchQuery) {
      query = query.or(`description.ilike.%${currentFilters.searchQuery}%,transaction_type.ilike.%${currentFilters.searchQuery}%`);
    }
    if (currentFilters.type) {
      query = query.eq('transaction_type', currentFilters.type);
    }
    if (currentFilters.flow === 'credit') {
      query = query.gt('amount', 0);
    } else if (currentFilters.flow === 'debit') {
      query = query.lt('amount', 0);
    }
    if (currentFilters.startDate) {
      query = query.gte('created_at', currentFilters.startDate.toISOString());
    }
    if (currentFilters.endDate) {
      // Add 1 day to endDate to include the whole day
      const endDatePlusOne = new Date(currentFilters.endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      query = query.lte('created_at', endDatePlusOne.toISOString());
    }
    query = query.order('created_at', {
      ascending: false
    });
    const itemsPerPage = mode === 'recent' ? ITEMS_PER_PAGE_RECENT : ITEMS_PER_PAGE_ALL;
    const offset = (page - 1) * itemsPerPage;
    query = query.range(offset, offset + itemsPerPage - 1);
    if (mode === 'recent' && !Object.values(currentFilters).some(f => f)) {
      // Only limit if recent and no filters
      query = query.limit(ITEMS_PER_PAGE_RECENT);
    }
    try {
      const {
        data,
        error,
        count
      } = await query;
      if (error) throw error;
      setTransactions(data || []);
      setTotalTransactions(count || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching transactions:', error.message);
      toast({
        title: 'Transaction Error',
        description: 'Could not fetch transactions.',
        variant: 'destructive'
      });
      setTransactions([]);
      setTotalTransactions(0);
    } finally {
      setLoadingTransactions(false);
      setLoading(false); // Also set main loading to false after first fetch
    }
  }, [user, viewMode, activeFilters]);
  useEffect(() => {
    // build graph data from currently loaded transactions
    const agg = {};
    transactions.forEach((tx) => {
      const day = new Date(tx.created_at);
      const key = day.toISOString().split('T')[0];
      const amt = Number(tx.amount) || 0;
      if (!agg[key]) agg[key] = { day: key, credits: 0, debits: 0 };
      if (amt > 0) agg[key].credits += amt;
      else agg[key].debits += Math.abs(amt);
    });
    const rows = Object.values(agg).sort((a, b) => new Date(a.day) - new Date(b.day));
    setGraphData(rows);
  }, [transactions]);
  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchWalletBalance();
      fetchTransactions(1, 'recent', initialFilters);
    }
  }, [user, fetchWalletBalance, fetchTransactions]);
  const handleApplyFilters = newFilters => {
    setActiveFilters(newFilters);
    setViewMode('all'); // Switch to 'all' mode when filters are applied
    fetchTransactions(1, 'all', newFilters);
  };
  const handleRefresh = () => {
    fetchWalletBalance();
    fetchTransactions(currentPage, viewMode, activeFilters);
  };

  const handleActionSuccess = () => {
    fetchWalletBalance();
    fetchTransactions(1, viewMode, activeFilters);
  };

  const handleActionModalChange = (isOpen) => {
    if (!isOpen) {
      setActiveAction(null);
    }
  };

  const formatBalance = () => {
    if (showUsd) {
      const usd = balance * conversionRate;
      return `$${usd.toFixed(2)}`;
    }
    return `${balance.toLocaleString()} CC`;
  };
  const handleViewModeToggle = () => {
    const newMode = viewMode === 'recent' ? 'all' : 'recent';
    setViewMode(newMode);
    if (newMode === 'recent') {
      // When going back to recent, reset filters and fetch first page of recent
      setFilters(initialFilters);
      setActiveFilters(initialFilters);
      fetchTransactions(1, 'recent', initialFilters);
    } else {
      // When going to 'all', fetch first page of all with current active filters
      fetchTransactions(1, 'all', activeFilters);
    }
  };
  const totalPages = Math.ceil(totalTransactions / (viewMode === 'recent' ? ITEMS_PER_PAGE_RECENT : ITEMS_PER_PAGE_ALL));
  const handlePageChange = newPage => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchTransactions(newPage, viewMode, activeFilters);
    }
  };
  const quickSetFlow = (flowValue) => {
    const nextFilters = { ...activeFilters, flow: flowValue === activeFilters.flow ? 'all' : flowValue };
    setFilters(nextFilters);
    setActiveFilters(nextFilters);
    setViewMode('all');
    fetchTransactions(1, 'all', nextFilters);
  };
  const hasActiveFilters = Object.values(activeFilters).some((v) => v) && !(activeFilters.flow === 'all' && !activeFilters.type && !activeFilters.searchQuery && !activeFilters.startDate && !activeFilters.endDate);

  const exportCsv = () => {
    if (!transactions.length) return;
    const header = ['Date', 'Type', 'Description', 'Amount'];
    const rows = transactions.map((tx) => [
      new Date(tx.created_at).toISOString(),
      tx.transaction_type,
      (tx.description || '').replace(/,/g, ' '),
      Number(tx.amount) || 0,
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const printPage = () => {
    window.print();
  };
  if (loading && !transactions.length) {
    // Show main loader only on initial load
    return <div className="container mx-auto px-4 py-8 text-center page-gradient-bg"> {/* Applied page-gradient-bg here */}
             <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mt-20"></div>
             <p className="text-gray-300 mt-4">Loading Wallet...</p>
          </div>;
  }
  return <>
          <WalletActionModal actionType={activeAction} open={!!activeAction} onOpenChange={handleActionModalChange} balance={balance} userId={user?.id} onSuccess={handleActionSuccess} />
          <div className="container mx-auto px-4 py-8 font-['Montserrat'] page-gradient-bg"> {/* Applied page-gradient-bg here */}
            <div className="text-center mb-12 mt-8">
              <h1 className="text-5xl font-bold mb-4">
                My <span className="golden-text">Wallet</span>
              </h1>
              <p className="text-xl text-gray-300">
                Manage your CrossCoins and view transaction history.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="glass-effect p-8 rounded-xl shadow-xl text-center space-y-3">
                <img src="https://bcrjrlafzqudmdzbcruz.supabase.co/storage/v1/object/public/logo//CrossCoin2025.png" alt="CrossCoin" className="w-20 h-20 mx-auto mb-2" />
                <h2 className="text-2xl text-gray-400">Current Balance</h2>
                <p className="text-5xl font-bold golden-text">{formatBalance()}</p>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-300">
                  <span>Rate: 1 CC = $0.01 USD</span>
                  <Button size="sm" variant="outline" onClick={() => setShowUsd(!showUsd)} className="h-8 text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300">
                    {showUsd ? 'Show CC' : 'Show USD'}
                  </Button>
                </div>
                <p className="text-yellow-400">Cross Coins</p>
              </div>
              <div className="glass-effect p-8 rounded-xl shadow-xl md:col-span-2">
                <h2 className="text-3xl font-bold text-white mb-6">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Button className="golden-gradient text-black font-semibold py-6 text-base hover:opacity-90 transition-opacity" onClick={() => setActiveAction('add_funds')}>
                    <DollarSign className="w-5 h-5 mr-2" /> Add Funds
                  </Button>
                  <Button className="golden-gradient text-black font-semibold py-6 text-base hover:opacity-90 transition-opacity" onClick={() => setActiveAction('withdraw')}>
                    <CreditCard className="w-5 h-5 mr-2" /> Withdraw
                  </Button>
                  <Button className="golden-gradient text-black font-semibold py-6 text-base hover:opacity-90 transition-opacity" onClick={() => setActiveAction('redeem_code')}>
                    <Gift className="w-5 h-5 mr-2" /> Redeem Code
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-6">Top-ups and withdrawals are reviewed before any balance changes. Redeem codes are validated and applied securely on the server.</p>
              </div>
            </div>

            <div className="glass-effect p-6 md:p-8 rounded-xl shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center">
                  <Activity className="w-6 h-6 md:w-7 md:h-7 mr-3 text-yellow-400" />
                  {viewMode === 'recent' && !Object.values(activeFilters).some(f => f) ? 'Recent Activity' : 'Transaction History'}
                </h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={exportCsv} className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300">
                    <Download className="w-4 h-4 mr-2" /> Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={printPage} className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300">
                    <Printer className="w-4 h-4 mr-2" /> Print / PDF
                  </Button>
                  <Button onClick={handleRefresh} variant="ghost" size="icon" className="text-yellow-400 hover:text-yellow-300 hover:bg-white/10">
                    {loadingTransactions ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  </Button>
                </div>
              </div>

              {viewMode === 'all' && <TransactionFilters filters={filters} setFilters={setFilters} onApplyFilters={handleApplyFilters} />}
              
              <div className="flex flex-wrap gap-2 mb-4">
                <Button size="sm" variant={activeFilters.flow === 'all' ? 'default' : 'outline'} onClick={() => quickSetFlow('all')} className={activeFilters.flow === 'all' ? 'golden-gradient text-black' : 'text-white border-white/20'}>
                  All
                </Button>
                <Button size="sm" variant={activeFilters.flow === 'credit' ? 'default' : 'outline'} onClick={() => quickSetFlow('credit')} className={activeFilters.flow === 'credit' ? 'bg-green-500 text-white' : 'text-green-300 border-green-400/40'}>
                  Credits
                </Button>
                <Button size="sm" variant={activeFilters.flow === 'debit' ? 'default' : 'outline'} onClick={() => quickSetFlow('debit')} className={activeFilters.flow === 'debit' ? 'bg-red-500 text-white' : 'text-red-300 border-red-400/40'}>
                  Debits
                </Button>
              </div>
              
              <div className="glass-effect-light p-4 rounded-lg mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <LineChart className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-semibold text-white">Credits vs Debits (current view)</h3>
                </div>
                {graphData.length === 0 ? (
                  <p className="text-sm text-gray-400">No data to plot.</p>
                ) : (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={graphData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                        <YAxis stroke="#9ca3af" fontSize={12} />
                        <Tooltip contentStyle={{ background: '#0b0f1a', border: '1px solid rgba(255,215,0,0.2)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="credits" stroke="#22c55e" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="debits" stroke="#f87171" strokeWidth={2} dot={false} />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {loadingTransactions && transactions.length === 0 ? <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
                </div> : transactions.length > 0 ? (
                  <motion.div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {transactions.map((tx, index) => <motion.div key={tx.id} layout initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} exit={{
            opacity: 0,
            y: -10
          }} transition={{
            duration: 0.3,
            delay: index * 0.05
          }}>
                        <TransactionRow transaction={tx} />
                      </motion.div>)}
                  </AnimatePresence>
                </motion.div>
                ) : <p className="text-gray-400 text-center py-8 text-lg">No transactions found matching your criteria.</p>}

              <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                <Button onClick={handleViewModeToggle} variant="outline" className="w-full sm:w-auto text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300">
                  {viewMode === 'recent' ? <ListChecks className="w-4 h-4 mr-2" /> : <ListCollapse className="w-4 h-4 mr-2" />}
                  {viewMode === 'recent' ? 'See All Transactions' : 'Back to Recent'}
                </Button>

                {viewMode === 'all' && totalTransactions > ITEMS_PER_PAGE_ALL && <div className="flex items-center space-x-2">
                    <Button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loadingTransactions} variant="outline" className="text-white border-white/20 hover:bg-white/10">
                      Previous
                    </Button>
                    <span className="text-gray-400">Page {currentPage} of {totalPages}</span>
                    <Button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || loadingTransactions} variant="outline" className="text-white border-white/20 hover:bg-white/10">
                      Next
                    </Button>
                  </div>}
              </div>
            </div>
          </div>
        </>;
}
export default WalletPage;
