import { copyFile, readFile, access } from 'node:fs/promises';
await copyFile('manifest.json', 'dist/manifest.json');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const paths = [manifest.background.service_worker, manifest.action.default_popup,
  ...manifest.content_scripts.flatMap(script => script.js), ...Object.values(manifest.icons)];
await Promise.all(paths.map(path => access(`dist/${path}`)));
console.log('Verified all manifest entry points and icons in dist/.');
