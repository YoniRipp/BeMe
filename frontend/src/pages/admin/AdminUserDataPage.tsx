import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dumbbell, UtensilsCrossed, Moon, Target, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type ApiUserSearchItem } from '@/core/api/admin';
import { toast } from '@/components/shared/ToastProvider';

export default function AdminUserDataPage() {
  const location = useLocation();
  const initialUser = (location.state as { user?: ApiUserSearchItem } | null)?.user ?? null;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ApiUserSearchItem | null>(initialUser);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ApiUserSearchItem[]>([]);

  useEffect(() => {
    const u = (location.state as { user?: ApiUserSearchItem } | null)?.user;
    if (u) setSelectedUser(u);
  }, [location.state]);

  const handleSearch = async () => {
    if (searchQuery.trim().length < 1) return;
    setSearching(true);
    try {
      const results = await adminApi.searchUsers(searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">User Data Management</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Search for a user to view and manage their data
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="w-4 h-4 mr-2" />
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setSelectedUser(user);
                    setSearchResults([]);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border
                    hover:bg-muted/50 transition-colors text-left
                    ${selectedUser?.id === user.id ? 'border-primary bg-muted/30' : 'border-border'}`}
                >
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected User Data */}
      {selectedUser && <UserDataView user={selectedUser} />}
    </div>
  );
}

function UserDataView({ user }: { user: ApiUserSearchItem }) {
  const { data: workoutsData, isLoading: loadingWorkouts } = useQuery({
    queryKey: ['admin', 'userData', user.id, 'workouts'],
    queryFn: () => adminApi.getUserWorkouts(user.id),
    staleTime: 2 * 60 * 1000,
  });
  const { data: foodData, isLoading: loadingFood } = useQuery({
    queryKey: ['admin', 'userData', user.id, 'food'],
    queryFn: () => adminApi.getUserFoodEntries(user.id),
    staleTime: 2 * 60 * 1000,
  });
  const { data: checkInsData, isLoading: loadingCheckIns } = useQuery({
    queryKey: ['admin', 'userData', user.id, 'checkIns'],
    queryFn: () => adminApi.getUserCheckIns(user.id),
    staleTime: 2 * 60 * 1000,
  });
  const { data: goalsData, isLoading: loadingGoals } = useQuery({
    queryKey: ['admin', 'userData', user.id, 'goals'],
    queryFn: () => adminApi.getUserGoals(user.id),
    staleTime: 2 * 60 * 1000,
  });

  const workouts = workoutsData?.data ?? [];
  const foodEntries = foodData?.data ?? [];
  const checkIns = checkInsData?.data ?? [];
  const goals = goalsData?.data ?? [];
  const isLoading = loadingWorkouts || loadingFood || loadingCheckIns || loadingGoals;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{user.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading user data...</p>
        ) : (
          <Tabs defaultValue="workouts">
            <TabsList>
              <TabsTrigger value="workouts" className="gap-1.5">
                <Dumbbell className="w-3.5 h-3.5" />
                Workouts ({workouts.length})
              </TabsTrigger>
              <TabsTrigger value="food" className="gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                Food ({foodEntries.length})
              </TabsTrigger>
              <TabsTrigger value="checkins" className="gap-1.5">
                <Moon className="w-3.5 h-3.5" />
                Check-ins ({checkIns.length})
              </TabsTrigger>
              <TabsTrigger value="goals" className="gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Goals ({goals.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="workouts" className="mt-4">
              <DataList
                items={workouts}
                emptyMessage="No workouts recorded yet."
                renderItem={(item) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {String(item.title || 'Workout')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {String(item.date || '')} - {String(item.type || 'strength')}
                        {item.durationMinutes ? ` - ${item.durationMinutes} min` : ''}
                      </p>
                    </div>
                    {Array.isArray(item.exercises) && (
                      <span className="text-xs text-muted-foreground">
                        {item.exercises.length} exercise{item.exercises.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              />
            </TabsContent>

            <TabsContent value="food" className="mt-4">
              <DataList
                items={foodEntries}
                emptyMessage="No food entries recorded yet."
                renderItem={(item) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {String(item.name || 'Food')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {String(item.date || '')}
                      </p>
                    </div>
                    {item.calories != null && (
                      <span className="text-xs text-muted-foreground">{String(item.calories)} cal</span>
                    )}
                  </div>
                )}
              />
            </TabsContent>

            <TabsContent value="checkins" className="mt-4">
              <DataList
                items={checkIns}
                emptyMessage="No check-ins recorded yet."
                renderItem={(item) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {String(item.date || '')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.sleepHours != null ? `Sleep: ${item.sleepHours}h` : ''}
                        {item.energyLevel != null ? ` | Energy: ${item.energyLevel}/10` : ''}
                        {item.mood != null ? ` | Mood: ${item.mood}/10` : ''}
                      </p>
                    </div>
                  </div>
                )}
              />
            </TabsContent>

            <TabsContent value="goals" className="mt-4">
              <DataList
                items={goals}
                emptyMessage="No goals set yet."
                renderItem={(item) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {String(item.type || 'Goal')}: {String(item.target || '')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {String(item.period || '')}
                        {item.startDate ? ` | ${item.startDate}` : ''}
                      </p>
                    </div>
                  </div>
                )}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

interface DataListProps {
  items: Record<string, unknown>[];
  emptyMessage: string;
  renderItem: (item: Record<string, unknown>) => React.ReactNode;
}

function DataList({ items, emptyMessage, renderItem }: DataListProps) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={String(item.id ?? index)}
          className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
        >
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}
