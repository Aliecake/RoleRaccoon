import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  STATUS_LABELS,
  REMOTE_POLICY_LABELS,
  type Application,
} from '@/types/applications';
import { formatSalary, formatDate } from '@/lib/format';
import { isSafeHttpUrl } from '@/lib/validation';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import ApplicationForm from '@/components/ApplicationForm';
import { ArrowLeft, Pencil, Trash2, ExternalLink, AlertCircle, Briefcase } from 'lucide-react';
import InterviewStories from '@/components/InterviewStories';

type ViewMode = 'view' | 'edit';

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('view');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchApplication = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Fetch failed:', error);
      setError('We could not load this application. Please try again.');
      setLoading(false);
      return;
    }

    if (!data) {
      setError('Application not found');
      setLoading(false);
      return;
    }

    setApplication(data as Application);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);

    const { error } = await supabase.from('applications').delete().eq('id', id);

    if (error) {
      console.error('Delete failed:', error);
      setError('We could not delete this application. Please try again.');
      setDeleting(false);
      setDeleteOpen(false);
      return;
    }

    navigate('/', { replace: true });
  };

  const renderField = (label: string, value: string | null) => {
    if (!value) return null;
    return (
      <div>
        <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</dt>
        <dd className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap">{value}</dd>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to applications
        </Link>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm text-slate-400">Loading…</div>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">{error}</p>
              <Link to="/" className="text-sm text-red-600 hover:underline mt-1 inline-block">
                Back to applications
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && application && (
          <>
            {mode === 'edit' ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-slate-900">Edit application</h2>
                  <button
                    onClick={() => setMode('view')}
                    className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Cancel edit
                  </button>
                </div>
                <ApplicationForm application={application} />
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="min-w-0">
                      <h1 className="text-xl font-bold text-slate-900">{application.company}</h1>
                      <p className="text-slate-600 mt-0.5">{application.role}</p>
                    </div>
                    <StatusBadge status={application.status} />
                  </div>

                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={() => setMode('edit')}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteOpen(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {renderField('Status', STATUS_LABELS[application.status] ?? application.status)}
                    {renderField('Location', application.location)}
                    {renderField(
                      'Remote policy',
                      application.remote_policy
                        ? REMOTE_POLICY_LABELS[application.remote_policy] ?? application.remote_policy
                        : null
                    )}
                    {renderField(
                      'Salary',
                      formatSalary(application.salary_min, application.salary_max, application.salary_currency)
                    )}
                    {renderField('Application date', formatDate(application.application_date))}
                    {renderField('Next action', application.next_action)}
                    {renderField('Next action date', formatDate(application.next_action_date))}
                    {application.job_url && (
                      <div>
                        <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Job URL</dt>
                        <dd className="text-sm mt-0.5">
                          {isSafeHttpUrl(application.job_url) ? (
                            <a
                              href={application.job_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              View posting
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-500 break-all">{application.job_url}</span>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {application.notes && (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Notes</dt>
                      <dd className="text-sm text-slate-800 whitespace-pre-wrap">{application.notes}</dd>
                    </div>
                  )}

                  {application.job_description && (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                        Job description
                      </dt>
                      <dd className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        {application.job_description}
                      </dd>
                    </div>
                  )}

                  <InterviewStories applicationId={application.id} />
                </div>
              </>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete application?"
        message={`This will permanently delete the application for ${application?.company ?? 'this company'}. This cannot be undone.`}
        confirmLabel="Delete"
        confirming={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </AppLayout>
  );
}
