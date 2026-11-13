import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const ignored = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report']);
const failures = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.(?:[cm]?[jt]sx?|css)$/.test(entry.name)) {
      const count = (await readFile(path, 'utf8')).split(/\r?\n/).length;
      if (count > 300) failures.push(`${path}: ${count} lines`);
    }
  }
}
await walk('.');
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('All source files are within the 300-line limit.');
