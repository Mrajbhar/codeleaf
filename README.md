# Codeleaf

A fast, tabbed text and source code editor in the spirit of Notepad++. It runs natively on
**macOS (Apple Silicon and Intel)**, **Windows (x64 and ARM64)** and **Linux**, with the same
features everywhere.

**[⬇ Download the latest version](https://github.com/Mrajbhar/codeleaf/releases/latest)**

### Install on macOS (recommended)

Paste this into **Terminal**. It picks the right build for your Mac (Apple Silicon or Intel), checks
its SHA-512 checksum and installs it into Applications, with no security prompt:

```bash
curl -fsSL https://raw.githubusercontent.com/Mrajbhar/codeleaf/main/install.sh | bash
```

If you download the `.dmg` from the releases page instead, macOS may say it *"could not verify
Codeleaf is free of malware"*. That message appears for every app that isn't notarized by Apple, which
costs $99/year. To open it anyway: open Codeleaf once, then go to **System Settings → Privacy & Security**
and click **Open Anyway**. Updates after that install themselves without the prompt.

### Install on Windows / Linux

Download `Codeleaf-Setup-<version>.exe` (Windows) or the `.AppImage` (Linux) from the
[releases page](https://github.com/Mrajbhar/codeleaf/releases/latest). On Windows, SmartScreen may show
*"Windows protected your PC"*: click **More info → Run anyway**.

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

Installed copies check for updates once a day (Help → Check for Updates… checks now) and install
them with one click: Windows and Linux through electron-updater, macOS by downloading the new build,
checking its SHA-512 checksum and swapping it in on restart.

To remove the macOS security warning entirely, join the Apple Developer Program and add the secrets
listed in `.github/workflows/release.yml` to the repository; the next release is then signed and
notarized automatically.

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
- **Function List**: functions, classes and headings for 25+ languages, with a filter; click to jump
- **Markdown / HTML preview**: live, side by side, scrolls with the editor (⇧⌘V / Ctrl+Shift+V)
- **Go to File**: type part of a name to open any file in the workspace (⌥⌘P / Ctrl+Alt+P)
- **Mark with colours**: 5 highlight styles that follow your edits and survive restarts
- **Word count** in the status bar for the document or the selection
- **Developer tools**: coloured bracket pairs, sticky scroll, distraction-free mode, insert UUID or
  Unix timestamp, timestamp ↔ date conversion, MD5 / SHA-1 / SHA-256 / SHA-512 hashes
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
