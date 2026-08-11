import { Clock, Lock, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';

interface UpgradePromptProps {
  feature: string;
  description?: string;
  compact?: boolean;
  quotaExhausted?: boolean;
}

export function UpgradePrompt({ feature, description, compact, quotaExhausted }: UpgradePromptProps) {
  const { subscribe } = useSubscription();

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 p-3 text-sm">
        <Lock className="h-4 w-4 shrink-0 text-gold" />
        <span className="text-foreground">
          <strong>{feature}</strong> requires Pro.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto shrink-0"
          onClick={subscribe}
        >
          Upgrade
        </Button>
      </div>
    );
  }

  if (quotaExhausted) {
    return (
      <Card className="border-info/30 bg-info/5">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-info/15">
            <Clock className="h-6 w-6 text-info" />
          </div>
          <CardTitle className="text-lg">{feature}</CardTitle>
          <CardDescription>
            {description || "You've used all your free AI calls this month. Exciting updates coming soon!"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button variant="outline" onClick={subscribe} className="px-8">
            Upgrade to Pro for unlimited access
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gold/30 bg-gold/5">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15">
          <Sparkles className="h-6 w-6 text-gold" />
        </div>
        <CardTitle className="text-lg">Unlock {feature}</CardTitle>
        <CardDescription>
          {description || `${feature} is a Pro feature. Upgrade to get access to AI-powered tools that make tracking your life effortless.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button onClick={subscribe} className="px-8">
          Upgrade to Pro — $7.99/mo
        </Button>
      </CardContent>
    </Card>
  );
}
