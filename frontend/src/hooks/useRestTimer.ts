import { useCallback, useEffect, useRef, useState } from 'react';
import { showNotification, getNotificationPermission } from '@/lib/notifications';
import { toast } from '@/components/shared/ToastProvider';
import { haptic } from '@/lib/haptics';

/** Matches what Hevy and Strong default to between working sets. */
export const DEFAULT_REST_SECONDS = 90;

export interface RestTimer {
  /** Seconds left, or null when no timer is running. */
  remaining: number | null;
  start: (seconds?: number) => void;
  stop: () => void;
}

/**
 * Countdown between sets.
 *
 * Driven off a wall-clock deadline rather than by decrementing a counter, because the
 * interval stops firing when the phone sleeps or the tab is backgrounded — which is
 * exactly what happens while someone is resting. On return the remaining time is
 * recomputed from the deadline, so the display is correct rather than however far the
 * interval got before it froze.
 *
 * Known limitation: the alert is driven by that same interval, so a phone locked for the
 * whole rest period is told the moment it wakes, not at the deadline. Firing on time from
 * the background needs the service worker (or a native local notification) to own the
 * schedule — worth doing, but a larger change than this hook. `showNotification` is used
 * rather than a toast so the message survives the app not being in front, with the toast
 * as the fallback when notification permission was never granted.
 */
export function useRestTimer(): RestTimer {
  const [remaining, setRemaining] = useState<number | null>(null);
  const deadlineRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    deadlineRef.current = null;
    setRemaining(null);
  }, []);

  const start = useCallback((seconds: number = DEFAULT_REST_SECONDS) => {
    deadlineRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, []);

  useEffect(() => {
    if (remaining === null) return;

    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      if (left <= 0) {
        deadlineRef.current = null;
        setRemaining(null);
        haptic('success');
        if (getNotificationPermission() === 'granted') {
          showNotification('Rest complete', { body: 'Time for your next set.' });
        } else {
          toast.success('Rest complete');
        }
        return;
      }
      setRemaining(left);
    };

    const id = setInterval(tick, 1000);
    // Recompute immediately on return from background, where the interval was frozen.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // Only re-arm when the timer starts or stops, not on every tick.
  }, [remaining === null]); // eslint-disable-line react-hooks/exhaustive-deps

  return { remaining, start, stop };
}
