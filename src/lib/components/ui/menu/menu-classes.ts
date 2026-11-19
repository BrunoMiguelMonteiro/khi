/*
	Componentes (D7) · 10 · Menu, shared by the Pop-up list (Task 14) and the DropdownMenu (Task 17).
	Static, whole class strings, so Tailwind finds them.
*/

/**
 * Menu container (55:3185): spacing/1, popover, 1 px border inside, radius/menu, Sombra/Menu.
 * Opens in duration/in with ease/out and closes in duration/out, with a fade and a slight scale;
 * with Reduzir movimento only the fade stays (Movimento 6). Width and height limits are the caller's.
 */
export const menuContent = [
	'z-50 p-1 outline-none',
	'bg-popover text-popover-foreground',
	'border-(length:--stroke-border) border-border rounded-menu shadow-sombra-menu',
	'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:motion-reduce:zoom-in-100',
	'data-open:duration-(--duration-in) data-open:ease-out',
	'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:motion-reduce:zoom-out-100',
	'data-closed:duration-(--duration-out)'
].join(' ');

/**
 * Item de menu (55:3156): 24 high, spacing/2 × spacing/1, gap spacing/2, radius/control, Body.
 * Realçado is primary with primary-foreground, as on macOS (not the shadcn accent), and instant.
 * `group/menu-item` lets the shortcut follow the highlighted and disabled states.
 */
export const menuItem = [
	'group/menu-item relative flex h-6 w-full cursor-default items-center gap-2 px-2 py-1',
	'rounded-control text-body text-foreground whitespace-nowrap outline-none select-none',
	'data-highlighted:bg-primary data-highlighted:text-primary-foreground',
	'data-disabled:text-disabled-foreground'
].join(' ');

/** Tipo=Com marca: the 12 × 12 (size/icon-sm) Marca column before the text. */
export const menuMark = 'flex size-icon-sm shrink-0 items-center justify-center';

/** Atalho: tertiary-foreground, primary-foreground when highlighted, disabled-foreground when disabled. */
export const menuShortcut = [
	'ms-auto text-body text-tertiary-foreground',
	'group-data-highlighted/menu-item:text-primary-foreground',
	'group-data-disabled/menu-item:text-disabled-foreground'
].join(' ');

/** Separador de menu (55:3159): a 1 px border line, spacing/1 above and below, spacing/2 at the sides. */
export const menuSeparator = 'mx-2 my-1 h-(--stroke-border) bg-border';
