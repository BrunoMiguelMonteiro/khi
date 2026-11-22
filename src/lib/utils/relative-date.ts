import { formatShortDate } from './short-date';

const DASH = '—';
const DAY_MS = 86_400_000;
const MAX_RELATIVE_DAYS = 30;

/** Whole local calendar days from `date` to `now`: 23:50 yesterday is 1, whatever the hour. */
function calendarDaysBetween(date: Date, now: Date): number {
	const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
	const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((end - start) / DAY_MS);
}

/**
 * Last read, in the interface's language: «Hoje», «Ontem», «Há 3 dias» up to 6 days, «Há 2 semanas» up to 30,
 * then a short date («9 nov.», with the year when it is not the current one). No date is «—».
 */
export function formatLastRead(value: string | null | undefined, locale: string, now: Date = new Date()): string {
	if (!value) return DASH;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return DASH;

	const days = Math.max(0, calendarDaysBetween(date, now));
	if (days > MAX_RELATIVE_DAYS) return formatShortDate(date, locale, date.getFullYear() !== now.getFullYear());

	const tag = locale === 'pt' ? 'pt-PT' : locale;
	// «auto» only for days («Hoje», «Ontem»): for weeks it would say «Semana passada» for a count, not the calendar.
	const text =
		days < 7
			? new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }).format(-days, 'day')
			: new Intl.RelativeTimeFormat(tag, { numeric: 'always' }).format(-Math.floor(days / 7), 'week');

	return text.charAt(0).toUpperCase() + text.slice(1);
}
