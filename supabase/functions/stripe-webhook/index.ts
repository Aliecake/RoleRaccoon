import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  appInfo: {
    name: 'RoleRaccoon',
    version: '1.0.0',
  },
});
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function response(body: string | object, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return response('Method not allowed', 405);
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return response('No signature found', 400);
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return response('Webhook signature verification failed', 400);
    }

    EdgeRuntime.waitUntil(handleEvent(event));
    return response({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return response({ error: 'Webhook processing failed' }, 500);
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event.data.object;

  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;
    if (typeof session.customer === 'string' && session.mode === 'subscription') {
      await syncCustomerFromStripe(session.customer);
    }
    return;
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const subscription = stripeData as Stripe.Subscription;
    if (typeof subscription.customer === 'string') {
      await syncCustomerFromStripe(subscription.customer);
    }
    return;
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const invoice = stripeData as Stripe.Invoice;
    if (typeof invoice.customer === 'string') {
      await syncCustomerFromStripe(invoice.customer);
    }
  }
}

const PRO_PRODUCT_NAME = 'RoleRaccoon Pro';

// Statuses that represent a subscription the customer is actually paying for.
const PAID_STATUSES = new Set(['active']);

/**
 * Resolves the set of price ids that belong to the Pro product.
 * Returns null when the product or its prices cannot be resolved, so that a
 * Stripe misconfiguration never silently downgrades a paying customer.
 */
async function getProPriceIds(): Promise<Set<string> | null> {
  try {
    const products = await stripe.products.list({ active: true, limit: 100 });
    const proProduct = products.data.find((product) => product.name === PRO_PRODUCT_NAME);
    if (!proProduct) return null;

    const prices = await stripe.prices.list({
      active: true,
      product: proProduct.id,
      type: 'recurring',
      limit: 100,
    });
    const ids = prices.data.map((price) => price.id);
    return ids.length > 0 ? new Set(ids) : null;
  } catch (error) {
    console.error('Failed to resolve Pro price ids:', error);
    return null;
  }
}

async function setPlanForCustomer(
  customerId: string,
  plan: 'free' | 'pro',
  subscriptionId: string | null,
) {
  const { data: customer, error: customerError } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .maybeSingle();

  if (customerError) throw customerError;
  if (!customer) return;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      plan,
      stripe_customer_id: plan === 'pro' ? customerId : null,
      stripe_subscription_id: plan === 'pro' ? subscriptionId : null,
    })
    .eq('id', customer.user_id);

  if (profileError) throw profileError;
}

async function syncCustomerFromStripe(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  const subscription = subscriptions.data[0];

  if (!subscription) {
    const { error } = await supabase
      .from('stripe_subscriptions')
      .upsert(
        { customer_id: customerId, status: 'not_started' },
        { onConflict: 'customer_id' },
      );
    if (error) throw error;
    // No subscription at all: the customer is not entitled to Pro.
    await setPlanForCustomer(customerId, 'free', null);
    return;
  }

  const defaultPaymentMethod = subscription.default_payment_method;
  const { error: subscriptionError } = await supabase
    .from('stripe_subscriptions')
    .upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0]?.price.id ?? null,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        payment_method_brand:
          defaultPaymentMethod && typeof defaultPaymentMethod !== 'string'
            ? defaultPaymentMethod.card?.brand ?? null
            : null,
        payment_method_last4:
          defaultPaymentMethod && typeof defaultPaymentMethod !== 'string'
            ? defaultPaymentMethod.card?.last4 ?? null
            : null,
        status: subscription.status,
      },
      { onConflict: 'customer_id' },
    );

  if (subscriptionError) throw subscriptionError;

  // Entitlement decision. Two independent conditions must both hold:
  //  1. the subscription is in a paid state (F1: cancellation revokes Pro)
  //  2. the subscription's price belongs to the Pro product (F2)
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const isPaid = PAID_STATUSES.has(subscription.status);

  let isProPrice = true;
  if (isPaid) {
    const proPriceIds = await getProPriceIds();
    // A null lookup means Stripe is misconfigured; keep the previous, more
    // permissive behaviour rather than downgrading a genuine paying customer.
    if (proPriceIds !== null) {
      isProPrice = priceId !== null && proPriceIds.has(priceId);
    }
  }

  if (isPaid && isProPrice) {
    await setPlanForCustomer(customerId, 'pro', subscription.id);
  } else {
    await setPlanForCustomer(customerId, 'free', null);
  }
}
