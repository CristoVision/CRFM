// src/pages/AdminPage.jsx
import React, { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

import {
  Tag,
  Flag,
  BarChartBig,
  Package,
  Gamepad2,
  BookOpen,
  Briefcase,
  Store,
  Users,
  Radio,
  Megaphone,
  Trophy,
  MessageSquare,
  DollarSign,
  Sparkles,
  Music2,
} from 'lucide-react';

import AdminContentFlagsTab from '@/components/admin/AdminContentFlagsTab';
import AdminCreatorTagsTab from '@/components/admin/AdminCreatorTagsTab';
import AdminUserManagementTab from '@/components/admin/AdminUserManagementTab';
import AppsTab from '@/components/admin/AppsTab';
import GamesTab from '@/components/admin/GamesTab';
import StationsTab from '@/components/admin/StationsTab';
import AdsTab from '@/components/admin/AdsTab';
import AdminAchievementsTab from '@/components/admin/AdminAchievementsTab';
import WalletAdminTab from '@/components/admin/WalletAdminTab';
import AdminSupportTab from '@/components/admin/AdminSupportTab';
import AdminBetaApplicationsTab from '@/components/admin/AdminBetaApplicationsTab';
import AdminServicesTab from '@/components/admin/AdminServicesTab';
import DuGameMusicTab from '@/components/admin/DuGameMusicTab';
import { useLanguage } from '@/contexts/LanguageContext';

function SectionShell({ children }) {
  return (
    <div className="glass-effect rounded-2xl border border-white/10">
      {children}
    </div>
  );
}

function PlaceholderContent({ title, icon }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8">
      {React.cloneElement(icon, { className: 'w-16 h-16 text-yellow-400 mb-6 opacity-70' })}
      <h2 className="text-3xl sm:text-4xl font-bold golden-text mb-4">{title}</h2>
      <p className="text-base sm:text-lg text-gray-300">{t('admin.placeholder')}</p>
    </div>
  );
}

