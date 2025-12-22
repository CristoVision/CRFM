import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { BadgeDollarSign, Filter, Package, PlayCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const PRICE_USD_RATE = 0.01;

const formatType = (format = '') => {
  const ext = format.toLowerCase();
  if (ext.includes('mp3') || ext.includes('wav') || ext.includes('flac')) return 'audio';
  if (ext.includes('mp4') || ext.includes('mov') || ext.includes('m4v')) return 'video';
  return 'file';
};

const withinWindow = (product) => {
  const now = new Date();
  if (product.sale_starts_at && new Date(product.sale_starts_at) > now) return false;
  if (product.sale_ends_at && new Date(product.sale_ends_at) < now) return false;
  return true;
};

const MarketplaceTab = ({ searchQuery = '' }) => {
  const { t } = useLanguage();
  const { user, refreshUserProfile } = useAuth();
  const [products, setProducts] = useState([]);
  const [formatsByProduct, setFormatsByProduct] = useState({});
  const [creatorsById, setCreatorsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedFormatByProduct, setSelectedFormatByProduct] = useState({});
  const [purchasePending, setPurchasePending] = useState({});

  useEffect(() => {
    const loadMarketplace = async () => {
      setLoading(true);
      try {
        const { data: productRows, error: productError } = await supabase
          .from('creator_store_products')
          .select('id, creator_id, content_type, content_id, title, description, is_active, is_public, sale_starts_at, sale_ends_at, created_at')
          .eq('is_active', true)
          .eq('is_public', true)
          .order('created_at', { ascending: false });
        if (productError) throw productError;
        const liveProducts = (productRows || []).filter(withinWindow);
        setProducts(liveProducts);

        const ids = liveProducts.map((p) => p.id);
        const creatorIds = [...new Set(liveProducts.map((p) => p.creator_id))];

        const [{ data: formatRows, error: formatError }, { data: creatorRows, error: creatorError }] = await Promise.all([
          supabase
            .from('creator_store_formats')
            .select('id, product_id, format, price_cc, is_active, file_bucket, file_path')
            .in('product_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
            .eq('is_active', true),
          supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', creatorIds.length ? creatorIds : ['00000000-0000-0000-0000-000000000000']),
        ]);
        if (formatError) throw formatError;
        if (creatorError) throw creatorError;

        const byProduct = {};
        (formatRows || []).forEach((row) => {
          byProduct[row.product_id] = byProduct[row.product_id] || [];
          byProduct[row.product_id].push(row);
        });
        setFormatsByProduct(byProduct);

        const byCreator = {};
        (creatorRows || []).forEach((row) => {
          byCreator[row.id] = row;
        });
        setCreatorsById(byCreator);
      } catch (error) {
        toast({ title: 'Marketplace error', description: error.message, variant: 'destructive' });
        setProducts([]);
        setFormatsByProduct({});
        setCreatorsById({});
      } finally {
        setLoading(false);
      }
    };
    loadMarketplace();
  }, []);

  useEffect(() => {
    if (!products.length) return;
    setSelectedFormatByProduct((prev) => {
      const next = { ...prev };
      products.forEach((product) => {
        if (next[product.id]) return;
        const formats = formatsByProduct[product.id] || [];
        if (!formats.length) return;
        const sorted = [...formats].sort((a, b) => Number(a.price_cc) - Number(b.price_cc));
        next[product.id] = sorted[0]?.id;
      });
      return next;
    });
  }, [products, formatsByProduct]);

  const handlePurchase = async (productId) => {
    if (!user?.id) {
      toast({ title: t('marketplace.loginRequired'), description: t('marketplace.loginRequiredBody'), variant: 'destructive' });
      return;
    }
    const formatId = selectedFormatByProduct[productId];
    if (!formatId) {
      toast({ title: t('marketplace.selectFormat'), description: t('marketplace.selectFormatBody'), variant: 'destructive' });
      return;
    }
    setPurchasePending((prev) => ({ ...prev, [productId]: true }));
    try {
      const { data, error } = await supabase.rpc('purchase_creator_store_item', {
        p_format_id: formatId,
        p_quantity: 1,
      });
      if (error || !data?.ok) {
        throw new Error(error?.message || data?.reason || 'Purchase failed.');
      }
      toast({
        title: t('marketplace.buySuccessTitle'),
        description: t('marketplace.buySuccessBody', { total: data.total_cc, fee: data.fee_cc }),
      });
      await refreshUserProfile?.();
    } catch (purchaseError) {
      toast({
        title: t('marketplace.buyErrorTitle'),
        description: purchaseError.message || t('marketplace.buyErrorBody'),
        variant: 'destructive',
      });
    } finally {
      setPurchasePending((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const creatorOptions = useMemo(() => {
    const list = Object.values(creatorsById);
    return list.sort((a, b) => (a.display_name || a.username || '').localeCompare(b.display_name || b.username || ''));
  }, [creatorsById]);

  const filtered = useMemo(() => {
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    return products
      .filter((product) => {
        const query = searchQuery.toLowerCase();
        return (
          !query ||
          (product.title || '').toLowerCase().includes(query) ||
          (product.description || '').toLowerCase().includes(query)
        );
      })
      .filter((product) => (creatorFilter === 'all' ? true : product.creator_id === creatorFilter))
      .filter((product) => {
        const formats = formatsByProduct[product.id] || [];
        if (!formats.length) return false;
        if (typeFilter === 'all') return true;
        return formats.some((f) => formatType(f.format) === typeFilter);
      })
      .filter((product) => {
        if (!min && !max) return true;
        const formats = formatsByProduct[product.id] || [];
        const prices = formats.map((f) => Number(f.price_cc));
        if (!prices.length) return false;
        const minPriceCc = Math.min(...prices);
        if (min !== null && minPriceCc < min) return false;
        if (max !== null && minPriceCc > max) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        return new Date(a.created_at) - new Date(b.created_at);
      });
  }, [products, formatsByProduct, creatorFilter, typeFilter, minPrice, maxPrice, sortOrder, searchQuery]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-effect p-4 rounded-xl border border-white/10">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-yellow-300 font-semibold">
            <Filter className="w-4 h-4" />
            <span>{t('marketplace.filtersTitle')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('marketplace.filters.all')}</SelectItem>
                <SelectItem value="audio">{t('marketplace.filters.audio')}</SelectItem>
                <SelectItem value="video">{t('marketplace.filters.video')}</SelectItem>
                <SelectItem value="file">{t('marketplace.filters.file')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white">
                <SelectValue placeholder="Creador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('marketplace.filters.all')}</SelectItem>
                {creatorOptions.map((creator) => (
                  <SelectItem key={creator.id} value={creator.id}>
                    {creator.display_name || creator.username || creator.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder={t('marketplace.filters.min')}
              className="bg-black/30 border-white/10 text-white"
            />
            <Input
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder={t('marketplace.filters.max')}
              className="bg-black/30 border-white/10 text-white"
            />
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white">
                <SelectValue placeholder="Orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('marketplace.filters.newest')}</SelectItem>
                <SelectItem value="oldest">{t('marketplace.filters.oldest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p>{t('marketplace.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((product) => {
            const formats = formatsByProduct[product.id] || [];
            const prices = formats.map((f) => Number(f.price_cc));
            const minPriceCc = prices.length ? Math.min(...prices) : null;
            const creator = creatorsById[product.creator_id];
            const creatorName = creator?.display_name || creator?.username || 'Creador';
            const formatLabel = formats.map((f) => f.format).join(', ');
            const selectedFormatId = selectedFormatByProduct[product.id];
            const selectedFormat = formats.find((f) => f.id === selectedFormatId);
            const detailHref =
              product.content_type === 'track'
                ? `/track/${product.content_id}`
                : product.content_type === 'album'
                ? `/album/${product.content_id}`
                : `/video/${product.content_id}`;
            return (
              <div key={product.id} className="glass-effect-light p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
                <div>
                  <div className="text-xs text-yellow-300 uppercase tracking-wide">{product.content_type}</div>
                  <h3 className="text-lg font-semibold text-white">{product.title}</h3>
                  <p className="text-sm text-gray-400 line-clamp-3">{product.description || t('marketplace.noDescription')}</p>
                </div>
                <div className="text-xs text-gray-400">{t('marketplace.creatorLabel')} {creatorName}</div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <BadgeDollarSign className="w-4 h-4 text-yellow-300" />
                  {minPriceCc !== null ? (
                    <span>
                      {minPriceCc} CC · ${(minPriceCc * PRICE_USD_RATE).toFixed(2)} USD
                    </span>
                  ) : (
                    <span>{t('marketplace.pricePending')}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">{t('marketplace.formatsLabel')} {formatLabel || '—'}</div>
                {formats.length ? (
                  <Select
                    value={selectedFormatId || ''}
                    onValueChange={(value) =>
                      setSelectedFormatByProduct((prev) => ({ ...prev, [product.id]: value }))
                    }
                  >
                    <SelectTrigger className="bg-black/30 border-white/10 text-white">
                      <SelectValue placeholder={t('marketplace.formatPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {formats.map((format) => (
                        <SelectItem key={format.id} value={format.id}>
                          {format.format} · {format.price_cc} CC
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <div className="flex flex-wrap gap-2 mt-auto">
                  <Button asChild variant="outline" className="border-white/10 text-white hover:text-yellow-300">
                    <a href={detailHref}>{t('marketplace.viewDetails')}</a>
                  </Button>
                  <Button
                    onClick={() => handlePurchase(product.id)}
                    disabled={purchasePending[product.id] || !selectedFormat}
                    className="golden-gradient text-black font-semibold"
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    {purchasePending[product.id] ? t('marketplace.buying') : t('marketplace.buy')}
                  </Button>
                  {selectedFormat ? (
                    <div className="text-xs text-gray-400 self-center">
                      {t('marketplace.selectedFormat', {
                        format: selectedFormat.format,
                        price: selectedFormat.price_cc,
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarketplaceTab;
