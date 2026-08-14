import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, AlertCircle, Activity, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { format, subHours, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { adminApi, type AppLogEntry, type UserActivityEvent } from '@/core/api/admin';
import { toast } from '@/components/shared/ToastProvider';
import { cn } from '@/lib/utils';

type LogTab = 'action' | 'error' | 'activity';
type TimePreset = '24h' | '7d' | '30d';

const EVENT_TYPE_ALL = '__all__';
const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: EVENT_TYPE_ALL, label: 'All' },
  { value: 'auth.', label: 'Auth' },
  { value: 'energy.', label: 'Energy' },
  { value: 'body.', label: 'Body' },
  { value: 'goals.', label: 'Goals' },
  { value: 'voice.', label: 'Voice' },
];

function getTimeRange(preset: TimePreset): { from: string; to: string } {
  const to = new Date();
  let from: Date;
  if (preset === '24h') from = subHours(to, 24);
  else if (preset === '7d') from = subDays(to, 7);
  else from = subDays(to, 30);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function formatTimeUtc(iso: string): string {
  try {
    const d = new Date(iso);
    return `${format(d, 'yyyy-MM-dd HH:mm:ss')} UTC`;
  } catch {
    return iso;
  }
}

/** Render a payload object as a readable key-value list */
function PayloadDetails({ payload }: { payload: Record<string, unknown> | null }) {
  if (!payload || Object.keys(payload).length === 0) {
    return <p className="text-xs text-muted-foreground italic">No payload data</p>;
  }

  // Highlight top-level human-readable fields
  const topFields: Record<string, unknown> = {};
  const HIGHLIGHT_KEYS = ['name', 'title', 'foodName', 'type', 'calories', 'amount', 'unit', 'source', 'intents', 'actionCount', 'method', 'period', 'target', 'date'];
  for (const k of HIGHLIGHT_KEYS) {
    if (payload[k] !== undefined && payload[k] !== null && payload[k] !== '') {
      topFields[k] = payload[k];
    }
  }

  return (
    <div className="space-y-2">
      {Object.keys(topFields).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(topFields).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 text-eyebrow bg-muted rounded px-2 py-0.5">
              <span className="text-muted-foreground font-medium">{k}:</span>
              <span className="font-mono truncate max-w-[140px]" title={String(v)}>
                {Array.isArray(v) ? v.join(',') : String(v)}
              </span>
            </span>
          ))}
        </div>
      )}
      <details className="group">
        <summary className="text-eyebrow text-muted-foreground cursor-pointer hover:text-foreground select-none">
          Raw payload
        </summary>
        <pre className="mt-1.5 text-eyebrow bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words text-muted-foreground max-h-48 overflow-y-auto">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function AdminLogs() {
  const [logTab, setLogTab] = useState<LogTab>('action');
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Activity tab state
  const [timePreset, setTimePreset] = useState<TimePreset>('24h');
  const [userId, setUserId] = useState<string | null>(null);
  const [eventType, setEventType] = useState(EVENT_TYPE_ALL);
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; email: string; name: string }[]>([]);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [events, setEvents] = useState<UserActivityEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [activityLoading, setActivityLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const { from, to } = useMemo(() => getTimeRange(timePreset), [timePreset]);

  const fetchLogs = useCallback(() => {
    if (logTab !== 'action' && logTab !== 'error') return;
    setLogsLoading(true);
    adminApi
      .getLogs(logTab)
      .then(setLogs)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load logs. Please try again.'))
      .finally(() => setLogsLoading(false));
  }, [logTab]);

  const fetchActivity = useCallback(
    (cursor?: string, replace = true) => {
      setActivityLoading(true);
      adminApi
        .getActivity({
          from,
          to,
          limit: 50,
          before: cursor,
          userId: userId ?? undefined,
          eventType: eventType && eventType !== EVENT_TYPE_ALL ? eventType : undefined,
        })
        .then((r) => {
          if (replace) setEvents(r.events);
          else setEvents((prev) => [...prev, ...r.events]);
          setNextCursor(r.nextCursor);
        })
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : 'Could not load activity. Please try again.');
        })
        .finally(() => setActivityLoading(false));
    },
    [from, to, userId, eventType]
  );

  useEffect(() => {
    if (logTab === 'action' || logTab === 'error') fetchLogs();
  }, [logTab, fetchLogs]);

  useEffect(() => {
    if (logTab === 'activity') fetchActivity();
  }, [logTab, from, to, userId, eventType, fetchActivity]);

  // Debounced user search
  useEffect(() => {
    if (logTab !== 'activity' || !userSearch.trim()) {
      setUserSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setUserSearchLoading(true);
      adminApi
        .searchUsers(userSearch.trim(), 20)
        .then(setUserSearchResults)
        .catch(() => setUserSearchResults([]))
        .finally(() => setUserSearchLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [logTab, userSearch]);

  const handleLoadMore = () => {
    if (nextCursor) fetchActivity(nextCursor, false);
  };

  const handleSelectUser = (u: { id: string; email: string; name: string }) => {
    setUserId(u.id);
    setUserSearch(`${u.name} (${u.email})`);
    setUserSearchOpen(false);
  };

  const handleClearUser = () => {
    setUserId(null);
    setUserSearch('');
  };

  const columnHelper = createColumnHelper<UserActivityEvent>();
  const columns = useMemo(
    () => [
      columnHelper.accessor('createdAt', {
        header: 'Time (UTC)',
        cell: (info) => (
          <span className="font-mono text-[13px]">{formatTimeUtc(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor((r) => r, {
        id: 'user',
        header: 'User',
        cell: (info) => {
          const r = info.getValue();
          const label = r.userName ? `${r.userName} (${r.userEmail ?? ''})` : r.userEmail ?? '—';
          return <span className="truncate max-w-[160px] block" title={label}>{label}</span>;
        },
      }),
      columnHelper.accessor('eventType', {
        header: 'Event type',
        cell: (info) => (
          <Badge variant="secondary" className="text-xs font-normal">
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('summary', {
        header: 'Summary',
        cell: (info) => (
          <span className="truncate max-w-[180px] block" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor((r) => r, {
        id: 'details',
        header: 'Details',
        cell: (info) => {
          const r = info.getValue();
          const isExpanded = expandedRowId === r.id;
          const hasPayload = r.payload && Object.keys(r.payload).length > 0;
          if (!hasPayload) return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-info hover:text-info/80"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedRowId(isExpanded ? null : r.id);
              }}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {isExpanded ? 'Hide' : 'Show'}
            </button>
          );
        },
      }),
    ],
    [columnHelper, expandedRowId]
  );

  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Logs</h3>
      <div className="flex gap-2 mb-4">
        <Button
          variant={logTab === 'action' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLogTab('action')}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          Logs
        </Button>
        <Button
          variant={logTab === 'error' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLogTab('error')}
        >
          <AlertCircle className="w-4 h-4 mr-1.5" />
          Log errors
        </Button>
        <Button
          variant={logTab === 'activity' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLogTab('activity')}
        >
          <Activity className="w-4 h-4 mr-1.5" />
          Activity
        </Button>
      </div>

      {logTab === 'activity' && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-2">
            <Button
              variant={timePreset === '24h' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePreset('24h')}
            >
              Last 24h
            </Button>
            <Button
              variant={timePreset === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePreset('7d')}
            >
              Last 7d
            </Button>
            <Button
              variant={timePreset === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePreset('30d')}
            >
              Last 30d
            </Button>
          </div>
          <div className="relative">
            <Input
              placeholder="Search user by email or name..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setUserId(null);
                setUserSearchOpen(true);
              }}
              onFocus={() => setUserSearchOpen(true)}
              className="w-64"
            />
            {userId && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-7" onClick={handleClearUser}>
                Clear
              </Button>
            )}
            {userSearchOpen && userSearch.trim() && (
              <div
                className="absolute z-10 mt-1 w-64 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto"
                onBlur={() => setTimeout(() => setUserSearchOpen(false), 150)}
              >
                {userSearchLoading ? (
                  <p className="p-2 text-sm text-muted-foreground">Searching...</p>
                ) : userSearchResults.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">No users found</p>
                ) : (
                  userSearchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => handleSelectUser(u)}
                    >
                      {u.name} ({u.email})
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {logTab !== 'activity' && (
        <div className="p-3 max-h-80 overflow-y-auto rounded-md border bg-muted/20">
          {logsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {logs.map((entry) => (
                <li
                  key={entry.id}
                  className={cn(
                    'rounded border p-2',
                    entry.level === 'error' ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/30'
                  )}
                >
                  <span className="text-muted-foreground text-xs">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  <p className="font-medium mt-0.5">{entry.message}</p>
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap break-words text-muted-foreground">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {logTab === 'activity' && (
        <>
          <div className="rounded-md border overflow-hidden max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-[13px] py-2">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {activityLoading && events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No events in selected time range
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const event = row.original;
                    const isExpanded = expandedRowId === event.id;
                    return (
                      <>
                        <TableRow key={row.id} className="text-[13px] cursor-pointer hover:bg-muted/30">
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="py-1.5">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${row.id}-expanded`} className="bg-muted/20 hover:bg-muted/30">
                            <TableCell colSpan={5} className="py-3 px-4">
                              <PayloadDetails payload={event.payload} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {nextCursor && (
            <Button variant="outline" size="sm" className="mt-3" onClick={handleLoadMore} disabled={activityLoading}>
              Load more
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
