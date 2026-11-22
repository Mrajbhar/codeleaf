// One-command release:  npm run release -- patch | minor | major | 1.2.3
// Bumps the version in package.json, commits, tags vX.Y.Z and pushes.
// GitHub Actions then builds macOS, Windows and Linux and publishes the release.
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const run = (cmd) => execSync(cmd, { stdio: 'pipe', encoding: 'utf8' }).trim();
const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

const arg = process.argv[2];
if (!arg) fail('Say which version to release, for example:  npm run release -- patch   (or minor, major, 1.2.3)');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const [ma, mi, pa] = pkg.version.split('.').map(Number);
const next = arg === 'patch' ? `${ma}.${mi}.${pa + 1}`
  : arg === 'minor' ? `${ma}.${mi + 1}.0`
    : arg === 'major' ? `${ma + 1}.0.0`
      : /^\d+\.\d+\.\d+$/.test(arg) ? arg : null;
if (!next) fail(`"${arg}" is not patch, minor, major or a version like 1.2.3`);

if (run('git rev-parse --abbrev-ref HEAD') !== 'main') fail('Switch to the main branch first:  git checkout main');
if (run('git tag --list v' + next)) fail(`Tag v${next} already exists. Pick a higher version.`);

console.log(`\nReleasing Codeleaf ${pkg.version} → ${next}\n`);
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
run('npm install --package-lock-only --ignore-scripts');

run('git add -A');
run(`git commit -m "Release ${next}"`);
run(`git tag v${next}`);
console.log('• Committed and tagged v' + next);
run('git push origin main');
run(`git push origin v${next}`);
console.log('• Pushed to GitHub');
console.log(`\n✔ GitHub is now building v${next} (about 15 minutes).`);
console.log('  Watch:   https://github.com/Mrajbhar/codeleaf/actions');
console.log('  Release: https://github.com/Mrajbhar/codeleaf/releases/latest\n');
