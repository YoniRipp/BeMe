import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

const FREE_FEATURES = [
  'Manual data entry for all domains',
  'Workout logging',
  'Food & nutrition tracking',
  'Goal setting & tracking',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Voice input — speak to track anything',
  'AI Insights — personalized analytics',
  'AI Food Lookup — instant nutrition data',
  'Daily AI summary & recommendations',
  'Priority support',
];

export function Pricing() {
  const { user } = useAuth();
  const { isPro, startTrial } = useSubscription();
  const isLoggedIn = !!user;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 pt-24 pb-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Simple pricing</h1>
        <p className="mt-2 text-muted-foreground">
          Start free. Upgrade when you want the AI-powered experience.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Free tier */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Free</CardTitle>
            <CardDescription>Track everything manually</CardDescription>
            <p className="text-3xl font-bold">
              $0<span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Pro Monthly */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Pro Monthly</CardTitle>
            <CardDescription>AI-powered life tracking</CardDescription>
            <p className="text-3xl font-bold">
              $7.99<span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  {f}
                </li>
              ))}
            </ul>
            {!isLoggedIn ? (
              <Button asChild className="w-full">
                <Link to="/signup">Start Free Trial</Link>
              </Button>
            ) : isPro ? (
              <Button className="w-full" disabled>Current Plan</Button>
            ) : (
              <Button className="w-full" onClick={() => startTrial('monthly')}>Start Free Trial</Button>
            )}
            <p className="text-center text-xs text-muted-foreground">7-day free trial, cancel anytime</p>
          </CardContent>
        </Card>

        {/* Pro Yearly */}
        <Card className="border-primary ring-1 ring-primary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Pro Yearly</CardTitle>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Best Value
              </span>
            </div>
            <CardDescription>AI-powered life tracking</CardDescription>
            <p className="text-3xl font-bold">
              $59.99<span className="text-sm font-normal text-muted-foreground">/year</span>
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="line-through">$95.88</span>{' '}
              <span className="text-primary font-medium">Save 37%</span>
              {' '}&middot; ~$5.00/month
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  {f}
                </li>
              ))}
            </ul>
            {!isLoggedIn ? (
              <Button asChild className="w-full">
                <Link to="/signup?plan=yearly">Start Free Trial</Link>
              </Button>
            ) : isPro ? (
              <Button className="w-full" disabled>Current Plan</Button>
            ) : (
              <Button className="w-full" onClick={() => startTrial('yearly')}>Start Free Trial</Button>
            )}
            <p className="text-center text-xs text-muted-foreground">7-day free trial, cancel anytime</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
