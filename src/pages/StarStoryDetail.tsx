import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { type StarStory } from '@/types/starStories';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import StarStoryForm from '@/components/StarStoryForm';
import { formatDate } from '@/lib/format';
import { ArrowLeft, Pencil, Trash2, AlertCircle, Tag } from 'lucide-react';

type ViewMode = 'view' | 'edit';

export default function StarStoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [story, setStory] = useState<StarStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('view');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchStory = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('star_stories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Fetch failed:', error);
      setError('We could not load this story. Please try again.');
      setLoading(false);
      return;
    }

    if (!data) {
      setError('Story not found');
      setLoading(false);
      return;
    }

    setStory(data as StarStory);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);

    const { error } = await supabase.from('star_stories').delete().eq('id', id);

    if (error) {
      console.error('Delete failed:', error);
      setError('We could not delete this story. Please try again.');
      setDeleting(false);
      setDeleteOpen(false);
      return;
    }

    navigate('/stories', { replace: true });
  };

  const renderSection = (label: string, value: string) => {
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
          to="/stories"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to stories
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
              <Link to="/stories" className="text-sm text-red-600 hover:underline mt-1 inline-block">
                Back to stories
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && story && (
          <>
            {mode === 'edit' ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-slate-900">Edit story</h2>
                  <button
                    onClick={() => setMode('view')}
                    className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Cancel edit
                  </button>
                </div>
                <StarStoryForm story={story} />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold text-slate-900">{story.title}</h1>
                    <p className="text-xs text-slate-400 mt-1">
                      Created {formatDate(story.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
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
                </div>

                <dl className="space-y-4">
                  {renderSection('Situation', story.situation)}
                  {renderSection('Task', story.task)}
                  {renderSection('Action', story.action)}
                  {renderSection('Result', story.result)}
                </dl>

                {story.tags.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                      Tags
                    </dt>
                    <div className="flex flex-wrap gap-2">
                      {story.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete STAR story?"
        message={`This will permanently delete "${story?.title ?? 'this story'}" and remove it from any linked applications. This cannot be undone.`}
        confirmLabel="Delete"
        confirming={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </AppLayout>
  );
}
