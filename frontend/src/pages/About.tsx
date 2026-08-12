import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Layers, BrainCircuit, ArrowRight, Users, Code, Palette } from 'lucide-react';

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Privacy First',
    description: 'Your data belongs to you. We never sell it, and we encrypt everything in transit. Passwords are hashed, and we follow industry best practices to keep your information safe.',
  },
  {
    icon: Layers,
    title: 'Simplicity Over Complexity',
    description: 'One app, one login, one place to see your whole life. No bloat, no feature overload — just the tools you need to track what matters.',
  },
  {
    icon: BrainCircuit,
    title: 'AI That Helps, Not Hypes',
    description: 'Our AI gives you practical insights based on your real data — not generic advice. It connects patterns across your health and habits to surface what actually matters.',
  },
];

export function About() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">About TrackVibe</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          We believe managing your life shouldn't require five different apps.
        </p>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="text-2xl font-bold tracking-tight">Our Mission</h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          TrackVibe was born from a simple frustration: tracking health and goals meant juggling
          multiple apps that never talked to each other. We built TrackVibe to be the single place where all
          your wellness data lives — and where AI connects the dots to give you insights no single-purpose
          app ever could.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Whether you're logging workouts, counting macros, tracking sleep, or setting goals,
          TrackVibe brings it all together. And with voice-first input, tracking takes seconds
          instead of minutes.
        </p>
      </section>

      {/* Values */}
      <section className="bg-muted/50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">What We Believe</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {VALUES.map((v) => (
              <Card key={v.title} className="transition-shadow hover:shadow-md">
                <CardContent className="p-6 space-y-3">
                  <v.icon className="h-8 w-8 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* The Product */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-bold tracking-tight">The Product</h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          TrackVibe covers three wellness domains: <strong>Body</strong> (workouts & exercise logging),{' '}
          <strong>Energy</strong> (nutrition, sleep & wellness), and <strong>Goals</strong>{' '}
          (measurable targets). Every domain supports voice input powered by Google Gemini AI.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Pro subscribers get AI-powered insights that connect patterns across all domains — like
          how your sleep quality affects your workout performance, or how your nutrition choices
          impact your energy levels.
        </p>
        <div className="mt-6">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/welcome#features">See all features <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* Team */}
      <section className="bg-muted/50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Our Team</h2>
            <p className="mt-2 text-muted-foreground">
              A small, passionate team building tools for a healthier life.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-6 space-y-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Code className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-semibold">Engineering</h3>
                <p className="text-sm text-muted-foreground">
                  Full-stack developers building a fast, reliable platform with AI-powered features and voice integration.
                </p>
              </CardContent>
            </Card>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-6 space-y-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Palette className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-semibold">Design</h3>
                <p className="text-sm text-muted-foreground">
                  Focused on creating a mobile-first experience that feels as natural as the apps you use every day.
                </p>
              </CardContent>
            </Card>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-6 space-y-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-semibold">Community</h3>
                <p className="text-sm text-muted-foreground">
                  We build in the open and welcome contributions — from bug fixes to feature ideas and documentation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to take control?</h2>
        <p className="mt-4 text-muted-foreground">
          Join thousands of people who track their whole life in one place.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="gap-2">
            <Link to="/signup">Get Started Free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
