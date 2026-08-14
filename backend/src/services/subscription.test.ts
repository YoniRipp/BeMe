import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../config/index.js', () => ({
  config: {
    lemonSqueezyApiKey: 'test_api_key',
    lemonSqueezyStoreId: 'store_123',
    lemonSqueezyVariantIdMonthly: 'variant_monthly',
    lemonSqueezyVariantIdYearly: 'variant_yearly',
    lemonSqueezyWebhookSecret: 'webhook_secret',
  },
}));

vi.mock('../db/pool.js', () => ({
  getPool: () => ({ query: mockQuery }),
}));

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { getUserSubscription, updateSubscriptionStatus, handleWebhookEvent } =
  await import('./subscription.js');

describe('subscription service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserSubscription', () => {
    it('returns subscription status from DB', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ subscription_status: 'pro', subscription_current_period_end: '2026-04-01T00:00:00Z' }],
      });

      const result = await getUserSubscription('user-123');

      expect(result).toEqual({
        status: 'pro',
        plan: null,
        currentPeriodEnd: '2026-04-01T00:00:00Z',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('subscription_status'),
        ['user-123'],
      );
    });

    it('returns null when user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getUserSubscription('nonexistent');

      expect(result).toBeNull();
    });

    it('defaults to free when subscription_status is null', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ subscription_status: null, subscription_current_period_end: null }],
      });

      const result = await getUserSubscription('user-123');

      expect(result).toEqual({ status: 'free', plan: null, currentPeriodEnd: null });
    });
  });

  describe('updateSubscriptionStatus', () => {
    it('updates DB with new status using lemon_squeezy_customer_id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await updateSubscriptionStatus('ls_cus_123', 'pro', 'sub_123', new Date('2026-04-01'));

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('lemon_squeezy_customer_id'),
        ['pro', 'sub_123', expect.any(Date), null, 'ls_cus_123'],
      );
    });
  });

  describe('handleWebhookEvent', () => {
    it('activates subscription on subscription_created', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await handleWebhookEvent({
        meta: {
          event_name: 'subscription_created',
          custom_data: { user_id: 'user-123' },
        },
        data: {
          id: 'sub_456',
          type: 'subscriptions',
          attributes: {
            customer_id: 789,
            status: 'active',
            renews_at: '2026-04-01T00:00:00Z',
          },
        },
      });

      // First call links customer ID to user
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('lemon_squeezy_customer_id'),
        ['789', 'user-123'],
      );
      // Second call updates subscription status
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['pro', 'sub_456']),
      );
    });

    it('updates status on subscription_updated', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await handleWebhookEvent({
        meta: {
          event_name: 'subscription_updated',
        },
        data: {
          id: 'sub_456',
          type: 'subscriptions',
          attributes: {
            customer_id: 789,
            status: 'cancelled',
            renews_at: null,
          },
        },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['canceled', 'sub_456']),
      );
    });

    it('sets past_due on subscription_payment_failed, storing the subscription id (not the invoice id)', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      // Payment webhooks carry a subscription-invoice: data.id is the invoice id
      await handleWebhookEvent({
        meta: {
          event_name: 'subscription_payment_failed',
        },
        data: {
          id: 'inv_001',
          type: 'subscription-invoices',
          attributes: {
            customer_id: 789,
            subscription_id: 'sub_456',
          },
        },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['past_due', 'sub_456']),
      );
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['inv_001']),
      );
    });

    it('sets pro on subscription_payment_success, storing the subscription id (not the invoice id)', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await handleWebhookEvent({
        meta: {
          event_name: 'subscription_payment_success',
        },
        data: {
          id: 'inv_001',
          type: 'subscription-invoices',
          attributes: {
            customer_id: 789,
            subscription_id: 'sub_456',
            renews_at: '2026-05-01T00:00:00Z',
          },
        },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['pro', 'sub_456']),
      );
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['inv_001']),
      );
    });

    it('ignores unknown event types', async () => {
      await handleWebhookEvent({
        meta: { event_name: 'some.unknown.event' },
        data: {
          id: '1',
          type: 'unknown',
          attributes: { customer_id: 1 },
        },
      });

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('warns and skips subscription_created when user_id is missing', async () => {
      await handleWebhookEvent({
        meta: {
          event_name: 'subscription_created',
          custom_data: {},
        },
        data: {
          id: 'sub_456',
          type: 'subscriptions',
          attributes: {
            customer_id: 789,
            status: 'active',
          },
        },
      });

      expect(mockQuery).not.toHaveBeenCalled();
    });
  });
});
