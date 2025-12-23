import React, { useMemo, useState } from 'react';
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
import AdminAnalyticsTab from '@/components/admin/AdminAnalyticsTab';
import AdminAchievementsTab from '@/components/admin/AdminAchievementsTab';
import AdminEcosystemTab from '@/components/admin/AdminEcosystemTab';
import AdminStationsTab from '@/components/admin/AdminStationsTab';
import AdminAdsTab from '@/components/admin/AdminAdsTab';
import WalletAdminTab from '@/components/admin/WalletAdminTab';
import AdminSupportTab from '@/components/admin/AdminSupportTab';
import AdminBetaApplicationsTab from '@/components/admin/AdminBetaApplicationsTab';
import AdminServicesTab from '@/components/admin/AdminServicesTab';

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

  if

