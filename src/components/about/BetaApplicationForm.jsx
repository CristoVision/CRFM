import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/contexts/LanguageContext';

const DEFAULT_FORM = {
  name: '',
  artist_name: '',
  email: '',
  links: '',
  genre: '',
  role_interest: '',
  notes: '',
};

const BetaApplicationForm = () => {
  const { t } = useLanguage();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: t('beta.form.requiredTitle'), description: t('beta.form.requiredBody'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        artist_name: form.artist_name.trim() || null,
        email: form.email.trim(),
        links: form.links.trim() || null,
        genre: form.genre.trim() || null,
        role_interest: form.role_interest.trim() || null,
        notes: form.notes.trim() || null,
        status: 'pending',
      };
      const { error } = await supabase.from('beta_applications').insert(payload);
      if (error) throw error;
      setSubmitted(true);
      setForm(DEFAULT_FORM);
      toast({ title: t('beta.form.successTitle'), description: t('beta.form.successBody'), variant: 'success' });
    } catch (error) {
      toast({ title: t('beta.form.errorTitle'), description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          value={form.name}
          onChange={handleChange('name')}
          placeholder={t('beta.form.name')}
          className="bg-black/30 border-white/10 text-white"
        />
        <Input
          value={form.artist_name}
          onChange={handleChange('artist_name')}
          placeholder={t('beta.form.artist')}
          className="bg-black/30 border-white/10 text-white"
        />
      </div>
      <Input
        value={form.email}
        onChange={handleChange('email')}
        placeholder={t('beta.form.email')}
        type="email"
        className="bg-black/30 border-white/10 text-white"
      />
      <Input
        value={form.links}
        onChange={handleChange('links')}
        placeholder={t('beta.form.links')}
        className="bg-black/30 border-white/10 text-white"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          value={form.genre}
          onChange={handleChange('genre')}
          placeholder={t('beta.form.genre')}
          className="bg-black/30 border-white/10 text-white"
        />
        <Input
          value={form.role_interest}
          onChange={handleChange('role_interest')}
          placeholder={t('beta.form.role')}
          className="bg-black/30 border-white/10 text-white"
        />
      </div>
      <Textarea
        value={form.notes}
        onChange={handleChange('notes')}
        placeholder={t('beta.form.notes')}
        rows={4}
        className="bg-black/30 border-white/10 text-white"
      />
      <div className="flex flex-wrap gap-3 items-center">
        <Button type="submit" disabled={submitting} className="golden-gradient text-black font-semibold">
          {submitting ? t('beta.form.submitting') : t('beta.form.submit')}
        </Button>
        {submitted ? <span className="text-sm text-green-200">{t('beta.form.confirmation')}</span> : null}
      </div>
      <p className="text-xs text-gray-400">{t('beta.form.followUp')}</p>
    </form>
  );
};

export default BetaApplicationForm;
