import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { safeErrorMessage, PLAN_LIMIT_APPLICATIONS } from '@/lib/errors';
import {
  APPLICATION_STATUSES,
  REMOTE_POLICIES,
  STATUS_LABELS,
  REMOTE_POLICY_LABELS,
  type Application,
  type ApplicationFormData,
} from '@/types/applications';
import {
  validateApplication,
  formDataToDb,
  emptyFormData,
  applicationToFormData,
  type ValidationErrors,
} from '@/lib/validation';
import { usePlanUsage, FREE_APP_LIMIT } from '@/lib/usePlanUsage';
import UpgradePrompt from '@/components/UpgradePrompt';

interface ApplicationFormProps {
  application?: Application;
}

export default function ApplicationForm({ application }: ApplicationFormProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<ApplicationFormData>(
    application ? applicationToFormData(application) : emptyFormData()
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { plan, activeApplications } = usePlanUsage();
  const isPro = plan === 'pro';
  const isTracked = data.status !== 'archived';
  const wasTracked = application ? application.status !== 'archived' : false;
  const wouldConsumeSlot = isTracked && !wasTracked;
  const blockedByLimit = !isPro && activeApplications >= FREE_APP_LIMIT && wouldConsumeSlot;

  const update = (field: keyof ApplicationFormData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const validationErrors = validateApplication(data);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    const dbData = formDataToDb(data);

    if (application) {
      const { data: updated, error } = await supabase
        .from('applications')
        .update(dbData)
        .eq('id', application.id)
        .select()
        .single();

      if (error) {
        console.error('Update failed:', error);
        setSubmitError(
          safeErrorMessage(
            error,
            'We could not save your changes. Please try again.',
            PLAN_LIMIT_APPLICATIONS,
          ),
        );
        setSubmitting(false);
        return;
      }
      navigate('/', { replace: true });
    } else {
      const { data: created, error } = await supabase
        .from('applications')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        console.error('Create failed:', error);
        setSubmitError(
          safeErrorMessage(
            error,
            'We could not create this application. Please try again.',
            PLAN_LIMIT_APPLICATIONS,
          ),
        );
        setSubmitting(false);
        return;
      }
      navigate(`/applications/${created.id}`, { replace: true });
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const errorClass = 'text-xs text-red-600 mt-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Basics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Company *</label>
            <input
              type="text"
              required
              value={data.company}
              onChange={(e) => update('company', e.target.value)}
              className={inputClass}
            />
            {errors.company && <p className={errorClass}>{errors.company}</p>}
          </div>
          <div>
            <label className={labelClass}>Role *</label>
            <input
              type="text"
              required
              value={data.role}
              onChange={(e) => update('role', e.target.value)}
              className={inputClass}
            />
            {errors.role && <p className={errorClass}>{errors.role}</p>}
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={data.status}
              onChange={(e) => update('status', e.target.value)}
              className={inputClass}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Job URL</label>
            <input
              type="url"
              value={data.job_url}
              onChange={(e) => update('job_url', e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
            {errors.job_url && <p className={errorClass}>{errors.job_url}</p>}
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Compensation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Salary min</label>
            <input
              type="number"
              min="0"
              value={data.salary_min}
              onChange={(e) => update('salary_min', e.target.value)}
              className={inputClass}
              placeholder="e.g. 80000"
            />
            {errors.salary_min && <p className={errorClass}>{errors.salary_min}</p>}
          </div>
          <div>
            <label className={labelClass}>Salary max</label>
            <input
              type="number"
              min="0"
              value={data.salary_max}
              onChange={(e) => update('salary_max', e.target.value)}
              className={inputClass}
              placeholder="e.g. 120000"
            />
            {errors.salary_max && <p className={errorClass}>{errors.salary_max}</p>}
          </div>
          <div>
            <label className={labelClass}>Currency</label>
            <input
              type="text"
              maxLength={3}
              value={data.salary_currency}
              onChange={(e) => update('salary_currency', e.target.value.toUpperCase())}
              className={inputClass}
              placeholder="USD"
            />
            {errors.salary_currency && <p className={errorClass}>{errors.salary_currency}</p>}
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Logistics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Location</label>
            <input
              type="text"
              value={data.location}
              onChange={(e) => update('location', e.target.value)}
              className={inputClass}
              placeholder="e.g. San Francisco, CA"
            />
          </div>
          <div>
            <label className={labelClass}>Remote policy</label>
            <select
              value={data.remote_policy}
              onChange={(e) => update('remote_policy', e.target.value)}
              className={inputClass}
            >
              <option value="">Not specified</option>
              {REMOTE_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {REMOTE_POLICY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Application date</label>
            <input
              type="date"
              value={data.application_date}
              onChange={(e) => update('application_date', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Tracking</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Next action</label>
            <input
              type="text"
              value={data.next_action}
              onChange={(e) => update('next_action', e.target.value)}
              className={inputClass}
              placeholder="e.g. Follow up with recruiter"
            />
          </div>
          <div>
            <label className={labelClass}>Next action date</label>
            <input
              type="date"
              value={data.next_action_date}
              onChange={(e) => update('next_action_date', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Notes</h3>
        <textarea
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder="Any additional notes..."
        />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Job description</h3>
        <textarea
          value={data.job_description}
          onChange={(e) => update('job_description', e.target.value)}
          className={`${inputClass} min-h-[160px] font-mono text-xs`}
          placeholder="Paste the full job posting here..."
        />
        <p className="text-xs text-slate-400 mt-1">
          Stored as-is for future reference and potential AI-assisted preparation.
        </p>
      </section>

      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {blockedByLimit && (
        <UpgradePrompt message={`You've reached the Free-plan limit of ${FREE_APP_LIMIT} tracked applications. Archive an application to free up space, or upgrade to Pro for unlimited applications.`} />
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => navigate(application ? `/applications/${application.id}` : '/')}
          disabled={submitting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || blockedByLimit}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? 'Saving…'
            : application
            ? 'Save changes'
            : 'Create application'}
        </button>
      </div>
    </form>
  );
}