export default function AdminPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  // opciones principales
  const MAIN = useMemo(
    () => [
        { value: 'creatorTags', label: t('admin.mainTabs.creatorTags'), Icon: Tag },
        { value: 'contentFlags', label: t('admin.mainTabs.contentFlags'), Icon: Flag },
        { value: 'userManagement', label: t('admin.mainTabs.userManagement'), Icon: Users },
        { value: 'platformAnalytics', label: t('admin.mainTabs.platformAnalytics'), Icon: BarChartBig },
        { value: 'achievements', label: t('admin.mainTabs.achievements'), Icon: Trophy },
        { value: 'ecosystem', label: t('admin.mainTabs.ecosystem'), Icon: Package },
        { value: 'stations', label: t('admin.mainTabs.stations'), Icon: Radio },
        { value: 'ads', label: t('admin.mainTabs.ads'), Icon: Megaphone },
        { value: 'wallet', label: t('admin.mainTabs.wallet'), Icon: DollarSign },
        { value: 'services', label: t('services.admin.tabLabel'), Icon: Briefcase },
        { value: 'support', label: t('admin.mainTabs.support'), Icon: MessageSquare },
        { value: 'betaApps', label: t('admin.mainTabs.betaApps'), Icon: Sparkles },
    ],
    [t]
  );

  // sub-opciones de Ecosystem
  const ECO = useMemo(
    () => [
      { value: 'appsAdmin', label: t('admin.ecosystemTabs.appsAdmin'), Icon: Package },
      { value: 'gamesAdmin', label: t('admin.ecosystemTabs.gamesAdmin'), Icon: Gamepad2 },
      { value: 'duMusic', label: t('admin.ecosystemTabs.duMusic'), Icon: Music2 },
      { value: 'storiesAdmin', label: t('admin.ecosystemTabs.storiesAdmin'), Icon: BookOpen },
      { value: 'portfolioAdmin', label: t('admin.ecosystemTabs.portfolioAdmin'), Icon: Briefcase },
      { value: 'storesAdmin', label: t('admin.ecosystemTabs.storesAdmin'), Icon: Store },
    ],
    [t]
  );

  const [mainTab, setMainTab] = useState('creatorTags');
  const [ecoTab, setEcoTab] = useState('appsAdmin');

  const CurrentMainIcon = MAIN.find((m) => m.value === mainTab)?.Icon ?? Tag;
  const CurrentEcoIcon = ECO.find((e) => e.value === ecoTab)?.Icon ?? Package;

  if (!profile?.is_admin) {
    return (
      <div className="container mx-auto px-4 py-20 text-center text-white">
        <h2 className="text-3xl font-bold mb-3">{t('admin.accessDeniedTitle')}</h2>
        <p className="text-gray-400">{t('admin.accessDeniedBody')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 page-gradient-bg">
      {/* Header */}
      <header className="text-center mb-6 sm:mb-8 mt-4 sm:mt-6">
        <h1 className="text-4xl sm:text-5xl font-bold mb-3">
          {t('admin.titlePrefix')} <span className="golden-text">{t('admin.titleAccent')}</span>
        </h1>
        <p className="text-base sm:text-xl text-gray-300">{t('admin.subtitle')}</p>
      </header>

      <SectionShell>
        {/* Barra de navegación estilo About, responsive con wrap */}
        <div className="sticky top-0 z-[5] -m-4 sm:-m-6 p-4 sm:p-6 bg-black/30 backdrop-blur-md rounded-t-2xl border-b border-white/10">
          <div className="w-full px-2 py-2 bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl flex flex-wrap gap-2 sm:gap-3 justify-start sm:justify-center">
            {MAIN.map(({ value, label, Icon }) => {
              const isActive = mainTab === value;
              return (
                <button
                  key={value}
                  onClick={() => setMainTab(value)}
                  className={`tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex items-center gap-2 ${isActive ? 'bg-yellow-400 text-black shadow-lg' : 'bg-white/5 text-white hover:bg-white/10'}`}
                >
                  <Icon className="w-4 h-4 text-current" />
                  {label}
                </button>
              );
            })}
          </div>

          {mainTab === 'ecosystem' && (
            <div className="mt-3 px-2 py-2 bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg flex flex-wrap gap-2 sm:gap-3 justify-start sm:justify-center">
              {ECO.map(({ value, label, Icon }) => {
                const isActive = ecoTab === value;
                return (
                  <button
                    key={value}
                    onClick={() => setEcoTab(value)}
                    className={`tab-button text-xs sm:text-sm whitespace-nowrap px-3 py-2 rounded-lg flex items-center gap-1 ${isActive ? 'bg-yellow-300 text-black shadow-md' : 'bg-white/5 text-white hover:bg-white/10'}`}
                  >
                    <Icon className="w-4 h-4 text-current" />
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Contenido: espacio dedicado, sin solaparse */}
        <div className="p-4 sm:p-6">
          {mainTab === 'creatorTags' && <AdminCreatorTagsTab />}
          {mainTab === 'contentFlags' && <AdminContentFlagsTab />}
          {mainTab === 'userManagement' && <AdminUserManagementTab />}
          {mainTab === 'platformAnalytics' && (
            <PlaceholderContent title={t('admin.titles.platformAnalytics')} icon={<BarChartBig />} />
          )}
          {mainTab === 'achievements' && <AdminAchievementsTab />}
          {mainTab === 'stations' && <StationsTab />}
          {mainTab === 'ads' && <AdsTab />}
          {mainTab === 'wallet' && <WalletAdminTab />}
          {mainTab === 'services' && <AdminServicesTab />}
          {mainTab === 'support' && <AdminSupportTab />}
          {mainTab === 'betaApps' && <AdminBetaApplicationsTab />}

          {mainTab === 'ecosystem' && (
            <div className="mt-2">
              {ecoTab === 'appsAdmin' && <AppsTab />}
              {ecoTab === 'gamesAdmin' && <GamesTab />}
              {ecoTab === 'duMusic' && <DuGameMusicTab />}
              {ecoTab === 'storiesAdmin' && (
                <PlaceholderContent title={t('admin.titles.storiesManagement')} icon={<BookOpen />} />
              )}
              {ecoTab === 'portfolioAdmin' && (
                <PlaceholderContent title={t('admin.titles.portfolioManagement')} icon={<Briefcase />} />
              )}
              {ecoTab === 'storesAdmin' && (
                <PlaceholderContent title={t('admin.titles.storesManagement')} icon={<Store />} />
              )}
            </div>
          )}
        </div>
      </SectionShell>
    </div>
  );
}
