import { cn } from '@/lib/utils';

/** Animated bars shown while the mic is open. Decorative — the recording state is announced elsewhere. */
export function AudioWave({ active = true, className }: { active?: boolean; className?: string }) {
  return (
    <div className={cn('flex h-20 items-center justify-center gap-1.5', className)} aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={cn('w-1.5 rounded-full bg-primary', active ? 'animate-pulse-wave' : 'opacity-40')}
          style={{ height: 18 + ((i * 13) % 42), animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}
