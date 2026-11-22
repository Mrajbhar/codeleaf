'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const INVOKE = new Set([
  'init', 'dialog-open', 'dialog-open-folder', 'dialog-save', 'message', 'read-file', 'write-file',
  'rename-file', 'file-exists', 'readdir', 'find-in-files', 'replace-in-files', 'print', 'popup-menu',
  'list-files', 'hash',
]);
const SEND = new Set([
  'languages', 'editor-state', 'save-session', 'save-settings', 'watch-files', 'add-recent', 'reveal',
  'open-external', 'open-path', 'clipboard-write', 'open-terminal', 'run-command', 'window-state',
  'close-window', 'cancel-find', 'edit-role',
]);
const ON = new Set(['menu', 'open-paths', 'file-changed']);

contextBridge.exposeInMainWorld('api', {
  invoke: (ch, ...args) => {
    if (!INVOKE.has(ch)) throw new Error('Blocked channel ' + ch);
    return ipcRenderer.invoke(ch, ...args);
  },
  send: (ch, ...args) => {
    if (!SEND.has(ch)) throw new Error('Blocked channel ' + ch);
    ipcRenderer.send(ch, ...args);
  },
  on: (ch, fn) => {
    if (!ON.has(ch)) throw new Error('Blocked channel ' + ch);
    ipcRenderer.on(ch, (e, ...args) => fn(...args));
  },
  saveSessionSync: (session) => ipcRenderer.sendSync('save-session-sync', session),
  pathForFile: (file) => webUtils.getPathForFile(file),
});
