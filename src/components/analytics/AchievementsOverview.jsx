import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trophy, Lock, CheckCircle, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const badgeStyles = [
  'from-amber-400 to-orange-500',
  'from-indigo-400 to-purple-500',
  'from-emerald-400 to-teal-500',
  'from-sky-400 to-cyan-500',
  'from-pink-400 to-rose-500',
];

const buildBadge = (ach, idx, isLocked) => {
  const gradient = badgeStyles[idx % badgeStyles.length];
  if (ach.icon_url) {
    return (
      <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20 shadow-lg bg-gradient-to-br from-black/50 to-black/20 flex items-center justify-center">
        <img
          src={ach.icon_url}
          alt={ach.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <span className="absolute text-xs font-semibold text-yellow-200">{(ach.name || 'A').slice(0,1).toUpperCase()}</span>
      </div>
    );
  }
  return (
    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-black font-bold shadow-lg ${isLocked ? 'opacity-60' : ''}`}>
      <span className="text-lg">{(ach.name || 'A').slice(0, 1).toUpperCase()}</span>
    </div>
  );
};

export default function AchievementsOverview({ userId, projectCode = 'CRFM' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unlocked, setUnlocked] = useState([]);
  const [locked, setLocked] = useState([]);
  const [projectId, setProjectId] = useState(null);
  const [projectLookupFailed, setProjectLookupFailed] = useState(false);

  const fetchProjectId = useCallback(async () => {
    if (!projectCode) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id')
        .eq('code', projectCode)
        .maybeSingle();
      if (error) {
        setProjectLookupFailed(true);
        return;
      }
      setProjectId(data?.id || null);
    } catch (err) {
      setProjectLookupFailed(true);
    }
  }, [projectCode]);

  const fetchAchievements = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      if (!projectId) {
        await fetchProjectId();
        return;
      }
      const achievementQuery = supabase
        .from('achievements')
        .select('id, name, description, icon_url, is_milestone, rarity, rewards, active_from, active_to')
        .order('name', { ascending: true });

      const userAchQuery = supabase
        .from('user_achievements')
        .select('achievement_id, unlocked_at, track:tracks(title)')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (projectId) {
        achievementQuery.eq('project_id', projectId);
        userAchQuery.eq('project_id', projectId);
      } else if (!projectId && !projectLookupFailed) {
        // still waiting for project lookup
        return;
      }

      const [{ data: allAch, error: allErr }, { data: userAch, error: userErr }] = await Promise.all([
        achievementQuery,
        userAchQuery,
      ]);
      if (allErr) throw allErr;
      if (userErr) throw userErr;

      const unlockedMap = new Map();
      (userAch || []).forEach((ua) => {
        unlockedMap.set(ua.achievement_id, ua);
      });

      const unlockedList = [];
      const lockedList = [];

      (allAch || []).forEach((ach, idx) => {
        const match = unlockedMap.get(ach.id);
        if (match) {
          unlockedList.push({
            ...ach,
            unlocked_at: match.unlocked_at,
            track_title: match.track?.title,
            badgeIndex: idx,
          });
        } else {
          lockedList.push({
            ...ach,
            badgeIndex: idx,
          });
        }
      });

      setUnlocked(unlockedList);
      setLocked(lockedList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, projectId, fetchProjectId]);

  useEffect(() => {
    if (projectLookupFailed && !projectId) {
      setError('No se pudo cargar el proyecto (columna code en projects o RLS).');
      setLoading(false);
      return;
    }
    fetchAchievements();
  }, [fetchAchievements, projectId, projectLookupFailed]);

  if (loading) {
    return (
      <Card className="glass-effect-light min-h-[200px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mr-3" />
        <p className="text-gray-300">Loading achievements…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-effect-light min-h-[200px] flex flex-col items-center justify-center p-4">
        <Trophy className="w-10 h-10 text-red-500 mb-3" />
        <h4 className="text-lg font-semibold text-red-400 mb-1">Could not load achievements</h4>
        <p className="text-sm text-gray-400 text-center">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-effect-light">
        <CardHeader>
          <CardTitle className="golden-text flex items-center">
            <CheckCircle className="mr-2 h-5 w-5 text-green-400" />
            Unlocked Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unlocked.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-6">
              <Sparkles className="w-8 h-8 mb-2 text-yellow-400" />
              <p className="text-sm">No achievements unlocked yet — keep creating!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {unlocked.map((ach, idx) => (
                <div key={ach.id} className="p-4 rounded-lg border border-yellow-400/20 bg-black/30 flex gap-3">
                  {buildBadge(ach, ach.badgeIndex ?? idx, false)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-yellow-200">{ach.name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase bg-white/10 text-gray-200">
                        {ach.rarity || 'common'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{ach.description}</p>
                    {Array.isArray(ach.rewards) && ach.rewards.length > 0 && (
                      <p className="text-[11px] text-emerald-300">
                        Rewards: {ach.rewards.map((r) => `${r.type}:${r.code || ''}${r.amount ? ` x${r.amount}` : ''}${r.project ? ` (${r.project})` : ''}`).join(', ')}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500">
                      Unlocked {formatDistanceToNow(new Date(ach.unlocked_at), { addSuffix: true })}
                      {ach.track_title ? ` • ${ach.track_title}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-effect-light">
        <CardHeader>
          <CardTitle className="golden-text flex items-center">
            <Lock className="mr-2 h-5 w-5 text-gray-400" />
            Locked Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {locked.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-6">
              <CheckCircle className="w-8 h-8 mb-2 text-green-400" />
              <p className="text-sm">You have unlocked every achievement — epic!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {locked.map((ach, idx) => (
                <div key={ach.id} className="p-4 rounded-lg border border-white/10 bg-black/40 flex gap-3 opacity-80">
                  {buildBadge(ach, ach.badgeIndex ?? idx, true)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-200">{ach.name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase bg-white/10 text-gray-200">
                        {ach.rarity || 'common'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{ach.description}</p>
                    {ach.active_from && ach.active_to && (
                      <p className="text-[11px] text-gray-500">
                        Active: {new Date(ach.active_from).toLocaleDateString()} - {new Date(ach.active_to).toLocaleDateString()}
                      </p>
                    )}
                    {Array.isArray(ach.rewards) && ach.rewards.length > 0 && (
                      <p className="text-[11px] text-emerald-300">
                        Rewards: {ach.rewards.map((r) => `${r.type}:${r.code || ''}${r.amount ? ` x${r.amount}` : ''}${r.project ? ` (${r.project})` : ''}`).join(', ')}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1">Locked</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
