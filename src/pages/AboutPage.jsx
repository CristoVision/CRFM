import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Users, Mail, Package, Gamepad2, BookOpen, Briefcase, Store, Tag, CalendarDays } from 'lucide-react';
import RequestCreatorTagsTab from '@/components/about/RequestCreatorTagsTab';
import PublicAppsDisplay from '@/components/about/PublicAppsDisplay';
import PublicGamesDisplay from '@/components/about/PublicGamesDisplay';
import SupportContactPanel from '@/components/about/SupportContactPanel';
import CreationCalendarPanel from '@/components/about/creation_calendar_panel';
import { buildInfo, formatBuildLabel } from '@/lib/buildInfo';
import { useLanguage } from '@/contexts/LanguageContext';
import DUStoriesPage from '@/pages/DUStoriesPage';
import BiblePage from '@/pages/BiblePage';
function TextContent({
  title,
  children,
  icon
}) {
  return <div className="p-6 sm:p-8 glass-effect rounded-xl min-h-[50vh]">
          <h2 className="text-3xl sm:text-4xl font-bold golden-text mb-6 flex items-center">
            {icon && React.cloneElement(icon, {
        className: "w-8 h-8 mr-3 text-yellow-400"
      })}
            {title}
          </h2>
          <div className="space-y-4 text-gray-300 text-base sm:text-lg leading-relaxed">
            {children}
          </div>
        </div>;
}
function PlaceholderEcosystemContent({
  title,
  icon,
  children
}) {
  return <div className="p-6 sm:p-8 glass-effect rounded-xl min-h-[50vh]">
            <h2 className="text-3xl sm:text-4xl font-bold golden-text mb-6 flex items-center">
              {icon && React.cloneElement(icon, {
        className: "w-8 h-8 mr-3 text-yellow-400"
      })}
              {title}
            </h2>
            <div className="space-y-4 text-gray-300 text-base sm:text-lg leading-relaxed">
              {children || <p>Content for this section is coming soon. Stay tuned for exciting updates!</p>}
            </div>
          </div>;
}
function AboutPage() {
  const { t } = useLanguage();
  const title = t('about.title', { brand: 'CRFM' });
  const titleParts = title.split('CRFM');
  return <div className="container mx-auto px-4 py-8 page-gradient-bg"> {/* Applied page-gradient-bg here */}
          <div className="text-center mb-12 mt-8">
            <h1 className="text-5xl font-bold mb-4">
              {titleParts[0]}<span className="golden-text">CRFM</span>{titleParts[1] || ''}
            </h1>
            <p className="text-xl text-gray-300">{t('about.subtitle')}</p>
          </div>

          <div className="max-w-5xl mx-auto space-y-8">
            <Tabs defaultValue="vision" className="w-full">
              <TabsList
                className="w-full px-3 py-2 bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl justify-start sm:justify-center"
                style={{ scrollbarWidth: 'none' }}
              >
                <TabsTrigger value="vision" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Eye className="w-4 h-4 mr-1 sm:mr-2" />{t('about.tabs.vision')}</TabsTrigger>
                <TabsTrigger value="team" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Users className="w-4 h-4 mr-1 sm:mr-2" />{t('about.tabs.team')}</TabsTrigger>
                <TabsTrigger value="contact" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Mail className="w-4 h-4 mr-1 sm:mr-2" />{t('about.tabs.contact')}</TabsTrigger>
                <TabsTrigger value="ecosystem" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Package className="w-4 h-4 mr-1 sm:mr-2" />{t('about.tabs.ecosystem')}</TabsTrigger>
                <TabsTrigger value="requestTags" className="tab-button text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-xl flex-1 sm:flex-none"><Tag className="w-4 h-4 mr-1 sm:mr-2" />{t('about.tabs.requestTags')}</TabsTrigger>
              </TabsList>

              <TabsContent value="vision">
                <TextContent title={t('about.vision.title')} icon={<Eye />}>
                  <p>{t('about.vision.p1')}</p>
                  <p>{t('about.vision.p2')}</p>
                  <p>{t('about.vision.p3')}</p>
                  <p></p>
                  <p></p>
                </TextContent>
              </TabsContent>
              <TabsContent value="team">
                <TextContent title={t('about.team.title')} icon={<Users />}>
                  <p>{t('about.team.p1')}</p>
                  <p>{t('about.team.p2')}</p>
                  <p></p>
                  <p></p>
                </TextContent>
              </TabsContent>
              <TabsContent value="contact">
                <div className="space-y-6">
                  <TextContent title={t('about.contact.title')} icon={<Mail />}>
                    <p>{t('about.contact.p1')}</p>
                    <p><strong>{t('about.contact.emailLabel')}</strong> <a href="mailto:contact@crfm.com" className="text-yellow-400 hover:underline">contact@crfm.com</a> (Placeholder)</p>
                    <p><strong>{t('about.contact.supportLabel')}</strong> <a href="mailto:support@crfm.com" className="text-yellow-400 hover:underline">support@crfm.com</a> (Placeholder)</p>
                  </TextContent>
                  <SupportContactPanel />
                </div>
              </TabsContent>
              <TabsContent value="ecosystem">
                  <Tabs defaultValue="apps" className="w-full mt-4">
                      <TabsList
                        className="w-full px-2 py-2 bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg justify-start sm:justify-center"
                        style={{ scrollbarWidth: 'none' }}
                      >
                          <TabsTrigger value="apps" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><Package className="w-3 h-3 mr-1" />{t('about.tabs.apps')}</TabsTrigger>
                          <TabsTrigger value="calendar" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><CalendarDays className="w-3 h-3 mr-1" />{t('about.tabs.calendar')}</TabsTrigger>
                          <TabsTrigger value="games" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><Gamepad2 className="w-3 h-3 mr-1" />{t('about.tabs.games')}</TabsTrigger>
                          <TabsTrigger value="stories" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><BookOpen className="w-3 h-3 mr-1" />{t('about.tabs.stories')}</TabsTrigger>
                          <TabsTrigger value="bible" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><BookOpen className="w-3 h-3 mr-1" />{t('about.tabs.bible')}</TabsTrigger>
                          <TabsTrigger value="portfolio" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><Briefcase className="w-3 h-3 mr-1" />{t('about.tabs.portfolio')}</TabsTrigger>
                          <TabsTrigger value="stores" className="tab-button text-xs whitespace-nowrap px-3 py-2 rounded-lg flex-1 sm:flex-none"><Store className="w-3 h-3 mr-1" />{t('about.tabs.stores')}</TabsTrigger>
                      </TabsList>
                      <TabsContent value="apps">
                          <PublicAppsDisplay />
                      </TabsContent>
                      <TabsContent value="calendar">
                          <CreationCalendarPanel />
                      </TabsContent>
                      <TabsContent value="games">
                          <PublicGamesDisplay />
                      </TabsContent>
                      <TabsContent value="stories">
                          <div className="max-w-none">
                            <DUStoriesPage />
                          </div>
                      </TabsContent>
                      <TabsContent value="bible">
                          <div className="max-w-none">
                            <BiblePage />
                          </div>
                      </TabsContent>
                      <TabsContent value="portfolio">
                          <PlaceholderEcosystemContent title={t('about.tabs.portfolio')} icon={<Briefcase />}>
                            <p>{t('about.placeholder')}</p>
                          </PlaceholderEcosystemContent>
                      </TabsContent>
                      <TabsContent value="stores">
                          <PlaceholderEcosystemContent title={t('about.tabs.stores')} icon={<Store />}>
                            <p>{t('about.placeholder')}</p>
                          </PlaceholderEcosystemContent>
                      </TabsContent>
                  </Tabs>
              </TabsContent>
              <TabsContent value="requestTags">
                <RequestCreatorTagsTab />
              </TabsContent>
            </Tabs>
            <div className="mt-6 text-center text-xs text-muted-foreground">
              {formatBuildLabel(buildInfo)}
              {buildInfo.time ? ` · ${buildInfo.time}` : ''}
            </div>
          </div>
        </div>;
}
export default AboutPage;
