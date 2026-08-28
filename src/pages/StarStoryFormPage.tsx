import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import StarStoryForm from '@/components/StarStoryForm';
import { ArrowLeft } from 'lucide-react';

export default function StarStoryFormPage() {
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

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-bold text-slate-900 mb-6">New STAR story</h1>
          <StarStoryForm />
        </div>
      </div>
    </AppLayout>
  );
}
