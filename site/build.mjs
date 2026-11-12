// Builds the static site into site/dist with the catalog's CSV files copied in unchanged.
import {copyFileSync, mkdirSync, rmSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const DATA = join(SITE, '..', 'data');
const DIST = join(SITE, 'dist');
const STATIC = ['index.html', 'style.css', 'observatory.css', 'app.js', 'favicon.svg'];
// [source under data/, name under dist/data/]
const TABLES = [
  ...['agents', 'tasks', 'agent_tasks', 'attributes', 'agent_attributes', 'agent_activities', 'agent_packages', 'agent_results']
    .map(name => [`core/${name}.csv`, `${name}.csv`]),
  ['derived/occupation_coverage.csv', 'occupation_coverage.csv'],
  ['reference/onet/29.2/DWA Reference.txt', 'onet_dwa_reference.txt'],
];

rmSync(DIST, {recursive: true, force: true});
mkdirSync(join(DIST, 'data'), {recursive: true});
for (const file of STATIC) copyFileSync(join(SITE, file), join(DIST, file));
for (const [source, name] of TABLES) copyFileSync(join(DATA, source), join(DIST, 'data', name));
console.log(`site built: ${STATIC.length} files, ${TABLES.length} tables`);
