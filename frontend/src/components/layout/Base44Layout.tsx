import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Dumbbell,
  Target,
  Menu,
  X,
  Leaf,
  ChevronRight,
  Sun,
  TrendingUp,
  Settings,
  ShieldCheck,
  LogOut,
  User,
  Users,
  BookOpen,
  Sparkles,
  Flame,
  Mic,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useMediaQuery, supportsMediaQueries, LG_BREAKPOINT_QUERY } from '@/hooks/useMediaQuery';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AiChatPanel } from '../insights/AiChatPanel';
import { VoiceAgentPanel } from '../voice/VoiceAgentPanel';
import { BottomNavigation } from './BottomNavigation';

const ROUTE_TO_TITLE: Record<string, string> = {
  '/': 'Home',
  '/body': 'Workouts',
  '/energy': 'Journal',
  '/water': 'Water',
  '/goals': 'Goals',
  '/insights': 'Insights',
  '/settings': 'Settings',
  '/trainer': 'My Clients',
  '/admin': 'Admin',
};

const SIDEBAR_NAV_BASE = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Workouts', path: '/body', icon: Dumbbell },
  { name: 'Journal', path: '/energy', icon: BookOpen },
  { name: 'Goals', path: '/goals', icon: Target },
  { name: 'Insights', path: '/insights', icon: TrendingUp },
  { name: 'Settings', path: '/settings', icon: Settings },
];

const BOTTOM_NAV_BASE = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Body', path: '/body', icon: Dumbbell },
  { name: 'Energy', path: '/energy', icon: Flame },
  { name: 'Goals', path: '/goals', icon: Target },
];

const BOTTOM_NAV_TRAINER = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Body', path: '/body', icon: Dumbbell },
  { name: 'Clients', path: '/trainer', icon: Users },
  { name: 'Goals', path: '/goals', icon: Target },
];

function getSidebarNav(isAdmin: boolean, isTrainer: boolean) {
  const nav = [...SIDEBAR_NAV_BASE];
  if (isTrainer) nav.push({ name: 'Clients', path: '/trainer', icon: Users });
  if (isAdmin) nav.push({ name: 'Admin', path: '/admin', icon: ShieldCheck });
  return nav;
}

function hasTrainerAccess(user?: { role?: string; subscriptionStatus?: string }) {
  return user?.role === 'trainer' ||
    user?.role === 'admin' ||
    user?.subscriptionStatus === 'trainer' ||
    user?.subscriptionStatus === 'trainer_pro';
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/trainer/client/')) return 'Client profile';
  return ROUTE_TO_TITLE[pathname] ?? (pathname.slice(1) || 'Dashboard');
}

