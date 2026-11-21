'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeTheme, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fsp = fs.promises;
const iconv = require('iconv-lite');
const { spawn } = require('child_process');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const APP_NAME = 'Codeleaf';
app.setName(APP_NAME);
const SMOKE = process.env.CODELEAF_SMOKE; // automated smoke test: CODELEAF_SMOKE=<output dir>
if (SMOKE) app.setPath('userData', path.join(SMOKE, 'userdata'));

// One-time move of settings, open files and recent files from the app's previous name.
if (!SMOKE) {
  try {
    const newDir = app.getPath('userData');
    const oldDir = path.join(app.getPath('appData'), 'Nodepad++');
    if (fs.existsSync(oldDir) && !fs.existsSync(path.join(newDir, 'settings.json'))) {
      fs.mkdirSync(newDir, { recursive: true });
      for (const f of ['settings.json', 'session.json', 'recent.json']) {
        try { fs.copyFileSync(path.join(oldDir, f), path.join(newDir, f)); } catch { /* missing file */ }
      }
    }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const userDir = app.getPath('userData');
const SESSION_FILE = path.join(userDir, 'session.json');
const SETTINGS_FILE = path.join(userDir, 'settings.json');
const RECENT_FILE = path.join(userDir, 'recent.json');

const DEFAULT_SETTINGS = {
  theme: 'system',
  fontFamily: isMac ? 'Menlo, Monaco, "Courier New", monospace' : 'Consolas, "Courier New", monospace',
  fontSize: 13,
  zoom: 0,
  tabSize: 4,
  insertSpaces: false,
  wordWrap: false,
  minimap: false,
  renderWhitespace: false,
  showIndentGuides: true,
  showLineNumbers: true,
  showToolbar: true,
  showStatusBar: true,
  showSidebar: false,
  showResults: false,
  defaultEol: isWin ? 'CRLF' : 'LF',
  defaultEncoding: 'utf8',
  restoreSession: true,
  autoCloseBrackets: false,
  highlightCurrentLine: true,
  detectFileChanges: true,
  autoReload: false,
  lastRunCommand: '',
  alwaysOnTop: false,
  sidebarWidth: 240,
  splitRatio: 0.5,
  compareSideBySide: true,
  resultsHeight: 200,
  lastMacro: null,
  windowBounds: null,
  workspace: null,
};

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  } catch (e) { console.error('writeJSON failed', file, e); }
}

let settings = { ...DEFAULT_SETTINGS, ...readJSON(SETTINGS_FILE, {}) };
let recent = readJSON(RECENT_FILE, []);
if (!Array.isArray(recent)) recent = [];
nativeTheme.themeSource = settings.theme;

function saveSettings() { writeJSON(SETTINGS_FILE, settings); }

function addRecent(p) {
  if (!p) return;
  recent = [p, ...recent.filter(r => r !== p)].slice(0, 20);
  writeJSON(RECENT_FILE, recent);
  if (isMac || isWin) app.addRecentDocument(p);
  buildMenu();
}

// ---------------------------------------------------------------------------
// Encodings
// ---------------------------------------------------------------------------
const ENCODINGS = {
  utf8: { label: 'UTF-8', iconv: 'utf8' },
  utf8bom: { label: 'UTF-8-BOM', iconv: 'utf8', bom: true },
  utf16le: { label: 'UTF-16 LE BOM', iconv: 'utf16le', bom: true },
  utf16be: { label: 'UTF-16 BE BOM', iconv: 'utf16be', bom: true },
  windows1252: { label: 'ANSI (Windows-1252)', iconv: 'windows1252' },
  iso88591: { label: 'ISO-8859-1 (Latin-1)', iconv: 'iso88591', group: 'Western European' },
  iso885915: { label: 'ISO-8859-15', iconv: 'iso885915', group: 'Western European' },
  windows1250: { label: 'Windows-1250', iconv: 'windows1250', group: 'Central European' },
  iso88592: { label: 'ISO-8859-2', iconv: 'iso88592', group: 'Central European' },
  windows1251: { label: 'Windows-1251', iconv: 'windows1251', group: 'Cyrillic' },
  koi8r: { label: 'KOI8-R', iconv: 'koi8r', group: 'Cyrillic' },
  koi8u: { label: 'KOI8-U', iconv: 'koi8u', group: 'Cyrillic' },
  windows1253: { label: 'Windows-1253', iconv: 'windows1253', group: 'Greek' },
  windows1254: { label: 'Windows-1254', iconv: 'windows1254', group: 'Turkish' },
  windows1255: { label: 'Windows-1255', iconv: 'windows1255', group: 'Hebrew' },
  windows1256: { label: 'Windows-1256', iconv: 'windows1256', group: 'Arabic' },
  windows1257: { label: 'Windows-1257', iconv: 'windows1257', group: 'Baltic' },
  windows1258: { label: 'Windows-1258', iconv: 'windows1258', group: 'Vietnamese' },
  windows874: { label: 'Windows-874', iconv: 'windows874', group: 'Thai' },
  shiftjis: { label: 'Shift-JIS', iconv: 'shiftjis', group: 'Japanese' },
  eucjp: { label: 'EUC-JP', iconv: 'eucjp', group: 'Japanese' },
  gbk: { label: 'GBK / GB2312', iconv: 'gbk', group: 'Chinese' },
  gb18030: { label: 'GB18030', iconv: 'gb18030', group: 'Chinese' },
  big5: { label: 'Big5', iconv: 'big5', group: 'Chinese' },
  euckr: { label: 'EUC-KR', iconv: 'euckr', group: 'Korean' },
};

function isValidUtf8(buf) {
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; }
}
function detectEncoding(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return 'utf8bom';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return 'utf16le';
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return 'utf16be';
  return isValidUtf8(buf) ? 'utf8' : 'windows1252';
}
function decode(buf, enc) {
  const e = ENCODINGS[enc] || ENCODINGS.utf8;
  return iconv.decode(buf, e.iconv, { stripBOM: true });
}
function encode(text, enc) {
  const e = ENCODINGS[enc] || ENCODINGS.utf8;
  if (enc === 'utf8') return Buffer.from(text, 'utf8');
  return iconv.encode(text, e.iconv, { addBOM: !!e.bom });
}
function detectEol(text) {
  const crlf = text.indexOf('\r\n');
  if (crlf !== -1) return 'CRLF';
  if (text.indexOf('\n') !== -1) return 'LF';
  if (text.indexOf('\r') !== -1) return 'CR';
  return null;
}

