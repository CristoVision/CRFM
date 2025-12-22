import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ExternalLink, Package } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const PublicAppsDisplay = () => {
  const [apps, setApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useLanguage();
  const dualIslandUrl = import.meta.env.VITE_DUAL_ISLAND_URL || '/apps/dual-island';
  const dualIslandMedia = import.meta.env.VITE_DUAL_ISLAND_MEDIA_URL || '/icon-512.png';

  const mergeDualIsland = (list) => {
    const normalized = list.map(app => ({ ...app, titleKey: (app.title || '').toLowerCase().trim() }));
    const hasDual = normalized.some(app => app.titleKey === 'dual island' || app.titleKey === 'isladual');
    if (hasDual) return list;
    return [
      ...list,
      {
        id: 'dual-island-static',
        title: t('apps.dualIslandTitle'),
        description: t('apps.dualIslandDescription'),
        media_url: dualIslandMedia || null,
        site_url: dualIslandUrl || null,
        is_public: true,
      }
    ];
  };

  useEffect(() => {
    const fetchPublicApps = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('apps')
          .select('id, title, description, media_url, site_url, is_public')
          .eq('is_public', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setApps(mergeDualIsland(data || []));
      } catch (error) {
        toast({
          title: t('apps.errorTitle'),
          description: t('apps.errorBody'),
          variant: "error",
        });
        console.error("Error fetching public apps:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicApps();
  }, [t]);

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 glass-effect rounded-xl">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
        <p className="text-lg text-gray-300">{t('apps.loading')}</p>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-6 glass-effect rounded-xl">
        <Package className="w-16 h-16 text-yellow-400/70 mb-4" />
        <h3 className="text-2xl font-semibold text-gray-200 mb-2">{t('apps.emptyTitle')}</h3>
        <p className="text-gray-400 text-center">{t('apps.emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h3 className="text-3xl font-bold golden-text flex items-center mb-6">
        <Package className="w-8 h-8 mr-3 text-yellow-400" /> {t('apps.featured')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map((app) => (
          <Card key={app.id} className="glass-effect-light flex flex-col justify-between overflow-hidden transform hover:scale-105 transition-transform duration-300 ease-out">
            <CardHeader className="p-0">
              {app.media_url ? (
                <img-replace src={app.media_url} alt={app.title} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-neutral-800 to-neutral-700 flex items-center justify-center">
                  <Package className="w-16 h-16 text-yellow-400 opacity-50" />
                </div>
              )}
              <div className="p-4">
                <CardTitle className="text-xl golden-text mb-2 truncate" title={app.title}>{app.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-2 flex-grow">
              <p className="text-sm text-gray-400 line-clamp-3 min-h-[60px]">{app.description || 'No description available.'}</p>
            </CardContent>
            <CardFooter className="p-4 bg-black/20">
              {app.site_url ? (
                <Button 
                  asChild 
                  className="w-full golden-gradient text-black font-semibold proximity-glow-button"
                >
                  {(() => {
                    const titleKey = (app.title || '').toLowerCase().trim();
                    const isDual = app.site_url === dualIslandUrl || titleKey === 'dual island' || titleKey === 'isladual';
                    return (
                      <a
                        href={app.site_url}
                        target={isDual ? undefined : '_blank'}
                        rel={isDual ? undefined : 'noopener noreferrer'}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" /> {t('apps.visit')}
                      </a>
                    );
                  })()}
                </Button>
              ) : (
                <Button disabled className="w-full bg-neutral-600 text-neutral-400 cursor-not-allowed">
                  {t('apps.linkUnavailable')}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PublicAppsDisplay;
