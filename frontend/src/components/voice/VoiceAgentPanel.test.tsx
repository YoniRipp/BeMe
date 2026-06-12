import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const sentinelContext = { marker: 'voice-context-from-hook' };
vi.mock('@/hooks/useVoiceActions', () => ({
  useVoiceActions: () => ({ voiceContext: sentinelContext }),
}));

const mockExecuteVoiceAction = vi.fn();
vi.mock('@/lib/voiceActionExecutor', () => ({
  executeVoiceAction: (...args: unknown[]) => mockExecuteVoiceAction(...args),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('@/components/shared/ToastProvider', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockGetVoiceResult = vi.fn();
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isNative: false,
    isAvailable: true,
    isListening: true,
    isProcessing: false,
    currentTranscript: '',
    startListening: vi.fn().mockResolvedValue(undefined),
    stopListening: vi.fn().mockResolvedValue(undefined),
    getVoiceResult: (...args: unknown[]) => mockGetVoiceResult(...args),
    isStreaming: false,
  }),
}));

import { VoiceAgentPanel } from './VoiceAgentPanel';

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <VoiceAgentPanel open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('VoiceAgentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes parsed actions against the shared useVoiceActions context', async () => {
    const action = { intent: 'add_food', name: 'apple' };
    mockGetVoiceResult.mockResolvedValueOnce({ actions: [action] });
    mockExecuteVoiceAction.mockResolvedValueOnce({ success: true, message: 'Added apple' });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording and send' }));

    await waitFor(() => expect(mockExecuteVoiceAction).toHaveBeenCalledTimes(1));
    expect(mockExecuteVoiceAction).toHaveBeenCalledWith(action, sentinelContext);
    expect(mockToastSuccess).toHaveBeenCalledWith('Added apple');
  });

  it('filters hallucinated empty workout actions instead of executing them', async () => {
    mockGetVoiceResult.mockResolvedValueOnce({
      actions: [{ intent: 'add_workout', title: 'Workout', exercises: [] }],
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording and send' }));

    expect(await screen.findByText('Could not understand your recording. Please try again.')).toBeInTheDocument();
    expect(mockExecuteVoiceAction).not.toHaveBeenCalled();
  });

  it('reports unknown intents as failures without executing', async () => {
    mockGetVoiceResult.mockResolvedValueOnce({ actions: [{ intent: 'unknown' }] });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording and send' }));

    expect(await screen.findByText('Not understood')).toBeInTheDocument();
    expect(mockExecuteVoiceAction).not.toHaveBeenCalled();
  });
});
