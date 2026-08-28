export const APPLICATION_STATUSES = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
  'archived',
] as const;

export const REMOTE_POLICIES = ['remote', 'hybrid', 'onsite'] as const;

export const ACTIVE_STATUSES = ['saved', 'applied', 'interviewing', 'offer'];

export const STATUS_LABELS: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  archived: 'Archived',
};

export const REMOTE_POLICY_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
};

export interface Application {
  id: string;
  user_id: string;
  company: string;
  role: string;
  job_url: string | null;
  job_description: string | null;
  status: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  location: string | null;
  remote_policy: string | null;
  application_date: string | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationFormData {
  company: string;
  role: string;
  status: string;
  job_url: string;
  job_description: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  location: string;
  remote_policy: string;
  application_date: string;
  next_action: string;
  next_action_date: string;
  notes: string;
}