async function readFileSmart(p, forcedEnc) {
  try {
    const stat = await fsp.stat(p);
    if (stat.isDirectory()) return { error: `"${p}" is a folder.` };
    if (stat.size > 512 * 1024 * 1024) return { error: 'File is too large to open (over 512 MB).' };
    const buf = await fsp.readFile(p);
    const encoding = forcedEnc || detectEncoding(buf);
    const text = decode(buf, encoding);
    const binary = !forcedEnc && !encoding.startsWith('utf16') && buf.subarray(0, 8000).includes(0);
    return { path: p, text, encoding, eol: detectEol(text), mtime: stat.mtimeMs, size: stat.size, binary };
  } catch (e) {
    return { error: e.code === 'ENOENT' ? `File not found:\n${p}` : `Cannot open file:\n${p}\n\n${e.message}` };
  }
}

// ---------------------------------------------------------------------------
// File watching (detect modifications by other programs)
// ---------------------------------------------------------------------------
const watchers = new Map(); // path -> { watcher, mtime, timer }

function notifyChange(p) {
  const w = watchers.get(p);
  if (!w) return;
  clearTimeout(w.timer);
  w.timer = setTimeout(async () => {
    let st = null;
    try { st = await fsp.stat(p); } catch { /* deleted */ }
    if (!watchers.has(p)) return;
    if (!st) {
      if (!w.deletedNotified) {
        w.deletedNotified = true;
        send('file-changed', { path: p, deleted: true });
      }
      return;
    }
    // re-arm the watcher (atomic saves replace the inode)
    if (w.deletedNotified || w.needsRearm) { armWatcher(p); w.deletedNotified = false; w.needsRearm = false; }
    if (Math.abs(st.mtimeMs - w.mtime) > 1) {
      w.mtime = st.mtimeMs;
      send('file-changed', { path: p, mtime: st.mtimeMs });
    }
  }, 300);
}

function armWatcher(p) {
  const w = watchers.get(p);
  if (!w) return;
  try { w.watcher && w.watcher.close(); } catch { /* ignore */ }
  try {
    w.watcher = fs.watch(p, { persistent: false }, (ev) => {
      if (ev === 'rename') w.needsRearm = true;
      notifyChange(p);
    });
    w.watcher.on('error', () => { w.needsRearm = true; });
  } catch {
    w.watcher = null;
    // file may be gone; poll its directory lightly
    setTimeout(() => watchers.has(p) && notifyChange(p), 2000);
  }
}

function syncWatchers(list) {
  if (!settings.detectFileChanges) list = [];
  const keep = new Set(list.map(f => f.path));
  for (const [p, w] of watchers) {
    if (!keep.has(p)) { try { w.watcher && w.watcher.close(); } catch { /* ignore */ } clearTimeout(w.timer); watchers.delete(p); }
  }
  for (const f of list) {
    if (watchers.has(f.path)) {
      const w = watchers.get(f.path);
      if (f.mtime && f.mtime > w.mtime) w.mtime = f.mtime;
      continue;
    }
    watchers.set(f.path, { watcher: null, mtime: f.mtime || 0, timer: null });
    armWatcher(f.path);
  }
}

// ---------------------------------------------------------------------------
// Find / Replace in files
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(['.git', '.svn', '.hg', 'node_modules', '.DS_Store', '__pycache__', '.idea', '.vscode-test']);

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function buildSearchRegex({ query, regex, matchCase, wholeWord }) {
  let src = regex ? query : escapeRegex(query);
  if (wholeWord) src = `\\b(?:${src})\\b`;
  return new RegExp(src, 'g' + (matchCase ? '' : 'i') + 'mu');
}
function buildFilter(filters) {
  const parts = (filters || '').split(/[\s;,]+/).map(s => s.trim()).filter(Boolean);
  if (!parts.length || parts.includes('*') || parts.includes('*.*')) return () => true;
  const include = [], exclude = [];
  for (const p of parts) {
    const neg = p.startsWith('!');
    const g = neg ? p.slice(1) : p;
    const re = new RegExp('^' + g.split('*').map(escapeRegex).join('.*').replace(/\\\?/g, '.') + '$', 'i');
    (neg ? exclude : include).push(re);
  }
  return (name) => (!include.length || include.some(r => r.test(name))) && !exclude.some(r => r.test(name));
}

async function* walk(dir, filter, state) {
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (state.cancelled) return;
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) { if (!SKIP_DIRS.has(ent.name)) stack.push(full); }
      else if (ent.isFile() && filter(ent.name)) yield full;
    }
  }
}

let currentSearch = null;
async function findInFiles(opts) {
  if (currentSearch) currentSearch.cancelled = true;
  const state = { cancelled: false };
  currentSearch = state;
  let re;
  try { re = buildSearchRegex(opts); } catch (e) { return { error: 'Invalid regular expression: ' + e.message }; }
  const filter = buildFilter(opts.filters);
  const results = [];
  let total = 0, filesSearched = 0, truncated = false;
  for await (const file of walk(opts.dir, filter, state)) {
    if (state.cancelled) return { cancelled: true };
    if (total >= 20000 || filesSearched >= 50000) { truncated = true; break; }
    filesSearched++;
    let buf;
    try {
      const st = await fsp.stat(file);
      if (st.size > 20 * 1024 * 1024) continue;
      buf = await fsp.readFile(file);
    } catch { continue; }
    if (buf.subarray(0, 8000).includes(0) && buf[0] !== 0xff && buf[0] !== 0xfe) continue;
    const text = decode(buf, detectEncoding(buf));
    const lines = text.split(/\r\n|\r|\n/);
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      re.lastIndex = 0;
      const ranges = [];
      let m;
      while ((m = re.exec(line)) !== null) {
        ranges.push([m.index, m[0].length]);
        if (m[0].length === 0) re.lastIndex++;
        if (ranges.length > 50) break;
      }
      if (ranges.length) {
        total += ranges.length;
        matches.push({ line: i + 1, ranges, text: line.length > 500 ? line.slice(0, 500) : line });
      }
    }
    if (matches.length) results.push({ path: file, matches });
  }
  if (currentSearch === state) currentSearch = null;
  return { results, total, filesSearched, truncated };
}

