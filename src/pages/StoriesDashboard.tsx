import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { type StarStory } from '@/types/starStories';
import AppLayout from '@/components/AppLayout';
import UsageBadge from '@/components/UsageBadge';
import UpgradePrompt from '@/components/UpgradePrompt';
import { usePlanUsage, FREE_STORY_LIMIT } from '@/lib/usePlanUsage';
import { Plus, Star, Tag, AlertCircle, Search } from 'lucide-react';

export default function StoriesDashboard() {
  const [stories, setStories] = useState<StarStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { plan, totalStories, loading: usageLoading } = usePlanUsage();
  const isPro = plan === 'pro';
  const atStoryLimit = !isPro && totalStories >= FREE_STORY_LIMIT;

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('star_stories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch failed:', error);
      setError('We could not load your stories. Please try again.');
      setLoading(false);
      return;
    }

    setStories((data as StarStory[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const filtered = search.trim()
    ? stories.filter((s) => {
        const q = search.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
    : stories;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">STAR Stories</h1>
            <p className="text-sm text-slate-500 mt-1">
              {stories.length} {stories.length === 1 ? 'story' : 'stories'} total
              {!usageLoading && (
                <span className="ml-2">
                  · <UsageBadge used={totalStories} limit={FREE_STORY_LIMIT} isPro={isPro} />
                </span>
              )}
            </p>
          </div>
          <Link
            to="/stories/new"
            className={`flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors ${
              atStoryLimit ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            New story
          </Link>
        </div>

        {atStoryLimit && (
          <div className="mb-6">
            <UpgradePrompt message={`You've reached the Free-plan limit of ${FREE_STORY_LIMIT} STAR stories. Delete an unused story to free up space, or upgrade to Pro for unlimited stories.`} />
          </div>
        )}

        {stories.length > 0 && (
          <div className="relative mb-6">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or tag..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm text-slate-400">Loading stories…</div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-6">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Failed to load stories</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && stories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Star className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No STAR stories yet</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm">
              Prepare for interviews by documenting your experiences using the STAR method.
            </p>
            <Link
              to="/stories/new"
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create your first story
            </Link>
          </div>
        )}

        {!loading && !error && stories.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-slate-500">No stories match "{search}"</p>
            <button
              onClick={() => setSearch('')}
              className="text-sm text-slate-600 hover:text-slate-900 mt-2 underline"
            >
              Clear search
            </button>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StoryCard({ story }: { story: StarStory }) {
  return (
    <Link
      to={`/stories/${story.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all group"
    >
      <h3 className="font-semibold text-slate-900 truncate group-hover:text-slate-700 mb-1">
        {story.title}
      </h3>
      <p className="text-sm text-slate-600 line-clamp-2">
        {story.situation || story.task || story.action || story.result || 'No content yet'}
      </p>
      {story.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {story.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
          {story.tags.length > 4 && (
            <span className="text-xs text-slate-400">+{story.tags.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  );
}
