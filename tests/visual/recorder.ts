/**
 * Runs inside the page: records every element's computed style and box.
 * `recordDom` is serialised into the page by Playwright, so it must not
 * reference anything outside its own body.
 */

export interface RecordedElement {
	/** Stable key: DOM path with tag, stable attributes and a text snippet. */
	k: string;
	/** Bounding box [x, y, width, height], rounded to 0.5 px. */
	b: [number, number, number, number];
	/** Computed styles that differ from the snapshot's `common` values. */
	s: Record<string, string>;
	/** Pseudo-elements that apply: `::before`, `::after`, `::placeholder`, `::marker`. */
	p?: Record<string, Record<string, string>>;
}

export interface DomRecord {
	htmlClass: string;
	/** The most frequent value of each property, omitted from each element. */
	common: Record<string, string>;
	elements: RecordedElement[];
}

export interface FocusRecord {
	k: string;
	b: [number, number, number, number];
	/** Every recorded property, not only the ones that differ from `common`. */
	s: Record<string, string>;
	p?: Record<string, Record<string, string>>;
}

export interface RecordOptions {
	/**
	 * `page`: every element. `focus`: only the focused element, with every
	 * property. `subtree`: `root` and its descendants, with every property.
	 */
	mode: 'page' | 'focus' | 'subtree' | 'phases';
	root?: Element;
	/** In `subtree` mode: an element whose key is returned as `targetKey`. */
	target?: Element;
}

export interface RecordResult {
	dom: DomRecord | null;
	focus: FocusRecord | null;
	subtree: FocusRecord[] | null;
	targetKey?: string;
	/** In `phases` mode: each infinite animation's target at `PHASES` of its cycle. */
	phases?: FocusRecord[];
}


