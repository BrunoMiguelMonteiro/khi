/**
 * Serves the production build (`build/`) like the app's WebView does: files
 * as they are, and `index.html` for any other path (adapter-static fallback).
 * Usage: node tests/visual/serve.ts <port>
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve('build');
const PORT = Number(process.argv[2] ?? 4791);
const TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain; charset=utf-8'
};

async function fileFor(urlPath: string): Promise<string> {
	const path = join(ROOT, normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, ''));
	if (path.startsWith(ROOT)) {
		const info = await stat(path).catch(() => null);
		if (info?.isFile()) return path;
		const index = join(path, 'index.html');
		if (info?.isDirectory() && (await stat(index).catch(() => null))?.isFile()) return index;
	}
	return join(ROOT, 'index.html');
}

createServer(async (req, res) => {
	const file = await fileFor(new URL(req.url ?? '/', 'http://localhost').pathname);
	try {
		const body = await readFile(file);
		res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
		res.end(body);
	} catch {
		res.writeHead(404).end();
	}
}).listen(PORT, '127.0.0.1', () => console.log(`Serving ${ROOT} on http://127.0.0.1:${PORT}`));
