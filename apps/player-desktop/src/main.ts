/**
 * Company: EonHive Inc. | Title: uRK Desktop Player
 * Purpose: Host the existing Web Player in sandboxed, bridge-free web contents with native package controls.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, session, WebContentsView, type IpcMainInvokeEvent, type Session, type WebContents } from 'electron';
import { join } from 'node:path';
import { mkdir, realpath, rm } from 'node:fs/promises';
import { contentPolicy, localResponse, packageOrigin, PLAYER_ORIGIN, SHELL_ORIGIN } from './local-content';
import { preparePackage, releasePackage, type OpenPackage } from './package-store';

app.setName('uRK Player');
app.enableSandbox();
const shellURL = `${SHELL_ORIGIN}/index.html`;
let window: BrowserWindow;
let viewport: WebContentsView | undefined;
let current: OpenPackage | undefined;
let temporaryRoot: string;
let opening = false;
let paused = false;
let quitting = false;
let pendingPath = process.argv.find(argument => argument.toLowerCase().endsWith('.urkpkg'));
let state = { phase: 'idle', message: 'Drop a .urkpkg here, or choose Open Package.', progress: 0 };
let openTask: Promise<void> = Promise.resolve();

function publish(phase: string, message: string, progress = 0): void {
  state = { phase, message, progress };
  if (!window?.isDestroyed()) window?.webContents.send('player:state', {
    ...state, manifest: current?.manifest, active: Boolean(viewport), paused,
  });
}

function failure(error: unknown): void {
  publish('error', `${error instanceof Error ? error.message : String(error)} Try another package or rebuild it with relative asset paths.`);
}

function lockSession(target: Session, origins: string[]): void {
  const allowed = new Set(origins);
  target.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    // Protocol handlers own HTTPS. Everything else, including file/http/ws, is unavailable.
    callback({ cancel: !allowed.has(url.origin) && !['data:', 'blob:'].includes(url.protocol) });
  });
  target.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'fullscreen' || permission === 'pointerLock');
  });
  target.setPermissionCheckHandler((_contents, permission) => permission === 'fullscreen' || permission === 'pointerLock');
  target.setDevicePermissionHandler(() => false);
  target.removeAllListeners('will-download');
  target.on('will-download', event => event.preventDefault());
}

function lockContents(contents: WebContents, host: string, experience?: string): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.on('will-navigate', event => event.preventDefault());
  contents.on('will-frame-navigate', event => {
    // A package may navigate within its own origin, but never onto either host origin.
    if (event.isMainFrame || !experience || new URL(event.url).origin !== experience) event.preventDefault();
  });
  contents.on('will-redirect', event => event.preventDefault());
  contents.on('will-prevent-unload', event => event.preventDefault());
  contents.on('select-bluetooth-device', (event, _devices, callback) => { event.preventDefault(); callback(''); });
  contents.on('render-process-gone', (_event, details) => failure(new Error(`Experience stopped (${details.reason}). Use Restart to recover.`)));
  contents.on('did-fail-load', (_event, code, message, url) => {
    if (code !== -3) failure(new Error(`Could not load ${url.startsWith(host) ? 'Player' : 'experience'}: ${message}`));
  });
}

function layout(): void {
  if (!viewport || window.isDestroyed()) return;
  const [width, height] = window.getContentSize();
  viewport.setBounds({ x: 0, y: 156, width, height: Math.max(0, height - 156) });
}

async function disposeExperience(): Promise<void> {
  const previous = current;
  current = undefined;
  paused = false;
  if (viewport) {
    const contents = viewport.webContents;
    const target = contents.session;
    window.contentView.removeChildView(viewport);
    viewport = undefined;
    contents.close({ waitForBeforeUnload: false });
    target.protocol.unhandle('https');
    target.flushStorageData();
  }
  if (previous) await releasePackage(previous);
}

async function loadPackage(path: string): Promise<void> {
  let prepared: OpenPackage | undefined;
  try {
    publish('loading', 'Copying, validating checksums, and extracting package…', 15);
    prepared = await preparePackage(path, temporaryRoot);
    if (quitting) { await releasePackage(prepared); return; }
    publish('loading', 'Package validated. Opening isolated viewport…', 75);
    await disposeExperience();
    current = prepared;
    prepared = undefined;
    const data = current;
    const origin = packageOrigin(data.digest);
    const target = session.fromPartition(`persist:experience-${data.digest}`, { cache: false });
    lockSession(target, [PLAYER_ORIGIN, origin]);
    // A dead local proxy also prevents WebRTC from bypassing the offline content policy.
    await target.setProxy({ mode: 'fixed_servers', proxyRules: 'http=127.0.0.1:9;https=127.0.0.1:9', proxyBypassRules: '<-loopback>' });
    target.protocol.handle('https', async request => {
      const address = new URL(request.url);
      if (address.origin === PLAYER_ORIGIN) return localResponse(request, join(__dirname, 'player'), contentPolicy(origin));
      if (address.origin !== origin) return new Response('Network access is disabled.', { status: 403 });
      const response = await localResponse(request, data.directory, contentPolicy());
      if (response.status >= 400 && current === data) failure(new Error(`Package asset ${address.pathname}: HTTP ${response.status}.`));
      return response;
    });
    viewport = new WebContentsView({ webPreferences: {
      session: target, sandbox: true, contextIsolation: true, nodeIntegration: false,
      nodeIntegrationInSubFrames: false, nodeIntegrationInWorker: false, webviewTag: false,
      webSecurity: true, allowRunningInsecureContent: false, navigateOnDragDrop: false,
      backgroundThrottling: true, autoplayPolicy: 'document-user-activation-required',
    } });
    lockContents(viewport.webContents, PLAYER_ORIGIN, origin);
    window.contentView.addChildView(viewport);
    layout();
    publish('loading', 'Loading compiled experience…', 90);
    await viewport.webContents.loadURL(`${PLAYER_ORIGIN}/index.html?src=${encodeURIComponent(`${origin}/${data.manifest.entrypoint}`)}`);
    if (state.phase !== 'error') publish('playing', 'Ready. Click inside to play. Packages run offline.', 100);
    app.addRecentDocument(path);
  } catch (error) {
    if (prepared) await releasePackage(prepared);
    failure(error);
  } finally { opening = false; }
}

function openPackage(path: string): Promise<void> {
  if (opening) { publish('loading', 'Finish opening the current package before choosing another.', state.progress); return openTask; }
  opening = true;
  openTask = loadPackage(path);
  return openTask;
}

async function choosePackage(): Promise<void> {
  if (opening) return;
  const result = await dialog.showOpenDialog(window, { title: 'Open uRK Package', properties: ['openFile'], filters: [{ name: 'uRK Package', extensions: ['urkpkg'] }] });
  if (!result.canceled && result.filePaths[0]) await openPackage(result.filePaths[0]);
}

async function control(action: string): Promise<void> {
  if (action === 'fullscreen') { window.setFullScreen(!window.isFullScreen()); return; }
  if (opening || !viewport) return;
  if (action === 'unload') { await disposeExperience(); publish('idle', 'Package closed. Drop another package to play.'); return; }
  const contents = viewport.webContents;
  if (action === 'pause') {
    // Pause this renderer's JavaScript, not the application's kernel. Hide input and mute native media.
    if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
    await contents.debugger.sendCommand('Debugger.enable');
    await contents.debugger.sendCommand(paused ? 'Debugger.resume' : 'Debugger.pause');
    paused = !paused;
    contents.setAudioMuted(paused);
    viewport.setVisible(!paused);
    publish(paused ? 'paused' : 'playing', paused ? 'Paused. Scripts are suspended and audio is muted; media time may advance.' : 'Resumed. Click inside to play.', 100);
  } else if (action === 'restart') {
    if (paused) await control('pause');
    await contents.executeJavaScript('document.querySelector("urk-player").reload()');
    publish('playing', 'Restarted. Saved browser data is retained.', 100);
  }
}

function fromShell(event: IpcMainInvokeEvent): void {
  if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== shellURL) {
    throw new Error('Only the bundled desktop shell can request native actions.');
  }
}

async function createWindow(): Promise<void> {
  const shellSession = session.fromPartition('desktop-shell');
  lockSession(shellSession, [SHELL_ORIGIN]);
  shellSession.protocol.handle('https', request => new URL(request.url).origin === SHELL_ORIGIN
    ? localResponse(request, join(__dirname, 'shell'), contentPolicy())
    : new Response('Blocked.', { status: 403 }));
  window = new BrowserWindow({ width: 1200, height: 900, minWidth: 720, minHeight: 540, title: 'uRK Player', backgroundColor: '#10151f', webPreferences: {
    session: shellSession, preload: join(__dirname, 'preload.cjs'), sandbox: true,
    contextIsolation: true, nodeIntegration: false, webviewTag: false, navigateOnDragDrop: false,
  } });
  lockContents(window.webContents, SHELL_ORIGIN);
  window.on('resize', layout);
  window.on('close', event => { if (!quitting) { event.preventDefault(); app.quit(); } });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'File', submenu: [{ label: 'Open Package…', accelerator: 'CmdOrCtrl+O', click: () => { void choosePackage(); } }, { role: 'close' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }] },
  ]));
  for (const channel of ['open', 'drop', 'control', 'ready']) {
    ipcMain.handle(`player:${channel}`, async (event, argument) => {
      fromShell(event);
      try {
        if (channel === 'open') await choosePackage();
        if (channel === 'drop') {
          if (typeof argument !== 'string' || !argument || argument.length > 4096) throw new Error('Drop a file from Finder.');
          await openPackage(argument);
        }
        if (channel === 'control') {
          if (!['pause', 'restart', 'unload', 'fullscreen'].includes(argument)) throw new Error('Unknown Player action.');
          await control(argument);
        }
        if (channel === 'ready') publish(state.phase, state.message, state.progress);
      } catch (error) { failure(error); }
    });
  }
  await window.loadURL(shellURL);
  if (pendingPath) { const path = pendingPath; pendingPath = undefined; await openPackage(path); }
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on('open-file', (event, path) => {
    event.preventDefault();
    if (window && temporaryRoot) { window.show(); window.focus(); void openPackage(path); }
    else pendingPath = path;
  });
  app.on('second-instance', (_event, argv) => {
    window?.show(); window?.focus();
    const path = argv.find(argument => argument.toLowerCase().endsWith('.urkpkg'));
    if (path) void openPackage(path);
  });
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    void (async () => {
      await openTask;
      await disposeExperience();
      if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
      app.quit();
    })().catch(error => { console.error(error); app.exit(1); });
  });
  void app.whenReady().then(async () => {
    const data = app.getPath('userData');
    await mkdir(data, { recursive: true });
    temporaryRoot = join(await realpath(data), 'Extracted');
    // This private scratch directory contains no saves; remove abandoned crash leftovers on launch.
    await rm(temporaryRoot, { recursive: true, force: true });
    await createWindow();
  }).catch(error => { console.error(error); app.exit(1); });
}
