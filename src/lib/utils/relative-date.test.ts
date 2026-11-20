import { describe, expect, it } from 'vitest';
import { formatRelativeDate } from './relative-date';

// Friday 20 November 2026, mid-afternoon, local time
const NOW = new Date(2026, 10, 20, 15, 30);
const daysAgo = (days: number, hour = 9) => new Date(2026, 10, 20 - days, hour).toISOString();

describe('formatRelativeDate', () => {
	it('today_and_yesterday_count_calendar_days', () => {
		expect(formatRelativeDate(daysAgo(0, 1), 'en', NOW)).toBe('Today');
		// 23:50 yesterday is 15 hours ago, but still yesterday
		expect(formatRelativeDate(daysAgo(1, 23), 'en', NOW)).toBe('Yesterday');
		expect(formatRelativeDate(daysAgo(1, 0), 'pt', NOW)).toBe('Ontem');
		expect(formatRelativeDate(daysAgo(0), 'pt', NOW)).toBe('Hoje');
	});

	it('days_up_to_six', () => {
		expect(formatRelativeDate(daysAgo(2), 'en', NOW)).toBe('2 days ago');
		expect(formatRelativeDate(daysAgo(6), 'en', NOW)).toBe('6 days ago');
		expect(formatRelativeDate(daysAgo(3), 'pt', NOW)).toBe('Há 3 dias');
	});

	it('weeks_up_to_four', () => {
		expect(formatRelativeDate(daysAgo(7), 'en', NOW)).toBe('1 week ago');
		expect(formatRelativeDate(daysAgo(14), 'en', NOW)).toBe('2 weeks ago');
		expect(formatRelativeDate(daysAgo(28), 'en', NOW)).toBe('4 weeks ago');
		expect(formatRelativeDate(daysAgo(21), 'pt', NOW)).toBe('Há 3 semanas');
		expect(formatRelativeDate(daysAgo(13), 'pt', NOW)).toBe('Há 1 semana');
	});

	it('months_up_to_eleven', () => {
		expect(formatRelativeDate(daysAgo(40), 'en', NOW)).toBe('1 month ago');
		expect(formatRelativeDate(daysAgo(90), 'en', NOW)).toBe('3 months ago');
		expect(formatRelativeDate(daysAgo(364), 'en', NOW)).toBe('11 months ago');
		expect(formatRelativeDate(daysAgo(150), 'pt', NOW)).toBe('Há 5 meses');
	});

	it('years', () => {
		expect(formatRelativeDate(daysAgo(400), 'en', NOW)).toBe('1 year ago');
		expect(formatRelativeDate(daysAgo(800), 'en', NOW)).toBe('2 years ago');
		expect(formatRelativeDate(daysAgo(800), 'pt', NOW)).toBe('Há 2 anos');
	});

	it('no_date_is_a_dash', () => {
		expect(formatRelativeDate(null, 'en', NOW)).toBe('—');
		expect(formatRelativeDate(undefined, 'pt', NOW)).toBe('—');
		expect(formatRelativeDate('', 'en', NOW)).toBe('—');
		expect(formatRelativeDate('not a date', 'en', NOW)).toBe('—');
	});

	it('a_date_in_the_future_reads_as_today', () => {
		expect(formatRelativeDate(new Date(2026, 10, 22).toISOString(), 'en', NOW)).toBe('Today');
	});
});
