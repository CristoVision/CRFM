import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { uploadPrivateFileToSupabase } from '@/components/formUtils';
import { Loader2, ShoppingBag, PlusCircle, UploadCloud, Percent } from 'lucide-react';

const DEFAULT_PRODUCT_FORM = {
  content_type: 'track',
  content_id: '',
  title: '',
  description: '',
  license_text: '',
  artist_message: '',
  sale_starts_at: '',
  sale_ends_at: '',
  is_active: true,
};

const DEFAULT_FORMAT_FORM = {
  format: 'mp3',
  price_cc: '',
  entitlement_duration_days: '',
  file: null,
  uploading: false,
};

const DEFAULT_CODE_FORM = {
  code: '',
  discount_percent: '10',
  expires_at: '',
  max_uses: '100',
  max_uses_per_user: '1',
  product_id: '__any__',
  format_id: '__any__',
  is_active: true,
};

const toIsoOrNull = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed ? new Date(trimmed).toISOString() : null;
};

const CreatorDownloadsManager = () => {
  const { user, profile } = useAuth();
  const isCreator = useMemo(() => !!profile?.is_verified_creator, [profile?.is_verified_creator]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState([]);
  const [formatsByProduct, setFormatsByProduct] = useState({});
  const [codes, setCodes] = useState([]);

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productForm, setProductForm] = useState(DEFAULT_PRODUCT_FORM);

  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [activeProductForFormat, setActiveProductForFormat] = useState(null);
  const [formatForm, setFormatForm] = useState(DEFAULT_FORMAT_FORM);

  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [codeForm, setCodeForm] = useState(DEFAULT_CODE_FORM);

  const [contentOptions, setContentOptions] = useState({ track: [], album: [], video: [] });

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [{ data: productRows, error: productError }, { data: codeRows, error: codeError }] = await Promise.all([
        supabase
          .from('creator_store_products')
          .select('id, creator_id, content_type, content_id, title, description, license_text, artist_message, is_active, sale_starts_at, sale_ends_at, created_at, updated_at')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('creator_store_discount_codes')
          .select('code, creator_id, discount_percent, product_id, format_id, expires_at, max_uses, usage_count, max_uses_per_user, is_active, created_at, updated_at')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (productError && productError.code !== 'PGRST116') throw productError;
      if (codeError && codeError.code !== 'PGRST116') throw codeError;

      const nextProducts = productRows || [];
      setProducts(nextProducts);
      setCodes(codeRows || []);

      const formatFetches = await Promise.all(
        nextProducts.map((p) =>
          supabase
            .from('creator_store_formats')
            .select('id, product_id, format, price_cc, entitlement_duration_days, is_active, file_bucket, file_path, created_at, updated_at')
            .eq('product_id', p.id)
            .order('created_at', { ascending: false })
        )
      );

      const byProduct = {};
      formatFetches.forEach((res) => {
        const rows = res.data || [];
        rows.forEach((r) => {
          byProduct[r.product_id] = byProduct[r.product_id] || [];
        });
        rows.forEach((r) => byProduct[r.product_id].push(r));
      });
      setFormatsByProduct(byProduct);
    } catch (error) {
      toast({ title: 'Could not load store', description: error.message || 'Try again.', variant: 'destructive' });
      setProducts([]);
      setFormatsByProduct({});
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadContentOptions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [tracks, albums, videos] = await Promise.all([
        supabase.from('tracks').select('id, title, created_at').eq('uploader_id', user.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('albums').select('id, title, created_at').eq('uploader_id', user.id).order('created_at', { ascending: false }).limit(200),
        supabase
          .from('videos')
          .select('id, title, created_at')
          .eq('uploader_id', user.id)
          .eq('video_type', 'music_video')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      setContentOptions({
        track: tracks.data || [],
        album: albums.data || [],
        video: videos.data || [],
      });
    } catch {
      setContentOptions({ track: [], album: [], video: [] });
    }
  }, [user?.id]);

  useEffect(() => {
    load();
    loadContentOptions();
  }, [load, loadContentOptions]);

  const closeProductDialog = () => {
    if (saving) return;
    setProductDialogOpen(false);
    setProductForm(DEFAULT_PRODUCT_FORM);
  };

  const openCreateProduct = () => {
    setProductForm(DEFAULT_PRODUCT_FORM);
    setProductDialogOpen(true);
  };

  const openEditProduct = (p) => {
    setProductForm({
      content_type: p.content_type,
      content_id: p.content_id,
      title: p.title || '',
      description: p.description || '',
      license_text: p.license_text || '',
      artist_message: p.artist_message || '',
      sale_starts_at: p.sale_starts_at ? new Date(p.sale_starts_at).toISOString().slice(0, 16) : '',
      sale_ends_at: p.sale_ends_at ? new Date(p.sale_ends_at).toISOString().slice(0, 16) : '',
      is_active: !!p.is_active,
      id: p.id,
    });
    setProductDialogOpen(true);
  };

  const saveProduct = async () => {
    if (!user?.id) return;
    if (!productForm.content_id) {
      toast({ title: 'Missing content', description: 'Select the track/album/video to sell.', variant: 'destructive' });
      return;
    }
    if (!String(productForm.title || '').trim()) {
      toast({ title: 'Missing title', description: 'Enter a product title.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        creator_id: user.id,
        content_type: productForm.content_type,
        content_id: productForm.content_id,
        title: String(productForm.title).trim(),
        description: String(productForm.description || '').trim() || null,
        license_text: String(productForm.license_text || '').trim() || null,
        artist_message: String(productForm.artist_message || '').trim() || null,
        sale_starts_at: toIsoOrNull(productForm.sale_starts_at),
        sale_ends_at: toIsoOrNull(productForm.sale_ends_at),
        is_active: !!productForm.is_active,
        updated_at: new Date().toISOString(),
      };

      if (productForm.id) {
        const { error } = await supabase.from('creator_store_products').update(payload).eq('id', productForm.id).eq('creator_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('creator_store_products').insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Product saved', description: 'Your download product is ready. Add formats to sell.', className: 'bg-green-600 text-white' });
      closeProductDialog();
      load();
    } catch (error) {
      toast({ title: 'Could not save product', description: error.message || 'Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openAddFormat = (product) => {
    setActiveProductForFormat(product);
    setFormatForm(DEFAULT_FORMAT_FORM);
    setFormatDialogOpen(true);
  };

  const closeFormatDialog = () => {
    if (saving) return;
    setFormatDialogOpen(false);
    setActiveProductForFormat(null);
    setFormatForm(DEFAULT_FORMAT_FORM);
  };

  const saveFormat = async () => {
    if (!user?.id || !activeProductForFormat?.id) return;
    const price = Number(formatForm.price_cc);
    if (!Number.isFinite(price) || price < 0) {
      toast({ title: 'Invalid price', description: 'Enter a valid CC price (>= 0).', variant: 'destructive' });
      return;
    }
    if (!formatForm.file) {
      toast({ title: 'Missing file', description: 'Upload the downloadable file (mp3/wav/mp4/etc).', variant: 'destructive' });
      return;
    }

    setSaving(true);
    setFormatForm((prev) => ({ ...prev, uploading: true }));
    try {
      const uploaded = await uploadPrivateFileToSupabase(formatForm.file, 'downloads', user.id, { prefix: `store/${activeProductForFormat.id}` });

      const durationDays = String(formatForm.entitlement_duration_days || '').trim();
      const payload = {
        product_id: activeProductForFormat.id,
        format: String(formatForm.format || '').trim().toLowerCase(),
        price_cc: price,
        entitlement_duration_days: durationDays ? Number(durationDays) : null,
        is_active: true,
        file_bucket: uploaded.bucket,
        file_path: uploaded.path,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('creator_store_formats').insert(payload);
      if (error) throw error;

      toast({ title: 'Format added', description: 'Format is now available for purchase.', className: 'bg-green-600 text-white' });
      closeFormatDialog();
      load();
    } catch (error) {
      toast({ title: 'Could not add format', description: error.message || 'Try again.', variant: 'destructive' });
    } finally {
      setFormatForm((prev) => ({ ...prev, uploading: false, file: null }));
      setSaving(false);
    }
  };

  const openCreateCode = () => {
    setCodeForm(DEFAULT_CODE_FORM);
    setCodeDialogOpen(true);
  };

  const closeCodeDialog = () => {
    if (saving) return;
    setCodeDialogOpen(false);
    setCodeForm(DEFAULT_CODE_FORM);
  };

  const saveCode = async () => {
    if (!user?.id) return;
    const code = String(codeForm.code || '').trim().toUpperCase();
    const percent = Number(codeForm.discount_percent);
    const maxUses = Number(codeForm.max_uses);
    const maxPerUser = Number(codeForm.max_uses_per_user);

    if (!code || code.length < 4) {
      toast({ title: 'Invalid code', description: 'Enter a code (min 4 chars).', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      toast({ title: 'Invalid percent', description: 'Discount must be 1–100.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(maxUses) || maxUses <= 0) {
      toast({ title: 'Invalid max uses', description: 'Max uses must be > 0.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(maxPerUser) || maxPerUser <= 0) {
      toast({ title: 'Invalid per-user limit', description: 'Max uses per user must be > 0.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code,
        creator_id: user.id,
        discount_percent: Number(percent.toFixed(2)),
        product_id: codeForm.product_id === '__any__' ? null : codeForm.product_id,
        format_id: codeForm.format_id === '__any__' ? null : codeForm.format_id,
        expires_at: toIsoOrNull(codeForm.expires_at),
        max_uses: maxUses,
        max_uses_per_user: maxPerUser,
        is_active: !!codeForm.is_active,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('creator_store_discount_codes').upsert(payload, { onConflict: 'code' });
      if (error) throw error;

      toast({ title: 'Code saved', description: `${code} is ready to share.`, className: 'bg-green-600 text-white' });
      closeCodeDialog();
      load();
    } catch (error) {
      toast({ title: 'Could not save code', description: error.message || 'Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="glass-effect p-6 rounded-xl border border-white/10 text-gray-300">Sign in to manage downloads.</div>;
  }
  if (!isCreator) {
    return <div className="glass-effect p-6 rounded-xl border border-white/10 text-gray-300">Digital downloads are available for verified creators only.</div>;
  }

  return (
    <>
      <div className="glass-effect p-4 sm:p-6 rounded-xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Digital Downloads Store</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={openCreateCode} variant="outline" className="bg-white/10 border-white/20 text-gray-200 hover:bg-white/20 hover:text-yellow-300">
              <Percent className="w-4 h-4 mr-2" />
              Discount Codes
            </Button>
            <Button onClick={openCreateProduct} className="golden-gradient text-black font-semibold">
              <PlusCircle className="w-4 h-4 mr-2" />
              New Product
            </Button>
          </div>
        </div>

        <div className="text-sm text-gray-300">
          Upload private downloadable files (mp3/wav/mp4) to the <code>downloads</code> bucket and price them in CC. Purchases generate entitlements and billing events for analytics.
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
            <span>Loading store…</span>
          </div>
        ) : products.length ? (
          <div className="space-y-3">
            {products.map((p) => {
              const formats = formatsByProduct[p.id] || [];
              return (
                <div key={p.id} className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-white font-semibold truncate">{p.title}</div>
                        {p.is_active ? <Badge className="bg-green-500/20 text-green-200">Active</Badge> : <Badge className="bg-gray-500/20 text-gray-200">Inactive</Badge>}
                        <Badge className="bg-white/10 text-gray-200">{p.content_type}</Badge>
                      </div>
                      {p.description ? <div className="text-sm text-gray-300 mt-1">{p.description}</div> : null}
                      <div className="text-xs text-gray-400 mt-1">
                        {p.sale_starts_at ? `Starts: ${new Date(p.sale_starts_at).toLocaleString()}` : 'Starts: anytime'} •{' '}
                        {p.sale_ends_at ? `Ends: ${new Date(p.sale_ends_at).toLocaleString()}` : 'Ends: never'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => openEditProduct(p)} className="bg-white/10 border-white/20 text-gray-200 hover:bg-white/20 hover:text-yellow-300">
                        Edit
                      </Button>
                      <Button onClick={() => openAddFormat(p)} className="golden-gradient text-black font-semibold">
                        <UploadCloud className="w-4 h-4 mr-2" />
                        Add Format
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 overflow-hidden">
                    <div className="px-3 py-2 text-xs text-gray-400 bg-black/20">Formats</div>
                    {formats.length ? (
                      <div className="divide-y divide-white/10">
                        {formats.map((f) => (
                          <div key={f.id} className="px-3 py-2 flex items-center justify-between gap-3">
                            <div className="text-sm text-gray-200">
                              <span className="text-white font-semibold">{String(f.format).toUpperCase()}</span> • {Number(f.price_cc || 0).toLocaleString()} CC
                              {f.entitlement_duration_days ? <span className="text-gray-400"> • expires after {f.entitlement_duration_days}d</span> : <span className="text-gray-400"> • permanent</span>}
                            </div>
                            <Badge className="bg-white/10 text-gray-200">{f.is_active ? 'Active' : 'Inactive'}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-3 text-sm text-gray-400">No formats yet. Add at least one file/format to sell.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No download products yet. Create one and add formats.</div>
        )}
      </div>

      <Dialog open={productDialogOpen} onOpenChange={(v) => (v ? null : closeProductDialog())}>
        <DialogContent className="sm:max-w-3xl glass-effect text-white font-montserrat">
          <DialogHeader className="space-y-2">
            <DialogTitle className="golden-text text-2xl">{productForm.id ? 'Edit Product' : 'Create Download Product'}</DialogTitle>
            <DialogDescription className="text-gray-300">Pick a piece of content and configure how long it stays on sale.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Content type</Label>
                <Select value={productForm.content_type} onValueChange={(v) => setProductForm((prev) => ({ ...prev, content_type: v, content_id: '' }))}>
                  <SelectTrigger className="w-full bg-black/20 border-white/10 text-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                    <SelectItem value="track" className="hover:bg-neutral-800 focus:bg-neutral-700">Track</SelectItem>
                    <SelectItem value="album" className="hover:bg-neutral-800 focus:bg-neutral-700">Album</SelectItem>
                    <SelectItem value="video" className="hover:bg-neutral-800 focus:bg-neutral-700">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Content</Label>
                <Select value={productForm.content_id || '__none__'} onValueChange={(v) => setProductForm((prev) => ({ ...prev, content_id: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="w-full bg-black/20 border-white/10 text-white">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                    <SelectItem value="__none__" className="hover:bg-neutral-800 focus:bg-neutral-700">(Select…)</SelectItem>
                    {(contentOptions[productForm.content_type] || []).map((row) => (
                      <SelectItem key={row.id} value={row.id} className="hover:bg-neutral-800 focus:bg-neutral-700">
                        {row.title || row.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-gray-500">If your list is long, we can add search/pagination next.</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Title</Label>
              <Input value={productForm.title} onChange={(e) => setProductForm((prev) => ({ ...prev, title: e.target.value }))} className="bg-black/20 border-white/10 text-white" />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Description (optional)</Label>
              <Textarea value={productForm.description} onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="bg-black/20 border-white/10 text-white" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Sale starts (optional)</Label>
                <Input type="datetime-local" value={productForm.sale_starts_at} onChange={(e) => setProductForm((prev) => ({ ...prev, sale_starts_at: e.target.value }))} className="bg-black/20 border-white/10 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Sale ends (optional)</Label>
                <Input type="datetime-local" value={productForm.sale_ends_at} onChange={(e) => setProductForm((prev) => ({ ...prev, sale_ends_at: e.target.value }))} className="bg-black/20 border-white/10 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">License text (optional)</Label>
                <Textarea value={productForm.license_text} onChange={(e) => setProductForm((prev) => ({ ...prev, license_text: e.target.value }))} rows={3} className="bg-black/20 border-white/10 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Artist message (optional)</Label>
                <Textarea value={productForm.artist_message} onChange={(e) => setProductForm((prev) => ({ ...prev, artist_message: e.target.value }))} rows={3} className="bg-black/20 border-white/10 text-white" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-sm text-gray-300">
                <div className="text-white font-semibold">Active</div>
                <div className="text-xs text-gray-400">Inactive products will not appear to buyers.</div>
              </div>
              <input type="checkbox" checked={productForm.is_active} onChange={(e) => setProductForm((prev) => ({ ...prev, is_active: e.target.checked }))} className="h-5 w-5 accent-yellow-400" />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={closeProductDialog} disabled={saving} className="flex-1 text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">
              Cancel
            </Button>
            <Button type="button" onClick={saveProduct} disabled={saving} className="flex-1 golden-gradient text-black font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formatDialogOpen} onOpenChange={(v) => (v ? null : closeFormatDialog())}>
        <DialogContent className="sm:max-w-lg glass-effect text-white font-montserrat">
          <DialogHeader className="space-y-2">
            <DialogTitle className="golden-text text-2xl">Add Format</DialogTitle>
            <DialogDescription className="text-gray-300">
              Upload a private file to the <code>downloads</code> bucket and set a CC price.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Format</Label>
              <Select value={formatForm.format} onValueChange={(v) => setFormatForm((prev) => ({ ...prev, format: v }))}>
                <SelectTrigger className="w-full bg-black/20 border-white/10 text-white">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                  {['mp3', 'wav', 'flac', 'mp4'].map((f) => (
                    <SelectItem key={f} value={f} className="hover:bg-neutral-800 focus:bg-neutral-700">{f.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Price (CC)</Label>
                <Input inputMode="decimal" value={formatForm.price_cc} onChange={(e) => setFormatForm((prev) => ({ ...prev, price_cc: e.target.value }))} className="bg-black/20 border-white/10 text-white" placeholder="300" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Entitlement duration (days, optional)</Label>
                <Input inputMode="numeric" value={formatForm.entitlement_duration_days} onChange={(e) => setFormatForm((prev) => ({ ...prev, entitlement_duration_days: e.target.value.replace(/[^\d]/g, '') }))} className="bg-black/20 border-white/10 text-white" placeholder="(permanent)" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">File</Label>
              <Input type="file" onChange={(e) => setFormatForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))} className="bg-black/20 border-white/10 text-white" />
              <div className="text-xs text-gray-500">Private download: buyers must purchase to access.</div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={closeFormatDialog} disabled={saving} className="flex-1 text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">
              Cancel
            </Button>
            <Button type="button" onClick={saveFormat} disabled={saving || formatForm.uploading} className="flex-1 golden-gradient text-black font-semibold">
              {formatForm.uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Upload & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={codeDialogOpen} onOpenChange={(v) => (v ? null : closeCodeDialog())}>
        <DialogContent className="sm:max-w-3xl glass-effect text-white font-montserrat">
          <DialogHeader className="space-y-2">
            <DialogTitle className="golden-text text-2xl">Discount Codes</DialogTitle>
            <DialogDescription className="text-gray-300">Creators can create discount codes for downloads.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2 gap-2 glass-effect p-1 rounded-lg">
              <TabsTrigger value="list" className="tab-button">My codes</TabsTrigger>
              <TabsTrigger value="create" className="tab-button">Create / Update</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4">
              {codes.length ? (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <div className="divide-y divide-white/10">
                    {codes.map((c) => (
                      <div key={c.code} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white font-semibold">{c.code}</div>
                          <div className="text-xs text-gray-400">
                            {Number(c.discount_percent).toFixed(0)}% • uses {c.usage_count}/{c.max_uses} • per-user {c.max_uses_per_user}
                            {c.expires_at ? ` • expires ${new Date(c.expires_at).toLocaleString()}` : ''}
                          </div>
                        </div>
                        <Badge className="bg-white/10 text-gray-200">{c.is_active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400">No codes yet.</div>
              )}
            </TabsContent>

            <TabsContent value="create" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Code</Label>
                    <Input value={codeForm.code} onChange={(e) => setCodeForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} className="bg-black/20 border-white/10 text-white uppercase" placeholder="SAVE10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Discount %</Label>
                    <Input inputMode="decimal" value={codeForm.discount_percent} onChange={(e) => setCodeForm((prev) => ({ ...prev, discount_percent: e.target.value }))} className="bg-black/20 border-white/10 text-white" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Expires at (optional)</Label>
                    <Input type="datetime-local" value={codeForm.expires_at} onChange={(e) => setCodeForm((prev) => ({ ...prev, expires_at: e.target.value }))} className="bg-black/20 border-white/10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Max uses</Label>
                    <Input inputMode="numeric" value={codeForm.max_uses} onChange={(e) => setCodeForm((prev) => ({ ...prev, max_uses: e.target.value.replace(/[^\d]/g, '') }))} className="bg-black/20 border-white/10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Max uses per user</Label>
                    <Input inputMode="numeric" value={codeForm.max_uses_per_user} onChange={(e) => setCodeForm((prev) => ({ ...prev, max_uses_per_user: e.target.value.replace(/[^\d]/g, '') }))} className="bg-black/20 border-white/10 text-white" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Scope to product (optional)</Label>
                    <Select value={codeForm.product_id} onValueChange={(v) => setCodeForm((prev) => ({ ...prev, product_id: v, format_id: v === '__any__' ? '__any__' : prev.format_id }))}>
                      <SelectTrigger className="w-full bg-black/20 border-white/10 text-white">
                        <SelectValue placeholder="Any product" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                        <SelectItem value="__any__" className="hover:bg-neutral-800 focus:bg-neutral-700">(Any product)</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="hover:bg-neutral-800 focus:bg-neutral-700">
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Scope to format (optional)</Label>
                    <Select value={codeForm.format_id} onValueChange={(v) => setCodeForm((prev) => ({ ...prev, format_id: v }))}>
                      <SelectTrigger className="w-full bg-black/20 border-white/10 text-white">
                        <SelectValue placeholder="Any format" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                        <SelectItem value="__any__" className="hover:bg-neutral-800 focus:bg-neutral-700">(Any format)</SelectItem>
                        {(codeForm.product_id !== '__any__' ? formatsByProduct[codeForm.product_id] || [] : []).map((f) => (
                          <SelectItem key={f.id} value={f.id} className="hover:bg-neutral-800 focus:bg-neutral-700">
                            {String(f.format).toUpperCase()} • {Number(f.price_cc || 0).toLocaleString()} CC
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-gray-500">To scope by format, first choose a product.</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-sm text-gray-300">
                    <div className="text-white font-semibold">Active</div>
                    <div className="text-xs text-gray-400">Inactive codes cannot be redeemed.</div>
                  </div>
                  <input type="checkbox" checked={codeForm.is_active} onChange={(e) => setCodeForm((prev) => ({ ...prev, is_active: e.target.checked }))} className="h-5 w-5 accent-yellow-400" />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={closeCodeDialog} disabled={saving} className="flex-1 text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">
              Close
            </Button>
            <Button type="button" onClick={saveCode} disabled={saving} className="flex-1 golden-gradient text-black font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreatorDownloadsManager;
