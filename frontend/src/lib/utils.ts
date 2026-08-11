import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string, dateFormat: string = 'DD/MM/YYYY'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Map date format strings to date-fns format strings
  const formatMap: Record<string, string> = {
    'MM/DD/YYYY': 'MM/dd/yyyy',
    'DD/MM/YYYY': 'dd/MM/yyyy',
    'YYYY-MM-DD': 'yyyy-MM-dd',
    // Legacy support for old 2-digit year formats
    'MM/DD/YY': 'MM/dd/yy',
    'DD/MM/YY': 'dd/MM/yy',
  };
  
  const dateFnsFormat = formatMap[dateFormat] || 'dd/MM/yyyy';
  // date-fns throws on an invalid date. A display helper must not be able to take the
  // page down over one bad stored value.
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—';
  return format(d, dateFnsFormat);
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Treat (dateStr, timeStr) as UTC and return the same time formatted in the user's local timezone (e.g. "10:00 AM").
 * Used for schedule items stored in UTC so we display "true time ± offset".
 */
export function utcScheduleTimeToLocal(dateStr: string, timeStr: string, timeZone?: string): string {
  const utc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  if (isNaN(utc.getTime())) return formatTime(timeStr);
  const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const result = formatter.format(utc);
  return result;
}

/**
 * Treat (dateStr, timeStr) as UTC and return the local calendar date (YYYY-MM-DD) in the user's timezone.
 * Used to group schedule items by day in week/list views.
 */
export function utcScheduleToLocalDateStr(dateStr: string, timeStr: string, timeZone?: string): string {
  const utc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  if (isNaN(utc.getTime())) return dateStr;
  const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(utc);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value.padStart(2, '0') ?? '';
  const d = parts.find((p) => p.type === 'day')?.value.padStart(2, '0') ?? '';
  return `${y}-${m}-${d}`;
}

/** True if the given end time (HH:MM) has already passed today (legacy: treats endTime as local). */
export function isScheduleItemPast(endTime: string): boolean {
  const now = new Date();
  const [h, m] = endTime.split(':').map(Number);
  const endMinutes = (h ?? 0) * 60 + (m ?? 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > endMinutes;
}

/** True if the UTC moment (dateStr + endTime) has already passed. Use for schedule items stored in UTC. */
export function isScheduleItemPastUtc(dateStr: string, endTime: string): boolean {
  const utc = new Date(`${dateStr}T${endTime}:00.000Z`);
  return !isNaN(utc.getTime()) && Date.now() > utc.getTime();
}

export function getMonthName(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export function startOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}

export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return d1.toDateString() === d2.toDateString();
}

export function getWeightUnit(units: 'metric' | 'imperial'): string {
  return units === 'metric' ? 'kg' : 'lbs';
}
