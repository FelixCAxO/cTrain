import type { ProgressBlob } from './progressStore';

export function shouldShowStreakReminder(
  progress: ProgressBlob,
  now: Date = new Date(),
  timeZone?: string
): boolean {
  if (progress.lastCompletionDate === undefined || progress.currentStreak <= 0) {
    return false;
  }

  const currentDate = formatCalendarDate(now, timeZone);
  if (progress.streakReminderSnoozedDate === currentDate) {
    return false;
  }

  return progress.lastCompletionDate === previousCalendarDate(now, timeZone);
}

export function formatStreakReminder(currentStreak: number): string {
  return `Your ${currentStreak}-day cTrain streak is waiting. Practice a lesson today to keep it going.`;
}

function previousCalendarDate(date: Date, timeZone: string | undefined): string {
  return shiftCalendarDate(formatCalendarDate(date, timeZone), -1);
}

function formatCalendarDate(date: Date, timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (year === undefined || month === undefined || day === undefined) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function shiftCalendarDate(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split('-').map(Number);
  const shifted = new Date(year!, month! - 1, day! + days);
  return [
    shifted.getFullYear().toString().padStart(4, '0'),
    (shifted.getMonth() + 1).toString().padStart(2, '0'),
    shifted.getDate().toString().padStart(2, '0')
  ].join('-');
}