async function replaceInFiles(opts) {
  let re;
  try { re = buildSearchRegex(opts); } catch (e) { return { error: 'Invalid regular expression: ' + e.message }; }
  const filter = buildFilter(opts.filters);
  let replaced = 0, filesChanged = 0;
  const changed = [];
  for await (const file of walk(opts.dir, filter, { cancelled: false })) {
    let buf;
    try {
      const st = await fsp.stat(file);
      if (st.size > 20 * 1024 * 1024) continue;
      buf = await fsp.readFile(file);
    } catch { continue; }
    if (buf.subarray(0, 8000).includes(0) && buf[0] !== 0xff && buf[0] !== 0xfe) continue;
    const enc = detectEncoding(buf);
    const text = decode(buf, enc);
    const count = (text.match(re) || []).length;
    const replacement = opts.regex ? opts.replace : opts.replace.replace(/\$/g, '$$$$');
    const out = count ? text.replace(re, replacement) : text;
    if (count) {
      try {
        await fsp.writeFile(file, encode(out, enc));
        replaced += count; filesChanged++; changed.push(file);
        const w = watchers.get(file);
        if (w) { try { w.mtime = (await fsp.stat(file)).mtimeMs; } catch { /* ignore */ } }
      } catch { /* skip read-only */ }
    }
  }
  return { replaced, filesChanged, changed };
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
let mainWindow = null;
let pendingOpen = [];
let forceClose = false;
let isQuitting = false;
let languages = []; // [{id, name}] provided by renderer
let editorState = {};

function send(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args);
}
function cmd(command, arg) { return () => send('menu', command, arg); }

function filesFromArgv(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2);
  return args.filter(a => {
    if (!a || a.startsWith('-')) return false;
    try { return fs.statSync(a).isFile(); } catch { return false; }
  }).map(a => path.resolve(a));
}

function openPaths(paths) {
  if (!paths.length) return;
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading() && mainWindow.__ready) {
    send('open-paths', paths);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingOpen.push(...paths);
    if (app.isReady() && !mainWindow) createWindow();
  }
}

