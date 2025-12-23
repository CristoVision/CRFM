import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';

const projectStatusLabel = (status, t) =>
  t(`services.status.projects.${status}`) || t('services.status.projects.intake');

const formatDate = (value, language) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return '-';
  }
};

const normalizeProjects = (data = []) =>
  (data || []).map((project) => ({
    ...project,
    service_milestones: (project.service_milestones || []).slice().sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    ),
  }));

export default function AdminServicesTab() {
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_projects')
        .select(`
          *,
          service_clients(name),
          service_milestones(*)
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        setError(error.message);
        setProjects([]);
      } else {
        setProjects(normalizeProjects(data));
        setError(null);
      }
      setLoading(false);
    };

    fetchServices();
  }, []);

  const statusSummary = useMemo(() => {
    return projects.reduce((acc, project) => {
      const key = project.status || 'intake';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [projects]);

  const milestoneCount = useMemo(
    () => projects.reduce((sum, project) => sum + (project.service_milestones?.length || 0), 0),
    [projects]
  );
  const clientCount = useMemo(
    () => new Set(projects.map((project) => project.client_id)).size,
    [projects]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-2xl border border-white/10 bg-black/40 p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-white">{t('services.admin.title')}</h2>
        <p className="text-sm text-gray-300">{t('services.admin.subtitle')}</p>
        <div className="grid gap-4 pt-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
            <p className="text-xs uppercase tracking-widest text-gray-500">
              {t('services.admin.stats.projects')}
            </p>
            <p className="text-3xl font-bold text-white">{projects.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
            <p className="text-xs uppercase tracking-widest text-gray-500">
              {t('services.admin.stats.clients')}
            </p>
            <p className="text-3xl font-bold text-white">{clientCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
            <p className="text-xs uppercase tracking-widest text-gray-500">
              {t('services.admin.stats.milestones')}
            </p>
            <p className="text-3xl font-bold text-white">{milestoneCount}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-4 text-xs text-gray-300">
          {Object.entries(statusSummary).map(([status, count]) => (
            <span
              key={status}
              className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-yellow-200"
            >
              {projectStatusLabel(status, t)}: {count}
            </span>
          ))}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-400">{t('services.admin.loading')}</p>
      )}
      {error && <p className="text-sm text-red-400">{t('services.admin.error')}</p>}

      <div className="space-y-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="glass-effect rounded-2xl border border-white/10 p-5 shadow-xl"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400">
                  {t('services.admin.table.client')}
                </p>
                <h3 className="text-xl font-semibold text-white">{project.name}</h3>
                {project.service_clients?.name && (
                  <p className="text-sm text-gray-300">{project.service_clients.name}</p>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-300">
                <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-widest text-yellow-300">
                  {projectStatusLabel(project.status, t)}
                </span>
                <span>
                  {t('services.admin.table.updated')}: {formatDate(project.updated_at, language)}
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-300">
              {project.description || t('services.admin.table.noDescription')}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
              <span>
                {project.service_milestones?.length || 0} {t('services.admin.table.milestones')}
              </span>
              <span>
                {project.service_milestones?.length
                  ? t('services.admin.table.lastMilestone')
                  : t('services.admin.table.noMilestones')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
