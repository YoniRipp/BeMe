/**
 * AI-powered Insights section — calls the backend Gemini endpoints
 * to show a wellness score, smart summary, highlights, and suggestions.
 * Supports configurable time periods and links to AI chat.
 */
import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, TrendingUp, Lightbulb, AlertCircle, Search, X, RefreshCw, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { aiInsightsApi, type SearchResult } from '@/core/api/aiInsights';
import { cn } from '@/lib/utils';
import { AiChatPanel } from './AiChatPanel';

// ─── Period Options ─────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function PeriodSelector({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div className="flex gap-1">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.days}
          onClick={() => onChange(opt.days)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium transition-colors',
            value === opt.days
              ? 'bg-primary/10 text-primary  '
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Wellness Score Ring ───────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? 'hsl(var(--chart-1))' : score >= 50 ? 'hsl(var(--chart-3))' : 'hsl(var(--destructive))';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="50" y="55" textAnchor="middle" fontSize="20" fontWeight="bold" fill={color}>
          {score}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground">Wellness Score</span>
    </div>
  );
}

// ─── Semantic Search Box ───────────────────────────────────────────────────────

const RECORD_TYPE_LABEL: Record<string, string> = {
  workout: '💪 Workout',
  food_entry: '🥗 Food',
};

