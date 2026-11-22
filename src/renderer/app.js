'use strict';
/* global require, monaco, ICONS */
(async function main() {
  const api = window.api;
  const init = await api.invoke('init');
  const isMac = init.platform === 'darwin';
  const isWin = init.platform === 'win32';
  const ENC = init.encodings;
  const EOL_LABEL = { CRLF: 'Windows (CR LF)', LF: 'Unix (LF)', CR: 'Macintosh (CR)' };
  let settings = init.settings;

  // -------------------------------------------------------------------------
  // Load Monaco
  // -------------------------------------------------------------------------
  const vsBase = new URL('../../node_modules/monaco-editor/min/', location.href).href;
  require.config({ paths: { vs: vsBase + 'vs' } });
  window.MonacoEnvironment = { getWorkerUrl: () => vsBase + 'vs/base/worker/workerMain.js' };
  await new Promise((resolve, reject) => require(['vs/editor/editor.main'], resolve, reject));

  const $ = (sel) => document.querySelector(sel);
  const el = {
    toolbar: $('#toolbar'),
    sidebar: $('#sidebar'), sideResizer: $('#sidebar-resizer'), tree: $('#tree'), sideTitle: $('#side-title'),
    results: $('#results'), resultsResizer: $('#results-resizer'), resultsBody: $('#results-body'), resultsTitle: $('#results-title'),
    status: $('#statusbar'), sbLang: $('#sb-lang'), sbSize: $('#sb-size'), sbPos: $('#sb-pos'), sbEol: $('#sb-eol'),
    sbEnc: $('#sb-enc'), sbMode: $('#sb-mode'), sbIndent: $('#sb-indent'), sbMacro: $('#sb-macro'), modalRoot: $('#modal-root'),
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const sep = isWin ? '\\' : '/';
  const basename = (p) => p.split(/[\\/]/).pop();
  const dirname = (p) => {
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    if (i < 0) return p;
    const d = p.slice(0, i);
    return d === '' ? '/' : (/^[A-Za-z]:$/.test(d) ? d + '\\' : d);
  };
  const joinPath = (d, n) => (d.endsWith('/') || d.endsWith('\\') ? d + n : d + sep + n);
  const samePath = (a, b) => (isMac || isWin ? a.toLowerCase() === b.toLowerCase() : a === b);
  const fmt = (n) => n.toLocaleString('en-US');
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fileUrl = (p) => 'file://' + (isWin ? '/' : '') + p.split(/[\\/]/).map(encodeURIComponent).join('/').replace(/^\/([A-Za-z])%3A/, '/$1:');
  const message = (opts) => api.invoke('message', opts);
  const alertBox = (msg, detail, type = 'warning') => message({ type, message: msg, detail, buttons: ['OK'] });
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // -------------------------------------------------------------------------
  // Themes
  // -------------------------------------------------------------------------
  monaco.editor.defineTheme('npp-light', {
    base: 'vs', inherit: true,
    rules: [
      { token: '', foreground: '000000' },
      { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'type', foreground: '8000FF' },
      { token: 'predefined', foreground: '8000FF' },
      { token: 'string', foreground: '808080' },
      { token: 'string.escape', foreground: 'FF8000' },
      { token: 'comment', foreground: '008000' },
      { token: 'number', foreground: 'FF8000' },
      { token: 'delimiter', foreground: '000080', fontStyle: 'bold' },
      { token: 'operator', foreground: '000080', fontStyle: 'bold' },
      { token: 'regexp', foreground: '8000FF' },
      { token: 'tag', foreground: '0000FF' },
      { token: 'metatag', foreground: 'FF0000' },
      { token: 'attribute.name', foreground: 'FF0000' },
      { token: 'attribute.value', foreground: '8000FF' },
      { token: 'string.key.json', foreground: '000080', fontStyle: 'bold' },
      { token: 'string.value.json', foreground: '808080' },
      { token: 'variable', foreground: '000080' },
      { token: 'annotation', foreground: 'FF8000' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editorGutter.background': '#E4E4E4',
      'editorLineNumber.foreground': '#808080',
      'editorLineNumber.activeForeground': '#000000',
      'editor.lineHighlightBackground': '#E8E8FF',
      'editor.lineHighlightBorder': '#E8E8FF',
      'editor.selectionBackground': '#C0C0C0',
      'editor.inactiveSelectionBackground': '#E0E0E0',
      'editor.wordHighlightBackground': '#00FF0040',
      'editor.wordHighlightStrongBackground': '#00FF0040',
      'editor.selectionHighlightBackground': '#00FF0035',
      'editor.findMatchHighlightBackground': '#FFD70080',
      'editorBracketMatch.background': '#FFFFFF00',
      'editorBracketMatch.border': '#FF0000',
      'editorWhitespace.foreground': '#FF8C2B99',
      'editorIndentGuide.background1': '#C8C8C8',
      'editorCursor.foreground': '#000000',
    },
  });
  monaco.editor.defineTheme('npp-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: '', foreground: 'DCDCDC' },
      { token: 'keyword', foreground: '7AA6FF', fontStyle: 'bold' },
      { token: 'type', foreground: 'C792EA' },
      { token: 'predefined', foreground: 'C792EA' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'string.escape', foreground: 'F78C6C' },
      { token: 'comment', foreground: '6A9955' },
      { token: 'number', foreground: 'F78C6C' },
      { token: 'delimiter', foreground: 'B8C4D6' },
      { token: 'operator', foreground: 'B8C4D6' },
      { token: 'regexp', foreground: 'D16969' },
      { token: 'tag', foreground: '7AA6FF' },
      { token: 'metatag', foreground: 'FF8B7A' },
      { token: 'attribute.name', foreground: 'FF8B7A' },
      { token: 'attribute.value', foreground: 'D7A8FF' },
      { token: 'string.key.json', foreground: '9CDCFE' },
      { token: 'string.value.json', foreground: 'CE9178' },
      { token: 'variable', foreground: '9CDCFE' },
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editorGutter.background': '#252526',
      'editorLineNumber.foreground': '#6E6E6E',
      'editorLineNumber.activeForeground': '#DCDCDC',
      'editor.lineHighlightBackground': '#2A2D3A',
      'editor.lineHighlightBorder': '#2A2D3A',
      'editor.selectionBackground': '#264F78',
      'editor.wordHighlightBackground': '#3F7F3F70',
      'editor.wordHighlightStrongBackground': '#3F7F3F70',
      'editor.selectionHighlightBackground': '#3F7F3F55',
      'editorBracketMatch.background': '#00000000',
      'editorBracketMatch.border': '#FF6B5E',
      'editorWhitespace.foreground': '#B4783C99',
    },
  });

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && darkQuery.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    monaco.editor.setTheme(dark ? 'npp-dark' : 'npp-light');
    updateThemeButton();
  }
  function isDarkNow() { return document.documentElement.dataset.theme === 'dark'; }
  function updateThemeButton() {
    const b = document.querySelector('.tb-theme');
    if (!b) return;
    const dark = isDarkNow();
    b.innerHTML = dark ? ICONS.sun : ICONS.moon;
    const key = isMac ? '⇧⌘D' : 'Ctrl+Shift+D';
    b.title = `${dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} (${key})`;
    b.setAttribute('aria-label', b.title);
  }
  function toggleTheme() {
    settings.theme = isDarkNow() ? 'light' : 'dark';
    applyTheme();
    saveSettings();
    const b = document.querySelector('.tb-theme');
    if (b) { b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); }
  }
  darkQuery.addEventListener('change', applyTheme);

  // -------------------------------------------------------------------------
  // Languages
  // -------------------------------------------------------------------------
  const langs = monaco.languages.getLanguages();
  const langName = (id) => {
    if (id === 'plaintext') return 'Normal text';
    const l = langs.find((x) => x.id === id);
    return (l && l.aliases && l.aliases[0]) || id;
  };
  api.send('languages', langs.map((l) => ({ id: l.id, name: langName(l.id) })));

  function guessLanguage(p, firstLine) {
    if (!p) return 'plaintext';
    const name = basename(p).toLowerCase();
    let best = null, bestLen = 0;
    for (const l of langs) {
      if (l.filenames && l.filenames.some((f) => f.toLowerCase() === name)) return l.id;
      for (const ext of l.extensions || []) {
        const e = ext.toLowerCase();
        if (name.endsWith(e) && e.length > bestLen) { best = l.id; bestLen = e.length; }
      }
    }
    if (best) return best;
    if (firstLine) {
      for (const l of langs) {
        if (!l.firstLine) continue;
        try { if (new RegExp(l.firstLine).test(firstLine)) return l.id; } catch { /* ignore */ }
      }
    }
    return 'plaintext';
  }
  const firstLineOf = (t) => { const i = t.indexOf('\n'); return (i < 0 ? t : t.slice(0, i)).slice(0, 300); };
  function defaultExt(langId) {
    const l = langs.find((x) => x.id === langId);
    return (l && l.extensions && l.extensions[0]) || '.txt';
  }

  // -------------------------------------------------------------------------
  // Editor
  // -------------------------------------------------------------------------
  const state = { columnMode: false, macroRecording: false, macroSteps: [] };

  function editorOptions() {
    return {
      fontFamily: settings.fontFamily,
      fontSize: Math.max(6, settings.fontSize + settings.zoom),
      wordWrap: settings.wordWrap ? 'on' : 'off',
      minimap: { enabled: settings.minimap, renderCharacters: false, showSlider: 'always' },
      renderWhitespace: settings.renderWhitespace ? 'all' : 'none',
      renderControlCharacters: settings.renderWhitespace,
      guides: { indentation: settings.showIndentGuides },
      lineNumbers: settings.showLineNumbers ? 'on' : 'off',
      renderLineHighlight: settings.highlightCurrentLine ? 'all' : 'none',
      autoClosingBrackets: settings.autoCloseBrackets ? 'languageDefined' : 'never',
      autoClosingQuotes: settings.autoCloseBrackets ? 'languageDefined' : 'never',
      autoSurround: settings.autoCloseBrackets ? 'languageDefined' : 'never',
      columnSelection: state.columnMode,
      tabSize: settings.tabSize,
      insertSpaces: settings.insertSpaces,
    };
  }

  const EDITOR_BASE = {
    model: null,
    detectIndentation: false,
    automaticLayout: true,
    glyphMargin: true,
    folding: true,
    showFoldingControls: 'always',
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    mouseWheelZoom: false,
    occurrencesHighlight: 'singleFile',
    selectionHighlight: true,
    unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
    dropIntoEditor: { enabled: false },
    fixedOverflowWidgets: true,
    stickyScroll: { enabled: false },
    multiCursorModifier: 'alt',
    find: { addExtraSpaceOnTop: false, seedSearchStringFromSelection: 'selection', autoFindInSelection: 'multiline' },
    largeFileOptimizations: true,
    contextmenu: true,
    'semanticHighlighting.enabled': false,
  };

  // Two views (main + other), like Notepad++. The second one is only shown when it holds tabs.
  const viewsEl = $('#views');
  const viewsResizer = $('#views-resizer');
  const views = [...document.querySelectorAll('#views .view')].map((root, index) => ({
    index,
    root,
    tabbarEl: root.querySelector('.tabbar'),
    tabsEl: root.querySelector('.tabs'),
    editor: monaco.editor.create(root.querySelector('.editor-host'), { ...EDITOR_BASE, ...editorOptions() }),
    active: null,
  }));
  let currentView = 0;
  let editor = views[0].editor;
  applyTheme();

  function applyEditorOptions() {
    for (const v of views) v.editor.updateOptions(editorOptions());
    if (cmp) cmp.diff.updateOptions({ ...editorOptions(), minimap: { enabled: false } });
    for (const t of tabs) t.model.updateOptions({ tabSize: settings.tabSize, insertSpaces: settings.insertSpaces });
    updateStatus();
  }

  // -------------------------------------------------------------------------
  // Tabs
  // -------------------------------------------------------------------------
  const tabs = [];
  let activeTab = null;
  let nextId = 1;
  const closedStack = [];

  const BOOKMARK_OPTS = {
    isWholeLine: true,
    glyphMarginClassName: 'bookmark-glyph',
    className: 'bookmark-line',
    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    overviewRuler: { color: '#2b6fd6', position: monaco.editor.OverviewRulerLane.Left },
    glyphMarginHoverMessage: { value: 'Bookmark' },
  };

  function nextUntitled() {
    const used = new Set(tabs.filter((t) => t.untitled).map((t) => t.untitled));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }

  function isDirty(t) { return t.metaDirty || t.model.getAlternativeVersionId() !== t.savedAlt; }
  function isPristine(t) { return !t.path && !isDirty(t) && t.model.getValueLength() === 0; }
  const viewTabs = (i) => tabs.filter((x) => x.view === i);
  const isSplit = () => tabs.some((x) => x.view === 1);

  function setModelEol(t) {
    t.model.setEOL(t.eol === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF);
  }

  function createTab(o = {}) {
    const id = nextId++;
    const untitled = o.path ? null : (o.untitled || nextUntitled());
    const language = o.language || (o.path ? guessLanguage(o.path, firstLineOf(o.text || '')) : 'plaintext');
    const model = monaco.editor.createModel(o.text || '', language);
    model.updateOptions({ tabSize: settings.tabSize, insertSpaces: settings.insertSpaces });
    const t = {
      id, model, untitled,
      view: o.view === 0 || o.view === 1 ? o.view : currentView,
      path: o.path || null,
      title: o.path ? basename(o.path) : `new ${untitled}`,
      encoding: o.encoding || settings.defaultEncoding || 'utf8',
      eol: o.eol || settings.defaultEol,
      mtime: o.mtime || 0,
      readOnly: !!o.readOnly,
      viewState: o.viewState || null,
      bookmarks: [],
      metaDirty: false,
      savedAlt: 0,
      _lastDirty: false,
    };
    setModelEol(t);
    t.savedAlt = o.dirty ? -1 : model.getAlternativeVersionId();
    t._lastDirty = isDirty(t);
    model.onDidChangeContent(() => onTabContentChanged(t));
    if (o.bookmarks && o.bookmarks.length) setBookmarks(t, o.bookmarks);
    const idx = activeTab && activeTab.view === t.view ? tabs.indexOf(activeTab) + 1 : tabs.length;
    tabs.splice(o.atEnd ? tabs.length : idx, 0, t);
    return t;
  }

  function newTab(view = currentView) {
    const t = createTab({ view });
    activate(t);
    scheduleSession();
    return t;
  }

  // Show a tab in its view's editor without changing which view has focus.
  function showInView(v, t) {
    if (v.active && v.active !== t && !v.active.closed) v.active.viewState = v.editor.saveViewState();
    v.active = t || null;
    if (!t) { v.editor.setModel(null); return; }
    if (v.editor.getModel() !== t.model) {
      v.editor.setModel(t.model);
      if (t.viewState) v.editor.restoreViewState(t.viewState);
    }
    v.editor.updateOptions({ readOnly: t.readOnly });
  }

  function setFocusedView(i) {
    currentView = i;
    editor = views[i].editor;
    activeTab = views[i].active;
    for (const v of views) v.root.classList.toggle('focused', v.index === i);
  }

  function focusView(i) {
    if (i === currentView || !views[i].active) return;
    setFocusedView(i);
    renderTabs();
    updateStatus();
    updateWindowState();
    scheduleSession();
  }

  // Keep the views consistent: the main view is never empty while the other view has tabs,
  // and the other view is hidden when it has none.
  function layoutViews() {
    if (!viewTabs(0).length && viewTabs(1).length) {
      const a = views[1].active;
      showInView(views[1], null);
      for (const x of tabs) x.view = 0;
      showInView(views[0], a && !a.closed ? a : tabs[0]);
      if (currentView === 1) setFocusedView(0);
    }
    const split = isSplit();
    views[1].root.hidden = !split;
    viewsResizer.hidden = !split;
    viewsEl.classList.toggle('split', split);
    if (!split && views[1].active) showInView(views[1], null);
    if (!split && currentView === 1) setFocusedView(0);
    views[0].root.style.flex = split ? `0 0 ${Math.round((settings.splitRatio || 0.5) * 1000) / 10}%` : '';
  }

  function activate(t, focus = true) {
    if (!t || t.closed) return;
    showInView(views[t.view], t);
    setFocusedView(t.view);
    layoutViews();
    renderTabs();
    updateStatus();
    updateWindowState();
    scheduleSession();
    if (focus && !cmp) editor.focus();
  }

  // Before a tab leaves its view, show a neighbour in its place.
  function detachFromView(t) {
    const v = views[t.view];
    if (v.active !== t) return;
    const list = viewTabs(t.view);
    const i = list.indexOf(t);
    const rest = list.filter((x) => x !== t);
    showInView(v, rest[i] || rest[i - 1] || null);
  }

  function moveToOtherView(t) {
    if (!t || tabs.length < 2) return;
    detachFromView(t);
    t.view = 1 - t.view;
    tabs.splice(tabs.indexOf(t), 1);
    tabs.push(t);
    activate(t);
  }

  function refreshDirty(t) {
    const d = isDirty(t);
    if (d !== t._lastDirty) {
      t._lastDirty = d;
      renderTabs();
      if (t === activeTab) updateWindowState();
    }
  }

  function onTabContentChanged(t) {
    refreshDirty(t);
    if (t === activeTab) scheduleStatus();
    scheduleSession();
  }

  async function closeTab(t, opts = {}) {
    if (!t || t.closed) return true;
    if (!opts.force && isDirty(t)) {
      activate(t);
      const r = await message({
        type: 'warning',
        message: `Save file "${t.path || t.title}"?`,
        detail: "Your changes will be lost if you don't save them.",
        buttons: ['Save', "Don't Save", 'Cancel'], defaultId: 0, cancelId: 2,
      });
      if (r === 2) return false;
      if (r === 0 && !(await saveTab(t))) return false;
    }
    if (tabs.indexOf(t) < 0) return true;
    if (cmp && cmp.uses(t.model)) closeCompare();
    if (t.path) { closedStack.push(t.path); if (closedStack.length > 50) closedStack.shift(); }
    const wasFocused = activeTab === t;
    detachFromView(t);
    tabs.splice(tabs.indexOf(t), 1);
    t.closed = true;
    t.model.dispose();
    layoutViews();
    if (!tabs.length) {
      activeTab = null;
      if (!opts.noReplace) newTab(0);
    } else if (wasFocused || !activeTab || activeTab.closed) {
      activate(views[currentView].active || views[0].active || tabs[0], wasFocused);
    }
    renderTabs();
    syncWatch();
    scheduleSession();
    return true;
  }

  async function closeMany(list) {
    for (const t of list) { if (!(await closeTab(t))) return false; }
    return true;
  }

  // ---- tab bar rendering ----
  let dragTabId = null;

  function dropTab(moving, target, viewIndex) {
    if (!moving || moving === target) return;
    const changedView = moving.view !== viewIndex;
    if (changedView) detachFromView(moving);
    tabs.splice(tabs.indexOf(moving), 1);
    if (target) tabs.splice(tabs.indexOf(target), 0, moving); else tabs.push(moving);
    moving.view = viewIndex;
    if (changedView) activate(moving); else renderTabs();
    scheduleSession();
  }

  function renderTabs() {
    const split = isSplit();
    for (const v of views) {
      const frag = document.createDocumentFragment();
      let activeEl = null;
      for (const t of viewTabs(v.index)) {
        const div = document.createElement('div');
        div.className = 'tab' + (t === v.active ? ' active' : '') + (isDirty(t) ? ' dirty' : '') + (t.readOnly ? ' readonly' : '');
        div.title = t.path || t.title;
        div.draggable = true;
        div.dataset.id = t.id;
        div.setAttribute('role', 'tab');
        div.innerHTML = `<span class="disk">${ICONS.disk}</span><span class="name"></span><button class="close" title="Close" tabindex="-1">✕</button>`;
        div.querySelector('.name').textContent = t.title;
        div.addEventListener('mousedown', (e) => { if (e.button === 0 && !e.target.closest('.close')) activate(t); });
        div.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); closeTab(t); } });
        div.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); closeTab(t); });
        div.addEventListener('dblclick', (e) => { if (!e.target.closest('.close')) closeTab(t); });
        div.addEventListener('contextmenu', (e) => { e.preventDefault(); tabContextMenu(t, e); });
        div.addEventListener('dragstart', (e) => { dragTabId = t.id; e.dataTransfer.setData('text/x-codeleaf-tab', String(t.id)); e.dataTransfer.effectAllowed = 'move'; });
        div.addEventListener('dragend', () => { dragTabId = null; });
        div.addEventListener('dragover', (e) => { if (dragTabId != null) { e.preventDefault(); div.classList.add('drag-over'); } });
        div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
        div.addEventListener('drop', (e) => {
          div.classList.remove('drag-over');
          if (dragTabId == null) return;
          e.preventDefault();
          e.stopPropagation();
          dropTab(tabs.find((x) => x.id === dragTabId), t, v.index);
        });
        if (t === v.active) activeEl = div;
        frag.appendChild(div);
      }
      v.tabsEl.replaceChildren(frag);
      v.root.classList.toggle('focused', v.index === currentView);
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    viewsEl.classList.toggle('split', split);
    pushEditorState();
  }

  for (const v of views) {
    v.tabsEl.addEventListener('dblclick', (e) => { if (e.target === v.tabsEl) newTab(v.index); });
    v.tabbarEl.addEventListener('dblclick', (e) => { if (e.target === v.tabbarEl) newTab(v.index); });
    v.root.querySelector('.tab-new').addEventListener('click', () => newTab(v.index));
    v.tabsEl.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) v.tabsEl.scrollLeft += e.deltaY; }, { passive: true });
    // dropping a tab on the empty part of a tab bar moves it to the end of that view
    v.tabbarEl.addEventListener('dragover', (e) => { if (dragTabId != null) e.preventDefault(); });
    v.tabbarEl.addEventListener('drop', (e) => {
      if (dragTabId == null) return;
      e.preventDefault();
      dropTab(tabs.find((x) => x.id === dragTabId), null, v.index);
    });
    v.editor.onDidFocusEditorWidget(() => focusView(v.index));
  }

  async function tabContextMenu(t, e) {
    activate(t, false);
    const list = viewTabs(t.view);
    const i = list.indexOf(t);
    const items = [
      { id: 'close', label: 'Close' },
      { id: 'closeOthers', label: 'Close All but This', enabled: list.length > 1 },
      { id: 'closeLeft', label: 'Close All to the Left', enabled: i > 0 },
      { id: 'closeRight', label: 'Close All to the Right', enabled: i < list.length - 1 },
      { id: 'closeUnchanged', label: 'Close All Unchanged' },
      { type: 'separator' },
      { id: 'save', label: 'Save' },
      { id: 'saveAs', label: 'Save As…' },
      { id: 'rename', label: 'Rename…' },
      { id: 'reload', label: 'Reload from Disk', enabled: !!t.path },
      { type: 'separator' },
      { id: 'moveToOtherView', label: t.view === 0 ? 'Move to Other View' : 'Move to Main View', enabled: tabs.length > 1 },
      { id: 'compare', label: 'Compare with…', enabled: tabs.length > 1 },
      { id: 'compareSaved', label: 'Compare with Saved Version', enabled: !!t.path },
      { type: 'separator' },
      { id: 'copyPath', label: 'Copy Full File Path', enabled: !!t.path },
      { id: 'copyName', label: 'Copy Filename' },
      { id: 'copyDir', label: 'Copy Directory Path', enabled: !!t.path },
      { type: 'separator' },
      { id: 'reveal', label: isMac ? 'Reveal in Finder' : 'Open Containing Folder', enabled: !!t.path },
      { id: 'terminal', label: 'Open Containing Folder in Terminal', enabled: !!t.path },
      { type: 'separator' },
      { id: 'toggleReadOnly', label: 'Read-Only', checked: t.readOnly },
    ];
    const id = await api.invoke('popup-menu', items, { x: e.clientX, y: e.clientY });
    if (id) runCommand(id);
  }

  // -------------------------------------------------------------------------
  // Compare (side-by-side diff)
  // -------------------------------------------------------------------------
  const cmpEl = { root: $('#compare'), host: $('#compare-host'), title: $('#cmp-title'), count: $('#cmp-count') };
  let cmp = null;
  const tabLabel = (t) => (t.path ? basename(t.path) : t.title);

  function openCompare(original, modified, leftLabel, rightLabel, temp = []) {
    if (cmp) closeCompare();
    const diff = monaco.editor.createDiffEditor(cmpEl.host, {
      ...EDITOR_BASE,
      ...editorOptions(),
      minimap: { enabled: false },
      glyphMargin: false,
      renderSideBySide: settings.compareSideBySide !== false,
      useInlineViewWhenSpaceIsLimited: false,
      originalEditable: true,
      ignoreTrimWhitespace: false,
      renderIndicators: true,
      enableSplitViewResizing: true,
    });
    diff.setModel({ original, modified });
    cmp = { diff, temp, labels: [leftLabel, rightLabel], first: true, uses: (m) => m === original || m === modified };
    cmpEl.title.textContent = `${leftLabel}   ⟷   ${rightLabel}`;
    cmpEl.count.textContent = 'Comparing…';
    cmpEl.root.classList.remove('identical');
    viewsEl.hidden = true;
    cmpEl.root.hidden = false;
    diff.onDidUpdateDiff(() => {
      if (!cmp || cmp.diff !== diff) return;
      const n = (diff.getLineChanges() || []).length;
      cmpEl.count.textContent = n ? `${n} difference${n === 1 ? '' : 's'}` : 'Files are identical';
      cmpEl.root.classList.toggle('identical', n === 0);
      if (cmp.first && n) { cmp.first = false; goDiff(1); }
    });
    diff.getModifiedEditor().focus();
    pushEditorState();
  }

  function goDiff(dir) {
    if (!cmp) return;
    const d = cmp.diff;
    const changes = d.getLineChanges() || [];
    if (!changes.length) return;
    const ed = d.getModifiedEditor();
    const line = (ed.getPosition() || { lineNumber: 0 }).lineNumber;
    const starts = changes.map((c) => Math.max(1, c.modifiedEndLineNumber === 0 ? c.modifiedStartLineNumber : c.modifiedStartLineNumber));
    const target = dir > 0
      ? (starts.find((s) => s > line) ?? starts[0])
      : ([...starts].reverse().find((s) => s < line) ?? starts[starts.length - 1]);
    ed.setPosition({ lineNumber: target, column: 1 });
    ed.revealLineInCenter(target);
    ed.focus();
  }

  function closeCompare() {
    if (!cmp) return;
    const c = cmp;
    cmp = null;
    c.diff.setModel(null);
    c.diff.dispose();
    for (const m of c.temp) m.dispose();
    cmpEl.root.hidden = true;
    viewsEl.hidden = false;
    if (activeTab) editor.focus();
    pushEditorState();
  }

  function swapCompare() {
    if (!cmp) return;
    const m = cmp.diff.getModel();
    cmp.diff.setModel({ original: m.modified, modified: m.original });
    cmp.labels.reverse();
    cmpEl.title.textContent = `${cmp.labels[0]}   ⟷   ${cmp.labels[1]}`;
  }

  async function compareCommand(mode) {
    const t = activeTab;
    if (!t) return;
    if (mode === 'saved') {
      if (!t.path) { await alertBox('Compare', 'This document has not been saved to disk yet.'); return; }
      const r = await api.invoke('read-file', t.path, t.encoding);
      if (r.error) { await alertBox('Compare', r.error); return; }
      const disk = monaco.editor.createModel(r.text, t.model.getLanguageId());
      openCompare(disk, t.model, `${tabLabel(t)} (saved on disk)`, `${tabLabel(t)} (current)`, [disk]);
      return;
    }
    if (isSplit() && views[0].active && views[1].active) {
      const a = views[0].active, b = views[1].active;
      openCompare(a.model, b.model, tabLabel(a), tabLabel(b));
      return;
    }
    const others = tabs.filter((x) => x !== t);
    if (!others.length) { await alertBox('Compare', 'Open another file to compare with.'); return; }
    let pick = others.length === 1 ? others[0] : null;
    if (!pick) {
      const id = await openModal('Compare',
        `<div class="row full"><label>Compare "${escapeHtml(tabLabel(t))}" with:</label>
         <select id="cmp-pick">${others.map((o) => `<option value="${o.id}">${escapeHtml(o.path || o.title)}</option>`).join('')}</select></div>`,
        [{ label: 'Cancel', value: null },
          { label: 'Compare', primary: true, onClick: (ctx) => ctx.close(Number(ctx.box.querySelector('#cmp-pick').value)) }]);
      pick = tabs.find((x) => x.id === id);
    }
    if (pick) openCompare(pick.model, t.model, tabLabel(pick), tabLabel(t));
  }

  cmpEl.root.querySelector('.compare-actions').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) runCommand(b.dataset.cmp);
  });

  // -------------------------------------------------------------------------
  // Status bar & window state
  // -------------------------------------------------------------------------
  let statusRaf = 0;
  function scheduleStatus() {
    if (statusRaf) return;
    statusRaf = requestAnimationFrame(() => { statusRaf = 0; updateStatus(); });
  }
  function updateStatus() {
    const t = activeTab;
    if (!t || t.closed) return;
    const m = t.model;
    const lang = m.getLanguageId();
    el.sbLang.textContent = lang === 'plaintext' ? 'Normal text file' : `${langName(lang)} file`;
    el.sbSize.textContent = `length : ${fmt(m.getValueLength())}    lines : ${fmt(m.getLineCount())}`;
    const pos = editor.getPosition() || { lineNumber: 1, column: 1 };
    let selChars = 0, selLines = 0;
    for (const s of editor.getSelections() || []) {
      if (s.isEmpty()) continue;
      selChars += m.getValueLengthInRange(s);
      selLines += s.endLineNumber - s.startLineNumber + (s.endColumn === 1 && s.endLineNumber > s.startLineNumber ? 0 : 1);
    }
    el.sbPos.textContent = `Ln : ${fmt(pos.lineNumber)}    Col : ${fmt(pos.column)}    Pos : ${fmt(m.getOffsetAt(pos) + 1)}    Sel : ${fmt(selChars)} | ${fmt(selLines)}`;
    el.sbEol.textContent = EOL_LABEL[t.eol];
    el.sbEnc.textContent = ENC[t.encoding] || t.encoding;
    const o = m.getOptions();
    el.sbIndent.textContent = o.insertSpaces ? `Spaces: ${o.tabSize}` : `Tab Size: ${o.tabSize}`;
    el.sbMode.textContent = t.readOnly ? 'Read-Only' : (state.columnMode ? 'COL' : 'INS');
    pushEditorState();
  }

  function updateWindowState() {
    const t = activeTab;
    if (!t) return;
    const dirty = isDirty(t);
    api.send('window-state', {
      title: `${dirty ? '*' : ''}${t.path || t.title} - Codeleaf`,
      edited: dirty,
      filePath: t.path,
    });
  }

  let lastStateJson = '';
  const pushEditorState = debounce(() => {
    const t = activeTab;
    const s = {
      language: t ? t.model.getLanguageId() : 'plaintext',
      encoding: t ? t.encoding : 'utf8',
      eol: t ? t.eol : settings.defaultEol,
      hasPath: !!(t && t.path),
      readOnly: !!(t && t.readOnly),
      columnMode: state.columnMode,
      macroRecording: state.macroRecording,
      hasMacro: !!(settings.lastMacro && settings.lastMacro.length),
      wordWrap: settings.wordWrap, renderWhitespace: settings.renderWhitespace, showIndentGuides: settings.showIndentGuides,
      showLineNumbers: settings.showLineNumbers, highlightCurrentLine: settings.highlightCurrentLine, minimap: settings.minimap,
      showSidebar: settings.showSidebar, showResults: settings.showResults, showToolbar: settings.showToolbar, showStatusBar: settings.showStatusBar,
      tabs: tabs.map((x) => ({ id: x.id, title: (isDirty(x) ? '*' : '') + x.title, active: x === activeTab })),
      tabCount: tabs.length, split: isSplit(), comparing: !!cmp, compareSideBySide: settings.compareSideBySide !== false,
    };
    const json = JSON.stringify(s);
    if (json === lastStateJson) return;
    lastStateJson = json;
    api.send('editor-state', s);
    updateToolbarState();
  }, 60);

  for (const v of views) v.editor.onDidChangeCursorSelection(() => { if (v.index === currentView) scheduleStatus(); });

  async function statusPopup(e, items) {
    const r = e.currentTarget.getBoundingClientRect();
    const id = await api.invoke('popup-menu', items, { x: Math.round(r.left), y: Math.round(r.top) - 4 });
    return id;
  }
  el.sbEol.addEventListener('click', async (e) => {
    const t = activeTab; if (!t) return;
    const id = await statusPopup(e, Object.entries(EOL_LABEL).map(([k, v]) => ({ id: k, label: v, checked: t.eol === k })));
    if (id) runCommand('setEol', id);
  });
  el.sbEnc.addEventListener('click', async (e) => {
    const t = activeTab; if (!t) return;
    const ids = Object.keys(ENC);
    const items = [
      ...ids.slice(0, 5).map((k) => ({ id: 'c:' + k, label: 'Convert to ' + ENC[k], checked: t.encoding === k })),
      { label: 'More Encodings', submenu: ids.slice(5).map((k) => ({ id: 'c:' + k, label: ENC[k], checked: t.encoding === k })) },
      { type: 'separator' },
      { label: 'Reopen with Encoding', enabled: !!t.path, submenu: ids.map((k) => ({ id: 'r:' + k, label: ENC[k] })) },
    ];
    const id = await statusPopup(e, items);
    if (!id) return;
    if (id.startsWith('c:')) runCommand('convertEncoding', id.slice(2));
    else runCommand('reopenWithEncoding', id.slice(2));
  });
  el.sbLang.addEventListener('click', async (e) => {
    const t = activeTab; if (!t) return;
    const cur = t.model.getLanguageId();
    const sorted = langs.filter((l) => l.id !== 'plaintext').sort((a, b) => langName(a.id).localeCompare(langName(b.id)));
    const groups = new Map();
    for (const l of sorted) {
      const ch = langName(l.id)[0].toUpperCase();
      const key = /[A-Z]/.test(ch) ? ch : '#';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ id: l.id, label: langName(l.id), checked: cur === l.id });
    }
    const items = [{ id: 'plaintext', label: 'Normal Text', checked: cur === 'plaintext' }, { type: 'separator' },
      ...[...groups].map(([k, v]) => ({ label: k, submenu: v }))];
    const id = await statusPopup(e, items);
    if (id) runCommand('setLanguage', id);
  });
  el.sbIndent.addEventListener('click', async (e) => {
    const items = [
      { id: 'spaces', label: 'Indent Using Spaces', checked: settings.insertSpaces },
      { id: 'tabs', label: 'Indent Using Tabs', checked: !settings.insertSpaces },
      { type: 'separator' },
      ...[2, 3, 4, 8].map((n) => ({ id: 'size:' + n, label: `Tab Width: ${n}`, checked: settings.tabSize === n })),
    ];
    const id = await statusPopup(e, items);
    if (!id) return;
    if (id === 'spaces') settings.insertSpaces = true;
    else if (id === 'tabs') settings.insertSpaces = false;
    else settings.tabSize = Number(id.split(':')[1]);
    applyEditorOptions();
    saveSettings();
  });

  // -------------------------------------------------------------------------
  // File operations
  // -------------------------------------------------------------------------
  function lastDir() {
    if (activeTab && activeTab.path) return dirname(activeTab.path);
    return settings.workspace || init.home;
  }

  function textForSave(t) {
    let text = t.model.getValue(monaco.editor.EndOfLinePreference.LF);
    if (t.eol === 'CRLF') text = text.replace(/\n/g, '\r\n');
    else if (t.eol === 'CR') text = text.replace(/\n/g, '\r');
    return text;
  }

  function markSaved(t) {
    t.savedAlt = t.model.getAlternativeVersionId();
    t.metaDirty = false;
    refreshDirty(t);
  }

  function syncWatch() {
    api.send('watch-files', tabs.filter((t) => t.path).map((t) => ({ path: t.path, mtime: t.mtime })));
  }

  async function openFiles(paths, { activateLast = true } = {}) {
    let last = null;
    for (const p of paths) {
      const existing = tabs.find((t) => t.path && samePath(t.path, p));
      if (existing) { last = existing; continue; }
      const r = await api.invoke('read-file', p);
      if (r.error) { await alertBox('Cannot open file', r.error); continue; }
      if (r.binary) {
        const resp = await message({
          type: 'warning', message: 'This file appears to be a binary file.',
          detail: `${p}\n\nOpening it as text may show garbled characters. Open anyway?`,
          buttons: ['Open', 'Cancel'], defaultId: 1, cancelId: 1,
        });
        if (resp !== 0) continue;
      }
      if (r.size > 100 * 1024 * 1024) {
        const resp = await message({
          type: 'warning', message: 'This file is very large.',
          detail: `${p} is ${(r.size / 1048576).toFixed(0)} MB. Opening it may be slow. Continue?`,
          buttons: ['Open', 'Cancel'], defaultId: 0, cancelId: 1,
        });
        if (resp !== 0) continue;
      }
      const pristine = tabs.length === 1 && isPristine(tabs[0]) ? tabs[0] : null;
      const t = createTab({ path: p, text: r.text, encoding: r.encoding, eol: r.eol || settings.defaultEol, mtime: r.mtime, atEnd: true });
      if (pristine) await closeTab(pristine, { force: true, noReplace: true });
      last = t;
      api.send('add-recent', p);
    }
    if (last && activateLast) activate(last);
    renderTabs();
    syncWatch();
    scheduleSession();
    return last;
  }

  async function openDialog() {
    const paths = await api.invoke('dialog-open', lastDir());
    if (paths.length) await openFiles(paths);
  }

  async function saveTab(t, mode) {
    if (!t) return false;
    let target = t.path;
    if (!target || mode) {
      const name = t.path ? basename(t.path) : t.title + defaultExt(t.model.getLanguageId());
      const dir = t.path ? dirname(t.path) : lastDir();
      target = await api.invoke('dialog-save', { defaultPath: joinPath(dir, name), title: mode === 'copy' ? 'Save a Copy As' : 'Save As' });
      if (!target) return false;
    }
    const r = await api.invoke('write-file', target, textForSave(t), t.encoding);
    if (r.error) { await alertBox('Save failed', r.error, 'error'); return false; }
    if (mode === 'copy') return true;
    const changedPath = !t.path || !samePath(t.path, target);
    if (changedPath) {
      const dup = tabs.find((x) => x !== t && x.path && samePath(x.path, target));
      if (dup) await closeTab(dup, { force: true, noReplace: true });
      t.path = target;
      t.title = basename(target);
      t.untitled = null;
      const lang = guessLanguage(target, firstLineOf(t.model.getLineContent(1)));
      if (lang !== 'plaintext' || t.model.getLanguageId() === 'plaintext') monaco.editor.setModelLanguage(t.model, lang);
    }
    t.mtime = r.mtime;
    markSaved(t);
    renderTabs();
    updateWindowState();
    updateStatus();
    syncWatch();
    scheduleSession();
    return true;
  }

  async function saveAll() {
    for (const t of [...tabs]) {
      if (!isDirty(t)) continue;
      if (!t.path) activate(t);
      if (!(await saveTab(t))) return false;
    }
    return true;
  }

  function replaceContent(t, text) {
    const m = t.model;
    m.pushStackElement();
    m.pushEditOperations([], [{ range: m.getFullModelRange(), text }], () => null);
    m.pushStackElement();
  }

  async function reloadTab(t, { force = false, encoding } = {}) {
    if (!t || !t.path) return;
    if (!force && isDirty(t)) {
      const r = await message({
        type: 'warning', message: `Reload "${t.path}"?`, detail: 'The current modifications will be lost.',
        buttons: ['Reload', 'Cancel'], defaultId: 1, cancelId: 1,
      });
      if (r !== 0) return;
    }
    const r = await api.invoke('read-file', t.path, encoding);
    if (r.error) { await alertBox('Reload failed', r.error); return; }
    const vs = t === activeTab ? editor.saveViewState() : t.viewState;
    replaceContent(t, r.text);
    t.encoding = r.encoding;
    if (r.eol) { t.eol = r.eol; setModelEol(t); }
    t.mtime = r.mtime;
    markSaved(t);
    if (t === activeTab && vs) editor.restoreViewState(vs);
    updateStatus();
    syncWatch();
  }

  async function renameTab(t) {
    if (!t) return;
    if (!t.path) {
      const name = await promptBox('Rename', 'New name:', t.title);
      if (!name) return;
      t.title = name;
      renderTabs(); updateWindowState(); scheduleSession();
      return;
    }
    const target = await api.invoke('dialog-save', { defaultPath: t.path, title: 'Rename' });
    if (!target || samePath(target, t.path)) return;
    const r = await api.invoke('rename-file', t.path, target);
    if (r.error) { await alertBox('Rename failed', r.error, 'error'); return; }
    t.path = target;
    t.title = basename(target);
    monaco.editor.setModelLanguage(t.model, guessLanguage(target, firstLineOf(t.model.getLineContent(1))));
    renderTabs(); updateWindowState(); updateStatus(); syncWatch(); scheduleSession();
  }

  // External modifications
  api.on('file-changed', async ({ path: p, deleted, mtime }) => {
    const t = tabs.find((x) => x.path === p);
    if (!t || t._prompting) return;
    t._prompting = true;
    try {
      if (deleted) {
        activate(t);
        const r = await message({
          type: 'warning', message: `"${p}" doesn't exist anymore.`, detail: 'Keep this file in the editor?',
          buttons: ['Keep', 'Close'], defaultId: 0, cancelId: 0,
        });
        if (r === 1) await closeTab(t, { force: true });
        else { t.metaDirty = true; refreshDirty(t); }
      } else {
        if (mtime) t.mtime = mtime;
        if (!isDirty(t) && settings.autoReload) { await reloadTab(t, { force: true }); return; }
        activate(t);
        const r = await message({
          type: 'question', message: `"${p}"`,
          detail: isDirty(t)
            ? 'This file has been modified by another program.\nReload it and lose the changes made in Codeleaf?'
            : 'This file has been modified by another program.\nDo you want to reload it?',
          buttons: ['Reload', 'Keep Current'], defaultId: 0, cancelId: 1,
        });
        if (r === 0) await reloadTab(t, { force: true });
      }
    } finally { t._prompting = false; }
  });

  api.on('open-paths', (paths) => openPaths(paths));
  async function openPaths(paths) {
    const files = [];
    for (const p of paths) {
      const r = await api.invoke('readdir', p);
      if (Array.isArray(r)) setWorkspace(p);
      else files.push(p);
    }
    if (files.length) await openFiles(files);
  }

  // -------------------------------------------------------------------------
  // Text transformations
  // -------------------------------------------------------------------------
  const model = () => activeTab && activeTab.model;

  function selectedLineRange() {
    const m = model();
    const sel = editor.getSelection();
    let start = 1, end = m.getLineCount();
    if (sel && !sel.isEmpty() && sel.startLineNumber !== sel.endLineNumber) {
      start = sel.startLineNumber;
      end = sel.endLineNumber;
      if (sel.endColumn === 1 && end > start) end--;
    } else if (end > 1 && m.getLineLength(end) === 0) {
      end--; // ignore the empty line after a final newline
    }
    return { start, end };
  }

  function transformLines(fn, wholeDoc = false) {
    const m = model();
    if (!m || activeTab.readOnly) return;
    const { start, end } = wholeDoc ? { start: 1, end: m.getLineCount() } : selectedLineRange();
    const lines = [];
    for (let i = start; i <= end; i++) lines.push(m.getLineContent(i));
    const out = fn(lines);
    if (!out) return;
    const range = new monaco.Range(start, 1, end, m.getLineMaxColumn(end));
    editor.pushUndoStop();
    editor.executeEdits('codeleaf', [{ range, text: out.join(m.getEOL()), forceMoveMarkers: true }]);
    editor.pushUndoStop();
  }

  function transformSelections(fn) {
    const m = model();
    if (!m || activeTab.readOnly) return;
    let sels = editor.getSelections();
    if (sels.every((s) => s.isEmpty())) sels = [m.getFullModelRange()];
    const edits = [];
    try {
      for (const s of sels) if (!s.isEmpty()) edits.push({ range: s, text: fn(m.getValueInRange(s)), forceMoveMarkers: true });
    } catch (err) {
      alertBox('Operation failed', err.message);
      return;
    }
    editor.pushUndoStop();
    editor.executeEdits('codeleaf', edits);
    editor.pushUndoStop();
  }

  function expandTabs(line, ts) {
    let out = '', col = 0;
    for (const ch of line) {
      if (ch === '\t') { const n = ts - (col % ts); out += ' '.repeat(n); col += n; } else { out += ch; col++; }
    }
    return out;
  }
  function unexpand(line, ts, leadingOnly) {
    const e = expandTabs(line, ts);
    if (leadingOnly) {
      const n = e.match(/^ */)[0].length;
      return '\t'.repeat(Math.floor(n / ts)) + ' '.repeat(n % ts) + e.slice(n);
    }
    let out = '';
    for (let i = 0; i < e.length; i += ts) {
      const chunk = e.slice(i, i + ts);
      out += chunk.length === ts && / {2,}$/.test(chunk) ? chunk.replace(/ +$/, '') + '\t' : chunk;
    }
    return out;
  }

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: false });
  const LINE_OPS = {
    dedupe: (l) => [...new Set(l)],
    dedupeConsecutive: (l) => l.filter((x, i) => i === 0 || x !== l[i - 1]),
    removeEmpty: (l) => l.filter((x) => x.length),
    removeBlank: (l) => l.filter((x) => x.trim().length),
    sortAsc: (l) => [...l].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    sortDesc: (l) => [...l].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
    sortAscCI: (l) => [...l].sort((a, b) => collator.compare(a, b)),
    sortDescCI: (l) => [...l].sort((a, b) => collator.compare(b, a)),
    sortNumAsc: (l) => [...l].sort((a, b) => numKey(a) - numKey(b)),
    sortNumDesc: (l) => [...l].sort((a, b) => numKey(b) - numKey(a)),
    sortLenAsc: (l) => [...l].sort((a, b) => a.length - b.length),
    reverse: (l) => [...l].reverse(),
    shuffle: (l) => { const a = [...l]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
  function numKey(s) { const n = parseFloat(s.trim()); return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n; }

  const BLANK_OPS = {
    trailing: (l) => l.map((x) => x.replace(/[ \t]+$/, '')),
    leading: (l) => l.map((x) => x.replace(/^[ \t]+/, '')),
    both: (l) => l.map((x) => x.trim()),
    eolToSpace: (l) => [l.join(' ')],
    trimEolToSpace: (l) => [l.map((x) => x.trim()).filter(Boolean).join(' ')],
    tabToSpace: (l) => l.map((x) => expandTabs(x, settings.tabSize)),
    spaceToTabAll: (l) => l.map((x) => unexpand(x, settings.tabSize, false)),
    spaceToTabLeading: (l) => l.map((x) => unexpand(x, settings.tabSize, true)),
  };

  function b64encode(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(s) {
    const bin = atob(s.replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  const indentUnit = () => (settings.insertSpaces ? ' '.repeat(settings.tabSize) : '\t');
  const TRANSFORMS = {
    b64enc: b64encode,
    b64dec: b64decode,
    urlenc: (s) => encodeURIComponent(s),
    urldec: (s) => decodeURIComponent(s.replace(/\+/g, ' ')),
    htmlenc: (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    htmldec: (s) => { const d = new DOMParser().parseFromString(`<!doctype html><body>${s.replace(/</g, '&lt;')}`, 'text/html'); return d.body.textContent; },
    jsonPretty: (s) => JSON.stringify(JSON.parse(s), null, indentUnit()),
    jsonMin: (s) => JSON.stringify(JSON.parse(s)),
    sentence: (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{Ll})/gu, (m, p, c) => p + c.toUpperCase()),
    invert: (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''),
    splitCommas: (s) => s.split(/,\s*/).join(',' + model().getEOL()),
  };

  function insertText(text) {
    const sels = editor.getSelections();
    editor.pushUndoStop();
    editor.executeEdits('codeleaf', sels.map((s) => ({ range: s, text, forceMoveMarkers: true })));
    editor.pushUndoStop();
  }

  // -------------------------------------------------------------------------
  // Bookmarks
  // -------------------------------------------------------------------------
  function bookmarkLines(t) {
    const set = new Set();
    for (const id of t.bookmarks) { const r = t.model.getDecorationRange(id); if (r) set.add(r.startLineNumber); }
    return [...set].sort((a, b) => a - b);
  }
  function setBookmarks(t, lines) {
    const max = t.model.getLineCount();
    const uniq = [...new Set(lines)].filter((l) => l >= 1 && l <= max);
    t.bookmarks = t.model.deltaDecorations(t.bookmarks, uniq.map((l) => ({ range: new monaco.Range(l, 1, l, 1), options: BOOKMARK_OPTS })));
    scheduleSession();
  }
  function toggleBookmark(line) {
    const t = activeTab;
    const lines = bookmarkLines(t);
    const i = lines.indexOf(line);
    if (i >= 0) lines.splice(i, 1); else lines.push(line);
    setBookmarks(t, lines);
  }
  function gotoLine(line) {
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.revealLineInCenterIfOutsideViewport(line);
    editor.focus();
  }
  function bookmarkCommand(op) {
    const t = activeTab; if (!t) return;
    const m = t.model;
    const lines = bookmarkLines(t);
    const cur = editor.getPosition().lineNumber;
    switch (op) {
      case 'toggle': toggleBookmark(cur); break;
      case 'next': if (lines.length) gotoLine(lines.find((l) => l > cur) || lines[0]); break;
      case 'prev': if (lines.length) gotoLine([...lines].reverse().find((l) => l < cur) || lines[lines.length - 1]); break;
      case 'clear': setBookmarks(t, []); break;
      case 'copy': api.send('clipboard-write', lines.map((l) => m.getLineContent(l)).join(m.getEOL())); break;
      case 'remove':
      case 'removeUnmarked': {
        const set = new Set(lines);
        const keepMarked = op === 'removeUnmarked';
        transformLines((all) => all.filter((x, i) => set.has(i + 1) === keepMarked), true);
        setBookmarks(t, keepMarked ? Array.from({ length: m.getLineCount() }, (_, i) => i + 1) : []);
        break;
      }
      case 'inverse': {
        const set = new Set(lines);
        const all = [];
        for (let i = 1; i <= m.getLineCount(); i++) if (!set.has(i)) all.push(i);
        setBookmarks(t, all);
        break;
      }
    }
  }
  for (const v of views) {
    v.editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN && e.target.position && v.active) {
        focusView(v.index);
        toggleBookmark(e.target.position.lineNumber);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Macros
  // -------------------------------------------------------------------------
  function macroStepFromKey(e) {
    const be = e.browserEvent;
    if (be.isComposing || be.key === 'Process' || be.key === 'Dead') return null;
    const wordMod = isMac ? be.altKey : be.ctrlKey;
    const lineMod = isMac && be.metaKey;
    const S = be.shiftKey ? 'Select' : '';
    const k = (c) => ({ type: 'key', cmd: c });
    switch (be.key) {
      case 'ArrowLeft': return k((lineMod ? 'cursorHome' : wordMod ? 'cursorWordStartLeft' : 'cursorLeft') + S);
      case 'ArrowRight': return k((lineMod ? 'cursorEnd' : wordMod ? 'cursorWordEndRight' : 'cursorRight') + S);
      case 'ArrowUp': return k((lineMod ? 'cursorTop' : 'cursorUp') + S);
      case 'ArrowDown': return k((lineMod ? 'cursorBottom' : 'cursorDown') + S);
      case 'Home': return k(((!isMac && be.ctrlKey) ? 'cursorTop' : 'cursorHome') + S);
      case 'End': return k(((!isMac && be.ctrlKey) ? 'cursorBottom' : 'cursorEnd') + S);
      case 'PageUp': return k('cursorPageUp' + S);
      case 'PageDown': return k('cursorPageDown' + S);
      case 'Backspace': return k(lineMod ? 'deleteAllLeft' : wordMod ? 'deleteWordLeft' : 'deleteLeft');
      case 'Delete': return k(wordMod ? 'deleteWordRight' : 'deleteRight');
      case 'Enter': if (!be.metaKey && !be.ctrlKey && !be.altKey) return { type: 'type', text: '\n' }; return null;
      case 'Tab': if (!be.metaKey && !be.ctrlKey && !be.altKey) return k(be.shiftKey ? 'outdent' : 'tab'); return null;
    }
    if (be.key.length === 1 && !be.ctrlKey && !be.metaKey) return { type: 'type', text: be.key };
    return null;
  }
  for (const v of views) {
    v.editor.onKeyDown((e) => {
      if (!state.macroRecording) return;
      const step = macroStepFromKey(e);
      if (step) state.macroSteps.push(step);
    });
    v.editor.onDidPaste((e) => {
      if (!state.macroRecording || !v.active) return;
      state.macroSteps.push({ type: 'type', text: v.active.model.getValueInRange(e.range) });
    });
  }

  const MACRO_RECORDABLE = new Set(['ed', 'lines', 'blank', 'transform', 'insertDate', 'sentenceCase', 'invertCase', 'splitLines', 'bookmark']);

  function playMacroOnce(steps) {
    for (const s of steps) {
      if (s.type === 'type') editor.trigger('macro', 'type', { text: s.text });
      else if (s.type === 'key') editor.trigger('macro', s.cmd, null);
      else if (s.type === 'cmd') execute(s.cmd, s.arg, true);
    }
  }
  function playMacro(times = 1, untilEnd = false) {
    const steps = settings.lastMacro;
    if (!steps || !steps.length || !activeTab) return;
    editor.focus();
    editor.pushUndoStop();
    const m = model();
    const limit = untilEnd ? 1000000 : times;
    for (let i = 0; i < limit; i++) {
      const before = editor.getPosition();
      const ver = m.getVersionId();
      playMacroOnce(steps);
      if (untilEnd) {
        const after = editor.getPosition();
        const atEnd = after.lineNumber >= m.getLineCount();
        if ((after.equals(before) && m.getVersionId() === ver) || atEnd) {
          if (atEnd && !after.equals(before)) { /* ran on last line */ }
          break;
        }
      }
    }
    editor.pushUndoStop();
  }
  function macroCommand(op) {
    switch (op) {
      case 'record':
        state.macroRecording = true;
        state.macroSteps = [];
        el.sbMacro.hidden = false;
        editor.focus();
        break;
      case 'stop':
        if (!state.macroRecording) return;
        state.macroRecording = false;
        el.sbMacro.hidden = true;
        if (state.macroSteps.length) { settings.lastMacro = mergeTypeSteps(state.macroSteps); saveSettings(); }
        break;
      case 'play': if (!state.macroRecording) playMacro(1); break;
      case 'multi': if (!state.macroRecording) macroMultiDialog(); break;
    }
    updateToolbarState();
    pushEditorState();
  }
  function mergeTypeSteps(steps) {
    const out = [];
    for (const s of steps) {
      const last = out[out.length - 1];
      if (s.type === 'type' && last && last.type === 'type' && s.text !== '\n' && last.text.indexOf('\n') < 0) last.text += s.text;
      else out.push({ ...s });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------
  function inputFocused() {
    const a = document.activeElement;
    return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.classList.contains('inputarea');
  }
  // The editor that should receive commands: one side of the Compare view when it is open,
  // otherwise the focused view's editor.
  function targetEditor() {
    if (cmp) {
      const orig = cmp.diff.getOriginalEditor();
      return orig.hasTextFocus() ? orig : cmp.diff.getModifiedEditor();
    }
    return editor;
  }
  function act(id) {
    if (!activeTab && !cmp) return;
    const ed = targetEditor();
    ed.focus();
    const a = ed.getAction(id);
    if (a) a.run();
    else ed.trigger('codeleaf', id, null);
  }
  function toggleSetting(key) {
    if (key === 'columnMode') {
      state.columnMode = !state.columnMode;
      applyEditorOptions();
      return;
    }
    settings[key] = !settings[key];
    applyEditorOptions();
    applyLayout();
    saveSettings();
  }

  let lastCmd = { key: '', t: 0 };
  function runCommand(cmd, arg) {
    // guard against the same shortcut arriving from both the menu and the editor
    const key = cmd + '|' + arg;
    const now = performance.now();
    if (key === lastCmd.key && now - lastCmd.t < 25) return;
    lastCmd = { key, t: now };
    execute(cmd, arg, false);
  }

  async function execute(cmd, arg, fromMacro) {
    const t = activeTab;
    if (state.macroRecording && !fromMacro && MACRO_RECORDABLE.has(cmd)) state.macroSteps.push({ type: 'cmd', cmd, arg });
    switch (cmd) {
      // File
      case 'new': newTab(); break;
      case 'open': await openDialog(); break;
      case 'openFolder': {
        const d = await api.invoke('dialog-open-folder', settings.workspace || lastDir());
        if (d) setWorkspace(d);
        break;
      }
      case 'reopenClosed': {
        while (closedStack.length) {
          const p = closedStack.pop();
          if (await api.invoke('file-exists', p)) { await openFiles([p]); break; }
        }
        break;
      }
      case 'reload': await reloadTab(t); break;
      case 'save': await saveTab(t); break;
      case 'saveAs': await saveTab(t, 'as'); break;
      case 'saveCopy': await saveTab(t, 'copy'); break;
      case 'saveAll': await saveAll(); break;
      case 'rename': await renameTab(t); break;
      case 'close': await closeTab(t); break;
      case 'closeAll': await closeMany([...tabs]); break;
      case 'closeOthers': await closeMany(viewTabs(t.view).filter((x) => x !== t)); break;
      case 'closeLeft': { const l = viewTabs(t.view); await closeMany(l.slice(0, l.indexOf(t))); break; }
      case 'closeRight': { const l = viewTabs(t.view); await closeMany(l.slice(l.indexOf(t) + 1)); break; }
      case 'closeUnchanged': await closeMany(tabs.filter((x) => !isDirty(x))); break;
      case 'reveal': if (t && t.path) api.send('reveal', t.path); break;
      case 'terminal': api.send('open-terminal', t && t.path ? dirname(t.path) : lastDir()); break;
      case 'print': if (t) api.invoke('print', { title: t.path || t.title, text: t.model.getValue(), fontFamily: settings.fontFamily }); break;

      // Edit
      case 'undo': if (inputFocused()) document.execCommand('undo'); else act('undo'); break;
      case 'redo': if (inputFocused()) document.execCommand('redo'); else act('redo'); break;
      case 'selectAll': if (inputFocused()) document.activeElement.select(); else act('editor.action.selectAll'); break;
      case 'deleteSel': if (inputFocused()) document.execCommand('delete'); else act('deleteRight'); break;
      case 'cut': case 'copy': case 'paste': editor.focus(); api.send('edit-role', cmd); break;
      case 'copyPath': if (t && t.path) api.send('clipboard-write', t.path); break;
      case 'copyName': if (t) api.send('clipboard-write', t.title); break;
      case 'copyDir': if (t && t.path) api.send('clipboard-write', dirname(t.path)); break;
      case 'ed': act(arg); break;
      case 'lines': transformLines(LINE_OPS[arg]); break;
      case 'blank': transformLines(BLANK_OPS[arg]); break;
      case 'transform': transformSelections(TRANSFORMS[arg]); break;
      case 'sentenceCase': transformSelections(TRANSFORMS.sentence); break;
      case 'invertCase': transformSelections(TRANSFORMS.invert); break;
      case 'splitLines': transformSelections(TRANSFORMS.splitCommas); break;
      case 'insertDate': {
        const d = new Date();
        const text = arg === 'iso' ? d.toISOString()
          : arg === 'long' ? d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' })
            : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
        insertText(text);
        break;
      }
      case 'setEol':
        if (!t || t.eol === arg) break;
        t.eol = arg;
        setModelEol(t);
        t.metaDirty = true;
        refreshDirty(t); updateStatus(); scheduleSession();
        break;
      case 'convertEncoding':
        if (!t || t.encoding === arg) break;
        t.encoding = arg;
        t.metaDirty = true;
        refreshDirty(t); updateStatus(); scheduleSession();
        break;
      case 'reopenWithEncoding':
        if (!t || !t.path) break;
        await reloadTab(t, { encoding: arg });
        break;
      case 'setLanguage':
        if (!t) break;
        monaco.editor.setModelLanguage(t.model, arg);
        updateStatus(); scheduleSession();
        break;
      case 'toggleReadOnly':
        if (!t) break;
        t.readOnly = !t.readOnly;
        for (const v of views) if (v.active === t) v.editor.updateOptions({ readOnly: t.readOnly });
        renderTabs(); updateStatus();
        break;

      // Search
      case 'find': if (inputFocused() && !document.activeElement.closest('.monaco-editor')) break; act('actions.find'); break;
      case 'replace': act('editor.action.startFindReplaceAction'); break;
      case 'findInFiles': findDialog(arg); break;
      case 'bookmark': bookmarkCommand(arg); break;
      case 'markLines': await markLinesDialog(); break;

      // View
      case 'toggle': toggleSetting(arg); break;
      case 'zoom':
        settings.zoom = arg === 0 ? 0 : Math.max(-6, Math.min(40, settings.zoom + arg));
        applyEditorOptions(); saveSettings();
        break;
      case 'zoomIn': execute('zoom', 1); break;
      case 'zoomOut': execute('zoom', -1); break;
      case 'setTheme': settings.theme = arg; applyTheme(); saveSettings(); break;
      case 'toggleTheme': toggleTheme(); break;

      // Settings / macro / run
      case 'preferences': preferencesDialog(); break;
      case 'macro': macroCommand(arg); break;
      case 'run': await runDialog(); break;
      case 'launchBrowser': if (t && t.path) api.send('open-external', fileUrl(t.path)); break;
      case 'openDefault': if (t && t.path) api.send('open-path', t.path); break;
      case 'searchWeb': {
        const m = model(); if (!m) break;
        const sel = editor.getSelection();
        let q = sel && !sel.isEmpty() ? m.getValueInRange(sel) : '';
        if (!q) { const w = m.getWordAtPosition(editor.getPosition()); q = w ? w.word : ''; }
        if (q) api.send('open-external', 'https://www.google.com/search?q=' + encodeURIComponent(q.slice(0, 300)));
        break;
      }

      // Window
      case 'activateTab': activate(tabs.find((x) => x.id === arg)); break;
      case 'nextTab': case 'prevTab': {
        const l = viewTabs(t.view);
        if (l.length > 1) activate(l[(l.indexOf(t) + (cmd === 'nextTab' ? 1 : -1) + l.length) % l.length]);
        break;
      }
      case 'moveTab': {
        const l = viewTabs(t.view), j = l.indexOf(t) + arg;
        if (j < 0 || j >= l.length) break;
        const a = tabs.indexOf(t), b = tabs.indexOf(l[j]);
        [tabs[a], tabs[b]] = [tabs[b], tabs[a]];
        renderTabs(); scheduleSession();
        break;
      }
      case 'moveToOtherView': moveToOtherView(t); break;
      case 'focusOtherView':
        if (cmp) goDiff(1);
        else if (isSplit()) activate(views[1 - currentView].active);
        break;
      case 'compare': await compareCommand('tabs'); break;
      case 'compareSaved': await compareCommand('saved'); break;
      case 'compareNext': goDiff(1); break;
      case 'comparePrev': goDiff(-1); break;
      case 'compareSwap': swapCompare(); break;
      case 'compareClose': closeCompare(); break;
      case 'compareToggleMode':
        settings.compareSideBySide = settings.compareSideBySide === false;
        if (cmp) cmp.diff.updateOptions({ renderSideBySide: settings.compareSideBySide });
        saveSettings(); pushEditorState();
        break;
      case 'sortTabs': {
        const key = (x) => (arg === 'path' ? (x.path || '~' + x.title) : x.title).toLowerCase();
        tabs.sort((a, b) => key(a).localeCompare(key(b)));
        renderTabs(); scheduleSession();
        break;
      }
      case 'shortcuts': shortcutsDialog(); break;
    }
  }

  api.on('menu', (cmd, arg) => runCommand(cmd, arg));

  // Editor keybindings that must override Monaco's defaults so behaviour matches the menus.
  {
    const KM = monaco.KeyMod, KC = monaco.KeyCode;
    const C = KM.CtrlCmd, S = KM.Shift, A = KM.Alt;
    const common = [
      [C | KC.KeyD, 'ed', 'editor.action.copyLinesDownAction'],
      [C | KC.KeyU, 'ed', 'editor.action.transformToLowercase'],
      [C | S | KC.KeyU, 'ed', 'editor.action.transformToUppercase'],
      [C | KC.KeyJ, 'ed', 'editor.action.joinLines'],
      [C | KC.KeyE, 'ed', 'editor.action.addSelectionToNextFindMatch'],
      [C | KC.KeyK, 'ed', 'editor.action.addCommentLine'],
      [C | KC.F2, 'bookmark', 'toggle'],
      [KC.F2, 'bookmark', 'next'],
      [S | KC.F2, 'bookmark', 'prev'],
      [A | KC.KeyZ, 'toggle', 'wordWrap'],
      [C | S | KC.KeyR, 'macro', 'record'],
      [C | S | KC.KeyP, 'macro', 'play'],
      [C | S | KC.KeyF, 'findInFiles'],
      [C | S | KC.KeyT, 'reopenClosed'],
      [C | KC.KeyP, 'print'],
      [C | S | KC.KeyD, 'toggleTheme'],
      [KC.F8, 'focusOtherView'],
      [S | KC.F8, 'comparePrev'],
    ];
    const perPlatform = isMac ? [
      [C | KC.KeyL, 'ed', 'editor.action.gotoLine'],
      [C | KC.KeyG, 'ed', 'editor.action.nextMatchFindAction'],
      [C | S | KC.KeyG, 'ed', 'editor.action.previousMatchFindAction'],
    ] : [
      [C | KC.KeyL, 'ed', 'editor.action.deleteLines'],
      [C | S | KC.KeyK, 'ed', 'editor.action.removeCommentLine'],
      [C | KC.KeyQ, 'ed', 'editor.action.commentLine'],
      [C | S | KC.KeyQ, 'ed', 'editor.action.blockComment'],
      [C | KC.KeyB, 'ed', 'editor.action.jumpToBracket'],
      [C | KC.KeyG, 'ed', 'editor.action.gotoLine'],
      [C | KC.KeyH, 'replace'],
      [C | S | KC.UpArrow, 'ed', 'editor.action.moveLinesUpAction'],
      [C | S | KC.DownArrow, 'ed', 'editor.action.moveLinesDownAction'],
      [C | KC.KeyY, 'redo'],
    ];
    for (const v of views) for (const [keys, cmd, arg] of [...common, ...perPlatform]) v.editor.addCommand(keys, () => runCommand(cmd, arg));
  }

  // Global shortcuts not tied to the editor
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      runCommand(e.shiftKey ? 'prevTab' : 'nextTab');
    } else if (e.key === 'Escape' && el.modalRoot.firstChild) {
      e.preventDefault();
      closeTopModal();
    }
  }, true);

  // -------------------------------------------------------------------------
  // Toolbar
  // -------------------------------------------------------------------------
  const mk = isMac ? '⌘' : 'Ctrl+';
  const TOOLBAR = [
    ['new', `New (${mk}N)`, 'new'], ['open', `Open (${mk}O)`, 'open'], ['save', `Save (${mk}S)`, 'save'],
    ['saveAll', 'Save All', 'saveAll'], ['close', `Close (${mk}W)`, 'close'], ['closeAll', 'Close All', 'closeAll'],
    ['print', `Print (${mk}P)`, 'print'], '|',
    ['cut', 'Cut', 'cut'], ['copy', 'Copy', 'copy'], ['paste', 'Paste', 'paste'], '|',
    ['undo', 'Undo', 'undo'], ['redo', 'Redo', 'redo'], '|',
    ['find', `Find (${mk}F)`, 'find'], ['replace', 'Replace', 'replace'], ['findFiles', 'Find in Files', 'findInFiles'], '|',
    ['zoomIn', 'Zoom In', 'zoomIn'], ['zoomOut', 'Zoom Out', 'zoomOut'], '|',
    ['wrap', 'Word Wrap', 'toggle:wordWrap'], ['whitespace', 'Show All Characters', 'toggle:renderWhitespace'],
    ['indentGuide', 'Show Indent Guide', 'toggle:showIndentGuides'], ['lineNumbers', 'Line Numbers', 'toggle:showLineNumbers'], '|',
    ['sidebar', 'Folder as Workspace', 'toggle:showSidebar'], ['minimap', 'Document Map', 'toggle:minimap'], '|',
    ['record', 'Start Recording Macro', 'macro:record'], ['stop', 'Stop Recording', 'macro:stop'],
    ['play', 'Playback Macro', 'macro:play'], ['playMulti', 'Run Macro Multiple Times', 'macro:multi'],
    ['moon', 'Switch to Dark Mode', 'toggleTheme'],
  ];
  const toolbarButtons = {};
  for (const item of TOOLBAR) {
    if (item === '|') { const s = document.createElement('span'); s.className = 'tb-sep'; el.toolbar.appendChild(s); continue; }
    const [icon, title, command] = item;
    const b = document.createElement('button');
    b.className = 'tb-btn' + (icon === 'record' ? ' rec' : '') + (command === 'toggleTheme' ? ' tb-theme' : '');
    b.title = title;
    b.innerHTML = ICONS[icon];
    b.tabIndex = -1;
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep editor focus
    b.addEventListener('click', () => {
      const [c, a] = command.split(':');
      runCommand(c, a);
    });
    toolbarButtons[command] = b;
    el.toolbar.appendChild(b);
  }
  updateThemeButton();
  function updateToolbarState() {
    for (const key of ['wordWrap', 'renderWhitespace', 'showIndentGuides', 'showLineNumbers', 'showSidebar', 'minimap']) {
      const b = toolbarButtons['toggle:' + key];
      if (b) b.classList.toggle('on', !!settings[key]);
    }
    const rec = state.macroRecording;
    const has = !!(settings.lastMacro && settings.lastMacro.length);
    toolbarButtons['macro:record'].disabled = rec;
    toolbarButtons['macro:record'].classList.toggle('on', rec);
    toolbarButtons['macro:stop'].disabled = !rec;
    toolbarButtons['macro:play'].disabled = rec || !has;
    toolbarButtons['macro:multi'].disabled = rec || !has;
  }

  // -------------------------------------------------------------------------
  // Layout, sidebar, results
  // -------------------------------------------------------------------------
  function applyLayout() {
    el.toolbar.hidden = !settings.showToolbar;
    el.status.hidden = !settings.showStatusBar;
    el.sidebar.hidden = el.sideResizer.hidden = !settings.showSidebar;
    el.sidebar.style.width = settings.sidebarWidth + 'px';
    el.results.hidden = el.resultsResizer.hidden = !settings.showResults;
    el.results.style.height = settings.resultsHeight + 'px';
    if (settings.showSidebar) renderTree();
    updateToolbarState();
    pushEditorState();
  }

  function makeResizer(handle, onMove) {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const move = (ev) => onMove(ev);
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); saveSettings(); };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }
  makeResizer(el.sideResizer, (e) => {
    settings.sidebarWidth = Math.max(140, Math.min(window.innerWidth - 300, e.clientX));
    el.sidebar.style.width = settings.sidebarWidth + 'px';
  });
  makeResizer(el.resultsResizer, (e) => {
    const bottom = el.status.hidden ? window.innerHeight : el.status.getBoundingClientRect().top;
    settings.resultsHeight = Math.max(60, Math.min(window.innerHeight - 200, bottom - e.clientY));
    el.results.style.height = settings.resultsHeight + 'px';
  });
  makeResizer(viewsResizer, (e) => {
    const r = viewsEl.getBoundingClientRect();
    settings.splitRatio = Math.max(0.15, Math.min(0.85, (e.clientX - r.left) / r.width));
    layoutViews();
  });

  // ---- Folder as Workspace ----
  const expanded = new Set();
  const dirCache = new Map();
  let selectedTreePath = null;

  function setWorkspace(dir) {
    settings.workspace = dir;
    settings.showSidebar = true;
    expanded.clear();
    dirCache.clear();
    expanded.add(dir);
    applyLayout();
    saveSettings();
  }

  async function listDir(dir) {
    if (dirCache.has(dir)) return dirCache.get(dir);
    const r = await api.invoke('readdir', dir);
    const list = Array.isArray(r) ? r : [];
    dirCache.set(dir, list);
    return list;
  }

  let treeRenderToken = 0;
  async function renderTree() {
    const token = ++treeRenderToken;
    const root = settings.workspace;
    if (!root) {
      el.sideTitle.textContent = 'Folder as Workspace';
      el.tree.innerHTML = '<div class="tree-empty">No folder opened.<br><button id="tree-open">Open Folder…</button></div>';
      $('#tree-open').addEventListener('click', () => runCommand('openFolder'));
      return;
    }
    el.sideTitle.textContent = basename(root) || root;
    el.sideTitle.title = root;
    expanded.add(root);
    const rows = [];
    const build = async (dir, depth) => {
      for (const ent of await listDir(dir)) {
        rows.push({ ...ent, depth });
        if (ent.isDir && expanded.has(ent.path)) await build(ent.path, depth + 1);
      }
    };
    await build(root, 0);
    if (token !== treeRenderToken) return;
    const frag = document.createDocumentFragment();
    for (const r of rows) {
      const div = document.createElement('div');
      div.className = 'tree-item' + (r.path === selectedTreePath ? ' selected' : '');
      div.style.paddingLeft = 8 + r.depth * 14 + 'px';
      div.title = r.path;
      div.innerHTML = `<span class="twisty">${r.isDir ? (expanded.has(r.path) ? '▼' : '▶') : ''}</span>` +
        `<span class="ficon">${r.isDir ? (expanded.has(r.path) ? '📂' : '📁') : '📄'}</span><span class="label"></span>`;
      div.querySelector('.label').textContent = r.name;
      div.addEventListener('click', () => {
        selectedTreePath = r.path;
        if (r.isDir) {
          if (expanded.has(r.path)) expanded.delete(r.path); else expanded.add(r.path);
          renderTree();
        } else {
          openFiles([r.path]);
          renderTree();
        }
      });
      div.addEventListener('contextmenu', (e) => { e.preventDefault(); treeContextMenu(r, e); });
      frag.appendChild(div);
    }
    el.tree.replaceChildren(frag);
  }

  async function treeContextMenu(r, e) {
    const dir = r.isDir ? r.path : dirname(r.path);
    const items = [
      ...(r.isDir ? [] : [{ id: 'open', label: 'Open' }, { type: 'separator' }]),
      { id: 'reveal', label: isMac ? 'Reveal in Finder' : 'Show in Explorer' },
      { id: 'terminal', label: 'Open in Terminal' },
      { id: 'find', label: 'Find in Files…' },
      { type: 'separator' },
      { id: 'copyPath', label: 'Copy Path' },
      { id: 'copyName', label: 'Copy Name' },
      { type: 'separator' },
      { id: 'refresh', label: 'Refresh' },
    ];
    const id = await api.invoke('popup-menu', items, { x: e.clientX, y: e.clientY });
    switch (id) {
      case 'open': openFiles([r.path]); break;
      case 'reveal': api.send('reveal', r.path); break;
      case 'terminal': api.send('open-terminal', dir); break;
      case 'find': findDialog(dir); break;
      case 'copyPath': api.send('clipboard-write', r.path); break;
      case 'copyName': api.send('clipboard-write', r.name); break;
      case 'refresh': dirCache.clear(); renderTree(); break;
    }
  }

  el.sidebar.querySelector('.side-actions').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    switch (b.dataset.side) {
      case 'open': runCommand('openFolder'); break;
      case 'refresh': dirCache.clear(); renderTree(); break;
      case 'collapse': expanded.clear(); renderTree(); break;
      case 'close': settings.showSidebar = false; applyLayout(); saveSettings(); break;
    }
  });

  // ---- Search results panel ----
  function highlightLine(text, ranges) {
    let out = '', pos = 0;
    for (const [s, len] of ranges) {
      if (s < pos) continue;
      out += escapeHtml(text.slice(pos, s)) + '<mark>' + escapeHtml(text.slice(s, s + len)) + '</mark>';
      pos = s + len;
    }
    return out + escapeHtml(text.slice(pos));
  }

  function showResults(res, opts) {
    settings.showResults = true;
    applyLayout();
    for (const h of el.resultsBody.querySelectorAll(':scope > .r-search')) h.classList.add('r-collapsed');
    const scopeLabel = opts.scope === 'dir' ? `in "${opts.dir}"` : opts.scope === 'open' ? 'in all open documents' : 'in current document';
    const header = document.createElement('div');
    header.className = 'r-search';
    header.textContent = `Search "${opts.query}" (${fmt(res.total)} hits in ${fmt(res.results.length)} file${res.results.length === 1 ? '' : 's'}` +
      (res.filesSearched != null ? ` of ${fmt(res.filesSearched)} searched` : '') + `) ${scopeLabel}${res.truncated ? ' — results truncated' : ''}`;
    header.addEventListener('click', () => header.classList.toggle('r-collapsed'));
    const group = document.createElement('div');
    group.className = 'r-group';
    let rendered = 0;
    for (const f of res.results) {
      const fh = document.createElement('div');
      fh.className = 'r-file';
      fh.innerHTML = `${escapeHtml(f.label || f.path)} <span class="count">(${f.matches.length} hit${f.matches.length === 1 ? '' : 's'})</span>`;
      fh.addEventListener('click', () => fh.classList.toggle('r-collapsed'));
      const fg = document.createElement('div');
      fg.className = 'r-group';
      for (const m of f.matches) {
        if (rendered++ > 10000) break;
        const line = document.createElement('div');
        line.className = 'r-line';
        line.innerHTML = `<span class="ln">Line ${m.line}:</span> ${highlightLine(m.text, m.ranges)}`;
        line.addEventListener('click', async () => {
          el.resultsBody.querySelectorAll('.r-line.selected').forEach((x) => x.classList.remove('selected'));
          line.classList.add('selected');
          const [col, len] = m.ranges[0];
          let tab = f.tabId ? tabs.find((x) => x.id === f.tabId) : null;
          if (!tab && f.path) tab = await openFiles([f.path]);
          if (!tab || tab.closed) return;
          activate(tab);
          const sel = new monaco.Selection(m.line, col + 1, m.line, col + 1 + len);
          editor.setSelection(sel);
          editor.revealRangeInCenterIfOutsideViewport(sel);
          editor.focus();
        });
        fg.appendChild(line);
      }
      group.appendChild(fh);
      group.appendChild(fg);
    }
    el.resultsBody.prepend(header, group);
    el.resultsBody.scrollTop = 0;
    el.resultsTitle.textContent = `Search results — ${fmt(res.total)} hits`;
  }

  el.results.querySelector('.side-actions').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    switch (b.dataset.results) {
      case 'collapse': el.resultsBody.querySelectorAll('.r-search, .r-file').forEach((x) => x.classList.add('r-collapsed')); break;
      case 'clear': el.resultsBody.textContent = ''; el.resultsTitle.textContent = 'Search results'; break;
      case 'close': settings.showResults = false; applyLayout(); saveSettings(); break;
    }
  });

  // -------------------------------------------------------------------------
  // Dialogs
  // -------------------------------------------------------------------------
  const modalStack = [];
  function openModal(title, bodyHtml, buttons, { width } = {}) {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'modal-backdrop';
      const box = document.createElement('div');
      box.className = 'modal';
      if (width) box.style.width = width + 'px';
      box.innerHTML = `<h2></h2><div class="body">${bodyHtml}</div><div class="footer"><span class="left"></span></div>`;
      box.querySelector('h2').textContent = title;
      const footer = box.querySelector('.footer');
      const ctx = {
        box, status: box.querySelector('.footer .left'),
        close: (v) => {
          back.remove();
          const i = modalStack.indexOf(ctx); if (i >= 0) modalStack.splice(i, 1);
          resolve(v);
          if (!modalStack.length && activeTab) editor.focus();
        },
        buttons: {},
      };
      for (const b of buttons) {
        const btn = document.createElement('button');
        btn.className = 'btn' + (b.primary ? ' primary' : '');
        btn.textContent = b.label;
        btn.addEventListener('click', () => (b.onClick ? b.onClick(ctx) : ctx.close(b.value)));
        ctx.buttons[b.id || b.label] = btn;
        footer.appendChild(btn);
      }
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
          const p = buttons.find((b) => b.primary);
          if (p) { e.preventDefault(); ctx.buttons[p.id || p.label].click(); }
        }
      });
      back.addEventListener('mousedown', (e) => { if (e.target === back) ctx.close(null); });
      back.appendChild(box);
      el.modalRoot.appendChild(back);
      modalStack.push(ctx);
      const first = box.querySelector('input, select, textarea');
      if (first) { first.focus(); if (first.select) first.select(); }
      if (buttons.onOpen) buttons.onOpen(ctx);
      ctx.ready = true;
      if (typeof openModal.onOpen === 'function') { const f = openModal.onOpen; openModal.onOpen = null; f(ctx); }
    });
  }
  function closeTopModal() { const top = modalStack[modalStack.length - 1]; if (top) top.close(null); }

  async function promptBox(title, label, value = '', hint = '') {
    let input;
    openModal.onOpen = (ctx) => { input = ctx.box.querySelector('input'); };
    const r = await openModal(title,
      `<div class="row full"><label>${escapeHtml(label)}</label><input type="text" value="${escapeHtml(value)}" spellcheck="false"></div>` +
      (hint ? `<div class="hint">${hint}</div>` : ''),
      [{ label: 'Cancel', value: null }, { label: 'OK', primary: true, onClick: (ctx) => ctx.close(input.value) }]);
    return r;
  }

  async function macroMultiDialog() {
    let ctxRef;
    openModal.onOpen = (ctx) => { ctxRef = ctx; };
    const r = await openModal('Run a Macro Multiple Times',
      `<div class="checks" style="flex-direction:column;align-items:flex-start;gap:10px">
        <label><input type="radio" name="mm" value="n" checked> Run <input type="number" id="mm-n" value="2" min="1" max="100000" style="width:90px;margin:0 6px"> times</label>
        <label><input type="radio" name="mm" value="eof"> Run until the end of file</label>
      </div>`,
      [{ label: 'Cancel', value: null }, {
        label: 'Run', primary: true,
        onClick: (ctx) => ctx.close({
          eof: ctx.box.querySelector('input[name=mm]:checked').value === 'eof',
          n: Math.max(1, parseInt(ctx.box.querySelector('#mm-n').value, 10) || 1),
        }),
      }]);
    void ctxRef;
    if (r) playMacro(r.n, r.eof);
  }

  async function markLinesDialog() {
    const q = await promptBox('Bookmark Lines', 'Bookmark all lines containing (case-insensitive):', selectedOrWord());
    if (!q || !activeTab) return;
    const m = model();
    const lines = new Set(bookmarkLines(activeTab));
    for (const f of m.findMatches(q, false, false, false, null, false)) lines.add(f.range.startLineNumber);
    setBookmarks(activeTab, [...lines]);
  }

  function selectedOrWord() {
    const m = model(); if (!m) return '';
    const sel = editor.getSelection();
    if (sel && !sel.isEmpty() && sel.startLineNumber === sel.endLineNumber) return m.getValueInRange(sel);
    const w = m.getWordAtPosition(editor.getPosition());
    return w ? w.word : '';
  }

  async function runDialog() {
    const vars = '$(FULL_CURRENT_PATH) $(CURRENT_DIRECTORY) $(FILE_NAME) $(NAME_PART) $(EXT_PART) $(CURRENT_WORD) $(CURRENT_LINE) $(CURRENT_COLUMN)';
    const cmdText = await promptBox('Run…', 'The program to run:', settings.lastRunCommand ||
      (isMac ? 'open -a Safari "$(FULL_CURRENT_PATH)"' : 'notepad "$(FULL_CURRENT_PATH)"'),
    `Runs through the system shell. Variables: <code>${escapeHtml(vars)}</code>`);
    if (!cmdText) return;
    settings.lastRunCommand = cmdText;
    saveSettings();
    const t = activeTab;
    const p = t && t.path ? t.path : '';
    const name = p ? basename(p) : (t ? t.title : '');
    const dot = name.lastIndexOf('.');
    const pos = editor.getPosition() || { lineNumber: 1, column: 1 };
    const map = {
      FULL_CURRENT_PATH: p, CURRENT_DIRECTORY: p ? dirname(p) : '', FILE_NAME: name,
      NAME_PART: dot > 0 ? name.slice(0, dot) : name, EXT_PART: dot > 0 ? name.slice(dot) : '',
      CURRENT_WORD: selectedOrWord(), CURRENT_LINE: String(pos.lineNumber), CURRENT_COLUMN: String(pos.column),
    };
    const expandedCmd = cmdText.replace(/\$\((\w+)\)/g, (m, k) => (k in map ? map[k] : m));
    api.send('run-command', expandedCmd, p ? dirname(p) : lastDir());
  }

  // ---- Find in Files / documents ----
  const fifState = { query: '', replace: '', filters: '*.*', dir: '', matchCase: false, wholeWord: false, regex: false, scope: 'dir' };

  function expandReplacement(rep, groups) {
    return rep.replace(/\$(\$|&|\d{1,2})|\\([nrt\\])/g, (m, g, esc) => {
      if (esc) return { n: '\n', r: '\r', t: '\t', '\\': '\\' }[esc];
      if (g === '$') return '$';
      if (g === '&') return groups[0];
      const i = parseInt(g, 10);
      return i < groups.length && groups[i] != null ? groups[i] : m;
    });
  }

  function searchModels(list, o) {
    const ws = o.wholeWord ? editor.getOption(monaco.editor.EditorOption.wordSeparators) : null;
    const results = [];
    let total = 0;
    for (const t of list) {
      let found;
      try { found = t.model.findMatches(o.query, false, o.regex, o.matchCase, ws, false, 20000); } catch (e) { return { error: e.message }; }
      if (!found.length) continue;
      const byLine = new Map();
      for (const f of found) {
        const r = f.range;
        if (!byLine.has(r.startLineNumber)) byLine.set(r.startLineNumber, []);
        const len = r.endLineNumber === r.startLineNumber ? r.endColumn - r.startColumn : t.model.getLineMaxColumn(r.startLineNumber) - r.startColumn;
        byLine.get(r.startLineNumber).push([r.startColumn - 1, len]);
      }
      const matches = [...byLine].map(([line, ranges]) => {
        const text = t.model.getLineContent(line);
        return { line, ranges, text: text.length > 500 ? text.slice(0, 500) : text };
      });
      total += found.length;
      results.push({ path: t.path, label: t.path || t.title, tabId: t.id, matches });
    }
    return { results, total };
  }

  function replaceInModels(list, o) {
    const ws = o.wholeWord ? editor.getOption(monaco.editor.EditorOption.wordSeparators) : null;
    let count = 0, docs = 0;
    for (const t of list) {
      if (t.readOnly) continue;
      const found = t.model.findMatches(o.query, false, o.regex, o.matchCase, ws, true);
      if (!found.length) continue;
      const edits = found.map((f) => ({ range: f.range, text: o.regex ? expandReplacement(o.replace, f.matches) : o.replace }));
      t.model.pushStackElement();
      t.model.pushEditOperations([], edits, () => null);
      t.model.pushStackElement();
      count += found.length; docs++;
    }
    return { count, docs };
  }

  function findDialog(dirArg) {
    fifState.query = selectedOrWord() || fifState.query;
    fifState.dir = typeof dirArg === 'string' ? dirArg : (fifState.dir || settings.workspace || lastDir());
    if (typeof dirArg === 'string') fifState.scope = 'dir';
    const chk = (k) => (fifState[k] ? 'checked' : '');
    const sel = (v) => (fifState.scope === v ? 'selected' : '');
    let busy = false;
    const read = (ctx) => {
      const b = ctx.box;
      Object.assign(fifState, {
        query: b.querySelector('#f-q').value, replace: b.querySelector('#f-r').value,
        filters: b.querySelector('#f-filter').value || '*.*', dir: b.querySelector('#f-dir').value,
        matchCase: b.querySelector('#f-case').checked, wholeWord: b.querySelector('#f-word').checked,
        regex: b.querySelector('#f-regex').checked, scope: b.querySelector('#f-scope').value,
      });
      return fifState;
    };
    const scopeTabs = (scope) => (scope === 'open' ? [...tabs] : activeTab ? [activeTab] : []);
    const doFind = async (ctx) => {
      if (busy) return;
      const o = read(ctx);
      if (!o.query) return;
      if (o.scope !== 'dir') {
        const res = searchModels(scopeTabs(o.scope), o);
        if (res.error) { ctx.status.textContent = res.error; return; }
        showResults(res, o);
        ctx.close(true);
        return;
      }
      if (!o.dir) { ctx.status.textContent = 'Choose a directory.'; return; }
      busy = true;
      ctx.status.textContent = 'Searching…';
      const res = await api.invoke('find-in-files', { ...o });
      busy = false;
      if (res.cancelled) return;
      if (res.error) { ctx.status.textContent = res.error; return; }
      showResults(res, o);
      ctx.close(true);
    };
    const doReplace = async (ctx) => {
      if (busy) return;
      const o = read(ctx);
      if (!o.query) return;
      if (o.scope !== 'dir') {
        const list = scopeTabs(o.scope);
        let r;
        try { r = replaceInModels(list, o); } catch (e) { ctx.status.textContent = e.message; return; }
        ctx.status.textContent = `${fmt(r.count)} occurrence(s) replaced in ${r.docs} document(s).`;
        return;
      }
      const ok = await message({
        type: 'warning', message: 'Replace in Files',
        detail: `Replace all occurrences of "${o.query}" with "${o.replace}" in all ${o.filters} files under:\n${o.dir}\n\nThis cannot be undone.`,
        buttons: ['Replace', 'Cancel'], defaultId: 1, cancelId: 1,
      });
      if (ok !== 0) return;
      busy = true;
      ctx.status.textContent = 'Replacing…';
      const r = await api.invoke('replace-in-files', { ...o });
      busy = false;
      if (r.error) { ctx.status.textContent = r.error; return; }
      ctx.status.textContent = `${fmt(r.replaced)} occurrence(s) replaced in ${fmt(r.filesChanged)} file(s).`;
      for (const p of r.changed) {
        const t = tabs.find((x) => x.path && samePath(x.path, p));
        if (t && !isDirty(t)) await reloadTab(t, { force: true });
      }
    };
    openModal('Find in Files', `
      <div class="row"><label for="f-q">Find what:</label><input id="f-q" type="text" spellcheck="false" value="${escapeHtml(fifState.query)}"><span></span></div>
      <div class="row"><label for="f-r">Replace with:</label><input id="f-r" type="text" spellcheck="false" value="${escapeHtml(fifState.replace)}"><span></span></div>
      <div class="row"><label for="f-scope">Search in:</label>
        <select id="f-scope">
          <option value="dir" ${sel('dir')}>Files in directory</option>
          <option value="open" ${sel('open')}>All opened documents</option>
          <option value="current" ${sel('current')}>Current document</option>
        </select><span></span></div>
      <div class="row dir-row"><label for="f-filter">Filters:</label><input id="f-filter" type="text" spellcheck="false" value="${escapeHtml(fifState.filters)}" placeholder="*.js *.ts !*.min.js"><span></span></div>
      <div class="row dir-row"><label for="f-dir">Directory:</label><input id="f-dir" type="text" spellcheck="false" value="${escapeHtml(fifState.dir)}"><button class="btn small" id="f-browse">…</button></div>
      <div class="checks">
        <label><input type="checkbox" id="f-case" ${chk('matchCase')}> Match case</label>
        <label><input type="checkbox" id="f-word" ${chk('wholeWord')}> Match whole word only</label>
        <label><input type="checkbox" id="f-regex" ${chk('regex')}> Regular expression</label>
      </div>
      <div class="hint">Filters: space-separated wildcards, prefix with ! to exclude. Folders .git and node_modules are skipped. In regex mode the replacement supports $1, $&amp;, \\n and \\t.</div>`,
    [
      { label: 'Close', value: null },
      { id: 'replace', label: 'Replace All', onClick: doReplace },
      { id: 'find', label: 'Find All', primary: true, onClick: doFind },
    ], { width: 600 });
    const box = modalStack[modalStack.length - 1].box;
    const syncScope = () => box.querySelectorAll('.dir-row').forEach((r) => { r.style.display = box.querySelector('#f-scope').value === 'dir' ? '' : 'none'; });
    box.querySelector('#f-scope').addEventListener('change', syncScope);
    syncScope();
    box.querySelector('#f-browse').addEventListener('click', async () => {
      const d = await api.invoke('dialog-open-folder', box.querySelector('#f-dir').value || lastDir());
      if (d) box.querySelector('#f-dir').value = d;
    });
  }

  // ---- Preferences ----
  function preferencesDialog() {
    const s = settings;
    const opt = (v, cur, label) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${label}</option>`;
    const cb = (id, v, label) => `<label><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${label}</label>`;
    openModal('Preferences', `
      <div class="row"><label>Theme</label><select id="p-theme">${opt('system', s.theme, 'Follow system')}${opt('light', s.theme, 'Light')}${opt('dark', s.theme, 'Dark')}</select><span></span></div>
      <div class="row"><label>Font family</label><input id="p-font" type="text" value="${escapeHtml(s.fontFamily)}"><span></span></div>
      <div class="row"><label>Font size</label><input id="p-size" type="number" min="6" max="72" value="${s.fontSize}"><span></span></div>
      <div class="row"><label>Tab size</label><input id="p-tab" type="number" min="1" max="16" value="${s.tabSize}"><span></span></div>
      <div class="row"><label>New document EOL</label><select id="p-eol">${opt('CRLF', s.defaultEol, 'Windows (CR LF)')}${opt('LF', s.defaultEol, 'Unix (LF)')}${opt('CR', s.defaultEol, 'Macintosh (CR)')}</select><span></span></div>
      <div class="row"><label>New doc encoding</label><select id="p-enc">${opt('utf8', s.defaultEncoding, 'UTF-8')}${opt('utf8bom', s.defaultEncoding, 'UTF-8-BOM')}${opt('windows1252', s.defaultEncoding, 'ANSI (Windows-1252)')}</select><span></span></div>
      <div class="checks">
        ${cb('p-spaces', s.insertSpaces, 'Replace tabs by spaces')}
        ${cb('p-brackets', s.autoCloseBrackets, 'Auto-close brackets and quotes')}
        ${cb('p-session', s.restoreSession, 'Remember open files and unsaved changes')}
        ${cb('p-detect', s.detectFileChanges, 'Detect file modifications by other programs')}
        ${cb('p-autoreload', s.autoReload, 'Reload unmodified files silently')}
        ${cb('p-line', s.highlightCurrentLine, 'Highlight current line')}
        ${cb('p-updates', s.checkForUpdates !== false, 'Check for updates automatically')}
      </div>`,
    [
      { label: 'Cancel', value: null },
      {
        label: 'Save', primary: true,
        onClick: (ctx) => {
          const b = ctx.box;
          const v = (id) => b.querySelector(id).value;
          const c = (id) => b.querySelector(id).checked;
          Object.assign(settings, {
            theme: v('#p-theme'),
            fontFamily: v('#p-font') || settings.fontFamily,
            fontSize: Math.max(6, Math.min(72, parseInt(v('#p-size'), 10) || 13)),
            tabSize: Math.max(1, Math.min(16, parseInt(v('#p-tab'), 10) || 4)),
            defaultEol: v('#p-eol'),
            defaultEncoding: v('#p-enc'),
            insertSpaces: c('#p-spaces'),
            autoCloseBrackets: c('#p-brackets'),
            restoreSession: c('#p-session'),
            detectFileChanges: c('#p-detect'),
            autoReload: c('#p-autoreload'),
            highlightCurrentLine: c('#p-line'),
            checkForUpdates: c('#p-updates'),
          });
          applyTheme();
          applyEditorOptions();
          saveSettings();
          syncWatch();
          ctx.close(true);
        },
      },
    ]);
  }

  // ---- Shortcuts ----
  function shortcutsDialog() {
    const M = isMac ? '⌘' : 'Ctrl+', SH = isMac ? '⇧' : 'Shift+', AL = isMac ? '⌥' : 'Alt+';
    const k = (mac, win) => (isMac ? mac : win);
    const groups = {
      File: [
        ['New', M + 'N'], ['Open', M + 'O'], ['Save', M + 'S'], ['Save As', k('⇧⌘S', 'Ctrl+Alt+S')], ['Save All', k('⌥⌘S', 'Ctrl+Shift+S')],
        ['Close', M + 'W'], ['Close All', SH + M + 'W'], ['Restore Closed File', SH + M + 'T'], ['Print', M + 'P'],
      ],
      Edit: [
        ['Undo / Redo', k('⌘Z / ⇧⌘Z', 'Ctrl+Z / Ctrl+Y')], ['Duplicate Line', M + 'D'], ['Delete Line', k('⇧⌘K', 'Ctrl+L')],
        ['Move Line Up / Down', k('⌥↑ / ⌥↓', 'Ctrl+Shift+↑ / ↓')], ['Join Lines', M + 'J'], ['UPPERCASE / lowercase', k('⇧⌘U / ⌘U', 'Ctrl+Shift+U / Ctrl+U')],
        ['Toggle Comment', k('⌘/', 'Ctrl+Q')], ['Block Comment', k('⇧⌥A', 'Ctrl+Shift+Q')],
        ['Column Selection', k('⇧⌥ + drag', 'Shift+Alt + drag')], ['Add Cursor', AL + 'Click'], ['Add Next Occurrence', M + 'E'],
        ['Select All Occurrences', SH + M + 'L'], ['Autocomplete', 'Ctrl+Space'],
      ],
      Search: [
        ['Find', M + 'F'], ['Replace', k('⌥⌘F', 'Ctrl+H')], ['Find in Files', SH + M + 'F'], ['Find Next / Previous', k('⌘G / ⇧⌘G', 'F3 / Shift+F3')],
        ['Go to Line', k('⌘L', 'Ctrl+G')], ['Matching Brace', k('⇧⌘\\', 'Ctrl+B')], ['Toggle Bookmark', M + 'F2'], ['Next / Previous Bookmark', 'F2 / Shift+F2'],
      ],
      View: [
        ['Word Wrap', AL + 'Z'], ['Zoom In / Out / Reset', `${M}= / ${M}- / ${M}0`], ['Fold All / Unfold All', `${AL}0 / ${SH}${AL}0`],
        ['Search Results Panel', 'F7'], ['Next / Previous Tab', k('Ctrl+Tab / ⌥⌘→', 'Ctrl+Tab / Ctrl+Shift+Tab')], ['Go to Tab 1–9', M + '1…9'],
        ['Command Palette', 'F1'], ['Toggle Dark / Light Mode', SH + M + 'D'],
      ],
      'Split View & Compare': [
        ['Move Tab to Other View', 'right-click tab, or drag it'], ['Focus on Another View', 'F8'],
        ['Compare Files', `${M}${AL}C`], ['Compare with Saved Version', `${M}${AL}D`],
        ['Next / Previous Difference', 'F8 / Shift+F8'], ['Close Compare', `${M}${AL}X`],
      ],
      Macro: [['Start Recording', SH + M + 'R'], ['Playback', SH + M + 'P'], ['Run', 'F5']],
    };
    let html = '<table class="kbd-table">';
    for (const [g, rows] of Object.entries(groups)) {
      html += `<tr><th colspan="2">${g}</th></tr>`;
      for (const [a, b] of rows) html += `<tr><td>${escapeHtml(a)}</td><td>${escapeHtml(b)}</td></tr>`;
    }
    html += '</table>';
    openModal('Keyboard Shortcuts', html, [{ label: 'Close', primary: true, value: null }], { width: 560 });
  }

  // -------------------------------------------------------------------------
  // Settings & session persistence
  // -------------------------------------------------------------------------
  function saveSettings() {
    const { windowBounds, ...rest } = settings; // window bounds are owned by the main process
    void windowBounds;
    api.send('save-settings', rest);
  }

  function buildSession() {
    if (activeTab && !activeTab.closed) activeTab.viewState = editor.saveViewState();
    const list = tabs.filter((t) => t.path || t.model.getValueLength() > 0 || isDirty(t));
    return {
      version: 1,
      activeIndex: Math.max(0, list.indexOf(activeTab)),
      tabs: list.map((t) => {
        const dirty = isDirty(t);
        return {
          path: t.path,
          untitled: t.untitled,
          title: t.title,
          text: dirty || !t.path ? t.model.getValue(monaco.editor.EndOfLinePreference.LF) : undefined,
          dirty,
          encoding: t.encoding,
          eol: t.eol,
          language: t.model.getLanguageId(),
          viewState: t.viewState,
          bookmarks: bookmarkLines(t),
          readOnly: t.readOnly,
          mtime: t.mtime,
          view: t.view,
          viewActive: views[t.view].active === t,
        };
      }),
    };
  }
  const scheduleSession = debounce(() => {
    if (settings.restoreSession) api.send('save-session', buildSession());
  }, 800);

  async function restoreSession(session) {
    if (!session || !Array.isArray(session.tabs)) return;
    let active = null;
    const viewActive = [null, null];
    for (let i = 0; i < session.tabs.length; i++) {
      const st = session.tabs[i];
      let t = null;
      if (st.path && !st.dirty) {
        const r = await api.invoke('read-file', st.path, st.encoding && !st.encoding.startsWith('utf') ? st.encoding : undefined);
        if (r.error) continue;
        t = createTab({ path: st.path, text: r.text, encoding: r.encoding, eol: r.eol || st.eol, mtime: r.mtime, language: st.language, atEnd: true, view: st.view === 1 ? 1 : 0 });
      } else if (typeof st.text === 'string') {
        t = createTab({
          path: st.path, untitled: st.untitled, text: st.text, encoding: st.encoding, eol: st.eol,
          language: st.language, mtime: st.mtime, dirty: !!st.dirty || (!st.path && st.text.length > 0), atEnd: true, view: st.view === 1 ? 1 : 0,
        });
        if (!st.path && st.title) t.title = st.title;
      }
      if (!t) continue;
      t.readOnly = !!st.readOnly;
      t.viewState = st.viewState || null;
      if (st.bookmarks && st.bookmarks.length) setBookmarks(t, st.bookmarks);
      if (i === session.activeIndex) active = t;
      if (st.viewActive) viewActive[t.view] = t;
    }
    for (const i of [0, 1]) {
      const a = viewActive[i] && viewActive[i].view === i ? viewActive[i] : viewTabs(i)[0];
      if (a) showInView(views[i], a);
    }
    if (tabs.length) activate(active || views[0].active || tabs[tabs.length - 1], false);
  }

  let allowClose = false;
  window.addEventListener('beforeunload', (e) => {
    if (allowClose) return;
    if (settings.restoreSession) { api.saveSessionSync(buildSession()); return; }
    if (tabs.some(isDirty)) {
      e.preventDefault();
      e.returnValue = false;
      setTimeout(async () => {
        for (const t of [...tabs]) { if (isDirty(t) && !(await closeTab(t, {}))) return; }
        allowClose = true;
        api.send('close-window');
      }, 0);
    }
  });

  // Drag & drop files / folders from Finder or Explorer
  window.addEventListener('dragover', (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
  }, true);
  window.addEventListener('drop', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    e.stopPropagation();
    const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean);
    openPaths(paths);
  }, true);

  // -------------------------------------------------------------------------
  // Startup
  // -------------------------------------------------------------------------
  applyLayout();
  if (settings.restoreSession && init.session) await restoreSession(init.session);
  if (init.openPaths && init.openPaths.length) await openPaths(init.openPaths);
  if (!tabs.length) newTab();
  else if (!activeTab) activate(tabs[0]);
  renderTabs();
  syncWatch();
  updateStatus();
  updateWindowState();
  $('#loading').remove();
  if (init.smoke) window.__np = { execute, tabs, editor, settings, state, bookmarkLines, get active() { return activeTab; }, get comparing() { return !!cmp; }, views, isDirty, monaco };
  editor.focus();
})().catch((err) => {
  console.error(err);
  const l = document.getElementById('loading');
  if (l) l.textContent = 'Failed to start: ' + (err && err.message ? err.message : err);
});
