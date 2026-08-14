import { Toaster } from 'sonner';
import { useIsMobile } from '@/hooks/useIsMobile';

export function ToastProvider() {
  // Sonner renders above everything, and the bottom nav sits at z-30 — a bottom-anchored
  // toast covers the navigation and the AI button for its whole lifetime. Top-center is
  // also where phones put transient banners.
  const isMobile = useIsMobile();

  return (
    <Toaster
      position={isMobile ? 'top-center' : 'bottom-right'}
      toastOptions={{
        className: 'toast',
        style: {
          background: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          border: '1px solid hsl(var(--border))',
        },
      }}
    />
  );
}

// Export hook for convenience (re-export from sonner)
export { toast } from 'sonner';
