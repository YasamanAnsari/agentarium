// Builds the static site into site/dist with the catalog's CSV files copied in unchanged.
import {copyFileSync, mkdirSync, rmSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const CORE = join(SITE, '..', 'data', 'core');
const DIST = join(SITE, 'dist');
const STATIC = ['index.html', 'style.css', 'observatory.css', 'app.js', 'favicon.svg'];
const TABLES = ['agents.csv', 'tasks.csv', 'agent_tasks.csv'];

rmSync(DIST, {recursive: true, force: true});
mkdirSync(join(DIST, 'data'), {recursive: true});
for (const file of STATIC) copyFileSync(join(SITE, file), join(DIST, file));
for (const file of TABLES) copyFileSync(join(CORE, file), join(DIST, 'data', file));
console.log(`site built: ${STATIC.length} files, ${TABLES.length} tables`);
