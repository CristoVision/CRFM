import React from 'react';
import { Coins, Headphones, Users, BadgeDollarSign, Sparkles } from 'lucide-react';
import SectionShell from './SectionShell';
import { useLanguage } from '@/contexts/LanguageContext';

const stepIcons = [Headphones, Coins, BadgeDollarSign, Users, Sparkles];

const HowItWorksSection = () => {
  const { t } = useLanguage();
  const steps = Array.isArray(t('about.how.steps')) ? t('about.how.steps') : [];

  return (
    <SectionShell title={t('about.how.title')} subtitle={t('about.how.subtitle')} icon={<Coins />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step, idx) => {
          const Icon = stepIcons[idx] || Sparkles;
          return (
            <div key={step.title} className="glass-effect p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-yellow-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              </div>
              <p className="text-sm text-gray-300">{step.body}</p>
            </div>
          );
        })}
      </div>

      <div className="glass-effect p-4 rounded-xl border border-white/10">
        <p className="text-sm text-gray-300">{t('about.how.economy')}</p>
      </div>
    </SectionShell>
  );
};

export default HowItWorksSection;
