import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useVoiceActions } from '@/hooks/useVoiceActions';
import { executeVoiceAction } from '@/lib/voiceActionExecutor';
import { queryKeys } from '@/lib/queryClient';
import { toast } from '@/components/shared/ToastProvider';
import { LocalErrorBoundary } from '@/components/shared/LocalErrorBoundary';
import { PulseWave } from '@/components/pulse/PulseUI';

interface VoiceAgentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoiceAgentPanel({ open, onOpenChange }: VoiceAgentPanelProps) {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const isTrainerPage = pathname.startsWith('/trainer');
  const { voiceContext } = useVoiceActions();

  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');

  const {
    isNative,
    isAvailable,
    isListening,
    isProcessing,
    currentTranscript,
    startListening,
    stopListening,
    getVoiceResult,
    isStreaming,
  } = useSpeechRecognition({
    language: navigator.language || 'en-US',
    onPartialResult: setTranscript,
  });

  const handleStartRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    try {
      await startListening();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start recording. Please check microphone permissions.';
      setError(msg);
      toast.error('Microphone', { description: msg });
    }
  }, [startListening]);

  const handleStopRecording = useCallback(async () => {
    try {
      await stopListening();
      const rawResult = await getVoiceResult();

      if (!rawResult || rawResult.actions.length === 0) {
        setError('Could not understand your recording. Please try again.');
        return;
      }

      // Filter out likely-hallucinated actions (e.g. add_workout from background noise)
      const validActions = rawResult.actions.filter((a) => {
        if (a.intent === 'add_workout') {
          const exercises = Array.isArray(a.exercises) ? a.exercises : [];
          const title = String(a.title ?? '').trim();
          if (exercises.length === 0 && (title === 'Workout' || title.length <= 3)) return false;
        }
        return true;
      });

      if (validActions.length === 0) {
        setError('Could not understand your recording. Please try again.');
        return;
      }
      const result = { ...rawResult, actions: validActions };

      const succeeded: string[] = [];
      const failed: string[] = [];

      if (result.results) {
        const hasTrainerAction = result.results.some((r) =>
          r.intent?.startsWith('add_client_') || r.intent?.startsWith('edit_client_') || r.intent?.startsWith('delete_client_')
        );
        for (const r of result.results) {
          if (r.success) succeeded.push(r.message ?? r.intent);
          else failed.push(r.message ?? 'Could not complete action. Please try again.');
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.workouts });
        await queryClient.invalidateQueries({ queryKey: queryKeys.foodEntries });
        await queryClient.invalidateQueries({ queryKey: queryKeys.checkIns });
        await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
        if (hasTrainerAction) {
          await queryClient.invalidateQueries({ queryKey: queryKeys.trainerClients });
          await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'trainerClientData' });
        }
      } else {
        for (const action of result.actions) {
          if (action.intent === 'unknown') {
            failed.push('Not understood');
            continue;
          }
          try {
            const r = await executeVoiceAction(action, voiceContext);
            if (r.success) succeeded.push(r.message ?? action.intent);
            else failed.push(r.message ?? 'Could not complete action. Please try again.');
          } catch (e) {
            failed.push(e instanceof Error ? e.message : 'Could not complete action. Please try again.');
          }
        }
      }

      if (succeeded.length > 0) {
        toast.success(succeeded.length === 1 ? succeeded[0] : `Done: ${succeeded.join(', ')}`);
      }
      if (failed.length > 0) {
        setError(failed.join('; '));
      }
      if (succeeded.length === 0 && failed.length > 0) {
        setError(failed[0]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network or server error. Please try again.';
      setError(msg);
      toast.error('Voice processing failed', { description: msg });
    }
  }, [stopListening, getVoiceResult, voiceContext, queryClient]);

  // Stop recording when dialog closes
  useEffect(() => {
    if (!open && isListening) {
      stopListening().catch(() => {});
    }
  }, [open, isListening, stopListening]);

  const displayTranscript = currentTranscript || transcript;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="pulse-bottom-sheet max-h-[82vh] overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-center text-base font-semibold">Voice Agent</SheetTitle>
        </SheetHeader>
        <LocalErrorBoundary label="Voice">
          {!isAvailable ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Voice is not supported in this browser. Microphone access required.
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-5">
              {(isNative || isStreaming) && (
                <p className="text-xs text-muted-foreground">
                  {isNative ? 'Using native speech recognition' : 'Real-time streaming'}
                </p>
              )}

              {isListening && <PulseWave className="-mb-1" />}

              <button
                type="button"
                onClick={isListening ? handleStopRecording : handleStartRecording}
                disabled={isProcessing}
                className={[
                  'relative flex h-24 w-24 items-center justify-center rounded-full shadow-card-lg transition-all',
                  isListening
                    ? 'bg-destructive text-destructive-foreground ring-[6px] ring-destructive/20'
                    : 'bg-primary text-primary-foreground',
                  isProcessing ? 'opacity-70' : 'hover:scale-105',
                ].join(' ')}
                aria-label={isListening ? 'Stop recording and send' : 'Start voice input'}
              >
                {isListening && <span className="absolute inset-0 animate-ping rounded-full bg-destructive/25" />}
                {isProcessing ? (
                  <Loader2 className="relative z-10 h-9 w-9 animate-spin" />
                ) : isListening ? (
                  <Square className="relative z-10 h-9 w-9" />
                ) : (
                  <Mic className="relative z-10 h-9 w-9" />
                )}
              </button>

              <div className="max-w-sm text-center">
                <p className="font-display text-lg font-medium tracking-tight text-foreground">
                  {isListening
                    ? 'Listening... tap to stop'
                    : isProcessing
                      ? 'Processing your voice...'
                      : 'Tap to log by voice'}
                </p>
                {!displayTranscript && !isListening && !isProcessing && (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {isTrainerPage
                      ? 'Try "Add Guy\'s pull workout, bench press 4 sets of 8 at 80 kg"'
                      : 'Try "I had oatmeal for breakfast" or "30 min run"'}
                  </p>
                )}
              </div>

              {displayTranscript && (
                <p className="max-w-sm break-words text-center text-sm italic text-muted-foreground" role="status" aria-live="polite">
                  "{displayTranscript}"
                </p>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              {isProcessing && (
                <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                  Processing voice...
                </p>
              )}
            </div>
          )}
        </LocalErrorBoundary>
      </SheetContent>
    </Sheet>
  );
}
