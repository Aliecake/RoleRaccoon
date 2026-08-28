import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
export interface PlanUsage {
  plan: 'free' | 'pro' | null;
  activeApplications: number;
  totalStories: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const FREE_APP_LIMIT = 4;
export const FREE_STORY_LIMIT = 3;

export function usePlanUsage(): PlanUsage {
  const [plan, setPlan] = useState<'free' | 'pro' | null>(null);
  const [activeApplications, setActiveApplications] = useState(0);
  const [totalStories, setTotalStories] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [profileRes, appsRes, storiesRes] = await Promise.all([
      supabase.from('profiles').select('plan').maybeSingle(),
      supabase.from('applications').select('status'),
      supabase.from('star_stories').select('id', { count: 'exact', head: true }),
    ]);

    if (profileRes.data) {
      setPlan(profileRes.data.plan as 'free' | 'pro');
    }
    const apps = (appsRes.data ?? []) as { status: string }[];
    setActiveApplications(apps.filter((a) => a.status !== 'archived').length);
    setTotalStories(storiesRes.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plan, activeApplications, totalStories, loading, refresh };
}
