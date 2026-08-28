import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  type StarStory,
  type StarStoryFormData,
  emptyStarStoryFormData,
  starStoryToFormData,
  starStoryFormDataToDb,
} from '@/types/starStories';
import { usePlanUsage, FREE_STORY_LIMIT } from '@/lib/usePlanUsage';
import { safeErrorMessage, PLAN_LIMIT_STORIES } from '@/lib/errors';
import UpgradePrompt from '@/components/UpgradePrompt';

interface StarStoryFormProps {
  story?: StarStory;
}

export default function StarStoryForm({ story }: StarStoryFormProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<StarStoryFormData>(
    story ? starStoryToFormData(story) : emptyStarStoryFormData()
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { plan, totalStories } = usePlanUsage();
  const isPro = plan === 'pro';
  const blockedByLimit = !story && !isPro && totalStories >= FREE_STORY_LIMIT;

  const update = (field: keyof StarStoryFormData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!data.title.trim()) {
      setSubmitError('Title is required');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const dbData = starStoryFormDataToDb(data);

    if (story) {
      const { data: updated, error } = await supabase
        .from('star_stories')
        .update(dbData)
        .eq('id', story.id)
        .select()
        .single();

      if (error) {
        console.error('Update failed:', error);
        setSubmitError(
          safeErrorMessage(
            error,
            'We could not save your changes. Please try again.',
            PLAN_LIMIT_STORIES,
          ),
        );
        setSubmitting(false);
        return;
      }
      navigate(`/stories/${updated.id}`, { replace: true });
    } else {
      const { data: created, error } = await supabase
        .from('star_stories')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        console.error('Create failed:', error);
        setSubmitError(
          safeErrorMessage(
            error,
            'We could not create this story. Please try again.',
            PLAN_LIMIT_STORIES,
          ),
        );
        setSubmitting(false);
        return;
      }
      navigate(`/stories/${created.id}`, { replace: true });
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Title</h3>
        <div>
          <label className={labelClass}>Title *</label>
          <input
            type="text"
            required
            value={data.title}
            onChange={(e) => update('title', e.target.value)}
            className={inputClass}
            placeholder="e.g. Resolving a production outage"
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Situation</h3>
        <textarea
          value={data.situation}
          onChange={(e) => update('situation', e.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder="Describe the context or challenge you faced..."
        />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Task</h3>
        <textarea
          value={data.task}
          onChange={(e) => update('task', e.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder="What were you responsible for in this situation?"
        />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Action</h3>
        <textarea
          value={data.action}
          onChange={(e) => update('action', e.target.value)}
          className={`${inputClass} min-h-[120px]`}
          placeholder="What specific steps did you take?"
        />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Result</h3>
        <textarea
          value={data.result}
          onChange={(e) => update('result', e.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder="What was the outcome? Quantify if possible..."
        />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Tags</h3>
        <input
          type="text"
          value={data.tags}
          onChange={(e) => update('tags', e.target.value)}
          className={inputClass}
          placeholder="leadership, debugging, teamwork"
        />
        <p className="text-xs text-slate-400 mt-1">Comma-separated keywords to help you find this story later.</p>
      </section>

      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {blockedByLimit && (
        <UpgradePrompt message={`You've reached the Free-plan limit of ${FREE_STORY_LIMIT} STAR stories. Delete an unused story to free up space, or upgrade to Pro for unlimited stories.`} />
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => navigate(story ? `/stories/${story.id}` : '/stories')}
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
          {submitting ? 'Saving…' : story ? 'Save changes' : 'Create story'}
        </button>
      </div>
    </form>
  );
}
