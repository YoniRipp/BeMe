import { useEffect, useRef } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const BAR_COUNT = 18;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface VoiceRecorderBarProps {
  durationMs: number;
  /** 0..1 mic level. When 0 for the whole recording the bars animate on their own. */
  level: number;
  /** Live recognised text, when the engine provides one. */
  transcript?: string;
  isTranscribing: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  className?: string;
}

/**
 * In-composer recording controls: cancel on the left, waveform + timer in the
 * middle, confirm on the right. Replaces the text input while recording.
 */
export function VoiceRecorderBar({
  durationMs,
  level,
  transcript,
  isTranscribing,
  error,
  onCancel,
  onConfirm,
  className,
}: VoiceRecorderBarProps) {
  // Rolling level history so the waveform scrolls like a real recorder.
  const historyRef = useRef<number[]>(Array(BAR_COUNT).fill(0));
  useEffect(() => {
    historyRef.current = [...historyRef.current.slice(1), level];
  }, [level]);
  const history = historyRef.current;
  const hasLevel = history.some((v) => v > 0.01);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {transcript && !isTranscribing && (
        <p
          className="line-clamp-2 px-2 text-sm leading-relaxed text-muted-foreground"
          role="status"
          aria-live="polite"
          dir="auto"
        >
          {transcript}
        </p>
      )}

      {error && (
        <p className="px-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 rounded-full border bg-muted/40 py-1.5 pe-1.5 ps-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isTranscribing}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Cancel recording"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {isTranscribing ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcribing…
            </span>
          ) : (
            <>
              <span className="flex h-6 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden="true">
                {history.map((value, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-[3px] shrink-0 rounded-full bg-primary transition-[height] duration-100 ease-out',
                      !hasLevel && 'animate-pulse-wave'
                    )}
                    style={
                      hasLevel
                        ? { height: `${Math.max(4, Math.min(24, value * 24))}px` }
                        : { height: `${8 + ((i * 7) % 14)}px`, animationDelay: `${i * 60}ms` }
                    }
                  />
                ))}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatDuration(durationMs)}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isTranscribing}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95 disabled:opacity-60"
          aria-label="Stop recording and use it"
        >
          {isTranscribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
