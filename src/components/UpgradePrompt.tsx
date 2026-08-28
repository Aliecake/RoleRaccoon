import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { startProCheckout } from '@/lib/stripeCheckout';

interface UpgradePromptProps {
  message: string;
}

export default function UpgradePrompt({ message }: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      await startProCheckout();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-800">{message}</p>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {loading ? 'Opening checkout…' : 'Upgrade to Pro'}
          </button>
          {error && <p className="text-xs text-red-700 mt-1.5">{error}</p>}
        </div>
      </div>
    </div>
  );
}
