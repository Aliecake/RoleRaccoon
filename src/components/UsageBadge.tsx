import { Sparkles } from 'lucide-react';

interface UsageBadgeProps {
  used: number;
  limit: number;
  isPro: boolean;
}

export default function UsageBadge({ used, limit, isPro }: UsageBadgeProps) {
  if (isPro) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <Sparkles className="w-3.5 h-3.5" />
        Unlimited
      </span>
    );
  }

  const atLimit = used >= limit;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        atLimit ? 'text-red-600' : 'text-slate-500'
      }`}
    >
      {used} / {limit}
    </span>
  );
}
