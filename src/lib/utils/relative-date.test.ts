import { describe, expect, it } from 'vitest';
import { formatLastRead } from './relative-date';

// Friday 20 November 2026, mid-afternoon, local time
const NOW = new Date(2026, 10, 20, 15, 30);
const daysAgo = (days: number, hour = 9) => new Date(2026, 10, 20 - days, hour).toISOString();

describe('formatLastRead', () => {
	it('today_and_yesterday_count_calendar_days', () => {
		expect(formatLastRead(daysAgo(0, 1), 'en', NOW)).toBe('Today');
		// 23:50 yesterday is 15 hours ago, but still yesterday
		expect(formatLastRead(daysAgo(1, 23), 'en', NOW)).toBe('Yesterday');
		expect(formatLastRead(daysAgo(1, 0), 'pt', NOW)).toBe('Ontem');
		expect(formatLastRead(daysAgo(0), 'pt', NOW)).toBe('Hoje');
	});

	it('days_up_to_six', () => {
		expect(formatLastRead(daysAgo(2), 'en', NOW)).toBe('2 days ago');
		expect(formatLastRead(daysAgo(6), 'en', NOW)).toBe('6 days ago');
		expect(formatLastRead(daysAgo(3), 'pt', NOW)).toBe('Há 3 dias');
	});

	it('weeks_from_seven_to_thirty_days', () => {
		expect(formatLastRead(daysAgo(7), 'en', NOW)).toBe('1 week ago');
		expect(formatLastRead(daysAgo(14), 'en', NOW)).toBe('2 weeks ago');
		expect(formatLastRead(daysAgo(28), 'en', NOW)).toBe('4 weeks ago');
		expect(formatLastRead(daysAgo(30), 'en', NOW)).toBe('4 weeks ago');
		expect(formatLastRead(daysAgo(21), 'pt', NOW)).toBe('Há 3 semanas');
		expect(formatLastRead(daysAgo(13), 'pt', NOW)).toBe('Há 1 semana');
		expect(formatLastRead(daysAgo(30), 'pt', NOW)).toBe('Há 4 semanas');
	});

	it('from_thirty_one_days_a_short_absolute_date_without_the_year', () => {
		// 31 days before 20 Nov is 20 Oct
		expect(formatLastRead(daysAgo(31), 'en', NOW)).toBe('Oct 20');
		expect(formatLastRead(daysAgo(31), 'pt', NOW)).toBe('20 out.');
		expect(formatLastRead(new Date(2026, 0, 3, 9).toISOString(), 'pt', NOW)).toBe('3 jan.');
	});

	it('another_year_adds_the_year', () => {
		const january = new Date(2027, 0, 2, 10);
		const lastYear = new Date(2026, 10, 20, 9).toISOString();
		expect(formatLastRead(lastYear, 'pt', january)).toBe('20 nov. 2026');
		expect(formatLastRead(lastYear, 'en', january)).toBe('Nov 20, 2026');
		// 31 Dec is 2 days before 2 Jan: still relative
		expect(formatLastRead(new Date(2026, 11, 31, 9).toISOString(), 'en', january)).toBe('2 days ago');
		expect(formatLastRead(daysAgo(800), 'pt', NOW)).toMatch(/ 2024$/);
	});

	it('no_date_is_a_dash', () => {
		expect(formatLastRead(null, 'en', NOW)).toBe('—');
		expect(formatLastRead(undefined, 'pt', NOW)).toBe('—');
		expect(formatLastRead('', 'en', NOW)).toBe('—');
		expect(formatLastRead('not a date', 'en', NOW)).toBe('—');
	});

	it('a_date_in_the_future_reads_as_today', () => {
		expect(formatLastRead(new Date(2026, 10, 22).toISOString(), 'en', NOW)).toBe('Today');
	});
});
