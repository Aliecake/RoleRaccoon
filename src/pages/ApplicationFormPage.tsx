import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import ApplicationForm from '@/components/ApplicationForm';
import { ArrowLeft } from 'lucide-react';

export default function ApplicationFormPage() {
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

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-slate-900 mb-6">New application</h1>
          <ApplicationForm />
        </div>
      </div>
    </AppLayout>
  );
}
