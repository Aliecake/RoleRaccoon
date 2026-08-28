import type { ApplicationFormData, Application } from '@/types/applications';

export type ValidationErrors = Partial<Record<keyof ApplicationFormData, string>>;

/**
 * Only http(s) links are safe to render as a clickable anchor. `new URL()`
 * happily parses `javascript:` and `data:` URLs, so the scheme must be checked
 * explicitly or a stored value becomes a script-execution sink.
 */
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateApplication(data: ApplicationFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.company.trim()) {
    errors.company = 'Company is required';
  }
  if (!data.role.trim()) {
    errors.role = 'Role is required';
  }

  const min = data.salary_min !== '' ? parseFloat(data.salary_min) : null;
  const max = data.salary_max !== '' ? parseFloat(data.salary_max) : null;

  if (min !== null && isNaN(min)) {
    errors.salary_min = 'Must be a number';
  } else if (min !== null && min < 0) {
    errors.salary_min = 'Must be a positive number';
  }

  if (max !== null && isNaN(max)) {
    errors.salary_max = 'Must be a number';
  } else if (max !== null && max < 0) {
    errors.salary_max = 'Must be a positive number';
  }

  if (min !== null && max !== null && min > max) {
    errors.salary_min = 'Minimum cannot exceed maximum';
  }

  if (data.job_url.trim()) {
    if (!isSafeHttpUrl(data.job_url)) {
      errors.job_url = 'Must be a valid http:// or https:// URL';
    }
  }

  const currency = data.salary_currency.trim();
  if (currency && currency.length !== 3) {
    errors.salary_currency = 'Must be a 3-letter code';
  }

  return errors;
}

export function formDataToDb(data: ApplicationFormData): Record<string, string | number | null> {
  return {
    company: data.company.trim(),
    role: data.role.trim(),
    status: data.status,
    job_url: data.job_url.trim() || null,
    job_description: data.job_description.trim() || null,
    salary_min: data.salary_min !== '' ? parseFloat(data.salary_min) : null,
    salary_max: data.salary_max !== '' ? parseFloat(data.salary_max) : null,
    salary_currency: data.salary_currency.trim().toUpperCase() || 'USD',
    location: data.location.trim() || null,
    remote_policy: data.remote_policy || null,
    application_date: data.application_date || null,
    next_action: data.next_action.trim() || null,
    next_action_date: data.next_action_date || null,
    notes: data.notes.trim() || null,
  };
}

export function emptyFormData(): ApplicationFormData {
  return {
    company: '',
    role: '',
    status: 'saved',
    job_url: '',
    job_description: '',
    salary_min: '',
    salary_max: '',
    salary_currency: 'USD',
    location: '',
    remote_policy: '',
    application_date: '',
    next_action: '',
    next_action_date: '',
    notes: '',
  };
}

export function applicationToFormData(app: Application): ApplicationFormData {
  return {
    company: app.company,
    role: app.role,
    status: app.status,
    job_url: app.job_url ?? '',
    job_description: app.job_description ?? '',
    salary_min: app.salary_min?.toString() ?? '',
    salary_max: app.salary_max?.toString() ?? '',
    salary_currency: app.salary_currency ?? 'USD',
    location: app.location ?? '',
    remote_policy: app.remote_policy ?? '',
    application_date: app.application_date ?? '',
    next_action: app.next_action ?? '',
    next_action_date: app.next_action_date ?? '',
    notes: app.notes ?? '',
  };
}
