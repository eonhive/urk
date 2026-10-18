/**
 * Company: EonHive Inc. | Title: Desktop Shell Controls
 * Purpose: Translate user gestures into the small native host API and show package status.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
type State = { phase: string; message: string; progress: number; active: boolean; paused: boolean; manifest?: { name: string; version: string; type: string } };
declare global {
  interface Window {
    desktop: {
      open(): Promise<void>; drop(file: File): Promise<void>; control(action: string): Promise<void>;
      ready(): Promise<void>; onState(listener: (state: State) => void): () => void;
    };
  }
}
const status = document.querySelector<HTMLElement>('#status')!;
const progress = document.querySelector<HTMLProgressElement>('#progress')!;
const open = document.querySelector<HTMLButtonElement>('#open')!;
const pause = document.querySelector<HTMLButtonElement>('[data-action="pause"]')!;

function perform(task: Promise<void>): void {
  void task.catch(error => { status.textContent = `Could not complete action: ${String(error)}`; });
}
open.addEventListener('click', () => perform(window.desktop.open()));
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
  button.addEventListener('click', () => perform(window.desktop.control(button.dataset.action!)));
});
window.desktop.onState(state => {
  document.body.dataset.phase = state.phase;
  status.textContent = state.message;
  status.title = state.message;
  progress.hidden = state.phase !== 'loading';
  progress.value = state.progress;
  open.disabled = state.phase === 'loading';
  document.querySelectorAll<HTMLButtonElement>('[data-action]:not([data-action="fullscreen"])').forEach(button => {
    button.disabled = !state.active || state.phase === 'loading';
  });
  pause.textContent = state.paused ? 'Resume' : 'Pause';
  document.querySelector('h1')!.textContent = state.paused ? 'Experience paused.' : 'Bring your experience.';
  document.querySelector('#drop-zone p')!.textContent = state.paused ? 'Choose Resume to continue, or Restart to begin again.' : 'Drop a .urkpkg file into this window.';
  const metadata = document.querySelector('#metadata')!;
  metadata.textContent = state.manifest ? `${state.manifest.name} · ${state.manifest.version} · ${state.manifest.type}` : 'Portable experiences · offline playback';
});
document.addEventListener('dragover', event => { event.preventDefault(); document.body.classList.add('dragging'); });
document.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
document.addEventListener('drop', event => {
  event.preventDefault();
  document.body.classList.remove('dragging');
  const files = event.dataTransfer?.files;
  if (files?.length === 1) perform(window.desktop.drop(files[0]));
  else status.textContent = 'Drop one .urkpkg file at a time.';
});
perform(window.desktop.ready());
export {};
