import React from 'react';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { Package, Gamepad2, BookOpen, Briefcase, Store } from 'lucide-react';

    function PlaceholderContent({ title }) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl">
          <h2 className="text-4xl font-bold golden-text mb-4">{title}</h2>
          <p className="text-xl text-gray-300 mb-6">Content coming soon!</p>
          <p className="text-gray-400">This section is under active development. Check back later for exciting updates.</p>
          <div className="mt-8 w-24 h-1 bg-yellow-400 rounded-full"></div>
        </div>
      );
    }

    function ProjectsPage() {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-12 mt-8">
            <h1 className="text-5xl font-bold mb-4">
              Our <span className="golden-text">Projects</span>
            </h1>
            <p className="text-xl text-gray-300">
              Exploring innovation across various digital frontiers.
            </p>
          </div>

          <Tabs defaultValue="apps" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-8 glass-effect p-2 rounded-lg">
              <TabsTrigger value="apps" className="tab-button text-sm sm:text-base"><Package className="w-4 h-4 mr-2"/>Apps</TabsTrigger>
              <TabsTrigger value="games" className="tab-button text-sm sm:text-base"><Gamepad2 className="w-4 h-4 mr-2"/>Games</TabsTrigger>
              <TabsTrigger value="stories" className="tab-button text-sm sm:text-base"><BookOpen className="w-4 h-4 mr-2"/>Stories</TabsTrigger>
              <TabsTrigger value="portfolio" className="tab-button text-sm sm:text-base"><Briefcase className="w-4 h-4 mr-2"/>Portfolio</TabsTrigger>
              <TabsTrigger value="stores" className="tab-button text-sm sm:text-base"><Store className="w-4 h-4 mr-2"/>Stores</TabsTrigger>
            </TabsList>

            <TabsContent value="apps"><PlaceholderContent title="Innovative Applications" /></TabsContent>
            <TabsContent value="games"><PlaceholderContent title="Engaging Games" /></TabsContent>
            <TabsContent value="stories"><PlaceholderContent title="Captivating Stories" /></TabsContent>
            <TabsContent value="portfolio"><PlaceholderContent title="Creative Portfolio" /></TabsContent>
            <TabsContent value="stores"><PlaceholderContent title="Digital Stores" /></TabsContent>
          </Tabs>
        </div>
      );
    }

    export default ProjectsPage;
