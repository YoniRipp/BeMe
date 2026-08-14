/**
 * AI Chat Panel — slide-up panel for conversational AI agent coaching.
 * Loads chat history from DB, sends messages, displays responses.
 * Messages can be typed or spoken — the mic records and drops the transcript
 * into the composer so it can be reviewed before sending.
 * The agent can take actions (log food, workouts, etc.) and the UI
 * refreshes affected data automatically.
 */
import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2, Loader2, MessageCircle, Mic } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { VoiceRecorderBar } from '@/components/chat/VoiceRecorderBar';
import { toast } from '@/components/shared/ToastProvider';
import { useVoiceDictation } from '@/hooks/useVoiceDictation';
import { chatApi, type ChatMessage, type ChatResponse } from '@/core/api/chat';
import { queryKeys } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface AiChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiChatPanel({ open, onOpenChange }: AiChatPanelProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['chat-history'],
    queryFn: () => chatApi.getHistory(50),
    enabled: open,
    staleTime: 0,
  });

  const messages = historyData?.messages ?? [];

  // Send message — when the agent takes actions, invalidate affected queries
  const sendMutation = useMutation({
    mutationFn: chatApi.sendMessage,
    onSuccess: (data: ChatResponse) => {
      void queryClient.invalidateQueries({ queryKey: ['chat-history'] });

      // If the agent executed any actions, refresh affected data
      if (data.actions?.length > 0) {
        const intents = new Set(data.actions.filter((a: { success: boolean }) => a.success).map((a: { intent: string }) => a.intent));
        if (intents.has('add_workout') || intents.has('edit_workout') || intents.has('delete_workout')) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.workouts });
        }
        if (intents.has('add_food') || intents.has('edit_food_entry') || intents.has('delete_food_entry')) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.foodEntries });
        }
        if (intents.has('log_sleep') || intents.has('edit_check_in') || intents.has('delete_check_in')) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.checkIns });
        }
        if (intents.has('add_goal') || intents.has('edit_goal') || intents.has('delete_goal')) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.goals });
        }
        if (intents.has('log_weight') || intents.has('edit_weight') || intents.has('delete_weight')) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.weightEntries });
        }
        if (intents.has('add_water') || intents.has('remove_water')) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.waterTodayAll });
          void queryClient.invalidateQueries({ queryKey: queryKeys.waterHistory });
        }
        if (intents.has('log_cycle') || intents.has('edit_cycle') || intents.has('delete_cycle')) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.cycleEntries });
        }
        // Refresh insights since data changed
        void queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
        void queryClient.invalidateQueries({ queryKey: ['ai-today-recs'] });
      }
    },
  });

  // Clear history
  const clearMutation = useMutation({
    mutationFn: chatApi.clearHistory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-history'] });
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sendMutation.isPending]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput('');
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // ─── Voice input ──────────────────────────────────────────────────────────

  const appendTranscript = useCallback((transcript: string) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
    inputRef.current?.focus();
  }, []);

  // onAutoEnd catches the case where the browser ends recognition itself — a long silence
  // or a network drop. Nobody is awaiting stop() then, so without this the words are lost.
  const dictation = useVoiceDictation({ onAutoEnd: appendTranscript });
  const { isRecording, cancel: cancelDictation, error: dictationError } = dictation;

  // Never keep the mic open once the panel is dismissed.
  useEffect(() => {
    if (!open && isRecording) cancelDictation();
  }, [open, isRecording, cancelDictation]);

  // VoiceRecorderBar renders the error, but it unmounts the instant recording stops —
  // which is exactly when recognition failures surface. Mirror it to a toast so the user
  // gets told why the recorder vanished.
  useEffect(() => {
    if (dictationError) toast.error(dictationError);
  }, [dictationError]);

  const handleStartRecording = useCallback(async () => {
    try {
      await dictation.start();
    } catch {
      // start() sets `error` before it throws, and the effect above turns that into a
      // toast — reporting it here as well would show the same message twice.
    }
  }, [dictation]);

  const handleFinishRecording = useCallback(async () => {
    let transcript = '';
    try {
      transcript = await dictation.stop();
    } catch {
      // Same as start(): stop() sets `error` before throwing, and the effect above is
      // what reports it. Toasting here too would show the message twice.
      return;
    }
    if (!transcript) {
      toast.error('Nothing was recorded. Try again.');
      return;
    }
    appendTranscript(transcript);
  }, [dictation, appendTranscript]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] flex flex-col p-0 rounded-t-2xl"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="w-4 h-4 text-primary" />
              AI Fitness Coach
            </SheetTitle>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="text-muted-foreground hover:text-destructive h-8 px-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {historyLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading conversation...
            </div>
          ) : messages.length === 0 && !sendMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Your AI Fitness Agent</h3>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                I can coach you, answer questions about your data, AND take actions — log food, workouts, sleep, and manage goals, all through chat.
              </p>
              {dictation.isSupported && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mic className="w-3.5 h-3.5" />
                  Type, or tap the mic to talk
                </p>
              )}
              <div className="mt-4 space-y-2 w-full max-w-[280px]">
                {[
                  'Log 3 eggs and toast for breakfast',
                  'What did I eat yesterday?',
                  'Am I hitting my protein goal?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg border text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {sendMutation.isPending && (
                <>
                  <MessageBubble
                    message={{
                      id: 'pending-user',
                      role: 'user',
                      content: sendMutation.variables ?? '',
                      created_at: new Date().toISOString(),
                    }}
                  />
                  <div className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                </>
              )}
              {sendMutation.isError && (
                <p className="text-xs text-destructive text-center">
                  Failed to send message. Please try again.
                </p>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input — type or record */}
        <form
          onSubmit={handleSubmit}
          className="border-t px-4 py-3 shrink-0 bg-background"
        >
          {dictation.isRecording || dictation.isTranscribing ? (
            <VoiceRecorderBar
              durationMs={dictation.durationMs}
              level={dictation.level}
              transcript={dictation.partialTranscript}
              isTranscribing={dictation.isTranscribing}
              error={dictation.error}
              onCancel={dictation.cancel}
              onConfirm={handleFinishRecording}
            />
          ) : (
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your coach..."
                rows={1}
                className={cn(
                  'flex-1 resize-none rounded-xl border px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50',
                  'max-h-[120px] min-h-[40px]',
                  'bg-background'
                )}
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              {dictation.isSupported && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleStartRecording}
                  disabled={sendMutation.isPending}
                  className="h-10 w-10 p-0 rounded-md shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Record a message"
                >
                  <Mic className="w-[18px] h-[18px]" />
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || sendMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 w-10 p-0 rounded-md shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2 items-start', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <MessageCircle className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted rounded-tl-sm'
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
