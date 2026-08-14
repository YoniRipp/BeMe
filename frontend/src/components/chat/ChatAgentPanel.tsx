import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Mic, CheckCircle2, AlertCircle, Trash2, Square, Dumbbell, UtensilsCrossed, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useAgent } from '@/hooks/useAgent';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { AudioWave } from '@/components/ui/audio-wave';
import { cn } from '@/lib/utils';
import type { AgentResponse, PlanProposal } from '@/core/api/chat';
import { toast } from '@/components/shared/ToastProvider';

function isRTL(text: string): boolean {
  return /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(text);
}

interface ChatAgentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatAgentPanel({ open, onOpenChange }: ChatAgentPanelProps) {
  const {
    messages,
    isLoadingHistory,
    isSending,
    isThinking,
    streamingContent,
    hasPendingResponse,
    pendingProposals,
    confirmingProposalId,
    sendMessage,
    clearHistory,
    confirmProposal,
    dismissProposal,
  } = useAgent();
  const [input, setInput] = useState('');
  const [lastActions, setLastActions] = useState<AgentResponse['actions'] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isAvailable: voiceAvailable,
    isListening,
    startListening,
    stopListening,
    currentTranscript,
  } = useSpeechRecognition({
    language: navigator.language || 'en-US',
  });

  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const transcriptRef = useRef('');
  useEffect(() => { transcriptRef.current = currentTranscript; }, [currentTranscript]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, streamingContent, scrollToBottom]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    if (!open && isVoiceMode) {
      if (isListening) stopListening().catch(() => {});
      setIsVoiceMode(false);
      setVoiceError(null);
    }
  }, [open, isVoiceMode, isListening, stopListening]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    setLastActions(null);
    const result = await sendMessage(text);
    if (result?.actions?.length) {
      setLastActions(result.actions);
    }
  }, [input, isSending, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleVoiceMode = useCallback(async () => {
    if (!voiceAvailable) return;
    setVoiceError(null);
    setIsVoiceMode(true);
    try {
      await startListening();
    } catch (e) {
      setIsVoiceMode(false);
      toast.error(e instanceof Error ? e.message : 'Could not access microphone.');
    }
  }, [voiceAvailable, startListening]);

  const handleVoiceStop = useCallback(async () => {
    try { await stopListening(); } catch { setIsVoiceMode(false); return; }
    const text = transcriptRef.current.trim();
    if (!text) {
      setVoiceError('Nothing heard — try again');
      setTimeout(() => setVoiceError(null), 2000);
      try { await startListening(); } catch { /* ignore */ }
      return;
    }
    setIsVoiceMode(false);
    setLastActions(null);
    const result = await sendMessage(text);
    if (result?.actions?.length) setLastActions(result.actions);
  }, [stopListening, startListening, sendMessage]);

  const handleVoiceCancel = useCallback(async () => {
    if (isListening) try { await stopListening(); } catch { /* ignore */ }
    setIsVoiceMode(false);
    setVoiceError(null);
  }, [isListening, stopListening]);

  const handleClearHistory = useCallback(async () => {
    if (window.confirm('Clear all chat history? This cannot be undone.')) {
      await clearHistory();
      setLastActions(null);
    }
  }, [clearHistory]);

  const handleConfirmProposal = useCallback(async (proposal: PlanProposal) => {
    const actions = await confirmProposal(proposal);
    if (!actions) {
      toast.error('Failed to save plan');
      return;
    }
    const failed = actions.filter((a) => !a.success).length;
    if (failed === 0) {
      toast.success(`Saved "${proposal.title}" to your app`);
    } else if (failed === actions.length) {
      toast.error('Could not save plan');
    } else {
      toast.warning(`Saved ${actions.length - failed} of ${actions.length} items`);
    }
    setLastActions(actions);
  }, [confirmProposal]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex h-[85vh] flex-col rounded-t-2xl p-0"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-0">
          <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header: title left, trash right */}
        <div className="flex items-center px-4 py-2">
          <h2 className="flex-1 text-base font-semibold">AI Coach</h2>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-destructive hover:text-destructive/80"
            onClick={handleClearHistory}
            aria-label="Clear chat history"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Divider */}
        <div className="border-b" />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {isLoadingHistory && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoadingHistory && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="text-sm">Ask me anything about your fitness data,</p>
              <p className="text-sm">or tell me to take an action.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  'How many workouts this week?',
                  'Copy today\'s meals to tomorrow',
                  'Write me a workout plan',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-muted"
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const rtl = isRTL(msg.content);
            const ts = msg.created_at ? new Date(msg.created_at) : null;
            const tsLabel = ts && !isNaN(ts.getTime()) ? format(ts, 'MMM d, HH:mm') : null;
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex max-w-[85%] flex-col gap-1',
                  msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                )}
              >
                <div
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                  dir={rtl ? 'rtl' : 'ltr'}
                >
                  <p className="whitespace-pre-wrap text-start">{msg.content}</p>
                </div>
                {tsLabel && (
                  <span className="px-1 text-caption tabular-nums text-muted-foreground">{tsLabel}</span>
                )}
              </div>
            );
          })}

          {/* Action results */}
          {lastActions && lastActions.length > 0 && (
            <div className="mr-auto max-w-[85%] space-y-1">
              {lastActions.map((action: AgentResponse['actions'][number], i: number) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs',
                    action.success
                      ? 'bg-success/10 text-success'
                      : 'bg-destructive/10 text-destructive'
                  )}
                >
                  {action.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{action.message || action.intent}</span>
                </div>
              ))}
            </div>
          )}

          {/* Plan proposals — user confirms before saving */}
          {pendingProposals.map((proposal) => {
            const isConfirming = confirmingProposalId === proposal.id;
            const workoutCount = proposal.workouts?.length ?? 0;
            const foodCount = proposal.foods?.length ?? 0;
            return (
              <div
                key={proposal.id}
                className="mr-auto w-full max-w-[92%] rounded-2xl border bg-card p-4 shadow-card"
              >
                <div className="mb-2">
                  <h4 className="text-sm font-semibold tracking-tight">{proposal.title}</h4>
                  {proposal.summary && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{proposal.summary}</p>
                  )}
                </div>

                {workoutCount > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-muted-foreground">
                      <Dumbbell className="h-3 w-3" />
                      <span>{workoutCount} workout{workoutCount === 1 ? '' : 's'}</span>
                    </div>
                    {proposal.workouts.slice(0, 6).map((w, i) => (
                      <div key={i} className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">{w.title}</span>
                          <span className="text-muted-foreground tabular-nums">{w.date ?? '—'}</span>
                        </div>
                        {w.exercises && w.exercises.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-eyebrow text-muted-foreground">
                            {w.exercises.slice(0, 6).map((e, j) => (
                              <li key={j}>
                                {e.name} — {e.sets}×{e.reps}
                                {e.weight ? ` @ ${e.weight}kg` : ''}
                              </li>
                            ))}
                            {w.exercises.length > 6 && (
                              <li className="italic">+{w.exercises.length - 6} more</li>
                            )}
                          </ul>
                        )}
                      </div>
                    ))}
                    {workoutCount > 6 && (
                      <div className="text-eyebrow italic text-muted-foreground">+{workoutCount - 6} more sessions</div>
                    )}
                  </div>
                )}

                {foodCount > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-muted-foreground">
                      <UtensilsCrossed className="h-3 w-3" />
                      <span>{foodCount} food item{foodCount === 1 ? '' : 's'}</span>
                    </div>
                    {proposal.foods.slice(0, 8).map((f, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
                        <span className="font-medium">
                          {f.amount && f.unit ? `${f.amount} ${f.unit} ` : ''}{f.food}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{f.date ?? '—'}</span>
                      </div>
                    ))}
                    {foodCount > 8 && (
                      <div className="text-eyebrow italic text-muted-foreground">+{foodCount - 8} more items</div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-9 flex-1 rounded-full"
                    onClick={() => handleConfirmProposal(proposal)}
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Save to app
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 rounded-full"
                    onClick={() => dismissProposal(proposal.id)}
                    disabled={isConfirming}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Pending response indicator — backend still processing after reconnect */}
          {hasPendingResponse && !isSending && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
              </div>
              <span className="text-xs text-muted-foreground">Waiting for response...</span>
            </div>
          )}

          {/* Thinking indicator (tool calls in progress) */}
          {isSending && isThinking && !streamingContent && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {/* Streaming message (real-time text) */}
          {isSending && streamingContent && (
            <div
              className="mr-auto max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed"
              dir={isRTL(streamingContent) ? 'rtl' : 'ltr'}
            >
              <p className="whitespace-pre-wrap text-start">
                {streamingContent}
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground/60 align-middle" />
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {isVoiceMode ? (
            <div className="flex flex-col items-center gap-4 py-2">
              {isListening && <AudioWave className="-mb-1" />}

              <button
                type="button"
                onClick={handleVoiceStop}
                disabled={isSending}
                className={[
                  'relative flex h-24 w-24 items-center justify-center rounded-full shadow-card-lg transition-all',
                  isListening
                    ? 'bg-destructive text-destructive-foreground ring-[6px] ring-destructive/20'
                    : 'bg-primary text-primary-foreground',
                  isSending ? 'opacity-70' : 'hover:scale-105',
                ].join(' ')}
                aria-label={isListening ? 'Stop and send' : 'Send voice message'}
              >
                {isListening && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-destructive/25" />
                )}
                {isSending ? (
                  <Loader2 className="relative z-10 h-9 w-9 animate-spin" />
                ) : isListening ? (
                  <Square className="relative z-10 h-9 w-9" />
                ) : (
                  <Mic className="relative z-10 h-9 w-9" />
                )}
              </button>

              <p className="font-display text-base font-medium tracking-tight text-foreground">
                {isSending
                  ? 'Sending…'
                  : isListening
                    ? 'Listening… tap to send'
                    : 'Tap to send'}
              </p>

              {currentTranscript && (
                <p
                  className="max-w-sm break-words text-center text-sm italic text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  "{currentTranscript}"
                </p>
              )}

              {voiceError && (
                <p className="text-sm text-destructive" role="alert">{voiceError}</p>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full px-5 text-muted-foreground"
                onClick={handleVoiceCancel}
                disabled={isSending}
                aria-label="Cancel voice input"
              >
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {voiceAvailable && !isSending && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={handleVoiceMode}
                  aria-label="Start voice input"
                >
                  <Mic className="h-5 w-5" />
                </Button>
              )}
              <input
                ref={inputRef}
                type="text"
                className="flex-1 rounded-full border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ask or command..."
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                dir="auto"
              />
              {isSending ? (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 shrink-0 rounded-full"
                  onClick={() => {/* TODO: abort controller */}}
                  aria-label="Stop generating"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
