import { rmSync } from 'node:fs';
import { OUTPUT_DIR } from './baseline-store';

/** Each run starts with an empty `output/`. */
export default function globalSetup() {
	rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
