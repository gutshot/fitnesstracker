// Generates dist/sw.js after a production build: the service worker template
// (sw-template.js) with the full list of emitted files to precache and a version
// derived from their contents, so every deploy that changes anything installs
// as a new worker and the app updates on next launch.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { createHash } from 'crypto';

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function serviceWorker() {
  let outDir;
  return {
    name: 'fitnesstrack-sw',
    apply: 'build',
    configResolved(config) { outDir = join(config.root, config.build.outDir); },
    closeBundle() {
      const files = walk(outDir)
        .map(p => relative(outDir, p).split(sep).join('/'))
        .filter(f => f !== 'sw.js' && !f.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
      const sw = template
        .replace('__SW_VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__SW_ASSETS__', JSON.stringify(['./', ...files], null, 2));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}