function SearchBox() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isFetching, error } = useQuery({
    queryKey: ['semantic-search', submitted],
    queryFn: () => aiInsightsApi.search(submitted),
    enabled: submitted.length > 2,
    staleTime: 30_000,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length > 2) setSubmitted(query.trim());
  };

  const clear = () => { setQuery(''); setSubmitted(''); };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="w-4 h-4" />
          Search Your Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. leg day workouts, high calorie meals, morning runs…"
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={query.trim().length < 3 || isFetching}>
            {isFetching ? '…' : 'Search'}
          </Button>
          {submitted && (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </form>

        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {(error as Error)?.message ?? 'Search unavailable.'}
          </p>
        )}

        {data && data.results.length === 0 && (
          <p className="text-sm text-muted-foreground">No matching records found.</p>
        )}

        {data && data.results.length > 0 && (
          <ul className="divide-y text-sm">
            {data.results.map((r: SearchResult) => (
              <li key={`${r.recordType}-${r.recordId}`} className="py-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{RECORD_TYPE_LABEL[r.recordType] ?? r.recordType}</span>
                  <span className="text-xs text-muted-foreground">{(r.similarity * 100).toFixed(0)}% match</span>
                </div>
                <p className="text-muted-foreground line-clamp-2">{r.contentText}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Powered by semantic vector search — finds results by meaning, not just keywords.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Today's Recommendations ───────────────────────────────────────────────────

function TodayRecommendations() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-today-recs'],
    queryFn: aiInsightsApi.getTodayRecommendations,
    staleTime: 30 * 60 * 1000, // 30 min — no need to refetch frequently
  });

  if (error) return null;

  const recs = [
    { icon: '💪', label: 'Workout', text: data?.workout },
    { icon: '😴', label: 'Sleep', text: data?.sleep },
    { icon: '🥗', label: 'Nutrition', text: data?.nutrition },
    { icon: '🧠', label: 'Focus', text: data?.focus },
  ].filter((r) => r.text);

  if (!isLoading && recs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="w-4 h-4 text-gold" />
          Today's Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-gold animate-pulse" />
              <span>
                Generating recommendations
                <span className="animate-thinking-dots inline">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </span>
            </p>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 rounded bg-muted/80 animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {recs.map((r) => (
              <li key={r.label} className="flex gap-2 text-sm">
                <span className="text-lg leading-none">{r.icon}</span>
                <div>
                  <span className="font-medium">{r.label}: </span>
                  <span className="text-muted-foreground">{r.text}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Section ──────────────────────────────────────────────────────────────

const ALL_PERIODS = [7, 14, 30, 90] as const;

export function AiInsightsSection() {
  const queryClient = useQueryClient();
  const [periodDays, setPeriodDays] = useState(30);
  const [chatOpen, setChatOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-insights', periodDays],
    queryFn: () => aiInsightsApi.getInsights(periodDays),
    staleTime: 15 * 60 * 1000, // 15 min cache
  });

  // Prefetch all other periods once the initial query succeeds
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (data && !prefetchedRef.current) {
      prefetchedRef.current = true;
      const otherPeriods = ALL_PERIODS.filter(d => d !== periodDays);
      for (const days of otherPeriods) {
        void queryClient.prefetchQuery({
          queryKey: ['ai-insights', days],
          queryFn: () => aiInsightsApi.getInsights(days),
          staleTime: 15 * 60 * 1000,
        });
      }
    }
  }, [data, periodDays, queryClient]);

  const autoRefreshTriggered = useRef(false);

  const refreshMutation = useMutation({
    mutationFn: () => aiInsightsApi.refreshInsights(periodDays),
    onSuccess: () => {
      // Invalidate all period caches so they refetch the newly preloaded data
      for (const days of ALL_PERIODS) {
        void queryClient.invalidateQueries({ queryKey: ['ai-insights', days] });
      }
      void queryClient.invalidateQueries({ queryKey: ['ai-today-recs'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-insights-freshness'] });
      autoRefreshTriggered.current = false;
      prefetchedRef.current = false; // allow re-prefetch after refresh
    },
  });

  // Auto-refresh when user has new activity since last insight generation
  const { data: freshness } = useQuery({
    queryKey: ['ai-insights-freshness'],
    queryFn: aiInsightsApi.getFreshness,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (
      freshness?.needsRefresh &&
      !autoRefreshTriggered.current &&
      !refreshMutation.isPending &&
      !isLoading &&
      data
    ) {
      autoRefreshTriggered.current = true;
      refreshMutation.mutate();
    }
  }, [freshness?.needsRefresh, refreshMutation.isPending, isLoading, data]);

  // Smart refresh: skip if nothing has changed
  const handleRefresh = () => {
    if (freshness && !freshness.needsRefresh) {
      // Nothing changed — no-op, don't call the backend
      return;
    }
    refreshMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI-Powered Insights
        </h2>
        <div className="flex items-center gap-2">
          <PeriodSelector value={periodDays} onChange={setPeriodDays} />
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || refreshMutation.isPending}
            onClick={handleRefresh}
          >
            <RefreshCw
              className={cn('w-4 h-4 mr-1.5', (isLoading || refreshMutation.isPending) && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Score + Summary card */}
      <Card>
        <CardContent className="pt-6">
          {isLoading || refreshMutation.isPending ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <span>
                  Analyzing your data
                  <span className="animate-thinking-dots inline">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </span>
              </p>
              <div className="space-y-3">
                <div className="h-4 rounded bg-muted/80 animate-pulse w-3/4" />
                <div className="h-4 rounded bg-muted/80 animate-pulse w-full" />
                <div className="h-4 rounded bg-muted/80 animate-pulse w-2/3" />
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {String((error as Error)?.message ?? '').includes('503')
                    ? 'AI insights require server configuration'
                    : 'Could not load AI insights right now'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {String((error as Error)?.message ?? '').includes('503')
                    ? 'Contact support if this persists.'
                    : 'The AI service may be temporarily unavailable.'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshMutation.isPending}
              >
                <RefreshCw className={cn('w-4 h-4 mr-1.5', refreshMutation.isPending && 'animate-spin')} />
                Retry
              </Button>
            </div>
          ) : data ? (
            <div className="flex gap-6 items-start flex-wrap">
              <ScoreRing score={data.score} />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">{data.summary.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Highlights + Suggestions side by side */}
      {data && !isLoading && !refreshMutation.isPending && (
        <div className="grid sm:grid-cols-2 gap-4">
          {data.highlights.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4 text-success" />
                  Highlights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {data.highlights.map((h, i) => (
                    <li key={i} className="text-sm flex gap-2.5 leading-relaxed">
                      <span className="text-success mt-0.5 shrink-0">✓</span>
                      <span>{h.replace(/\*\*(.*?)\*\*/g, '$1')}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {data.suggestions.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="w-4 h-4 text-gold" />
                  Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {data.suggestions.map((s, i) => (
                    <li key={i} className="text-sm flex gap-2.5 leading-relaxed">
                      <span className="text-gold mt-0.5 shrink-0">→</span>
                      <span>{s.replace(/\*\*(.*?)\*\*/g, '$1')}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* AI Coach Chat Button */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                AI Fitness Coach
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Ask anything about your nutrition, workouts, or goals. Your coach knows all your data.
              </p>
            </div>
            <Button
              onClick={() => setChatOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white shrink-0"
              size="sm"
            >
              Chat Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Recommendations */}
      <TodayRecommendations />

      {/* Semantic Search */}
      <SearchBox />

      {/* Chat Panel */}
      <AiChatPanel open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
