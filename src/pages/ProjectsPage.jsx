import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Gamepad2, BookOpen, Briefcase, Store } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function PlaceholderContent({ title, description, note }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl">
      <h2 className="text-4xl font-bold golden-text mb-4">{title}</h2>
      <p className="text-xl text-gray-300 mb-6">{description}</p>
      <p className="text-gray-400">{note}</p>
      <div className="mt-8 w-24 h-1 bg-yellow-400 rounded-full"></div>
    </div>
  );
}

function ProjectsPage() {
  const { t } = useLanguage();
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12 mt-8">
        <h1 className="text-5xl font-bold mb-4">
          {t('projects.titlePrefix')} <span className="golden-text">{t('projects.titleEmphasis')}</span>
        </h1>
        <p className="text-xl text-gray-300">
          {t('projects.subtitle')}
        </p>
      </div>

      <Tabs defaultValue="apps" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-8 glass-effect p-2 rounded-lg">
          <TabsTrigger value="apps" className="tab-button text-sm sm:text-base"><Package className="w-4 h-4 mr-2"/>{t('projects.tabs.apps')}</TabsTrigger>
          <TabsTrigger value="games" className="tab-button text-sm sm:text-base"><Gamepad2 className="w-4 h-4 mr-2"/>{t('projects.tabs.games')}</TabsTrigger>
          <TabsTrigger value="stories" className="tab-button text-sm sm:text-base"><BookOpen className="w-4 h-4 mr-2"/>{t('projects.tabs.stories')}</TabsTrigger>
          <TabsTrigger value="portfolio" className="tab-button text-sm sm:text-base"><Briefcase className="w-4 h-4 mr-2"/>{t('projects.tabs.portfolio')}</TabsTrigger>
          <TabsTrigger value="stores" className="tab-button text-sm sm:text-base"><Store className="w-4 h-4 mr-2"/>{t('projects.tabs.stores')}</TabsTrigger>
        </TabsList>

        <TabsContent value="apps"><PlaceholderContent title={t('projects.placeholders.appsTitle')} description={t('projects.placeholders.description')} note={t('projects.placeholders.note')} /></TabsContent>
        <TabsContent value="games"><PlaceholderContent title={t('projects.placeholders.gamesTitle')} description={t('projects.placeholders.description')} note={t('projects.placeholders.note')} /></TabsContent>
        <TabsContent value="stories"><PlaceholderContent title={t('projects.placeholders.storiesTitle')} description={t('projects.placeholders.description')} note={t('projects.placeholders.note')} /></TabsContent>
        <TabsContent value="portfolio"><PlaceholderContent title={t('projects.placeholders.portfolioTitle')} description={t('projects.placeholders.description')} note={t('projects.placeholders.note')} /></TabsContent>
        <TabsContent value="stores"><PlaceholderContent title={t('projects.placeholders.storesTitle')} description={t('projects.placeholders.description')} note={t('projects.placeholders.note')} /></TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjectsPage;
