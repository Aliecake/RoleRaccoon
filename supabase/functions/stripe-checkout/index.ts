import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  appInfo: {
    name: 'RoleRaccoon',
    version: '1.0.0',
  },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function jsonResponse(body: string | object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Origins the checkout flow is allowed to return the browser to.
 * Configure ALLOWED_REDIRECT_ORIGINS as a comma-separated list of origins
 * (e.g. "https://app.example.com,https://example.com"). When it is not set we
 * fall back to the origin the request itself came from, which keeps the
 * deployed app working without extra configuration.
 */
function allowedOrigins(req: Request): string[] {
  const configured = (Deno.env.get('ALLOWED_REDIRECT_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (configured.length > 0) return configured;

  const requestOrigin = req.headers.get('Origin');
  return requestOrigin ? [requestOrigin] : [];
}

/**
 * Accepts a return URL only when it parses, uses an http(s) scheme, and its
 * origin is allowlisted. Everything else is rejected, so a caller cannot make
 * Stripe redirect a visitor to an unrelated site after payment.
 */
function isAllowedReturnUrl(candidate: string, origins: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  return origins.includes(parsed.origin);
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const body = await req.json();
    const { success_url, cancel_url } = body;

    if (typeof success_url !== 'string' || typeof cancel_url !== 'string') {
      return jsonResponse({ error: 'Checkout return URLs are required' }, 400);
    }

    const origins = allowedOrigins(req);
    if (
      origins.length === 0 ||
      !isAllowedReturnUrl(success_url, origins) ||
      !isAllowedReturnUrl(cancel_url, origins)
    ) {
      return jsonResponse({ error: 'Checkout return URLs are not permitted' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);

    if (getUserError || !user) {
      return jsonResponse({ error: 'Failed to authenticate user' }, 401);
    }

    const { data: customer, error: getCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (getCustomerError) {
      console.error('Failed to fetch customer information:', getCustomerError);
      return jsonResponse({ error: 'Failed to fetch customer information' }, 500);
    }

    let customerId = customer?.customer_id;

    if (!customerId) {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });

      const { error: createCustomerError } = await supabase.from('stripe_customers').insert({
        user_id: user.id,
        customer_id: newCustomer.id,
      });

      if (createCustomerError) {
        await stripe.customers.del(newCustomer.id);
        console.error('Failed to save customer information:', createCustomerError);
        return jsonResponse({ error: 'Failed to create customer mapping' }, 500);
      }

      customerId = newCustomer.id;
    }

    const products = await stripe.products.list({ active: true, limit: 100 });
    const proProduct = products.data.find((product) => product.name === 'RoleRaccoon Pro');

    if (!proProduct) {
      return jsonResponse({ error: 'RoleRaccoon Pro product is not configured' }, 500);
    }

    const prices = await stripe.prices.list({
      active: true,
      product: proProduct.id,
      type: 'recurring',
      limit: 100,
    });
    const proPrice = prices.data[0];

    if (!proPrice) {
      return jsonResponse({ error: 'RoleRaccoon Pro price is not configured' }, 500);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: proPrice.id, quantity: 1 }],
      mode: 'subscription',
      success_url,
      cancel_url,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
    });

    return jsonResponse({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return jsonResponse({ error: 'Unable to start checkout' }, 500);
  }
});
