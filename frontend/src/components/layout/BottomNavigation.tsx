import { Link } from 'react-router-dom';
import { Mic } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

interface BottomNavigationProps {
  items: NavItem[];
  currentPath: string;
  onCenterPress?: () => void;
}

export function BottomNavigation({ items, currentPath, onCenterPress }: BottomNavigationProps) {
  // Split items into left and right halves for the center button
  const half = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, half);
  const rightItems = items.slice(half);

  const renderItem = (item: NavItem) => {
    const isActive = currentPath === item.path;
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] py-2 transition-colors press min-h-[48px]
          ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.9} />
        <span className="leading-none">
          {item.name}
        </span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden pointer-events-none pb-safe"
      aria-label="Main navigation"
    >
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none" />
      <div className="relative mx-3.5 mb-3.5 h-16 rounded-[22px] border border-border bg-card/95 flex items-center justify-around shadow-card-lg pointer-events-auto backdrop-blur-xl">
        {leftItems.map(renderItem)}
        <div className="w-16" />
        {rightItems.map(renderItem)}
        <button
          type="button"
          onClick={onCenterPress}
          className="absolute top-[-22px] left-1/2 -translate-x-1/2 w-[60px] h-[60px] rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-[3px] ring-background press shadow-fab"
          aria-label="Open voice"
        >
          <Mic className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
        </button>
      </div>
    </nav>
  );
}
