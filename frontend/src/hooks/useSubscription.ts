import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscriptionApi } from '@/core/api/subscription';
import { toast } from '@/components/shared/ToastProvider';

export function useSubscription() {
  const { user } = useAuth();
  const isPro = user?.subscriptionStatus === 'pro';
  const aiCallsRemaining = user?.aiCallsRemaining ?? 0;
  const hasAiAccess = isPro || aiCallsRemaining > 0;

  const subscribe = useCallback(async () => {
    try {
      const { url } = await subscriptionApi.createCheckout('monthly');
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not start checkout. Please try again.'
      );
    }
  }, []);

  const subscribeYearly = useCallback(async () => {
    try {
      const { url } = await subscriptionApi.createCheckout('yearly');
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not start checkout. Please try again.'
      );
    }
  }, []);

  const startTrial = useCallback(async (plan: 'monthly' | 'yearly' = 'monthly') => {
    try {
      const { url } = await subscriptionApi.createCheckout(plan, true);
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not start trial. Please try again.'
      );
    }
  }, []);

  const manage = useCallback(async () => {
    try {
      const { url } = await subscriptionApi.createPortal();
      if (!url) throw new Error('No portal URL returned');
      window.location.href = url;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not open billing portal. Please try again.'
      );
    }
  }, []);

  return {
    isPro,
    hasAiAccess,
    aiCallsRemaining,
    subscriptionStatus: user?.subscriptionStatus || 'free',
    subscribe,
    subscribeYearly,
    startTrial,
    manage,
  };
}
