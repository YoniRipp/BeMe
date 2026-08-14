/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Base44Layout } from './Base44Layout';

const mockUser = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ user: mockUser() }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ hasAiAccess: false }),
}));

vi.mock('../insights/AiChatPanel', () => ({
  AiChatPanel: () => null,
}));

vi.mock('../voice/VoiceAgentPanel', () => ({
  VoiceAgentPanel: () => null,
}));

function renderLayout() {
  render(
    <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Base44Layout />}>
          <Route path="/" element={<div>Home content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Base44Layout trainer navigation', () => {
  beforeEach(() => {
    mockUser.mockReturnValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      subscriptionStatus: 'free',
    });
  });

  it('shows Clients navigation for trainer roles', () => {
    mockUser.mockReturnValue({
      id: 'trainer-1',
      name: 'Trainer',
      email: 'trainer@example.com',
      role: 'trainer',
      subscriptionStatus: 'free',
    });

    renderLayout();

    expect(screen.getAllByText('Clients').length).toBeGreaterThan(0);
  });

  it('shows Clients navigation for trainer subscription accounts', () => {
    mockUser.mockReturnValue({
      id: 'trainer-sub-1',
      name: 'Trainer Sub',
      email: 'trainer-sub@example.com',
      role: 'user',
      subscriptionStatus: 'trainer_pro',
    });

    renderLayout();

    expect(screen.getAllByText('Clients').length).toBeGreaterThan(0);
  });

  it('hides Clients navigation for regular users', () => {
    renderLayout();

    expect(screen.queryByText('Clients')).not.toBeInTheDocument();
  });
});

describe('Base44Layout sidebar drawer', () => {
  beforeEach(() => {
    mockUser.mockReturnValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      subscriptionStatus: 'free',
    });
  });

  // Below `lg` the sidebar is translated off-screen but stays in the DOM. Without `inert`
  // its links remain in the tab order, so a keyboard or switch user lands on controls
  // they cannot see.
  it('takes the closed drawer out of the tab order', async () => {
    renderLayout();
    const sidebar = document.querySelector('aside');
    expect(sidebar).not.toBeNull();
    await waitFor(() => expect(sidebar).toHaveAttribute('inert'));
  });

  it('puts the drawer back in the tab order once opened', async () => {
    const user = userEvent.setup();
    renderLayout();
    const sidebar = document.querySelector('aside')!;
    await waitFor(() => expect(sidebar).toHaveAttribute('inert'));

    await user.click(screen.getByRole('button', { name: /toggle menu/i }));

    await waitFor(() => expect(sidebar).not.toHaveAttribute('inert'));
  });

  it('closes the drawer on Escape', async () => {
    const user = userEvent.setup();
    renderLayout();
    const sidebar = document.querySelector('aside')!;

    await user.click(screen.getByRole('button', { name: /toggle menu/i }));
    await waitFor(() => expect(sidebar).not.toHaveAttribute('inert'));

    await user.keyboard('{Escape}');

    await waitFor(() => expect(sidebar).toHaveAttribute('inert'));
  });
});
