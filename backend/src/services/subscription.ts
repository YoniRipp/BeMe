/**
 * Subscription service — Lemon Squeezy integration for TrackVibe Pro.
 */
import { config } from '../config/index.js';
import { getPool } from '../db/pool.js';
import { logger } from '../lib/logger.js';

const LS_BASE_URL = 'https://api.lemonsqueezy.com';

export interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string };
  };
  data: {
    id: string;
    type: string;
    attributes: {
      customer_id: number;
      status?: string;
      renews_at?: string;
      variant_id?: number | string;
      // Present on subscription-invoice payloads (payment events), where data.id is the invoice id
      subscription_id?: number | string;
      urls?: { customer_portal?: string };
      [key: string]: unknown;
    };
  };
}

async function lsApi(method: string, path: string, body?: unknown): Promise<any> {
  if (!config.lemonSqueezyApiKey) {
    throw new Error('Lemon Squeezy is not configured (missing LEMONSQUEEZY_API_KEY)');
  }
  const res = await fetch(`${LS_BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.lemonSqueezyApiKey}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, 'Lemon Squeezy API error');
    throw new Error(`Lemon Squeezy API error: ${res.status}`);
  }
  return res.json();
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
  plan: 'monthly' | 'yearly' = 'monthly',
  trial: boolean = false,
): Promise<string> {
  const variantId = plan === 'yearly'
    ? config.lemonSqueezyVariantIdYearly
    : config.lemonSqueezyVariantIdMonthly;

  if (!variantId || !config.lemonSqueezyStoreId) {
    throw new Error('Lemon Squeezy checkout is not configured');
  }

  const checkoutData: Record<string, unknown> = {
    email,
    custom: { user_id: userId },
  };
  if (trial) {
    checkoutData.trial_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  const response = await lsApi('POST', '/v1/checkouts', {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: checkoutData,
        product_options: {
          redirect_url: successUrl,
        },
      },
      relationships: {
        store: { data: { type: 'stores', id: config.lemonSqueezyStoreId } },
        variant: { data: { type: 'variants', id: variantId } },
      },
    },
  });

  return response.data.attributes.url;
}

export async function getCustomerPortalUrl(userId: string): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT subscription_id FROM users WHERE id = $1',
    [userId],
  );
  const subscriptionId = rows[0]?.subscription_id;
  if (!subscriptionId) return null;

  const response = await lsApi('GET', `/v1/subscriptions/${subscriptionId}`);
  return response.data.attributes.urls?.customer_portal || null;
}

export async function getUserSubscription(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT subscription_status, subscription_plan, subscription_current_period_end FROM users WHERE id = $1',
    [userId],
  );
  if (rows.length === 0) return null;
  return {
    status: rows[0].subscription_status || 'free',
    plan: rows[0].subscription_plan || null,
    currentPeriodEnd: rows[0].subscription_current_period_end,
  };
}

/** Null subscriptionId/periodEnd/plan mean "keep the stored value", not "clear it". */
export async function updateSubscriptionStatus(
  lemonSqueezyCustomerId: string,
  status: string,
  subscriptionId: string | null,
  periodEnd: Date | null,
  plan: 'monthly' | 'yearly' | null = null,
) {
  const pool = getPool();
  await pool.query(
    `UPDATE users
     SET subscription_status = $1,
         subscription_id = COALESCE($2, subscription_id),
         subscription_current_period_end = COALESCE($3, subscription_current_period_end),
         subscription_plan = COALESCE($4, subscription_plan)
     WHERE lemon_squeezy_customer_id = $5`,
    [status, subscriptionId, periodEnd, plan, lemonSqueezyCustomerId],
  );
}

function getPlanFromVariantId(variantId: unknown): 'monthly' | 'yearly' | null {
  if (variantId == null) return null;
  const normalized = String(variantId);
  if (config.lemonSqueezyVariantIdYearly && normalized === String(config.lemonSqueezyVariantIdYearly)) {
    return 'yearly';
  }
  if (config.lemonSqueezyVariantIdMonthly && normalized === String(config.lemonSqueezyVariantIdMonthly)) {
    return 'monthly';
  }
  return null;
}

export async function handleWebhookEvent(payload: LemonSqueezyWebhookPayload) {
  const eventName = payload.meta.event_name;
  const customData = payload.meta.custom_data;
  const attrs = payload.data.attributes;
  const customerId = String(attrs.customer_id);
  const plan = getPlanFromVariantId(attrs.variant_id);

  switch (eventName) {
    case 'subscription_created': {
      const userId = customData?.user_id;
      if (!userId) {
        logger.warn({ eventName, customerId }, 'subscription_created missing user_id in custom_data');
        break;
      }
      // Link the Lemon Squeezy customer to the user
      const pool = getPool();
      await pool.query(
        'UPDATE users SET lemon_squeezy_customer_id = $1 WHERE id = $2',
        [customerId, userId],
      );
      await updateSubscriptionStatus(
        customerId,
        'pro',
        String(payload.data.id),
        attrs.renews_at ? new Date(attrs.renews_at) : null,
        plan,
      );
      logger.info({ userId, subscriptionId: payload.data.id }, 'Subscription created');
      break;
    }
    case 'subscription_updated': {
      const lsStatus = attrs.status;
      const mappedStatus = lsStatus === 'active' ? 'pro'
        : lsStatus === 'past_due' ? 'past_due'
        : lsStatus === 'cancelled' ? 'canceled'
        : lsStatus === 'paused' ? 'paused'
        : lsStatus === 'expired' ? 'expired'
        : 'free';
      await updateSubscriptionStatus(
        customerId,
        mappedStatus,
        String(payload.data.id),
        attrs.renews_at ? new Date(attrs.renews_at) : null,
        plan,
      );
      logger.info({ customerId, status: mappedStatus }, 'Subscription updated');
      break;
    }
    case 'subscription_payment_failed': {
      // Payment webhooks carry a subscription-invoice: data.id is the invoice id,
      // the subscription id lives in attributes.subscription_id.
      await updateSubscriptionStatus(
        customerId,
        'past_due',
        attrs.subscription_id != null ? String(attrs.subscription_id) : null,
        null,
        plan,
      );
      logger.warn({ customerId }, 'Subscription payment failed');
      break;
    }
    case 'subscription_payment_success': {
      await updateSubscriptionStatus(
        customerId,
        'pro',
        attrs.subscription_id != null ? String(attrs.subscription_id) : null,
        attrs.renews_at ? new Date(attrs.renews_at) : null,
        plan,
      );
      logger.info({ customerId }, 'Subscription payment succeeded');
      break;
    }
    default:
      break;
  }
}
