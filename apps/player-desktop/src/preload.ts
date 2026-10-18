/**
 * Company: EonHive Inc. | Title: Desktop Shell Bridge
 * Purpose: Expose fixed host actions only to the bundled shell, never to experience web contents.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  open: () => ipcRenderer.invoke('player:open'),
  drop: (file: File) => ipcRenderer.invoke('player:drop', webUtils.getPathForFile(file)),
  control: (action: string) => ipcRenderer.invoke('player:control', action),
  ready: () => ipcRenderer.invoke('player:ready'),
  onState: (listener: (state: unknown) => void) => {
    const receive = (_event: unknown, state: unknown) => listener(state);
    ipcRenderer.on('player:state', receive);
    return () => ipcRenderer.removeListener('player:state', receive);
  },
});
