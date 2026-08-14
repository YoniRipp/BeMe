import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dumbbell } from 'lucide-react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title on its own', () => {
    render(<EmptyState title="No workouts yet" />);
    expect(screen.getByText('No workouts yet')).toBeInTheDocument();
  });

  it('renders the description when given', () => {
    render(<EmptyState title="No workouts yet" description="Start tracking your fitness." />);
    expect(screen.getByText('Start tracking your fitness.')).toBeInTheDocument();
  });

  it('announces itself politely so a filter change is not silent', () => {
    render(<EmptyState title="No workouts match" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  // The card used to be a div with role="button" and hand-rolled key handling, while
  // separately drawing something that only looked like a button.
  it('exposes the action as a real button', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <EmptyState
        icon={Dumbbell}
        title="Add your first workout"
        actionLabel="Add a workout"
        onAction={onAction}
      />
    );

    const button = screen.getByRole('button', { name: /add a workout/i });
    await user.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);

    button.focus();
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it('renders no button when there is nothing to do', () => {
    render(<EmptyState title="No workouts match" description="Try a different filter." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('needs both a label and a handler before it renders an action', () => {
    render(<EmptyState title="No workouts match" actionLabel="Clear filters" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
