/**
 * Tactile confirmation for actions that record something.
 *
 * Uses the Web Vibration API, which the Capacitor Android WebView exposes directly. iOS
 * Safari and the iOS WebView do not, so this is a no-op there rather than a dependency —
 * adding @capacitor/haptics would be the upgrade path if iOS feedback becomes a priority.
 *
 * Silent by design: haptics are a nicety, and a device that refuses should never surface
 * an error for it.
 */

type Pattern = 'light' | 'success' | 'warning';

const PATTERNS: Record<Pattern, number | number[]> = {
  /** A single set ticked, a glass added — the common, high-frequency case. */
  light: 10,
  /** Something was saved. */
  success: [12, 40, 18],
  /** Something needs attention. */
  warning: [20, 60, 20],
};

let enabled = true;

/** Turn haptics off globally, e.g. from a future settings toggle. */
export function setHapticsEnabled(next: boolean) {
  enabled = next;
}

export function haptic(pattern: Pattern = 'light') {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  // Respect users who have asked the OS to reduce motion — vibration is motion.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  }
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // A device that refuses to vibrate is not an error worth surfacing.
  }
}
