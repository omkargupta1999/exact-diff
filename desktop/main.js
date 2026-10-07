// Exact Diff — desktop shell.
// Wraps app/index.html (the same single-file tool) in a locked-down Electron window:
// no Node.js in the page, no network access, no navigation away from the app.
'use strict';
const { app, BrowserWindow, session, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Files passed on the command line: first = left, second = right.
function filesFromArgs(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-'));
  const out = [];
  for (const a of args) {
    const p = path.resolve(a);
    try {
      if (fs.statSync(p).isFile()) out.push(p);
    } catch (e) { /* not a file: ignore */ }
    if (out.length === 2) break;
  }
  return out;
}

function createWindow(paths) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 760,
    minHeight: 480,
    title: 'Exact Diff',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // page cannot reach Electron or Node internals
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  // Keep the window on the app: block navigation and pop-ups.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  // The only external link (Help > About) opens the project page in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/github\.com\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  if (paths.length) {
    win.webContents.once('did-finish-load', () => {
      const files = paths.map((p, i) => ({ side: i === 0 ? 'left' : 'right', name: path.basename(p), data: fs.readFileSync(p) }));
      win.webContents.send('open-files', files);
    });
  }
  return win;
}

app.whenReady().then(() => {
  // Defence in depth on top of the page's Content-Security-Policy: cancel every network request.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*'] },
    (details, cb) => cb({ cancel: true }));
  // Only clipboard access is ever granted (used by Paste and Copy diff summary).
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'clipboard-read' || permission === 'clipboard-sanitized-write'));

  // Minimal native menu so standard shortcuts (copy, paste, zoom, reload) keep working.
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] }
  ]));

  createWindow(filesFromArgs(process.argv));
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow([]); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
// Never embed other web content.
app.on('web-contents-created', (e, wc) => { wc.on('will-attach-webview', (ev) => ev.preventDefault()); });
