/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

describe('Base44Layout navigation', () => {
  beforeEach(() => {
    mockUser.mockReturnValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      subscriptionStatus: 'free',
    });
  });

  it('renders the four bottom tabs: Home, Workouts, Food, Profile', () => {
    renderLayout();

    const bar = screen.getByRole('navigation', { name: /main navigation/i });
    const tabs = within(bar).getAllByRole('link').map((a) => a.textContent);
    expect(tabs).toEqual(['Home', 'Workouts', 'Food', 'Profile']);
  });

  it('points the Profile tab at settings and the Food tab at the energy route', () => {
    renderLayout();

    const bar = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(bar).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/settings');
    expect(within(bar).getByRole('link', { name: 'Food' })).toHaveAttribute('href', '/energy');
  });

  // Goals left the tab bar, not the app.
  it('keeps Goals in the sidebar while leaving it out of the bottom bar', () => {
    renderLayout();

    const bar = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(bar).queryByRole('link', { name: 'Goals' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Goals' })).toHaveAttribute('href', '/goals');
  });

  it('shows no Clients entry for anyone, admins included', () => {
    mockUser.mockReturnValue({
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      subscriptionStatus: 'free',
    });

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
