# Codeleaf

A fast, tabbed text and source code editor in the spirit of Notepad++. It runs natively on
**macOS (Apple Silicon and Intel)**, **Windows (x64 and ARM64)** and **Linux**, with the same
features everywhere.

**[⬇ Download the latest version](https://github.com/Mrajbhar/codeleaf/releases/latest)**

Built with Electron and the Monaco editor engine.

## Run from source

```bash
npm install
npm start
```

> When you launch from a VS Code terminal, run `unset ELECTRON_RUN_AS_NODE` first.
> VS Code sets that variable, and it stops Electron from starting.

## Build installers

| Command | Output (in `dist/`) |
| --- | --- |
| `npm run dist:mac` | `Codeleaf-<version>-arm64.dmg` (Apple Silicon) and `-x64.dmg` (Intel) |
| `npm run dist:win` | `Codeleaf-Setup-<version>.exe` (one installer for x64 and ARM64) |
| `npm run dist:linux` | `Codeleaf-<version>-x86_64.AppImage` |

## Releasing a new version

GitHub Actions builds every platform and publishes the release:

```bash
npm version 1.0.2 --no-git-tag-version   # bump the version
git commit -am "Release 1.0.2"
git tag v1.0.2
git push && git push --tags
```

Installed copies check for updates once a day (Help → Check for Updates… checks now). Windows and
Linux download and install updates themselves. On macOS, the app offers to download the new
version, because unsigned Mac apps can't replace themselves.

The Mac app is ad-hoc signed. If you copy it to another Mac, right-click it and choose **Open** the
first time. The Windows installer is unsigned, so SmartScreen shows **More info → Run anyway** the
first time.

## Features

- **Tabs**: reorder by dragging, middle-click to close, double-click the empty bar for a new tab,
  restore recently closed files, and sort tabs
- **Session**: open files *and unsaved changes* are kept between launches, as in Notepad++
- **Syntax highlighting** for 80+ languages (Language menu or the status bar), with code folding
- **Search**: find and replace (regex, match case, whole word), Find in Files and Replace in Files
  with a results panel (F7), search all open documents, and mark lines
- **Bookmarks**: toggle, next/previous, copy, remove bookmarked or unmarked lines, inverse
- **Line operations**: duplicate, delete, move, join, sort (text, case-insensitive, numeric,
  length), remove duplicate or empty lines, reverse, shuffle
- **Blank operations**: trim leading or trailing spaces, EOL to space, TAB ↔ space
- **Case**: UPPER, lower, Proper, Sentence, iNVERT, snake, kebab
- **Encode / Decode**: Base64, URL, HTML, JSON pretty-print and minify
- **Encodings**: UTF-8, UTF-8-BOM, UTF-16 LE/BE, ANSI and 20+ character sets (convert or reopen with)
- **End of line**: Windows (CR LF), Unix (LF), Macintosh (CR)
- **Macros**: record, playback, and run N times or until end of file
- **Split view**: two views side by side, like Notepad++. Right-click a tab → *Move to Other
  View*, or drag it to the other tab bar; F8 switches between views
- **Compare** (Plugins → Compare): side-by-side or inline diff of two files, or of a file against
  its saved version, with next/previous difference (F8 / Shift+F8)
- **Folder as Workspace** sidebar, Document Map (minimap), column / multi-cursor editing
- **Detects changes from other programs**, plus read-only mode, zoom and print
- **Run** menu with `$(FULL_CURRENT_PATH)`-style variables; launch in browser; open in Terminal or Finder/Explorer
- Light and dark themes (or follow the system), a Preferences dialog, and a Notepad++-style status bar
- **Crash-safe**: unsaved text is backed up within a second of every change
- **Automatic updates** from GitHub Releases

Keyboard shortcuts are listed under **Help → Keyboard Shortcuts**. On Windows they match Notepad++
(Ctrl+D, Ctrl+L, Ctrl+Q, Ctrl+H, F3, Ctrl+F2…). On macOS they use the standard ⌘ equivalents.

## Project layout

```
src/main.js            Main process: windows, menus, file I/O, encodings, watching, find-in-files
src/preload.js         Safe IPC bridge
src/renderer/          UI: app.js (editor logic), styles.css, icons.js, index.html
build/                 App icon and the macOS ad-hoc signing hook
```
