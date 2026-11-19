import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compile } from 'tailwindcss';

const root = process.cwd();
const PACKAGES: Record<string, string> = {
	tailwindcss: 'node_modules/tailwindcss/index.css',
	'tw-animate-css': 'node_modules/tw-animate-css/dist/tw-animate.css'
};

/** Compiles the real src/app.css with the given candidates, as the Vite plugin would. */
export async function compileAppCss(candidates: string[]) {
	const loadStylesheet = async (id: string, base: string) => {
		const path = id in PACKAGES ? resolve(root, PACKAGES[id]) : resolve(base, id);
		return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
	};
	const appPath = resolve(root, 'src/app.css');
	const compiler = await compile(readFileSync(appPath, 'utf8'), {
		base: dirname(appPath),
		from: appPath,
		loadStylesheet
	});
	return { sources: compiler.sources, css: compiler.build(candidates) };
}

type Node = { prelude: string; decls: string; children: Node[] };

function parse(css: string): Node[] {
	const nodes: Node[] = [];
	let i = 0;
	let text = '';
	while (i < css.length) {
		const ch = css[i];
		if (ch === '{') {
			let depth = 1;
			let j = i + 1;
			for (; j < css.length && depth > 0; j++) {
				if (css[j] === '{') depth++;
				else if (css[j] === '}') depth--;
			}
			const body = css.slice(i + 1, j - 1);
			const prelude = text.slice(text.lastIndexOf(';') + 1).trim();
			const children = parse(body);
			nodes.push({ prelude, decls: ownDecls(body), children });
			text = '';
			i = j;
		} else {
			text += ch;
			i++;
		}
	}
	return nodes;
}

function ownDecls(body: string): string {
	let out = '';
	let depth = 0;
	for (const ch of body) {
		if (ch === '{') depth++;
		if (depth === 0) out += ch;
		if (ch === '}') depth--;
	}
	// A nested rule's prelude stays in `out` without a ';' after it, so keep only full declarations.
	return out
		.split(';')
		.slice(0, -1)
		.map((d) => d.trim())
		.filter(Boolean)
		.join('; ');
}

/** Splits a selector list on top-level commas. */
function list(selector: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let cur = '';
	for (const ch of selector) {
		if (ch === '(' || ch === '[') depth++;
		if (ch === ')' || ch === ']') depth--;
		if (ch === ',' && depth === 0) {
			out.push(cur.trim());
			cur = '';
		} else cur += ch;
	}
	out.push(cur.trim());
	return out;
}

// A nesting `&`, not an escaped one in a class name such as `.\[\&\>svg\]\:size-4`.
const NESTING = /(?<!\\)((?:\\\\)*)&/g;

function nest(parents: string[], prelude: string): string[] {
	return parents.flatMap((p) =>
		list(prelude).map((c) => {
			NESTING.lastIndex = 0;
			return NESTING.test(c) ? c.replace(NESTING, (_, slashes) => slashes + p) : `${p} ${c}`;
		})
	);
}

/** Selectors of every rule under `node` that declares something; at-rules are passed through. */
function flatten(node: Node, parents: string[]): string[] {
	const selectors = node.prelude.startsWith('@') ? parents : nest(parents, node.prelude);
	const own = node.decls && !node.prelude.startsWith('@') ? selectors : [];
	return [...own, ...node.children.flatMap((c) => flatten(c, selectors))];
}

const escapeRegExp = (s: string) => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

/**
 * The selector Tailwind emits for one candidate, compiled with the real app.css, flattened from
 * CSS nesting (at-rules such as `@media (hover: hover)` are dropped). Use with `element.matches`.
 *
 * jsdom (nwsapi 2.2) gets `:not(:where(a), :where(b))` wrong, so a `not-data-disabled:` selector
 * matches disabled elements there; check those variants by class, not with `matches`.
 */
export async function selectorFor(candidate: string): Promise<string> {
	const { css } = await compileAppCss([candidate]);
	const tree = parse(css.replace(/\/\*[\s\S]*?\*\//g, ''));
	const utilities = tree.find((n) => n.prelude === '@layer utilities');
	const rules = (utilities?.children ?? []).flatMap((n) =>
		n.prelude.startsWith('@') ? n.children : [n]
	);
	const className = `.${candidate.replace(/[^\w-]/g, (c) => `\\${c}`)}`;
	const ownClass = new RegExp(`${escapeRegExp(className)}(?![\\w\\\\-])`);
	const selectors = rules
		.filter((n) => ownClass.test(n.prelude))
		.flatMap((n) => flatten(n, ['']).map((s) => s.trim()));
	if (selectors.length === 0) throw new Error(`Tailwind emits no rule for "${candidate}"`);
	return [...new Set(selectors)].join(', ');
}
