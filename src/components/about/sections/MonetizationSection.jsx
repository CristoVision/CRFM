import React from 'react';
import { BadgeDollarSign, CreditCard, Coins, Crown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import SectionShell from './SectionShell';

const icons = [Coins, CreditCard, BadgeDollarSign, Crown];

const MonetizationSection = () => {
  const { t } = useLanguage();
  const options = Array.isArray(t('about.monetization.options')) ? t('about.monetization.options') : [];

  return (
    <SectionShell title={t('about.monetization.title')} subtitle={t('about.monetization.subtitle')} icon={<BadgeDollarSign />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option, idx) => {
          const Icon = icons[idx] || BadgeDollarSign;
          return (
            <div key={option.title} className="glass-effect p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-yellow-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">{option.title}</h3>
              </div>
              <p className="text-sm text-gray-300">{option.body}</p>
            </div>
          );
        })}
      </div>

      <div className="glass-effect p-4 rounded-xl border border-white/10">
        <p className="text-sm text-gray-300">{t('about.monetization.note')}</p>
      </div>
    </SectionShell>
  );
};

export default MonetizationSection;
