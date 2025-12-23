import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';

const formatDate = (timestamp, language) => {
  if (!timestamp) return '-';
  try {
    return new Date(timestamp).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (error) {
    return '-';
  }
};

const projectStatusLabel = (status, t) => {
  return t(`services.status.projects.${status}`) || t('services.status.projects.intake');
};

const milestoneStatusLabel = (status, t) => {
  return t(`services.status.milestones.${status}`) || t('services.status.milestones.pending');
};

export default function ServicesPortalPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }
    let isMounted = true;
    const fetchProjects = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_projects')
        .select(`
          *,
          service_clients(name),
          service_milestones(*)
        `)
        .order('updated_at', { ascending: false });

      if (!isMounted) return;
      if (error) {
        setError(error.message);
        setProjects([]);
      } else {
        setProjects(
          (data || []).map((project) => ({
            ...project,
            service_milestones: (project.service_milestones || []).slice().sort(
              (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
            ),
          }))
        );
        setError(null);
      }
      setLoading(false);
    };

    fetchProjects();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const projectCards = useMemo(
    () =>
      projects.map((project) => (
        <div
          key={project.id}
          className="glass-effect rounded-2xl border border-white/10 p-6 space-y-4 shadow-xl"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400">
                {t('services.portal.clientLabel')}
              </p>
              <h2 className="text-2xl font-semibold text-white">
                {project.name}
              </h2>
              {project.service_clients?.name && (
                <p className="text-sm text-gray-300">{project.service_clients.name}</p>
              )}
            </div>
            <span className="rounded-full border border-white/20 px-3 py-1 text-sm font-semibold text-yellow-300">
              {projectStatusLabel(project.status, t)}
            </span>
          </div>
          {project.description && (
            <p className="text-sm text-gray-300 leading-relaxed">{project.description}</p>
          )}
          <div>
            <h3 className="text-base font-semibold text-white">
              {t('services.portal.milestonesTitle')}
            </h3>
            {project.service_milestones?.length ? (
              <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/5 bg-black/30">
                {project.service_milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex flex-col gap-2 px-4 py-3 text-sm text-gray-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-white">{milestone.title}</span>
                      <span className="text-xs uppercase tracking-widest text-gray-400">
                        {milestoneStatusLabel(milestone.status, t)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {milestone.description || t('services.portal.milestoneMissingDescription')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t('services.portal.milestoneDue')}: {formatDate(milestone.due_date, language)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-300">{t('services.portal.noMilestones')}</p>
            )}
          </div>
        </div>
      )),
    [projects, t, language]
  );

  return (
    <div className="container mx-auto px-4 py-10 page-gradient-bg">
      <div className="max-w-4xl space-y-4 mx-auto text-center">
        <h1 className="text-4xl font-bold text-white">{t('services.portal.title')}</h1>
        <p className="text-lg text-gray-300">{t('services.portal.subtitle')}</p>
      </div>
      <div className="mt-10 space-y-6">
        {loading && (
          <p className="text-center text-sm text-gray-400">{t('services.portal.loading')}</p>
        )}
        {error && (
          <p className="text-center text-sm text-red-400">{t('services.portal.error')}</p>
        )}
        {!loading && !error && !projects.length && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-gray-300 shadow-lg">
            <p className="text-xl font-semibold text-white">{t('services.portal.emptyTitle')}</p>
            <p className="mt-2 text-sm">{t('services.portal.emptyBody')}</p>
          </div>
        )}
        {projectCards}
      </div>
    </div>
  );
}
