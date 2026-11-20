const DASH = '—';
const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 30;

/** Whole local calendar days from `date` to `now`: 23:50 yesterday is 1, whatever the hour. */
function calendarDaysBetween(date: Date, now: Date): number {
	const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
	const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((end - start) / DAY_MS);
}

/**
 * «Hoje», «Ontem», «Há 3 dias», «Há 2 semanas», «Há 4 meses», «Há 2 anos», in the interface's language.
 * Days up to 6, weeks up to 4, months up to 11, then years. No date is «—».
 */
export function formatRelativeDate(value: string | null | undefined, locale: string, now: Date = new Date()): string {
	if (!value) return DASH;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return DASH;

	const days = Math.max(0, calendarDaysBetween(date, now));
	const tag = locale === 'pt' ? 'pt-PT' : locale;
	// «auto» only for days («Hoje», «Ontem»): for weeks and up it would say «Semana passada» for a count, not the calendar.
	const dayFormat = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
	const format = new Intl.RelativeTimeFormat(tag, { numeric: 'always' });

	let text: string;
	if (days < 7) text = dayFormat.format(-days, 'day');
	else if (days < 35) text = format.format(-Math.floor(days / 7), 'week');
	else if (days < 365) text = format.format(-Math.min(11, Math.floor(days / DAYS_PER_MONTH)), 'month');
	else text = format.format(-Math.floor(days / 365), 'year');

	return text.charAt(0).toUpperCase() + text.slice(1);
}
