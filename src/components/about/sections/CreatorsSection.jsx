import React from 'react';
import { UploadCloud, Film, ListMusic, Mic2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import SectionShell from './SectionShell';

const featureIcons = [UploadCloud, Film, ListMusic, Mic2, Sparkles];

const CreatorsSection = () => {
  const { t } = useLanguage();
  const features = Array.isArray(t('about.creators.features')) ? t('about.creators.features') : [];

  return (
    <SectionShell title={t('about.creators.title')} subtitle={t('about.creators.subtitle')} icon={<UploadCloud />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature, idx) => {
          const Icon = featureIcons[idx] || UploadCloud;
          return (
            <div key={feature.title} className="glass-effect p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-yellow-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              </div>
              <p className="text-sm text-gray-300">{feature.body}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button asChild className="golden-gradient text-black font-semibold">
          <a href="/hub">{t('about.creators.ctaHub')}</a>
        </Button>
        <Button asChild variant="outline" className="border-yellow-400/40 text-yellow-200 hover:text-yellow-100">
          <a href="/about?tab=beta">{t('about.creators.ctaApply')}</a>
        </Button>
      </div>
    </SectionShell>
  );
};

export default CreatorsSection;
