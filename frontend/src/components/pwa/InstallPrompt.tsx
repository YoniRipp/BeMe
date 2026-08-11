import { X, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export function InstallPrompt() {
  const { isInstallable, isIOS, promptInstall, dismiss } = useInstallPrompt();

  if (!FEATURE_FLAGS.PWA_ENABLED || !isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (!accepted) {
      dismiss();
    }
  };

  return (
    // Offsets from the bottom nav (only hidden at lg) and respects the home
    // indicator, so it can't sit on top of the nav on a notched phone. Stacked
    // above UpdateBanner so the two never overlap.
    <Card className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+11rem)] left-4 right-4 z-50 p-4 shadow-lg lg:left-auto lg:right-4 lg:w-80 lg:bottom-28 bg-background border animate-in slide-in-from-bottom-4">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3 pr-10">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <img src="/logo.png" alt="TrackVibe" className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Install TrackVibe App</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isIOS
              ? 'Tap Share then "Add to Home Screen"'
              : 'Install for quick access and offline use'}
          </p>
        </div>
      </div>

      {!isIOS && (
        <Button onClick={handleInstall} size="sm" className="w-full mt-3">
          <Download className="h-4 w-4 mr-2" />
          Install
        </Button>
      )}

      {isIOS && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Share className="h-4 w-4" />
          <span>Tap Share → Add to Home Screen</span>
        </div>
      )}
    </Card>
  );
}
