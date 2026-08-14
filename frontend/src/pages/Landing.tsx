import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Mic,
  Sparkles,
  Dumbbell,
  Apple,
  Target,
  Check,
  ArrowRight,
  UserPlus,
  BarChart3,
  Quote,
  ChevronDown,
  Mail,
  Clock,
  Smartphone,
  Utensils,
  TrendingUp,
} from 'lucide-react';

/* --- Data --- */

const FEATURES = [
  {
    icon: Mic,
    title: 'Voice-First Tracking',
    description: 'Just speak naturally. "I had oatmeal for breakfast" or "30 minute run" — TrackVibe handles the rest.',
  },
  {
    icon: Sparkles,
    title: 'AI Insights',
    description: 'Get personalized recommendations based on your wellness habits across fitness, nutrition, and sleep.',
  },
  {
    icon: Dumbbell,
    title: 'Workout Tracking',
    description: 'Log workouts with exercises, sets, and reps. Monitor your weekly training volume.',
  },
  {
    icon: Apple,
    title: 'Nutrition & Food',
    description: 'Track meals and macros with AI-powered food lookup. No more manual calorie counting.',
  },
  {
    icon: Target,
    title: 'Goal Setting',
    description: 'Set measurable goals for workouts, calories, and more — track your progress over time.',
  },
];

const FREE_FEATURES = [
  'Manual data entry for all domains',
  'Workout logging',
  'Food & nutrition tracking',
  'Sleep & energy check-ins',
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

const HOW_IT_WORKS = [
  {
    icon: UserPlus,
    step: 1,
    title: 'Sign up free',
    description: 'Create your account in seconds. No credit card needed.',
  },
  {
    icon: BarChart3,
    step: 2,
    title: 'Track your life',
    description: 'Log meals, workouts, sleep, and goals — by voice or manually.',
  },
  {
    icon: Sparkles,
    step: 3,
    title: 'Get AI insights',
    description: 'TrackVibe connects the dots and shows you patterns across your fitness, nutrition, and habits.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'I used to track my food in one app, workouts in another, and sleep in a third. TrackVibe replaced all of them.',
    name: 'Sarah M.',
    role: 'Fitness Enthusiast',
  },
  {
    quote: 'The voice feature is a game changer. I just say "chicken salad for lunch" and it\'s done.',
    name: 'James R.',
    role: 'Software Engineer',
  },
  {
    quote: 'Finally seeing how my sleep, workouts, and energy connect. The insights are surprisingly useful.',
    name: 'Priya K.',
    role: 'Freelance Designer',
  },
];

const STATS = [
  { value: '5', label: 'Wellness domains' },
  { value: '1000+', label: 'Foods in database' },
  { value: '100+', label: 'Exercises available' },
];

const FAQ = [
  {
    q: 'Is my data safe?',
    a: 'Yes. All data is encrypted in transit (HTTPS/TLS), passwords are hashed with bcrypt, and we never sell your data. See our Privacy Policy.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Absolutely. Cancel from your account settings or the Lemon Squeezy customer portal. No cancellation fees.',
  },
  {
    q: 'What happens during the free trial?',
    a: 'You get full access to all Pro features for 7 days. Your card is charged only after the trial ends. Cancel anytime during the trial and you won\'t be charged.',
  },
  {
    q: 'How is TrackVibe different from MyFitnessPal or YNAB?',
    a: 'Those are great single-purpose tools. TrackVibe combines fitness, nutrition, sleep, and goals in one app with AI that connects insights across all areas.',
  },
  {
    q: 'Can I use TrackVibe without the AI features?',
    a: 'Yes. The Free plan includes full manual tracking for workouts, food, sleep, and goals. AI features are Pro-only.',
  },
  {
    q: 'Does TrackVibe work offline?',
    a: 'TrackVibe requires an internet connection. Your data syncs in real-time so it\'s always up to date.',
  },
];

/* --- Helpers --- */

function RevealSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${visible ? 'animate-reveal' : 'opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0">
      <button
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {q}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground">{a}</p>
      )}
    </div>
  );
}

/* --- Landing Page --- */