export function recordDom(options: RecordOptions): RecordResult {
	const PROPS = [
		'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'box-sizing',
		'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
		'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
		'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
		'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
		'align-items', 'align-self', 'justify-content', 'row-gap', 'column-gap',
		'grid-template-columns', 'grid-template-rows', 'grid-column-start', 'grid-column-end',
		'overflow-x', 'overflow-y', 'visibility', 'opacity', 'vertical-align',
		'color', 'background-color', 'background-image', 'background-position', 'background-size',
		'background-repeat', 'background-clip',
		'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
		'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
		'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
		'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
		'outline-color', 'outline-style', 'outline-width', 'outline-offset', 'box-shadow',
		'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
		'text-align', 'text-transform', 'text-decoration-line', 'text-decoration-style',
		'text-decoration-color', 'text-decoration-thickness', 'text-underline-offset',
		'text-overflow', 'white-space', 'word-break', 'overflow-wrap', 'hyphens', '-webkit-hyphens', 'text-wrap', '-webkit-line-clamp',
		'-webkit-font-smoothing', 'list-style-type', 'list-style-position',
		'cursor', 'appearance', 'accent-color', 'caret-color', 'object-fit',
		'transform', 'transform-origin', 'translate', 'scale', 'rotate',
		'filter', 'backdrop-filter', '-webkit-backdrop-filter', 'mix-blend-mode',
		'transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay',
		'animation-name', 'animation-duration', 'animation-iteration-count',
		'fill', 'stroke', 'stroke-width', 'content'
	];
	const PLACEHOLDER_PROPS = ['color', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing'];
	const MARKER_PROPS = ['color', 'font-family', 'font-size', 'font-weight', 'content'];
	const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD']);
	const KEY_ATTRS = ['id', 'data-testid', 'role', 'aria-label', 'type', 'name', 'for', 'href', 'placeholder', 'alt', 'value'];

	// ---------- Colors: every notation becomes rgba() in sRGB ----------
	const clamp = (v: number) => Math.min(1, Math.max(0, v));
	const gamma = (c: number) => {
		const s = Math.sign(c) || 1;
		const a = Math.abs(c);
		return s * (a <= 0.0031308 ? 12.92 * a : 1.055 * Math.pow(a, 1 / 2.4) - 0.055);
	};
	const linear = (c: number) => {
		const s = Math.sign(c) || 1;
		const a = Math.abs(c);
		return s * (a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4));
	};
	const mul = (m: number[][], v: number[]) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
	const XYZ65_TO_LSRGB = [
		[3.2409699419045226, -1.537383177570094, -0.4986107602930034],
		[-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
		[0.05563007969699366, -0.20397695888897652, 1.0569715142428786]
	];
	const D50_TO_D65 = [
		[0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
		[-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
		[0.012314001688319899, -0.020507696433477912, 1.3303659366080753]
	];
	const LP3_TO_XYZ65 = [
		[0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
		[0.2289745640697488, 0.6917385218365064, 0.079286914093745],
		[0, 0.04511338185890264, 1.043944368900976]
	];
	const oklabToLsrgb = (L: number, a: number, b: number) => {
		const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
		const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
		const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
		return [
			4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
			-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
			-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
		];
	};
	const labToLsrgb = (L: number, a: number, b: number) => {
		const e = 216 / 24389;
		const k = 24389 / 27;
		const fy = (L + 16) / 116;
		const fx = fy + a / 500;
		const fz = fy - b / 200;
		const x = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
		const y = L > k * e ? fy ** 3 : L / k;
		const z = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
		const d50 = [x * (0.3457 / 0.3585), y, z * ((1 - 0.3457 - 0.3585) / 0.3585)];
		return mul(XYZ65_TO_LSRGB, mul(D50_TO_D65, d50));
	};
	const num = (token: string, percentScale = 1) => {
		if (token === 'none') return 0;
		if (token.endsWith('%')) return (parseFloat(token) / 100) * percentScale;
		if (token.endsWith('deg')) return parseFloat(token);
		return parseFloat(token);
	};
	const canvas = document.createElement('canvas').getContext('2d')!;
	const fmt = (rgb: number[], alpha: number) =>
		`rgba(${rgb.map((c) => Math.round(clamp(c) * 255)).join(', ')}, ${alpha >= 1 ? 1 : Math.round(alpha * 1000) / 1000})`;

	function normalizeColor(raw: string): string {
		const text = raw.trim().toLowerCase();
		if (text === 'transparent') return 'rgba(0, 0, 0, 0)';
		const fn = /^([a-z-]+)\((.*)\)$/.exec(text);
		if (fn) {
			const [, name, body] = fn;
			const [main, alphaPart] = body.includes('/') ? body.split('/') : [body, undefined];
			const parts = main.replace(/,/g, ' ').trim().split(/\s+/);
			let alpha = alphaPart !== undefined ? num(alphaPart.trim()) : 1;
			if (alpha === 0) return 'rgba(0, 0, 0, 0)';
			if ((name === 'rgb' || name === 'rgba') && parts.length >= 3) {
				if (parts.length === 4) alpha = num(parts[3]);
				if (alpha === 0) return 'rgba(0, 0, 0, 0)';
				return fmt(parts.slice(0, 3).map((p) => num(p, 255) / 255), alpha);
			}
			if (name === 'oklab') return fmt(oklabToLsrgb(num(parts[0]), num(parts[1], 0.4), num(parts[2], 0.4)).map(gamma), alpha);
			if (name === 'oklch') {
				const h = (num(parts[2]) * Math.PI) / 180;
				const c = num(parts[1], 0.4);
				return fmt(oklabToLsrgb(num(parts[0]), c * Math.cos(h), c * Math.sin(h)).map(gamma), alpha);
			}
			if (name === 'lab') return fmt(labToLsrgb(num(parts[0], 100), num(parts[1], 125), num(parts[2], 125)).map(gamma), alpha);
			if (name === 'lch') {
				const h = (num(parts[2]) * Math.PI) / 180;
				const c = num(parts[1], 150);
				return fmt(labToLsrgb(num(parts[0], 100), c * Math.cos(h), c * Math.sin(h)).map(gamma), alpha);
			}
			if (name === 'color') {
				const space = parts[0];
				const v = parts.slice(1, 4).map((p) => num(p));
				if (space === 'srgb') return fmt(v, alpha);
				if (space === 'srgb-linear') return fmt(v.map(gamma), alpha);
				if (space === 'display-p3') return fmt(mul(XYZ65_TO_LSRGB, mul(LP3_TO_XYZ65, v.map(linear))).map(gamma), alpha);
				if (space === 'xyz' || space === 'xyz-d65') return fmt(mul(XYZ65_TO_LSRGB, v).map(gamma), alpha);
				if (space === 'xyz-d50') return fmt(mul(XYZ65_TO_LSRGB, mul(D50_TO_D65, v)).map(gamma), alpha);
			}
		}
		// Hex, named and hsl/hwb colors: the canvas resolves them to sRGB
		canvas.fillStyle = '#010203';
		canvas.fillStyle = text;
		const resolved = String(canvas.fillStyle);
		if (resolved === '#010203' && text !== '#010203') return `unparsed(${raw})`;
		if (resolved.startsWith('#')) {
			const n = parseInt(resolved.slice(1), 16);
			return fmt([(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], 1);
		}
		return resolved === text ? `unparsed(${raw})` : normalizeColor(resolved);
	}

	const COLOR_TOKEN =
		/(?<![\w-])(?:oklch|oklab|rgba?|hsla?|hwb|lab|lch|color)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b|(?<![\w-])transparent(?![\w-])/gi;
	const normalizeColors = (value: string) => value.replace(COLOR_TOKEN, (m) => normalizeColor(m));

	/** Splits on commas that are not inside parentheses. */
	function splitTop(value: string): string[] {
		const out: string[] = [];
		let depth = 0;
		let start = 0;
		for (let i = 0; i < value.length; i++) {
			const ch = value[i];
			if (ch === '(') depth++;
			else if (ch === ')') depth--;
			else if (ch === ',' && depth === 0) {
				out.push(value.slice(start, i).trim());
				start = i + 1;
			}
		}
		out.push(value.slice(start).trim());
		return out;
	}

	function normalizeValue(prop: string, value: string): string {
		let v = normalizeColors(value.trim());
		if (prop === 'box-shadow' && v !== 'none') {
			// Layers that paint nothing are dropped: a fully transparent color, or
			// no offset, blur or spread. Tailwind pads box-shadow with such layers
			// (`--tw-ring-offset-shadow`…), and v3 and v4 pad differently.
			const paintsNothing = (layer: string) =>
				layer.includes('rgba(0, 0, 0, 0)') ||
				layer
					.replace(/rgba\([^)]*\)/g, '')
					.replace('inset', '')
					.trim()
					.split(/\s+/)
					.every((length) => parseFloat(length) === 0);
			const layers = splitTop(v).filter((layer) => !paintsNothing(layer));
			v = layers.length ? layers.join(', ') : 'none';
		}
		return v;
	}

	function styleOf(el: Element, pseudo: string | null, props: string[]): Record<string, string> {
		const cs = getComputedStyle(el, pseudo);
		const out: Record<string, string> = {};
		for (const prop of props) {
			const value = cs.getPropertyValue(prop);
			out[prop] = normalizeValue(prop, value);
		}
		return out;
	}

	function pseudosOf(el: Element): Record<string, Record<string, string>> | undefined {
		const out: Record<string, Record<string, string>> = {};
		for (const pseudo of ['::before', '::after']) {
			const content = getComputedStyle(el, pseudo).getPropertyValue('content');
			if (content && content !== 'none' && content !== 'normal') out[pseudo] = styleOf(el, pseudo, PROPS);
		}
		if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.placeholder) {
			out['::placeholder'] = styleOf(el, '::placeholder', PLACEHOLDER_PROPS);
		}
		if (getComputedStyle(el).display === 'list-item') out['::marker'] = styleOf(el, '::marker', MARKER_PROPS);
		return Object.keys(out).length ? out : undefined;
	}

	const half = (n: number) => Math.round(n * 2) / 2;
	const boxOf = (el: Element): [number, number, number, number] => {
		const r = el.getBoundingClientRect();
		return [half(r.x), half(r.y), half(r.width), half(r.height)];
	};

	// ---------- Stable keys ----------
	function signature(el: Element): string {
		let sig = el.tagName.toLowerCase();
		for (const attr of KEY_ATTRS) {
			const value = el.getAttribute(attr);
			if (value !== null && value !== '') sig += `[${attr}=${JSON.stringify(value.slice(0, 40))}]`;
		}
		const text = Array.from(el.childNodes)
			.filter((n) => n.nodeType === Node.TEXT_NODE)
			.map((n) => n.textContent ?? '')
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (text) sig += `{${JSON.stringify(text.slice(0, 30))}}`;
		return sig;
	}
	const keys = new Map<Element, string>();
	function keyOf(el: Element): string {
		const known = keys.get(el);
		if (known) return known;
		const sig = signature(el);
		const parent = el.parentElement;
		let segment = sig;
		if (parent) {
			const same = Array.from(parent.children).filter((c) => signature(c) === sig);
			if (same.length > 1) segment += `:${same.indexOf(el) + 1}`;
		}
		const key = parent ? `${keyOf(parent)} > ${segment}` : segment;
		keys.set(el, key);
		return key;
	}

	// Infinite animations would make computed styles depend on timing: they
	// are held at their first frame. Finite ones have ended by now.
	for (const animation of document.getAnimations()) {
		const timing = animation.effect?.getComputedTiming();
		if (timing && timing.iterations === Infinity) {
			animation.pause();
			animation.currentTime = 0;
		}
	}

	if (options.mode === 'phases') {
		// Keyframes matter, not just the first frame: each infinite animation is
		// sought to fixed points of its cycle, its target recorded there, and put back
		const phases: FocusRecord[] = [];
		const animations = document
			.getAnimations()
			.filter((a) => a.effect?.getComputedTiming().iterations === Infinity && a.effect instanceof KeyframeEffect && a.effect.target);
		for (const animation of animations) {
			const effect = animation.effect as KeyframeEffect;
			const target = effect.target!;
			const name = (animation as CSSAnimation).animationName ?? animation.id ?? 'animation';
			const duration = Number(effect.getComputedTiming().duration);
			for (const fraction of [0.25, 0.5, 0.75]) {
				animation.currentTime = fraction * duration;
				const pseudo = effect.pseudoElement ?? null;
				phases.push({
					k: `${keyOf(target)}${pseudo ?? ''} @${name} ${fraction * 100}%`,
					b: boxOf(target),
					s: styleOf(target, pseudo, PROPS)
				});
			}
			animation.currentTime = 0;
		}
		return { dom: null, focus: null, subtree: null, phases };
	}

	const full = (el: Element): FocusRecord => {
		const record: FocusRecord = { k: keyOf(el), b: boxOf(el), s: styleOf(el, null, PROPS) };
		const p = pseudosOf(el);
		if (p) record.p = p;
		return record;
	};
	if (options.mode === 'focus') {
		const el = document.activeElement;
		if (!el || el === document.body) return { dom: null, focus: null, subtree: null };
		return { dom: null, focus: full(el), subtree: null };
	}
	if (options.mode === 'subtree') {
		const root = options.root!;
		const els = [root, ...Array.from(root.querySelectorAll('*'))].filter((el) => !SKIP.has(el.tagName));
		return { dom: null, focus: null, subtree: els.map(full), targetKey: options.target ? keyOf(options.target) : undefined };
	}

	const all = [document.documentElement, ...Array.from(document.body.querySelectorAll('*'))].filter(
		(el) => !SKIP.has(el.tagName)
	);
	all.splice(1, 0, document.body);
	const raw = all.map((el) => ({ k: keyOf(el), b: boxOf(el), s: styleOf(el, null, PROPS), p: pseudosOf(el) }));

	const common: Record<string, string> = {};
	for (const prop of PROPS) {
		const counts = new Map<string, number>();
		for (const e of raw) counts.set(e.s[prop], (counts.get(e.s[prop]) ?? 0) + 1);
		common[prop] = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
	}
	const elements: RecordedElement[] = raw.map((e) => {
		const s: Record<string, string> = {};
		for (const prop of PROPS) if (e.s[prop] !== common[prop]) s[prop] = e.s[prop];
		const out: RecordedElement = { k: e.k, b: e.b, s };
		if (e.p) out.p = e.p;
		return out;
	});
	return { dom: { htmlClass: document.documentElement.className, common, elements }, focus: null, subtree: null };
}
