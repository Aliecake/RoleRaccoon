import { STATUS_LABELS } from '@/types/applications';

const STATUS_STYLES: Record<string, string> = {
  saved: 'bg-slate-100 text-slate-700',
  applied: 'bg-blue-100 text-blue-700',
  interviewing: 'bg-amber-100 text-amber-700',
  offer: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-orange-100 text-orange-700',
  archived: 'bg-gray-100 text-gray-500',
};

export default function StatusBadge({ status }: { status: string }) {
  const styles = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
