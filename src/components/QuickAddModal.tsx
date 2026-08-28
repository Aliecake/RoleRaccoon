import { useState, FormEvent, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type Application,
} from '@/types/applications';
import { safeErrorMessage, PLAN_LIMIT_APPLICATIONS } from '@/lib/errors';
import { X } from 'lucide-react';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (app: Application) => void;
}

export default function QuickAddModal({ open, onClose, onCreated }: QuickAddModalProps) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('saved');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCompany('');
      setRole('');
      setStatus('saved');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!company.trim() || !role.trim()) {
      setError('Company and role are required');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data, error } = await supabase
      .from('applications')
      .insert({
        company: company.trim(),
        role: role.trim(),
        status,
      })
      .select()
      .single();

    if (error) {
      console.error('Quick add failed:', error);
      setError(
        safeErrorMessage(
          error,
          'We could not create this application. Please try again.',
          PLAN_LIMIT_APPLICATIONS,
        ),
      );
      setSubmitting(false);
      return;
    }

    onCreated(data as Application);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/30" onClick={() => !submitting && onClose()} />
      <div className="relative bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Quick Add</h2>
          <button
            onClick={() => !submitting && onClose()}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company *</label>
            <input
              type="text"
              required
              autoFocus
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
            <input
              type="text"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              placeholder="e.g. Senior Backend Engineer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add application'}
            </button>
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <Link
            to="/applications/new"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            Need more fields? Use the full form →
          </Link>
        </div>
      </div>
    </div>
  );
}
