/**
 * The path as the Finder shows it: the home folder written «~». Only for display; what is stored
 * stays absolute. A path that merely starts with the same letters (`/Users/leitor2`) is not inside
 * the home.
 */
export function abbreviateHome(path: string, home: string | null | undefined): string {
	const base = home ? home.replace(/\/+$/, '') : '';
	if (!base) return path;
	if (path === base) return '~';
	return path.startsWith(`${base}/`) ? `~${path.slice(base.length)}` : path;
}
