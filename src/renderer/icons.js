'use strict';
// Simple original 16x16 line icons used by the toolbar.
(function () {
  const S = (body, extra = '') =>
    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;
  window.ICONS = {
    new: S('<path d="M4 1.5h5.5L12.5 4.5v10h-8.5z"/><path d="M9.5 1.5v3h3"/><path d="M8.5 8v5M6 10.5h5" stroke="#2f9e44"/>'),
    open: S('<path d="M1.5 4V13h11l2-6H4.2L2.5 13"/><path d="M1.5 4V2.5h4l1.3 1.5H12V7"/>', 'style="color:#c98a00"'),
    save: S('<path d="M2 2h9.5L14 4.5V14H2z"/><path d="M4.5 2v3.5h6V2"/><rect x="4.5" y="9" width="7" height="5"/>', 'style="color:#3477d9"'),
    saveAll: S('<path d="M4 4h8l2 2v8.5H4z"/><path d="M6 4v2.5h5V4"/><path d="M2 12V2h8"/>', 'style="color:#3477d9"'),
    close: S('<path d="M4 1.5h5.5L12.5 4.5v10h-8.5z"/><path d="M6.3 7.3l3.4 3.4M9.7 7.3l-3.4 3.4" stroke="#d93025"/>'),
    closeAll: S('<path d="M5 3.5h5.5l2.5 2.5v8.5H5z"/><path d="M3 12V1.5h6"/><path d="M7 8.3l3 3M10 8.3l-3 3" stroke="#d93025"/>'),
    print: S('<path d="M4 6V1.5h8V6"/><rect x="1.5" y="6" width="13" height="6" rx="1"/><path d="M4 10h8v4.5H4z"/>'),
    cut: S('<circle cx="4.5" cy="12" r="2"/><circle cx="11.5" cy="12" r="2"/><path d="M5.8 10.5L12 2M10.2 10.5L4 2"/>'),
    copy: S('<rect x="5" y="5" width="9" height="9.5" rx="1"/><path d="M11 5V2H2v9.5h3"/>'),
    paste: S('<path d="M5 2.5H3v12h10v-12h-2"/><rect x="5" y="1.5" width="6" height="2.5" rx=".6"/><path d="M5.5 8h5M5.5 11h3.5"/>'),
    undo: S('<path d="M5 3L2 6l3 3"/><path d="M2 6h7.5a4 4 0 0 1 0 8H6"/>'),
    redo: S('<path d="M11 3l3 3-3 3"/><path d="M14 6H6.5a4 4 0 0 0 0 8H10"/>'),
    find: S('<circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4.5 4.5"/>'),
    replace: S('<circle cx="5.5" cy="5.5" r="3.5"/><path d="M8 8l2.5 2.5"/><path d="M9.5 14.5h5M12 12v5" transform="translate(0,-2)"/>'),
    findFiles: S('<path d="M1.5 3.5V13h7"/><path d="M1.5 3.5V2h4l1.2 1.5H13V7"/><circle cx="11" cy="10.5" r="2.6"/><path d="M13 12.5l2 2"/>'),
    zoomIn: S('<circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4.5 4.5M4.5 6.5h4M6.5 4.5v4"/>'),
    zoomOut: S('<circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4.5 4.5M4.5 6.5h4"/>'),
    wrap: S('<path d="M2 3.5h12M2 8h10a2.2 2.2 0 0 1 0 4.5H8"/><path d="M9.5 11l-1.6 1.5L9.5 14"/><path d="M2 12.5h3.5"/>'),
    whitespace: S('<path d="M7 13.5V2.5h4M9.5 2.5v11"/><path d="M7 2.5a3 3 0 0 0 0 6"/>'),
    indentGuide: S('<path d="M3 2v12" stroke-dasharray="1.5 1.5"/><path d="M7 2v12" stroke-dasharray="1.5 1.5"/><path d="M10 4h4M10 8h4M10 12h4"/>'),
    lineNumbers: S('<path d="M2.5 3h1.5v4M2.5 7h3M2 9.5h3l-3 4h3"/><path d="M8 4h6M8 8h6M8 12h6"/>'),
    sidebar: S('<rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M6 2.5v11"/><path d="M3 5h1.5M3 7h1.5M3 9h1.5"/>'),
    minimap: S('<rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M10.5 2.5v11"/><path d="M3.5 5h5M3.5 7.5h4M3.5 10h5" /><rect x="11.5" y="4" width="2" height="3" fill="currentColor" stroke="none"/>'),
    record: S('<circle cx="8" cy="8" r="4.5" fill="currentColor"/>'),
    stop: S('<rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/>'),
    play: S('<path d="M5 3l8 5-8 5z" fill="currentColor"/>', 'style="color:#2f9e44"'),
    playMulti: S('<path d="M2 3l6 5-6 5z" fill="currentColor"/><path d="M8 3l6 5-6 5z" fill="currentColor"/>', 'style="color:#2f9e44"'),
    sun: `<svg viewBox="0 0 16 16" fill="none" stroke-linecap="round">
      <circle cx="8" cy="8" r="3.2" fill="#FDB813" stroke="#F59E0B" stroke-width="1"/>
      <g stroke="#F59E0B" stroke-width="1.4">
        <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/>
      </g></svg>`,
    moon: `<svg viewBox="0 0 16 16" fill="none">
      <path d="M13.6 10.3A6 6 0 0 1 5.7 2.4a6 6 0 1 0 7.9 7.9z" fill="#6D5BD0" stroke="#5646B8" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M11.6 2.2l.35.9.9.35-.9.35-.35.9-.35-.9-.9-.35.9-.35z" fill="#8B7CF0"/>
      <circle cx="14" cy="5.6" r=".6" fill="#8B7CF0"/></svg>`,
    disk: S('<path d="M2 2h9.5L14 4.5V14H2z" fill="currentColor" fill-opacity=".15"/><path d="M4.5 2v3.5h6V2"/><rect x="4.5" y="9" width="7" height="5"/>'),
  };
})();