export function Base44Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const isDesktop = useMediaQuery(LG_BREAKPOINT_QUERY);
  const { user } = useApp();
  const { logout } = useAuth();
  const { hasAiAccess } = useSubscription();

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };
  const trainerAccess = hasTrainerAccess(user);
  const sidebarNav = useMemo(() => getSidebarNav(user?.role === 'admin', trainerAccess), [user?.role, trainerAccess]);
  const bottomNavItems = trainerAccess ? BOTTOM_NAV_TRAINER : BOTTOM_NAV_BASE;

  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Escape closes the drawer, matching every other dismissible surface in the app.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  // Below `lg` the sidebar is a drawer: translated off-screen but still in the DOM, so
  // without `inert` its links stay tabbable while invisible. Set imperatively rather than
  // as a JSX prop so it works the same on React 18 and 19.
  //
  // `inert` also blocks pointer events, so a wrong reading here would make the *visible*
  // desktop sidebar completely dead. It is therefore applied only when the drawer is
  // positively known to be off-screen — never on a guess, and never where matchMedia is
  // unavailable to answer.
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const isHiddenDrawer = supportsMediaQueries() && !isDesktop && !sidebarOpen;
    if (isHiddenDrawer) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [sidebarOpen, isDesktop]);

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-scrim/50 backdrop-blur-sm z-40 lg:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar. Below `lg` it is a drawer: translated off-screen but still in the DOM,
          so it needs `inert` when closed or its links stay in the tab order — invisible
          controls a keyboard or switch user lands on. Above `lg` it is always visible. */}
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-72 bg-sidebar border-r border-sidebar-border z-50
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="px-6 pt-7 pb-5">
            <Link
              to="/"
              className="flex items-center gap-3"
              aria-label="TrackVibe home"
            >
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-card">
                <Leaf className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-medium tracking-tight leading-none">TrackVibe</h1>
                <p className="text-caption uppercase tracking-[0.22em] text-muted-foreground font-medium mt-1.5">Life Balance</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-2">
            <p className="px-3 mb-2 text-caption uppercase tracking-[0.18em] text-muted-foreground font-semibold">Navigate</p>
            <div className="space-y-0.5">
              {sidebarNav.map((item) => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
                      ${isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2.25 : 1.75} />
                    <span className="text-sm font-medium">{item.name}</span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="p-4 mx-3 mb-4 rounded-2xl bg-muted">
            <p className="text-sm font-display font-medium text-foreground">Your journey</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Every step counts — keep showing up.</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-72 min-h-screen">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 lg:hidden bg-card/95 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 min-h-[56px]">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="-ml-1 p-2 rounded-xl hover:bg-muted transition-colors press"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="font-display text-lg font-semibold tracking-tight leading-none">{pageTitle}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="p-1 rounded-full hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open user menu"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[11rem]">
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="flex items-center gap-2 cursor-pointer text-muted-foreground focus:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Desktop header */}
        <header
          className={`hidden lg:sticky lg:block top-0 z-30 transition-all duration-300
            ${scrolled ? 'glass border-b border-border/70' : 'bg-transparent'}`}
        >
          <div className="flex items-center justify-between px-5 sm:px-6 lg:px-8 py-3 min-h-[60px]">
            <h2 className="font-display text-[22px] font-medium tracking-tight leading-none">{pageTitle}</h2>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                <Sun className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{dateStr}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label="Open user menu"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="hidden sm:inline text-sm font-medium pr-1">{user?.name ?? 'Account'}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[11rem]">
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="flex items-center gap-2 cursor-pointer text-muted-foreground focus:text-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 pb-32 lg:pb-10 pt-5 lg:pt-3 animate-fade-up">
          <div className="mx-auto max-w-[700px] xl:max-w-none">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav with center "+" */}
      <BottomNavigation
        items={bottomNavItems}
        currentPath={pathname}
        onCenterPress={() => setVoicePanelOpen((prev) => !prev)}
      />

      <VoiceAgentPanel open={voicePanelOpen} onOpenChange={setVoicePanelOpen} />

      {/* Desktop voice button. Shown on every page including Home — on desktop the bottom
          nav (and its centre mic) is hidden, so this is the only voice entry point there. */}
      <Button
        size="icon"
        onClick={() => setVoicePanelOpen((prev) => !prev)}
        className="fixed right-4 z-40 hidden h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-card-lg hover:bg-primary/90 md:right-6 lg:bottom-6 lg:flex"
        aria-label={voicePanelOpen ? 'Close voice panel' : 'Open voice'}
      >
        <Mic className="h-5 w-5" />
      </Button>

      {/* AI Chat FAB — bottom-right, above mobile nav */}
      {hasAiAccess && pathname !== '/insights' && (
        <Button
          size="icon"
          onClick={() => setAiChatOpen(true)}
          className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+9.75rem)] z-40 h-12 w-12 rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-card-lg md:right-6 lg:bottom-[5.25rem]"
          aria-label="Open AI Coach"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      )}
      <AiChatPanel open={aiChatOpen} onOpenChange={setAiChatOpen} />
    </div>
  );
}
