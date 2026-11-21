// Makes `npm start` on macOS show "Nodepad++" and its icon instead of "Electron".
// It rebrands the local development copy of Electron.app in node_modules (it never touches
// packaged builds, which electron-builder brands on its own).
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (process.platform !== 'darwin') process.exit(0);

const NAME = 'Nodepad++';
const root = path.join(__dirname, '..');
const appDir = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app');
const plist = path.join(appDir, 'Contents', 'Info.plist');
const iconPng = path.join(root, 'build', 'icon.png');
const targetIcns = path.join(appDir, 'Contents', 'Resources', 'electron.icns');
const stamp = path.join(root, 'node_modules', 'electron', '.nodepad-branded');

if (!fs.existsSync(plist)) process.exit(0);

const iconTime = fs.statSync(iconPng).mtimeMs;
if (fs.existsSync(stamp) && Number(fs.readFileSync(stamp, 'utf8')) === iconTime) process.exit(0);

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'ignore' });
const setKey = (key, value) => {
  try { run('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist]); }
  catch { run('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist]); }
};

// 1. Name shown in the menu bar, Dock and Cmd+Tab
setKey('CFBundleName', NAME);
setKey('CFBundleDisplayName', NAME);

// 2. Icon: build an .icns from build/icon.png
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nodepad-icon-'));
const set = path.join(tmp, 'icon.iconset');
fs.mkdirSync(set);
for (const size of [16, 32, 128, 256, 512]) {
  run('sips', ['-z', String(size), String(size), iconPng, '--out', path.join(set, `icon_${size}x${size}.png`)]);
  run('sips', ['-z', String(size * 2), String(size * 2), iconPng, '--out', path.join(set, `icon_${size}x${size}@2x.png`)]);
}
run('iconutil', ['-c', 'icns', set, '-o', targetIcns]);
fs.rmSync(tmp, { recursive: true, force: true });

// 3. Re-sign ad hoc (editing the bundle invalidates Electron's signature) and refresh caches
run('codesign', ['--force', '--deep', '--sign', '-', appDir]);
const now = new Date();
fs.utimesSync(appDir, now, now);
try {
  run('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', appDir]);
} catch { /* ignore */ }

fs.writeFileSync(stamp, String(iconTime));
console.log(`Development Electron.app rebranded as ${NAME}.`);
