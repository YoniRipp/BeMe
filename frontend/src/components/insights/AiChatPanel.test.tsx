import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockStop, mockCancel, mockSendMessage } = vi.hoisted(() => ({
  mockStop: vi.fn(),
  mockCancel: vi.fn(),
  mockSendMessage: vi.fn(),
}));

vi.mock('@/core/api/chat', () => ({
  chatApi: {
    getHistory: vi.fn().mockResolvedValue({ messages: [] }),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    clearHistory: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/components/shared/ToastProvider', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

// Mocked with real state so the panel re-renders when recording starts/stops.
vi.mock('@/hooks/useVoiceDictation', async () => {
  const { useState } = await import('react');
  return {
    useVoiceDictation: () => {
      const [isRecording, setIsRecording] = useState(false);
      return {
        isSupported: true,
        engine: 'browser' as const,
        isRecording,
        isTranscribing: false,
        durationMs: 7000,
        level: 0,
        partialTranscript: '',
        error: null,
        start: async () => setIsRecording(true),
        stop: async () => {
          setIsRecording(false);
          return mockStop() as Promise<string>;
        },
        cancel: () => {
          setIsRecording(false);
          mockCancel();
        },
      };
    },
  };
});

import { AiChatPanel } from './AiChatPanel';

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AiChatPanel open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  );
}

describe('AiChatPanel voice input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStop.mockResolvedValue('two eggs and toast');
    mockSendMessage.mockResolvedValue({ text: 'Logged it', actions: [] });
  });

  it('offers a mic button alongside the text composer', async () => {
    renderPanel();

    expect(await screen.findByRole('button', { name: /record a message/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask your coach/i)).toBeInTheDocument();
  });

  it('swaps the composer for recording controls while recording', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: /record a message/i }));

    expect(await screen.findByRole('button', { name: /stop recording/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel recording/i })).toBeInTheDocument();
    expect(screen.getByText('0:07')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ask your coach/i)).not.toBeInTheDocument();
  });

  it('puts the transcript in the composer so it can be reviewed before sending', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: /record a message/i }));
    await user.click(await screen.findByRole('button', { name: /stop recording/i }));

    const input = await screen.findByPlaceholderText(/ask your coach/i);
    await waitFor(() => expect(input).toHaveValue('two eggs and toast'));
    expect(mockSendMessage).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /send message/i }));
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    expect(mockSendMessage.mock.calls[0][0]).toBe('two eggs and toast');
  });

  it('appends the transcript to text already typed', async () => {
    const user = userEvent.setup();
    renderPanel();

    const input = await screen.findByPlaceholderText(/ask your coach/i);
    await user.type(input, 'today I ate');
    await user.click(screen.getByRole('button', { name: /record a message/i }));
    await user.click(await screen.findByRole('button', { name: /stop recording/i }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText(/ask your coach/i)).toHaveValue('today I ate two eggs and toast')
    );
  });

  it('discards the recording on cancel', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: /record a message/i }));
    await user.click(await screen.findByRole('button', { name: /cancel recording/i }));

    const input = await screen.findByPlaceholderText(/ask your coach/i);
    expect(input).toHaveValue('');
    expect(mockStop).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalled();
  });
});
