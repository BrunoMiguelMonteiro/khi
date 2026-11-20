type When = Date | string | number;

/** «9 nov.», «Nov 9»: day and month only, in the interface's language. With `year`, «9 nov. 2025» / «Nov 9, 2025». */
export function formatShortDate(when: When, locale: string, year = false): string {
	const date = new Date(when);
	const format = new Intl.DateTimeFormat(locale, year ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
	if (year) {
		// Portuguese joins the parts with « de »: a space is enough
		return format.format(date).replace(/ de /g, ' ');
	}
	return format
		.formatToParts(date)
		.filter((part) => part.type === 'day' || part.type === 'month')
		.map((part) => part.value)
		.join(' ');
}
