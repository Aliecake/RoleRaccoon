import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { type StarStory } from '@/types/starStories';
import {
  Plus,
  X,
  AlertCircle,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
} from 'lucide-react';

interface InterviewStoriesProps {
  applicationId: string;
}

export default function InterviewStories({ applicationId }: InterviewStoriesProps) {
  const [attached, setAttached] = useState<StarStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchAttached = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('application_stories')
      .select('story_id, star_stories(*)')
      .eq('application_id', applicationId);

    if (error) {
      console.error('Fetch links failed:', error);
      setError('We could not load the attached stories. Please try again.');
      setLoading(false);
      return;
    }

    const stories = (data ?? [])
      .map((row) => row.star_stories)
      .filter(Boolean) as unknown as StarStory[];

    setAttached(stories);
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    fetchAttached();
  }, [fetchAttached]);

  const handleAttach = async (storyIds: string[]) => {
    if (storyIds.length === 0) return;

    const rows = storyIds.map((storyId) => ({
      application_id: applicationId,
      story_id: storyId,
    }));

    const { error: insertError } = await supabase
      .from('application_stories')
      .insert(rows);

    if (insertError) {
      // 23505 = unique violation — some may already be linked, which is fine
      if (insertError.code !== '23505') {
        console.error('Attach failed:', insertError);
        setError('We could not attach that story. Please try again.');
        return;
      }
    }
    setPickerOpen(false);
    fetchAttached();
  };

  const handleDetach = async (storyId: string) => {
    const { error } = await supabase
      .from('application_stories')
      .delete()
      .eq('application_id', applicationId)
      .eq('story_id', storyId);

    if (error) {
      console.error('Detach failed:', error);
      setError('We could not remove that story. Please try again.');
      return;
    }
    setAttached((prev) => prev.filter((s) => s.id !== storyId));
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Interview Stories</h2>
          <span className="text-xs text-slate-400">
            {attached.length} {attached.length === 1 ? 'story' : 'stories'}
          </span>
        </div>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Story
          {pickerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 mb-4">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {pickerOpen && (
        <StoryPicker
          attachedIds={attached.map((s) => s.id)}
          onAttach={handleAttach}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Loading stories…</div>
      ) : attached.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
          <p className="text-sm text-slate-500">
            No STAR stories attached yet. Click "Add Story" to add stories relevant to this application.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {attached.map((story) => (
            <div
              key={story.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  to={`/stories/${story.id}`}
                  className="text-sm font-medium text-slate-900 hover:underline inline-flex items-center gap-1"
                >
                  {story.title}
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </Link>
                {story.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {story.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDetach(story.id)}
                className="text-slate-400 hover:text-red-600 transition-colors flex-shrink-0 mt-0.5"
                title="Remove from this application"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StoryPicker({
  attachedIds,
  onAttach,
  onClose,
}: {
  attachedIds: string[];
  onAttach: (storyIds: string[]) => void;
  onClose: () => void;
}) {
  const [allStories, setAllStories] = useState<StarStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('star_stories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setError('We could not load your stories. Please try again.');
        setLoading(false);
        return;
      }
      setAllStories((data as StarStory[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const available = allStories.filter((s) => !attachedIds.includes(s.id));
  const filtered = search.trim()
    ? available.filter((s) => {
        const q = search.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
    : available;

  const toggleSelect = (storyId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  };

  const handleAttach = () => {
    onAttach(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 mb-4">
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stories..."
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          autoFocus
        />
      </div>

      {loading && <div className="text-sm text-slate-400 py-2">Loading…</div>}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 mb-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="py-4 text-center">
          <p className="text-sm text-slate-500 mb-2">
            {allStories.length === 0
              ? 'You have no STAR stories yet.'
              : 'No more stories available to attach.'}
          </p>
          {allStories.length === 0 && (
            <Link
              to="/stories/new"
              onClick={onClose}
              className="text-sm text-slate-600 hover:text-slate-900 underline"
            >
              Create a new story
            </Link>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map((story) => {
              const isSelected = selected.has(story.id);
              return (
                <button
                  key={story.id}
                  onClick={() => toggleSelect(story.id)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    isSelected ? 'bg-slate-100 ring-1 ring-slate-300' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div
                      className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900'
                          : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{story.title}</p>
                      {story.tags.length > 0 && (
                        <p className="text-xs text-slate-500 truncate">{story.tags.join(', ')}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {selected.size > 0
                ? `${selected.size} ${selected.size === 1 ? 'story' : 'stories'} selected`
                : 'Select stories to attach'}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAttach}
                disabled={selected.size === 0}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Attach {selected.size > 0 ? `${selected.size}` : ''}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
