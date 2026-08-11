import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyUpdate } from '@/lib/pwaUtils';

export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('pwa:update-available', handler);
    return () => window.removeEventListener('pwa:update-available', handler);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] left-4 right-4 z-50 lg:left-auto lg:right-4 lg:w-80 lg:bottom-4 bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <RefreshCw className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Update available</p>
        <p className="text-xs opacity-80">A new version of TrackVibe is ready.</p>
      </div>
      <Button
        onClick={() => applyUpdate()}
        size="sm"
        variant="secondary"
        className="flex-shrink-0"
      >
        Update
      </Button>
    </div>
  );
}
