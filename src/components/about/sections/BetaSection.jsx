import React from 'react';
import { Sparkles, Mail } from 'lucide-react';
import SectionShell from './SectionShell';
import BetaApplicationForm from '@/components/about/BetaApplicationForm';
import { useLanguage } from '@/contexts/LanguageContext';

const BetaSection = () => {
  const { t } = useLanguage();

  return (
    <SectionShell title={t('beta.title')} subtitle={t('beta.subtitle')} icon={<Sparkles />}>
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="glass-effect p-4 rounded-xl border border-white/10">
          <BetaApplicationForm />
        </div>
        <div className="space-y-4">
          <div className="glass-effect p-4 rounded-xl border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-2">{t('beta.panel.title')}</h3>
            <p className="text-sm text-gray-300">{t('beta.panel.body')}</p>
          </div>
          <div className="glass-effect p-4 rounded-xl border border-white/10 flex items-start gap-3">
            <Mail className="w-5 h-5 text-yellow-300 mt-1" />
            <div>
              <p className="text-sm text-gray-300">{t('beta.panel.contact')}</p>
              <a href="mailto:info@crfministry.com" className="text-yellow-300 hover:underline">
                info@crfministry.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
};

export default BetaSection;
