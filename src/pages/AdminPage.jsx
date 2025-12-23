import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Tag,
  Flag,
  Users,
  BarChartBig,
  Trophy,
  Package,
  Radio,
  Megaphone,
  DollarSign,
  MessageSquare,
  Sparkles,
  Briefcase,
} from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

import AdminCreatorTagsTab from '@/components/admin/AdminCreatorTagsTab';
import AdminContentFlagsTab from '@/components/admin/AdminContentFlagsTab';
import AdminUserManagementTab from '@/components/admin/AdminUserManagementTab';
import AdminAchievementsTab from '@/components/admin/AdminAchievementsTab';
import AdminEcosystemTab from '@/components/admin/AdminEcosystemTab';
import AdminStationsTab from '@/components/admin/AdminStationsTab';
import AdminAdsTab from '@/components/admin/AdminAdsTab';
import WalletAdminTab from '@/components/admin/WalletAdminTab';
import AdminSupportTab from '@/components/admin/AdminSupportTab';
import AdminBetaApplicationsTab from '@/components/admin/AdminBetaApplicationsTab';
import AdminServicesTab from '@/components/admin/AdminServicesTab';

function TabButton({ active, onClick, Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition',
        active
          ? 'border-white/20 bg-white/10 text-white'
          : 'border-white/10 bg-black/20 text-gray-300 hover:bg-white/5 hover:text-white',
      ].join(' ')}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span>{label}</span>
    </button>
  );
}

export default function AdminPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const mainTab = searchParams.get('tab') || 'creatorTags';

  const MAIN_TABS = useMemo(
    () => [
      { value: 'creatorTags', label: t('admin.mainTabs.creatorTags'), Icon: Tag },
      { value: 'contentFlags', label: t('admin.mainTabs.contentFlags'), Icon: Flag },
      { value: 'userManagement', label: t('admin.mainTabs.userManagement'), Icon: Users },
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

  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  // Nota: aquí NO estoy aplicando un “admin gate” estricto porque
  // no tengo certeza del campo exacto (role/is_admin/etc.).
  // Si tú ya tienes una regla, la añadimos luego sin romper build.
  const hasProfile = Boolean(profile);

  return (
    <div className="container mx-auto px-4 py-10 page-gradient-bg">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="glass-effect rounded-2xl border border-white/10 p-6 shadow-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{t('admin.title') || 'Admin'}</h1>
              <p className="mt-1 text-sm text-gray-300">
                {t('admin.subtitle') || 'Manage platform settings and moderation tools.'}
              </p>
            </div>
            {!hasProfile && (
              <p className="text-xs text-gray-400">
                {t('admin.profileLoading') || 'Loading profile...'}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {MAIN_TABS.map(({ value, label, Icon }) => (
              <TabButton
                key={value}
                active={mainTab === value}
                onClick={() => setTab(value)}
                Icon={Icon}
                label={label}
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {mainTab === 'creatorTags' && <AdminCreatorTagsTab />}
          {mainTab === 'contentFlags' && <AdminContentFlagsTab />}
          {mainTab === 'userManagement' && <AdminUserManagementTab />}
          {mainTab === 'achievements' && <AdminAchievementsTab />}
          {mainTab === 'ecosystem' && <AdminEcosystemTab />}
          {mainTab === 'stations' && <AdminStationsTab />}
          {mainTab === 'ads' && <AdminAdsTab />}
          {mainTab === 'wallet' && <WalletAdminTab />}
          {mainTab === 'services' && <AdminServicesTab />}
          {mainTab === 'support' && <AdminSupportTab />}
          {mainTab === 'betaApps' && <AdminBetaApplicationsTab />}

          {!MAIN_TABS.some((t) => t.value === mainTab) && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-gray-300">
              <p className="text-white font-semibold">Unknown tab</p>
              <p className="mt-2 text-sm">
                Current tab query param: <span className="font-mono">{String(mainTab)}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
