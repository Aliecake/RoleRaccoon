import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  ACTIVE_STATUSES,
  type Application,
} from '@/types/applications';
import { formatSalary, formatDate } from '@/lib/format';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import QuickAddModal from '@/components/QuickAddModal';
import KanbanBoard from '@/components/KanbanBoard';
import UsageBadge from '@/components/UsageBadge';
import UpgradePrompt from '@/components/UpgradePrompt';
import { usePlanUsage, FREE_APP_LIMIT } from '@/lib/usePlanUsage';
import { Plus, Briefcase, MapPin, Calendar, AlertCircle, LayoutGrid, List, Clock, ChevronDown, ChevronUp } from 'lucide-react';

export default function ApplicationsDashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [view, setView] = useState<'list' | 'board'>(() =>
    (sessionStorage.getItem('appView') as 'list' | 'board') || 'board'
  );

  const handleViewChange = (v: 'list' | 'board') => {
    setView(v);
    sessionStorage.setItem('appView', v);
  };
  const { plan, activeApplications, loading: usageLoading, refresh: refreshUsage } = usePlanUsage();
  const [searchParams] = useSearchParams();
  const isPro = plan === 'pro';
  const atAppLimit = !isPro && activeApplications >= FREE_APP_LIMIT;

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch failed:', error);
      setError('We could not load your applications. Please try again.');
      setLoading(false);
      return;
    }

    setApplications((data as Application[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      refreshUsage();
    }
  }, [refreshUsage, searchParams]);

  const handleCreated = (app: Application) => {
    setApplications((prev) => [app, ...prev]);
  };

  const handleStatusChange = (appId: string, newStatus: string) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
    );
  };

  const filtered =
    statusFilter === 'all'
      ? applications
      : applications.filter((a) => a.status === statusFilter);

  const statusCounts = applications.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const needsAttention = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return applications
      .filter((a) => ACTIVE_STATUSES.includes(a.status as (typeof ACTIVE_STATUSES)[number]) && a.next_action_date)
      .map((a) => {
        const due = new Date(a.next_action_date! + 'T00:00:00');
        const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
        let urgency: number;
        if (diffDays < 0) urgency = 0;
        else if (diffDays === 0) urgency = 1;
        else if (diffDays <= 7) urgency = 2;
        else urgency = 3;
        return { app: a, diffDays, urgency, due };
      })
      .filter((x) => x.urgency < 3)
      .sort((a, b) => a.urgency - b.urgency || a.due.getTime() - b.due.getTime())
      .slice(0, 5);
  }, [applications]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
            <p className="text-sm text-slate-500 mt-1">
              {applications.length} {applications.length === 1 ? 'application' : 'applications'} total
              {!usageLoading && (
                <span className="ml-2">
                  · Tracked <UsageBadge used={activeApplications} limit={FREE_APP_LIMIT} isPro={isPro} />
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                onClick={() => handleViewChange('list')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  view === 'list'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleViewChange('board')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  view === 'board'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Board view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setQuickAddOpen(true)}
              disabled={atAppLimit}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Quick add
            </button>
            <Link
              to="/applications/new"
              className={`flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold transition-colors ${
                atAppLimit
                  ? 'text-slate-400 pointer-events-none opacity-50'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Plus className="w-4 h-4" />
              Full form
            </Link>
          </div>
        </div>

        {atAppLimit && (
          <div className="mb-6">
            <UpgradePrompt message={`You've reached the Free-plan limit of ${FREE_APP_LIMIT} tracked applications. Archive an application to free up space, or upgrade to Pro for unlimited applications.`} />
          </div>
        )}

        {!loading && !error && needsAttention.length > 0 && (
          <NeedsAttention items={needsAttention} />
        )}

        {view === 'list' && (
          <div className="flex flex-wrap gap-2 mb-6">
            <FilterChip
              label="All"
              count={applications.length}
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            />
            {APPLICATION_STATUSES.map((status) => (
              <FilterChip
                key={status}
                label={STATUS_LABELS[status]}
                count={statusCounts[status] ?? 0}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              />
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm text-slate-400">Loading applications…</div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-6">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Failed to load applications</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && applications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Briefcase className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No applications yet</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm">
              Start tracking your job search by adding your first application.
            </p>
            <button
              onClick={() => setQuickAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add your first application
            </button>
          </div>
        )}

        {!loading && !error && view === 'list' && applications.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No applications with this status</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm">
              Try a different status filter to see more applications.
            </p>
          </div>
        )}

        {!loading && !error && view === 'list' && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        )}

        {!loading && !error && view === 'board' && applications.length > 0 && (
          <KanbanBoard applications={applications} onStatusChange={handleStatusChange} />
        )}
      </div>

      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={handleCreated}
      />
    </AppLayout>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
      <span
        className={`text-xs ${active ? 'text-slate-300' : 'text-slate-400'}`}
      >
        {count}
      </span>
    </button>
  );
}

function ApplicationCard({ app }: { app: Application }) {
  const salary = formatSalary(app.salary_min, app.salary_max, app.salary_currency);
  const nextDate = formatDate(app.next_action_date);

  return (
    <Link
      to={`/applications/${app.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 truncate group-hover:text-slate-700">
            {app.company}
          </h3>
          <p className="text-sm text-slate-600 truncate">{app.role}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {app.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {app.location}
            {app.remote_policy && ` · ${app.remote_policy}`}
          </span>
        )}
        {salary && <span className="font-medium text-slate-600">{salary}</span>}
      </div>

      {(app.next_action || nextDate) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-600">
          <Calendar className="w-3 h-3 text-slate-400" />
          {app.next_action && <span className="font-medium">{app.next_action}</span>}
          {app.next_action && nextDate && <span>·</span>}
          {nextDate && <span className="text-slate-500">{nextDate}</span>}
        </div>
      )}
    </Link>
  );
}

function dueLabel(diffDays: number): string {
  if (diffDays < 0) {
    const d = Math.abs(diffDays);
    return d === 1 ? '1 day overdue' : `${d} days overdue`;
  }
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}

function dueColor(diffDays: number): string {
  if (diffDays < 0) return 'text-red-600';
  if (diffDays === 0) return 'text-amber-600';
  return 'text-slate-500';
}

function NeedsAttention({
  items,
}: {
  items: { app: Application; diffDays: number }[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 mb-3"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
          {collapsed ? (
            <>
              Show
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Hide
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          )}
        </span>
      </button>
      {!collapsed && (
      <ul className="divide-y divide-slate-100">
        {items.map(({ app, diffDays }) => (
          <li key={app.id}>
            <Link
              to={`/applications/${app.id}`}
              className="flex items-center justify-between gap-3 py-2.5 group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate group-hover:text-slate-700">
                    {app.company}
                  </span>
                  <span className="text-xs text-slate-500 truncate">{app.role}</span>
                </div>
                {app.next_action && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{app.next_action}</p>
                )}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${dueColor(diffDays)}`}>
                {dueLabel(diffDays)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
