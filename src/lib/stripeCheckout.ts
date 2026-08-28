import { supabase } from '@/lib/supabaseClient';

export async function startProCheckout(): Promise<void> {
  const returnUrl = new URL('/', window.location.origin);
  returnUrl.searchParams.set('checkout', 'success');

  const cancelUrl = new URL('/', window.location.origin);
  cancelUrl.searchParams.set('checkout', 'cancelled');

  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: {
      success_url: returnUrl.toString(),
      cancel_url: cancelUrl.toString(),
    },
  });

  if (error) {
    console.error('Checkout invocation failed:', error);
    throw new Error('Unable to start checkout. Please try again.');
  }

  if (!data || typeof data.url !== 'string' || !data.url) {
    throw new Error('Checkout did not return a payment URL');
  }

  window.location.assign(data.url);
  return new Promise(() => undefined);
}
