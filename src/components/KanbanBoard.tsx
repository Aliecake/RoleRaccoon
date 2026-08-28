import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { type Application, STATUS_LABELS } from '@/types/applications';
import { formatSalary, formatDate } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import { MapPin, Calendar, AlertCircle } from 'lucide-react';

const KANBAN_COLUMNS = ['saved', 'applied', 'interviewing', 'offer', 'rejected'] as const;

const COLUMN_ACCENTS: Record<string, string> = {
  saved: 'border-slate-300',
  applied: 'border-blue-300',
  interviewing: 'border-amber-300',
  offer: 'border-green-300',
  rejected: 'border-red-300',
};

interface KanbanBoardProps {
  applications: Application[];
  onStatusChange: (appId: string, newStatus: string) => void;
}

export default function KanbanBoard({ applications, onStatusChange }: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimisticApp, setOptimisticApp] = useState<Application | null>(null);

  const columns = KANBAN_COLUMNS.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    items: applications.filter((a) => a.status === status),
  }));

  const handleDragStart = (e: React.DragEvent, appId: string) => {
    setDraggedId(appId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appId);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== status) setDragOverCol(status);
  };

  const handleDragLeave = (status: string) => {
    if (dragOverCol === status) setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);

    const appId = draggedId ?? e.dataTransfer.getData('text/plain');
    setDraggedId(null);
    if (!appId) return;

    const app = applications.find((a) => a.id === appId);
    if (!app || app.status === targetStatus) return;

    const previousStatus = app.status;
    setOptimisticApp({ ...app, status: targetStatus });
    onStatusChange(appId, targetStatus);
    setError(null);

    const { error: updateError } = await supabase
      .from('applications')
      .update({ status: targetStatus })
      .eq('id', appId);

    if (updateError) {
      setOptimisticApp(null);
      onStatusChange(appId, previousStatus);
      setError(
        updateError.message?.includes('Free plan limit')
          ? `Free plan limit reached: you can have at most 4 tracked applications. "${app.company}" was moved back to ${STATUS_LABELS[previousStatus]}.`
          : `Failed to move "${app.company}" to ${STATUS_LABELS[targetStatus]}. It has been returned to ${STATUS_LABELS[previousStatus]}.`
      );
    } else {
      setOptimisticApp(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 mb-4">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 min-h-[400px]">
        {columns.map((col) => (
          <div
            key={col.status}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={() => handleDragLeave(col.status)}
            onDrop={(e) => handleDrop(e, col.status)}
            className={`rounded-xl border-2 bg-slate-50/50 flex flex-col transition-colors ${
              dragOverCol === col.status
                ? `${COLUMN_ACCENTS[col.status]} bg-slate-100`
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/70">
              <span className="text-sm font-semibold text-slate-700">{col.label}</span>
              <span className="text-xs font-medium text-slate-400 bg-white rounded-full px-2 py-0.5 border border-slate-200">
                {col.items.length}
              </span>
            </div>

            <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px]">
              {col.items.map((app) => {
                const isDragging = draggedId === app.id;
                const displayApp =
                  optimisticApp?.id === app.id ? optimisticApp : app;
                return (
                  <KanbanCard
                    key={app.id}
                    app={displayApp}
                    isDragging={isDragging}
                    onDragStart={(e) => handleDragStart(e, app.id)}
                    onDragEnd={handleDragEnd}
                  />
                );
              })}

              {col.items.length === 0 && (
                <div className="flex items-center justify-center h-20 text-xs text-slate-300 border border-dashed border-slate-200 rounded-lg">
                  Drop here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  app,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  app: Application;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const salary = formatSalary(app.salary_min, app.salary_max, app.salary_currency);
  const nextDate = formatDate(app.next_action_date);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-lg border border-slate-200 bg-white p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm hover:border-slate-300 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <Link to={`/applications/${app.id}`} className="block">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <h4 className="font-semibold text-slate-900 text-sm truncate">{app.company}</h4>
            <p className="text-xs text-slate-600 truncate">{app.role}</p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {app.location && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {app.location}
            </span>
          )}
          {salary && <span className="font-medium text-slate-600">{salary}</span>}
        </div>

        {(app.next_action || nextDate) && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-600">
            <Calendar className="w-2.5 h-2.5 text-slate-400" />
            {app.next_action && <span className="font-medium truncate">{app.next_action}</span>}
            {app.next_action && nextDate && <span>·</span>}
            {nextDate && <span className="text-slate-500">{nextDate}</span>}
          </div>
        )}
      </Link>
    </div>
  );
}