export function Landing() {
  const pricingRef = useRef<HTMLDivElement>(null);
  const [pricingVisible, setPricingVisible] = useState(false);

  useEffect(() => {
    const el = pricingRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPricingVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Skip to content (a11y) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Hero */}
      <section id="main-content" aria-label="Hero" className="mx-auto max-w-4xl px-6 pt-28 pb-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          One app for your{' '}
          <span className="text-primary">whole life</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Track your body, energy, and goals — all in one place.
          Just speak and TrackVibe takes care of the rest.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="gap-2">
            <Link to="/signup">Start Free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#pricing">View Pricing</a>
          </Button>
        </div>
      </section>

      {/* App Preview */}
      <section aria-label="App preview" className="bg-muted/50 py-16">
        <RevealSection>
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                See TrackVibe in action
              </h2>
              <p className="mt-2 text-muted-foreground">
                A single dashboard for your body, energy, and goals.
              </p>
            </div>
            <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 shadow-lg">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/60 p-5 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Dumbbell className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">Body</h3>
                  <p className="text-xs text-muted-foreground">Log workouts, track sets & reps, monitor progress</p>
                </div>
                <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/60 p-5 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Utensils className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">Energy</h3>
                  <p className="text-xs text-muted-foreground">Track meals, macros, sleep, and daily energy levels</p>
                </div>
                <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/60 p-5 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">Goals</h3>
                  <p className="text-xs text-muted-foreground">Set targets, track habits, see your progress over time</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-center gap-3 rounded-lg bg-primary/5 p-4">
                <Smartphone className="h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Available as a <strong className="text-foreground">web app</strong>, <strong className="text-foreground">iOS</strong>, and <strong className="text-foreground">Android</strong>
                </p>
              </div>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* Features Grid */}
      <section id="features" aria-label="Features" className="mx-auto max-w-6xl px-6 py-16">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Everything you need, nothing you don't
            </h2>
            <p className="mt-2 text-muted-foreground">
              TrackVibe consolidates your daily tracking into a single, intelligent app.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="transition-shadow hover:shadow-md" role="listitem">
                <CardContent className="flex flex-col gap-3 p-6">
                  <feature.icon className="h-8 w-8 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* Voice Demo Section */}
      <section aria-label="Voice demo" className="bg-muted/50 py-16">
        <RevealSection>
          <div className="mx-auto max-w-4xl px-6 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Mic className="h-10 w-10 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Talk, don't type
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Say things like "I had a chicken salad for lunch", "bench press 3 sets of 10 at 135",
              or "I slept 7 hours last night" — TrackVibe understands and logs it instantly.
            </p>
          </div>
        </RevealSection>
      </section>

      {/* How It Works */}
      <section aria-label="How it works" className="mx-auto max-w-4xl px-6 py-16">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Get started in 3 steps
            </h2>
            <p className="mt-2 text-muted-foreground">
              From sign-up to insights in minutes.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="flex flex-col items-center text-center">
                <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                  {step.step}
                </div>
                <step.icon className="mb-3 h-8 w-8 text-primary" aria-hidden="true" />
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* Social Proof / Testimonials */}
      <section aria-label="Testimonials" className="bg-muted/50 py-16">
        <RevealSection>
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Trusted by people who take control of their lives
              </h2>
            </div>

            {/* Stats */}
            <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-12">
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Testimonials */}
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <Card key={t.name} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-6 space-y-4">
                    <Quote className="h-6 w-6 text-primary/30" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground leading-relaxed">"{t.quote}"</p>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </RevealSection>
      </section>

      {/* Pricing Section -- 3 Cards */}
      <section id="pricing" aria-label="Pricing" className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Simple pricing</h2>
          <p className="mt-2 text-muted-foreground">
            Start free. Upgrade when you want the AI-powered experience.
          </p>
        </div>

        <div ref={pricingRef} className="mt-10 grid gap-6 md:grid-cols-3">
          {/* Free */}
          <Card className={pricingVisible ? 'animate-reveal' : 'opacity-0'}>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-bold">Free</h3>
                <p className="text-sm text-muted-foreground">Track everything manually</p>
                <p className="mt-2 text-3xl font-bold">
                  $0<span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </div>
              <ul className="space-y-2" role="list">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="w-full">
                <Link to="/signup">Get Started</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Pro Monthly */}
          <Card className={pricingVisible ? 'animate-reveal-delay' : 'opacity-0'}>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-bold">Pro Monthly</h3>
                <p className="text-sm text-muted-foreground">AI-powered life tracking</p>
                <p className="mt-2 text-3xl font-bold">
                  $7.99<span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </div>
              <ul className="space-y-2" role="list">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full">
                <Link to="/signup?plan=monthly">Start Free Trial</Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">7-day free trial, cancel anytime</p>
            </CardContent>
          </Card>

          {/* Pro Yearly */}
          <Card className={`border-primary ring-1 ring-primary ${pricingVisible ? 'animate-reveal-delay-2' : 'opacity-0'}`}>
            <CardContent className="p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold">Pro Yearly</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Best Value
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">AI-powered life tracking</p>
                <p className="mt-2 text-3xl font-bold">
                  $59.99<span className="text-sm font-normal text-muted-foreground">/year</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="line-through">$95.88</span>{' '}
                  <span className="text-primary font-medium">Save 37%</span>
                  {' '}&middot; ~$5.00/month
                </p>
              </div>
              <ul className="space-y-2" role="list">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full">
                <Link to="/signup?plan=yearly">Start Free Trial</Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">7-day free trial, cancel anytime</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-label="Frequently asked questions" className="bg-muted/50 py-16">
        <RevealSection>
          <div className="mx-auto max-w-2xl px-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Frequently asked questions
              </h2>
            </div>
            <div className="mt-10 rounded-lg border bg-card p-6">
              {FAQ.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </RevealSection>
      </section>

      {/* Contact */}
      <section id="contact" aria-label="Contact" className="mx-auto max-w-5xl px-6 py-16">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Get in touch</h2>
            <p className="mt-2 text-muted-foreground">
              Have a question, suggestion, or just want to say hello? We'd love to hear from you.
            </p>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-2">
            {/* Contact info */}
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium">Email us</p>
                  <a href="mailto:support@trackvibe.app" className="text-sm text-primary hover:underline">
                    support@trackvibe.app
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium">Response time</p>
                  <p className="text-sm text-muted-foreground">We typically respond within 24 hours.</p>
                </div>
              </div>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    For account-related issues, please include your registered email address so we can help you faster.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Contact form (visual placeholder) */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Name</Label>
                  <Input id="contact-name" placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input id="contact-email" type="email" placeholder="you@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea id="contact-message" placeholder="How can we help?" rows={4} />
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    const name = (document.getElementById('contact-name') as HTMLInputElement)?.value || '';
                    const email = (document.getElementById('contact-email') as HTMLInputElement)?.value || '';
                    const message = (document.getElementById('contact-message') as HTMLTextAreaElement)?.value || '';
                    const subject = encodeURIComponent(`TrackVibe Contact: Message from ${name || 'Website Visitor'}`);
                    const body = encodeURIComponent(`From: ${name}\nEmail: ${email}\n\n${message}`);
                    window.location.href = `mailto:support@trackvibe.app?subject=${subject}&body=${body}`;
                  }}
                >
                  Send Message
                </Button>
              </CardContent>
            </Card>
          </div>
        </RevealSection>
      </section>
    </>
  );
}
