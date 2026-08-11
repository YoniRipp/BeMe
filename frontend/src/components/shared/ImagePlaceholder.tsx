import { useState, useEffect } from 'react';
import { UtensilsCrossed, Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONFIG = {
  food: {
    icon: UtensilsCrossed,
    bg: 'bg-terracotta/10',
    text: 'text-terracotta',
    ring: 'ring-terracotta-light/30',
  },
  exercise: {
    icon: Dumbbell,
    bg: 'bg-info/10',
    text: 'text-info',
    ring: 'ring-info/20',
  },
} as const;

const SIZES = {
  sm: { container: 'w-10 h-10', icon: 'w-5 h-5' },
  md: { container: 'w-12 h-12', icon: 'w-6 h-6' },
  lg: { container: 'w-16 h-16', icon: 'w-8 h-8' },
} as const;

interface ImagePlaceholderProps {
  type: 'food' | 'exercise';
  size?: 'sm' | 'md' | 'lg';
  imageUrl?: string;
  className?: string;
}

export function ImagePlaceholder({ type, size = 'md', imageUrl, className }: ImagePlaceholderProps) {
  const { icon: Icon, bg, text, ring } = CONFIG[type];
  const { container, icon } = SIZES[size];
  // Catalog images are hosted remotely, so a dead URL must degrade to the icon rather
  // than render a broken image.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn('rounded-xl object-cover shrink-0 ring-2', ring, container, className)}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={cn('rounded-xl flex items-center justify-center shrink-0', bg, container, className)}>
      <Icon className={cn(icon, text)} aria-hidden="true" />
    </div>
  );
}
