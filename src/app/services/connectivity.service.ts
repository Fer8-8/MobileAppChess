import { DestroyRef, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly online = signal(navigator.onLine);

  constructor() {
    const update = () => this.online.set(navigator.onLine);
    const connected = () => this.online.set(true);
    const disconnected = () => this.online.set(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    window.addEventListener('focus', update);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('focus', update);
    });
  }
}
