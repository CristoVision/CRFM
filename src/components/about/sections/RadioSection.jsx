import React from 'react';
import { Radio, Sparkles, Megaphone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import SectionShell from './SectionShell';

const RadioSection = () => {
  const { t } = useLanguage();
  const points = Array.isArray(t('about.radio.points')) ? t('about.radio.points') : [];

  return (
    <SectionShell title={t('about.radio.title')} subtitle={t('about.radio.subtitle')} icon={<Radio />}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {points.map((point, idx) => {
          const Icon = idx === 1 ? Sparkles : idx === 2 ? Megaphone : Radio;
          return (
            <div key={point.title} className="glass-effect p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-yellow-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">{point.title}</h3>
              </div>
              <p className="text-sm text-gray-300">{point.body}</p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
};

export default RadioSection;