function createWindow() {
  const b = settings.windowBounds || {};
  mainWindow = new BrowserWindow({
    width: b.width || 1280,
    height: b.height || 820,
    x: b.x, y: b.y,
    minWidth: 520,
    minHeight: 320,
    title: APP_NAME,
    show: false,
    alwaysOnTop: !!settings.alwaysOnTop,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#f0f0f0',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (b.maximized) mainWindow.maximize();
  forceClose = false;

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (SMOKE) runSmoke(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const maximized = mainWindow.isMaximized();
    const nb = maximized ? (settings.windowBounds || {}) : mainWindow.getBounds();
    settings.windowBounds = { ...nb, maximized };
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('close', () => { saveBounds(); saveSettings(); });
  mainWindow.on('closed', () => {
    mainWindow = null;
    syncWatchers([]);
    if (isQuitting || !isMac) app.quit();
  });
}

function runSmoke(win) {
  const wc = win.webContents;
  wc.on('console-message', (e, level, msg, line, src) => console.log(`[renderer:${level}] ${msg} (${src}:${line})`));
  wc.on('did-finish-load', () => setTimeout(async () => {
    try {
      const script = process.env.CODELEAF_SMOKE_JS || '';
      if (script) await wc.executeJavaScript(fs.readFileSync(script, 'utf8'));
      await new Promise(r => setTimeout(r, 1500));
      const info = await wc.executeJavaScript(`JSON.stringify({ title: document.title, tabs: document.querySelectorAll('.tab').length, loading: !!document.getElementById('loading'), status: document.getElementById('statusbar').innerText.replace(/\\s+/g,' '), monaco: !!window.monaco })`);
      console.log('SMOKE', info, 'WINDOW-TITLE', win.getTitle());
      const img = await wc.capturePage();
      fs.writeFileSync(path.join(SMOKE, 'shot.png'), img.toPNG());
    } catch (err) { console.log('SMOKE-ERROR', err); }
    app.exit(0);
  }, 3000));
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
const k = (mac, win) => (isMac ? mac : win);

function radio(label, checked, click, extra = {}) { return { label, type: 'radio', checked: !!checked, click, ...extra }; }
function check(label, checked, click, extra = {}) { return { label, type: 'checkbox', checked: !!checked, click, ...extra }; }

function languageMenu() {
  const s = editorState;
  const groups = new Map();
  const sorted = [...languages].filter(l => l.id !== 'plaintext').sort((a, b) => a.name.localeCompare(b.name));
  for (const l of sorted) {
    const letter = l.name[0].toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const items = [radio('Normal Text', s.language === 'plaintext', cmd('setLanguage', 'plaintext')), { type: 'separator' }];
  for (const [letter, langs] of groups) {
    items.push({
      label: letter,
      submenu: langs.map(l => radio(l.name, s.language === l.id, cmd('setLanguage', l.id))),
    });
  }
  return items;
}

function encodingMenu() {
  const s = editorState;
  const main = ['utf8', 'utf8bom', 'utf16le', 'utf16be', 'windows1252'];
  const groups = new Map();
  for (const [id, e] of Object.entries(ENCODINGS)) {
    if (!e.group) continue;
    if (!groups.has(e.group)) groups.set(e.group, []);
    groups.get(e.group).push(id);
  }
  const reopen = [...main, ...Object.keys(ENCODINGS).filter(id => !main.includes(id))]
    .map(id => ({ label: ENCODINGS[id].label, click: cmd('reopenWithEncoding', id), enabled: !!s.hasPath }));
  return [
    ...main.map(id => radio(`Convert to ${ENCODINGS[id].label}`, s.encoding === id, cmd('convertEncoding', id))),
    {
      label: 'Character Sets',
      submenu: [...groups].map(([g, ids]) => ({
        label: g,
        submenu: ids.map(id => radio(ENCODINGS[id].label, s.encoding === id, cmd('convertEncoding', id))),
      })),
    },
    { type: 'separator' },
    { label: 'Reopen with Encoding', submenu: reopen },
  ];
}

function buildMenu() {
  const s = editorState;
  const noAcc = { registerAccelerator: false };
  const recentItems = recent.length
    ? [...recent.map((p, i) => ({ label: `${i + 1}: ${p}`, click: () => openPaths([p]) })), { type: 'separator' },
      { label: 'Open All Recent Files', click: () => openPaths(recent.filter(p => fs.existsSync(p))) },
      { label: 'Empty Recent Files List', click: () => { recent = []; writeJSON(RECENT_FILE, recent); app.clearRecentDocuments(); buildMenu(); } }]
    : [{ label: 'No Recent Files', enabled: false }];

  const template = [];
  if (isMac) {
    template.push({
      label: APP_NAME,
      submenu: [
        { label: `About ${APP_NAME}`, click: showAbout },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Cmd+,', click: cmd('preferences') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({
    label: 'File',
    submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', click: cmd('new') },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: cmd('open') },
      { label: 'Open Folder as Workspace…', click: cmd('openFolder') },
      { label: 'Open Recent', submenu: recentItems },
      { label: 'Restore Recently Closed File', accelerator: 'CmdOrCtrl+Shift+T', click: cmd('reopenClosed') },
      { label: 'Reload from Disk', click: cmd('reload'), enabled: !!s.hasPath },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: cmd('save') },
      { label: 'Save As…', accelerator: k('Cmd+Shift+S', 'Ctrl+Alt+S'), click: cmd('saveAs') },
      { label: 'Save a Copy As…', click: cmd('saveCopy') },
      { label: 'Save All', accelerator: k('Cmd+Alt+S', 'Ctrl+Shift+S'), click: cmd('saveAll') },
      { label: 'Rename…', click: cmd('rename') },
      { type: 'separator' },
      { label: 'Close', accelerator: 'CmdOrCtrl+W', click: cmd('close') },
      { label: 'Close All', accelerator: 'CmdOrCtrl+Shift+W', click: cmd('closeAll') },
      {
        label: 'Close Multiple Documents',
        submenu: [
          { label: 'Close All but Active Document', click: cmd('closeOthers') },
          { label: 'Close All to the Left', click: cmd('closeLeft') },
          { label: 'Close All to the Right', click: cmd('closeRight') },
          { label: 'Close All Unchanged', click: cmd('closeUnchanged') },
        ],
      },
      { type: 'separator' },
      { label: isMac ? 'Reveal in Finder' : 'Open Containing Folder in Explorer', click: cmd('reveal'), enabled: !!s.hasPath },
      { label: 'Open Containing Folder in Terminal', click: cmd('terminal'), enabled: !!s.hasPath },
      { type: 'separator' },
      { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: cmd('print') },
      ...(isMac ? [] : [{ type: 'separator' }, { label: 'Exit', accelerator: 'Alt+F4', click: () => app.quit() }]),
    ],
  });

  template.push({
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: cmd('undo') },
      { label: 'Redo', accelerator: k('Cmd+Shift+Z', 'Ctrl+Y'), click: cmd('redo') },
      { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
      { label: 'Delete', click: cmd('deleteSel') },
      { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: cmd('selectAll') },
      { type: 'separator' },
      {
        label: 'Copy to Clipboard',
        submenu: [
          { label: 'Copy Current Full File Path', click: cmd('copyPath') },
          { label: 'Copy Current Filename', click: cmd('copyName') },
          { label: 'Copy Current Directory Path', click: cmd('copyDir') },
        ],
      },
      {
        label: 'Indent',
        submenu: [
          { label: 'Increase Line Indent', accelerator: 'Tab', ...noAcc, click: cmd('ed', 'editor.action.indentLines') },
          { label: 'Decrease Line Indent', accelerator: 'Shift+Tab', ...noAcc, click: cmd('ed', 'editor.action.outdentLines') },
        ],
      },
      {
        label: 'Convert Case to',
        submenu: [
          { label: 'UPPERCASE', accelerator: 'CmdOrCtrl+Shift+U', click: cmd('ed', 'editor.action.transformToUppercase') },
          { label: 'lowercase', accelerator: 'CmdOrCtrl+U', click: cmd('ed', 'editor.action.transformToLowercase') },
          { label: 'Proper Case', click: cmd('ed', 'editor.action.transformToTitlecase') },
          { label: 'Sentence case', click: cmd('sentenceCase') },
          { label: 'iNVERT cASE', click: cmd('invertCase') },
          { label: 'snake_case', click: cmd('ed', 'editor.action.transformToSnakecase') },
          { label: 'kebab-case', click: cmd('ed', 'editor.action.transformToKebabcase') },
        ],
      },
      {
        label: 'Line Operations',
        submenu: [
          { label: 'Duplicate Current Line', accelerator: 'CmdOrCtrl+D', click: cmd('ed', 'editor.action.copyLinesDownAction') },
          { label: 'Delete Current Line', accelerator: k('Cmd+Shift+K', 'Ctrl+L'), ...(isMac ? noAcc : {}), click: cmd('ed', 'editor.action.deleteLines') },
          { label: 'Move Up Current Line', accelerator: k('Alt+Up', 'Ctrl+Shift+Up'), ...(isMac ? noAcc : {}), click: cmd('ed', 'editor.action.moveLinesUpAction') },
          { label: 'Move Down Current Line', accelerator: k('Alt+Down', 'Ctrl+Shift+Down'), ...(isMac ? noAcc : {}), click: cmd('ed', 'editor.action.moveLinesDownAction') },
          { label: 'Join Lines', accelerator: 'CmdOrCtrl+J', click: cmd('ed', 'editor.action.joinLines') },
          { label: 'Split Lines at Commas', click: cmd('splitLines') },
          { label: 'Insert Blank Line Above Current', accelerator: 'CmdOrCtrl+Alt+Enter', click: cmd('ed', 'editor.action.insertLineBefore') },
          { label: 'Insert Blank Line Below Current', accelerator: 'CmdOrCtrl+Alt+Shift+Enter', click: cmd('ed', 'editor.action.insertLineAfter') },
          { type: 'separator' },
          { label: 'Remove Duplicate Lines', click: cmd('lines', 'dedupe') },
          { label: 'Remove Consecutive Duplicate Lines', click: cmd('lines', 'dedupeConsecutive') },
          { label: 'Remove Empty Lines', click: cmd('lines', 'removeEmpty') },
          { label: 'Remove Empty Lines (Containing Blank Characters)', click: cmd('lines', 'removeBlank') },
          { type: 'separator' },
          { label: 'Sort Lines Lexicographically Ascending', click: cmd('lines', 'sortAsc') },
          { label: 'Sort Lines Lexicographically Descending', click: cmd('lines', 'sortDesc') },
          { label: 'Sort Lines Case Insensitively Ascending', click: cmd('lines', 'sortAscCI') },
          { label: 'Sort Lines Case Insensitively Descending', click: cmd('lines', 'sortDescCI') },
          { label: 'Sort Lines as Integers Ascending', click: cmd('lines', 'sortNumAsc') },
          { label: 'Sort Lines as Integers Descending', click: cmd('lines', 'sortNumDesc') },
          { label: 'Sort Lines By Length Ascending', click: cmd('lines', 'sortLenAsc') },
          { label: 'Reverse Line Order', click: cmd('lines', 'reverse') },
          { label: 'Randomize Line Order', click: cmd('lines', 'shuffle') },
        ],
      },
      {
        label: 'Comment/Uncomment',
        submenu: [
          { label: 'Toggle Single Line Comment', accelerator: k('Cmd+/', 'Ctrl+Q'), ...(isMac ? noAcc : {}), click: cmd('ed', 'editor.action.commentLine') },
          { label: 'Single Line Comment', accelerator: 'CmdOrCtrl+K', click: cmd('ed', 'editor.action.addCommentLine') },
          { label: 'Single Line Uncomment', accelerator: k(undefined, 'Ctrl+Shift+K'), click: cmd('ed', 'editor.action.removeCommentLine') },
          { label: 'Block Comment', accelerator: k('Shift+Alt+A', 'Ctrl+Shift+Q'), ...(isMac ? noAcc : {}), click: cmd('ed', 'editor.action.blockComment') },
        ],
      },
      {
        label: 'Blank Operations',
        submenu: [
          { label: 'Trim Trailing Space', click: cmd('blank', 'trailing') },
          { label: 'Trim Leading Space', click: cmd('blank', 'leading') },
          { label: 'Trim Leading and Trailing Space', click: cmd('blank', 'both') },
          { label: 'EOL to Space', click: cmd('blank', 'eolToSpace') },
          { label: 'Trim both and EOL to Space', click: cmd('blank', 'trimEolToSpace') },
          { type: 'separator' },
          { label: 'TAB to Space', click: cmd('blank', 'tabToSpace') },
          { label: 'Space to TAB (All)', click: cmd('blank', 'spaceToTabAll') },
          { label: 'Space to TAB (Leading)', click: cmd('blank', 'spaceToTabLeading') },
        ],
      },
      {
        label: 'Encode / Decode',
        submenu: [
          { label: 'Base64 Encode', click: cmd('transform', 'b64enc') },
          { label: 'Base64 Decode', click: cmd('transform', 'b64dec') },
          { label: 'URL Encode', click: cmd('transform', 'urlenc') },
          { label: 'URL Decode', click: cmd('transform', 'urldec') },
          { label: 'HTML Escape', click: cmd('transform', 'htmlenc') },
          { label: 'HTML Unescape', click: cmd('transform', 'htmldec') },
          { type: 'separator' },
          { label: 'JSON Pretty Print', click: cmd('transform', 'jsonPretty') },
          { label: 'JSON Minify', click: cmd('transform', 'jsonMin') },
        ],
      },
      {
        label: 'EOL Conversion',
        submenu: [
          radio('Windows (CR LF)', s.eol === 'CRLF', cmd('setEol', 'CRLF')),
          radio('Unix (LF)', s.eol === 'LF', cmd('setEol', 'LF')),
          radio('Macintosh (CR)', s.eol === 'CR', cmd('setEol', 'CR')),
        ],
      },
      {
        label: 'Insert',
        submenu: [
          { label: 'Date Time (short)', click: cmd('insertDate', 'short') },
          { label: 'Date Time (long)', click: cmd('insertDate', 'long') },
          { label: 'Date Time (ISO 8601)', click: cmd('insertDate', 'iso') },
        ],
      },
      { type: 'separator' },
      { label: 'Format Document', accelerator: 'Shift+Alt+F', ...noAcc, click: cmd('ed', 'editor.action.formatDocument') },
      { label: 'Trigger Autocomplete', accelerator: 'Ctrl+Space', ...noAcc, click: cmd('ed', 'editor.action.triggerSuggest') },
      { label: 'Add Cursor Above', accelerator: k('Cmd+Alt+Up', 'Ctrl+Alt+Up'), ...noAcc, click: cmd('ed', 'editor.action.insertCursorAbove') },
      { label: 'Add Cursor Below', accelerator: k('Cmd+Alt+Down', 'Ctrl+Alt+Down'), ...noAcc, click: cmd('ed', 'editor.action.insertCursorBelow') },
      check('Column Mode (Rectangular Selection)', s.columnMode, cmd('toggle', 'columnMode')),
      check('Read-Only', s.readOnly, cmd('toggleReadOnly')),
      ...(isMac ? [{ type: 'separator' }, { role: 'startSpeaking' }, { role: 'stopSpeaking' }] : []),
    ],
  });

  template.push({
    label: 'Search',
    submenu: [
      { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: cmd('find') },
      { label: 'Find in Files…', accelerator: 'CmdOrCtrl+Shift+F', click: cmd('findInFiles') },
      { label: 'Find Next', accelerator: k('Cmd+G', 'F3'), click: cmd('ed', 'editor.action.nextMatchFindAction') },
      { label: 'Find Previous', accelerator: k('Cmd+Shift+G', 'Shift+F3'), click: cmd('ed', 'editor.action.previousMatchFindAction') },
      { label: 'Select and Find Next', accelerator: k('Cmd+F3', 'Ctrl+F3'), click: cmd('ed', 'editor.action.nextSelectionMatchFindAction') },
      { label: 'Replace…', accelerator: k('Cmd+Alt+F', 'Ctrl+H'), click: cmd('replace') },
      { type: 'separator' },
      { label: 'Add Next Occurrence to Selection', accelerator: k('Cmd+E', 'Ctrl+E'), click: cmd('ed', 'editor.action.addSelectionToNextFindMatch') },
      { label: 'Select All Occurrences', accelerator: 'CmdOrCtrl+Shift+L', ...noAcc, click: cmd('ed', 'editor.action.selectHighlights') },
      { type: 'separator' },
      { label: 'Go to Line…', accelerator: k('Cmd+L', 'Ctrl+G'), click: cmd('ed', 'editor.action.gotoLine') },
      { label: 'Go to Matching Brace', accelerator: k('Cmd+Shift+\\', 'Ctrl+B'), ...(isMac ? noAcc : {}), click: cmd('ed', 'editor.action.jumpToBracket') },
      { label: 'Select All Between Matching Braces', accelerator: k('Cmd+Alt+B', 'Ctrl+Alt+B'), click: cmd('ed', 'editor.action.selectToBracket') },
      { type: 'separator' },
      {
        label: 'Bookmark',
        submenu: [
          { label: 'Toggle Bookmark', accelerator: 'CmdOrCtrl+F2', click: cmd('bookmark', 'toggle') },
          { label: 'Next Bookmark', accelerator: 'F2', click: cmd('bookmark', 'next') },
          { label: 'Previous Bookmark', accelerator: 'Shift+F2', click: cmd('bookmark', 'prev') },
          { label: 'Clear All Bookmarks', click: cmd('bookmark', 'clear') },
          { type: 'separator' },
          { label: 'Copy Bookmarked Lines', click: cmd('bookmark', 'copy') },
          { label: 'Remove Bookmarked Lines', click: cmd('bookmark', 'remove') },
          { label: 'Remove Unmarked Lines', click: cmd('bookmark', 'removeUnmarked') },
          { label: 'Inverse Bookmark', click: cmd('bookmark', 'inverse') },
        ],
      },
      { label: 'Bookmark All Lines Containing…', click: cmd('markLines') },
    ],
  });

  template.push({
    label: 'View',
    submenu: [
      check('Always on Top', settings.alwaysOnTop, (mi) => { settings.alwaysOnTop = mi.checked; mainWindow && mainWindow.setAlwaysOnTop(mi.checked); saveSettings(); }),
      isMac ? { role: 'togglefullscreen' } : { label: 'Toggle Full Screen', accelerator: 'F11', click: () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
      { type: 'separator' },
      {
        label: 'Show Symbol',
        submenu: [
          check('Show White Space and TAB', s.renderWhitespace, cmd('toggle', 'renderWhitespace')),
          check('Show Indent Guide', s.showIndentGuides, cmd('toggle', 'showIndentGuides')),
          check('Show Line Numbers', s.showLineNumbers, cmd('toggle', 'showLineNumbers')),
          check('Highlight Current Line', s.highlightCurrentLine, cmd('toggle', 'highlightCurrentLine')),
        ],
      },
      {
        label: 'Zoom',
        submenu: [
          { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: cmd('zoom', 1) },
          { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: cmd('zoom', -1) },
          { label: 'Restore Default Zoom', accelerator: 'CmdOrCtrl+0', click: cmd('zoom', 0) },
        ],
      },
      check('Word Wrap', s.wordWrap, cmd('toggle', 'wordWrap'), { accelerator: 'Alt+Z' }),
      { type: 'separator' },
      { label: 'Move to Other View', click: cmd('moveToOtherView'), enabled: (s.tabCount || 0) > 1 },
      { label: 'Focus on Another View', accelerator: 'F8', click: cmd('focusOtherView'), enabled: !!s.split || !!s.comparing },
      { type: 'separator' },
      check('Folder as Workspace', s.showSidebar, cmd('toggle', 'showSidebar')),
      check('Document Map (Minimap)', s.minimap, cmd('toggle', 'minimap')),
      check('Search Results Panel', s.showResults, cmd('toggle', 'showResults'), { accelerator: 'F7' }),
      check('Toolbar', s.showToolbar, cmd('toggle', 'showToolbar')),
      check('Status Bar', s.showStatusBar, cmd('toggle', 'showStatusBar')),
      { type: 'separator' },
      {
        label: 'Fold',
        submenu: [
          { label: 'Fold All', accelerator: 'Alt+0', click: cmd('ed', 'editor.foldAll') },
          { label: 'Unfold All', accelerator: 'Alt+Shift+0', click: cmd('ed', 'editor.unfoldAll') },
          { label: 'Fold Current Level', click: cmd('ed', 'editor.fold') },
          { label: 'Unfold Current Level', click: cmd('ed', 'editor.unfold') },
          { type: 'separator' },
          ...[1, 2, 3, 4, 5].map(n => ({ label: `Fold Level ${n}`, click: cmd('ed', `editor.foldLevel${n}`) })),
        ],
      },
      { type: 'separator' },
      {
        label: 'Theme',
        submenu: [
          { label: 'Toggle Dark / Light Mode', accelerator: 'CmdOrCtrl+Shift+D', click: cmd('toggleTheme') },
          { type: 'separator' },
          radio('Follow System', settings.theme === 'system', cmd('setTheme', 'system')),
          radio('Light', settings.theme === 'light', cmd('setTheme', 'light')),
          radio('Dark', settings.theme === 'dark', cmd('setTheme', 'dark')),
        ],
      },
      { label: 'Command Palette…', accelerator: 'F1', ...noAcc, click: cmd('ed', 'editor.action.quickCommand') },
      { type: 'separator' },
      { label: 'Toggle Developer Tools', accelerator: k('Cmd+Alt+I', 'Ctrl+Shift+I'), click: () => mainWindow && mainWindow.webContents.toggleDevTools() },
    ],
  });

  template.push({ label: 'Encoding', submenu: encodingMenu() });
  template.push({ label: 'Language', submenu: languageMenu() });

  template.push({
    label: 'Settings',
    submenu: [
      { label: 'Preferences…', accelerator: isMac ? undefined : 'Ctrl+,', click: cmd('preferences') },
      { label: 'Open Settings Folder', click: () => shell.openPath(userDir) },
    ],
  });

  template.push({
    label: 'Macro',
    submenu: [
      { label: 'Start Recording', accelerator: 'CmdOrCtrl+Shift+R', click: cmd('macro', 'record'), enabled: !s.macroRecording },
      { label: 'Stop Recording', accelerator: 'CmdOrCtrl+Alt+Shift+R', click: cmd('macro', 'stop'), enabled: !!s.macroRecording },
      { label: 'Playback', accelerator: 'CmdOrCtrl+Shift+P', click: cmd('macro', 'play'), enabled: !!s.hasMacro && !s.macroRecording },
      { label: 'Run a Macro Multiple Times…', click: cmd('macro', 'multi'), enabled: !!s.hasMacro && !s.macroRecording },
    ],
  });

  template.push({
    label: 'Run',
    submenu: [
      { label: 'Run…', accelerator: 'F5', click: cmd('run') },
      { type: 'separator' },
      { label: 'Launch in Default Browser', click: cmd('launchBrowser'), enabled: !!s.hasPath },
      { label: 'Open With Default App', click: cmd('openDefault'), enabled: !!s.hasPath },
      { label: 'Open Containing Folder in Terminal', click: cmd('terminal'), enabled: !!s.hasPath },
      { type: 'separator' },
      { label: 'Search on Internet', click: cmd('searchWeb') },
    ],
  });

  template.push({
    label: 'Plugins',
    submenu: [{
      label: 'Compare',
      submenu: [
        { label: 'Compare…', accelerator: 'CmdOrCtrl+Alt+C', click: cmd('compare'), enabled: (s.tabCount || 0) > 1 },
        { label: 'Compare with Saved Version', accelerator: 'CmdOrCtrl+Alt+D', click: cmd('compareSaved'), enabled: !!s.hasPath },
        { type: 'separator' },
        { label: 'Next Difference', accelerator: 'F8', registerAccelerator: false, click: cmd('compareNext'), enabled: !!s.comparing },
        { label: 'Previous Difference', accelerator: 'Shift+F8', click: cmd('comparePrev'), enabled: !!s.comparing },
        { label: 'Swap Sides', click: cmd('compareSwap'), enabled: !!s.comparing },
        check('Side by Side', s.compareSideBySide !== false, cmd('compareToggleMode')),
        { type: 'separator' },
        { label: 'Close Compare', accelerator: 'CmdOrCtrl+Alt+X', click: cmd('compareClose'), enabled: !!s.comparing },
      ],
    }],
  });

  const tabItems = (s.tabs || []).slice(0, 40).map((t, i) =>
    radio(`${i < 9 ? (i + 1) + ': ' : ''}${t.title}`, t.active, cmd('activateTab', t.id),
      i < 9 ? { accelerator: `CmdOrCtrl+${i + 1}` } : {}));
  template.push({
    label: 'Window',
    submenu: [
      ...(isMac ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }] : []),
      { label: 'Next Tab', accelerator: k('Cmd+Alt+Right', 'Ctrl+Tab'), click: cmd('nextTab') },
      { label: 'Previous Tab', accelerator: k('Cmd+Alt+Left', 'Ctrl+Shift+Tab'), click: cmd('prevTab') },
      { label: 'Move Tab Forward', click: cmd('moveTab', 1) },
      { label: 'Move Tab Backward', click: cmd('moveTab', -1) },
      {
        label: 'Sort Tabs By',
        submenu: [
          { label: 'Name A to Z', click: cmd('sortTabs', 'name') },
          { label: 'Path A to Z', click: cmd('sortTabs', 'path') },
        ],
      },
      ...(tabItems.length ? [{ type: 'separator' }, ...tabItems] : []),
    ],
  });

  template.push({
    label: isMac ? 'Help' : '?',
    role: isMac ? 'help' : undefined,
    submenu: [
      { label: 'Keyboard Shortcuts', click: cmd('shortcuts') },
      { label: 'Command Palette…', click: cmd('ed', 'editor.action.quickCommand') },
      { type: 'separator' },
      { label: 'Open Settings Folder', click: () => shell.openPath(userDir) },
      ...(isMac ? [] : [{ type: 'separator' }, { label: `About ${APP_NAME}`, accelerator: 'F1', registerAccelerator: false, click: showAbout }]),
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: `About ${APP_NAME}`,
    message: `${APP_NAME} ${app.getVersion()}`,
    detail: `A fast tabbed text and source code editor.\n\n` +
      `Platform: ${process.platform} (${process.arch})\n` +
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}\n\n` +
      `Editor engine: Monaco Editor`,
    buttons: ['OK'],
  });
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('init', () => {
  if (mainWindow) mainWindow.__ready = true;
  const paths = pendingOpen;
  pendingOpen = [];
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    settings,
    session: settings.restoreSession ? readJSON(SESSION_FILE, null) : null,
    openPaths: paths,
    encodings: Object.fromEntries(Object.entries(ENCODINGS).map(([id, e]) => [id, e.label])),
    home: os.homedir(),
    smoke: !!SMOKE,
  };
});

ipcMain.on('languages', (e, list) => { languages = list; buildMenu(); });
ipcMain.on('editor-state', (e, state) => { editorState = state; buildMenu(); });

ipcMain.on('save-session-sync', (e, session) => { writeJSON(SESSION_FILE, session); e.returnValue = true; });
ipcMain.on('save-session', (e, session) => writeJSON(SESSION_FILE, session));
ipcMain.on('save-settings', (e, s) => {
  const themeChanged = s.theme !== settings.theme;
  settings = { ...settings, ...s };
  if (themeChanged) nativeTheme.themeSource = settings.theme;
  if (mainWindow) mainWindow.setAlwaysOnTop(!!settings.alwaysOnTop);
  saveSettings();
  buildMenu();
});

ipcMain.handle('dialog-open', async (e, defaultPath) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections', 'showHiddenFiles', 'treatPackageAsDirectory'],
    defaultPath,
    filters: [{ name: 'All Files', extensions: ['*'] }],
  });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('dialog-open-folder', async (e, defaultPath) => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'], defaultPath });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog-save', async (e, { defaultPath, title }) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: title || 'Save As',
    defaultPath,
    properties: ['showHiddenFiles', 'createDirectory', 'showOverwriteConfirmation'],
  });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('message', async (e, opts) => {
  const r = await dialog.showMessageBox(mainWindow, { type: 'question', ...opts });
  return r.response;
});

ipcMain.handle('read-file', (e, p, enc) => readFileSmart(p, enc));
ipcMain.handle('write-file', async (e, p, text, enc) => {
  try {
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, encode(text, enc));
    const st = await fsp.stat(p);
    const w = watchers.get(p);
    if (w) { w.mtime = st.mtimeMs; w.deletedNotified = false; armWatcher(p); }
    addRecent(p);
    return { ok: true, mtime: st.mtimeMs };
  } catch (err) {
    return { error: err.code === 'EACCES' || err.code === 'EPERM'
      ? `Permission denied. Cannot save:\n${p}`
      : `Cannot save file:\n${p}\n\n${err.message}` };
  }
});
ipcMain.handle('rename-file', async (e, from, to) => {
  try { await fsp.rename(from, to); addRecent(to); return { ok: true }; } catch (err) { return { error: err.message }; }
});
ipcMain.handle('file-exists', (e, p) => fs.existsSync(p));
ipcMain.on('watch-files', (e, list) => syncWatchers(list));
ipcMain.on('add-recent', (e, p) => addRecent(p));

ipcMain.handle('readdir', async (e, dir) => {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    return entries
      .filter(d => d.name !== '.DS_Store' && d.name !== '.git')
      .map(d => ({ name: d.name, path: path.join(dir, d.name), isDir: d.isDirectory() }))
      .sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('find-in-files', (e, opts) => findInFiles(opts));
ipcMain.on('cancel-find', () => { if (currentSearch) currentSearch.cancelled = true; });
ipcMain.handle('replace-in-files', (e, opts) => replaceInFiles(opts));

ipcMain.on('reveal', (e, p) => shell.showItemInFolder(p));
ipcMain.on('open-external', (e, url) => { if (/^(https?|file):/i.test(url)) shell.openExternal(url); });
ipcMain.on('open-path', (e, p) => shell.openPath(p));
ipcMain.on('clipboard-write', (e, text) => clipboard.writeText(text));
ipcMain.on('edit-role', (e, role) => { if (['cut', 'copy', 'paste'].includes(role)) e.sender[role](); });

function openTerminal(dir) {
  try {
    if (isMac) spawn('open', ['-a', 'Terminal', dir], { detached: true, stdio: 'ignore' }).unref();
    else if (isWin) spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/K', `cd /d "${dir}"`], { detached: true, stdio: 'ignore', shell: false }).unref();
    else spawn('x-terminal-emulator', [], { cwd: dir, detached: true, stdio: 'ignore' }).unref();
  } catch (err) { dialog.showErrorBox('Terminal', err.message); }
}
ipcMain.on('open-terminal', (e, dir) => openTerminal(dir));
ipcMain.on('run-command', (e, command, cwd) => {
  try {
    const child = spawn(command, { shell: true, cwd: cwd || os.homedir(), detached: true, stdio: 'ignore' });
    child.on('error', err => dialog.showErrorBox('Run', err.message));
    child.unref();
  } catch (err) { dialog.showErrorBox('Run', err.message); }
});

ipcMain.handle('print', async (e, { title, text, fontFamily }) => {
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const tmp = path.join(os.tmpdir(), `codeleaf-print-${Date.now()}.html`);
  await fsp.writeFile(tmp, `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<style>body{margin:0}pre{font:9.5pt ${fontFamily};white-space:pre-wrap;word-wrap:break-word;margin:0}</style>` +
    `</head><body><pre>${esc(text)}</pre></body></html>`);
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  await w.loadFile(tmp);
  w.webContents.print({ printBackground: false }, () => { w.destroy(); fsp.unlink(tmp).catch(() => {}); });
});

ipcMain.on('window-state', (e, { title, edited, filePath }) => {
  if (!mainWindow) return;
  mainWindow.setTitle(title);
  if (isMac) {
    mainWindow.setDocumentEdited(!!edited);
    mainWindow.setRepresentedFilename(filePath || '');
  }
});

ipcMain.handle('popup-menu', (e, items, pos) => new Promise(resolve => {
  let chosen = null;
  const build = list => list.map(it => {
    if (it.type === 'separator') return { type: 'separator' };
    const out = { label: it.label, enabled: it.enabled !== false };
    if (it.checked !== undefined) { out.type = 'checkbox'; out.checked = it.checked; }
    if (it.submenu) out.submenu = build(it.submenu);
    else out.click = () => { chosen = it.id; };
    return out;
  });
  const menu = Menu.buildFromTemplate(build(items));
  menu.popup({ window: mainWindow, x: pos && pos.x, y: pos && pos.y, callback: () => setTimeout(() => resolve(chosen), 0) });
}));

ipcMain.on('close-window', () => {
  forceClose = true;
  if (mainWindow) mainWindow.destroy();
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  console.error(`[${APP_NAME}] another instance holds the single-instance lock; exiting`);
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    const files = filesFromArgv(argv);
    if (files.length) openPaths(files);
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
    else createWindow();
  });

  app.on('open-file', (e, p) => {
    e.preventDefault();
    openPaths([p]);
  });

  pendingOpen.push(...filesFromArgv(process.argv));

  app.whenReady().then(() => {
    // When running from source (npm start) macOS would otherwise show the default Electron icon.
    if (isMac && !app.isPackaged && app.dock) {
      try { app.dock.setIcon(path.join(__dirname, '..', 'build', 'icon.png')); } catch { /* ignore */ }
    }
    buildMenu();
    createWindow();
    app.on('activate', () => { if (!mainWindow) createWindow(); });
  });

  app.on('before-quit', () => { isQuitting = true; });
  app.on('window-all-closed', () => { if (!isMac || isQuitting) app.quit(); });
}
