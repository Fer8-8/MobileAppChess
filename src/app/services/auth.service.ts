import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, defer, firstValueFrom, map, of, tap, throwError, timeout } from 'rxjs';
import { ConnectivityService } from './connectivity.service';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  user_id: number;
}

interface PendingProfile {
  name: string;
  email: string;
  blocked?: string;
}

interface ProfileResponse {
  queued?: boolean;
  success: boolean;
  message?: string;
  user: AuthUser;
}

export interface ProfileChanges {
  name: string;
  email: string;
  password?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(ConnectivityService);
  readonly pending = signal(false);
  readonly syncing = signal(false);
  readonly deleting = signal(false);
  readonly syncError = signal('');
  private profileRevision = 0;

  constructor() {
    this.refreshPending();
    effect(() => {
      if (this.connection.online()) untracked(() => void this.syncPending());
    });
    const timer = window.setInterval(() => void this.syncPending(), 30000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(timer));
  }

  // En Android/iOS físico, NO uses localhost.
  // Usa la IP LAN de la PC donde corre XAMPP, por ejemplo:
  // http://192.168.1.100/app_api
  private readonly API_URL = environment.apiUrl;

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.API_URL}/login.php`, {
        email,
        password,
      })
      .pipe(
        timeout(15000),
        tap((response) => {
          localStorage.setItem('auth_token', response.token);
          this.storeUser(response.user);
          this.refreshPending();
          void this.syncPending();
        })
      );
  }

  register(name: string, email: string, password: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.API_URL}/create_user.php`, {
      name,
      email,
      password,
    }).pipe(timeout(15000));
  }

  getProfile(): Observable<ProfileResponse> {
    const cached = this.getUser();
    if (!this.connection.online() && cached) return of({ success: true, user: cached });
    const token = this.getToken();
    const revision = this.profileRevision;
    return this.http.get<ProfileResponse>(`${this.API_URL}/profile.php`).pipe(
      timeout(15000),
      map(response => {
        if (this.getToken() === token && revision === this.profileRevision) this.storeUser(response.user);
        return { ...response, user: this.getUser() ?? response.user };
      }),
      catchError(error => cached && (error.status === 0 || error.status >= 500 || error.name === 'TimeoutError')
        ? of({ success: true, user: this.getUser() ?? cached })
        : throwError(() => error))
    );
  }

  updateProfile(changes: ProfileChanges): Observable<ProfileResponse> {
    return defer(async () => {
      const user = this.getUser();
      if (!user) throw new Error('Inicia sesión para guardar cambios.');
      if (this.deleting()) throw new Error('La cuenta se está eliminando.');
      if (this.syncing()) throw new Error('Espera a que termine la sincronización.');
      if (changes.password) {
        if (!this.connection.online() || this.pending()) {
          throw new Error('Sincroniza tus datos y conéctate antes de cambiar la contraseña.');
        }
        const token = this.getToken();
        const response = await firstValueFrom(this.http.put<ProfileResponse>(`${this.API_URL}/profile.php`, changes).pipe(timeout(15000)));
        if (this.getToken() === token) this.storeUser(response.user);
        return response;
      }
      // Persist before sending. Passwords are never part of the outbox.
      localStorage.setItem(this.pendingKey(user.id), JSON.stringify({ name: changes.name, email: changes.email }));
      this.profileRevision++;
      this.refreshPending();
      await this.syncPending();
      return { success: true, user: this.getUser() ?? user, queued: this.pending() };
    });
  }

  async syncPending(manual = false): Promise<void> {
    const user = this.getUser();
    const token = this.getToken();
    if (!user || !token || !this.connection.online() || this.syncing() || this.deleting()) return;
    const pending = this.readPending(user.id);
    if (!pending || (pending.blocked && !manual)) return;
    this.syncing.set(true);
    this.syncError.set('');
    try {
      const response = await firstValueFrom(this.http.put<ProfileResponse>(`${this.API_URL}/profile.php`, {
        name: pending.name, email: pending.email,
      }).pipe(timeout(15000)));
      if (this.getToken() !== token) return;
      this.storeUser(response.user);
      localStorage.removeItem(this.pendingKey(user.id));
      this.refreshPending();
    } catch (error: unknown) {
      if (this.getToken() !== token) return;
      const failure = error as { status?: number; error?: { message?: string } };
      const blocked = !!failure.status && failure.status >= 400 && failure.status < 500 && failure.status !== 408 && failure.status !== 429;
      const message = blocked
        ? failure.error?.message || 'Revisa tus datos o vuelve a iniciar sesión para sincronizar.'
        : 'Cambios guardados en este dispositivo. Reintentaremos al recuperar el servicio.';
      if (blocked) {
        try { localStorage.setItem(this.pendingKey(user.id), JSON.stringify({ ...pending, blocked: message })); } catch { /* Original pending data remains. */ }
      }
      this.syncError.set(message);
    } finally {
      this.syncing.set(false);
    }
  }

  private pendingKey(id: number): string { return `outplay:pending-profile:${id}`; }

  private readPending(id: number): PendingProfile | null {
    try {
      const value = JSON.parse(localStorage.getItem(this.pendingKey(id)) || 'null');
      return value && typeof value.name === 'string' && typeof value.email === 'string' ? value : null;
    } catch { return null; }
  }

  private refreshPending(): void {
    const user = this.getUser();
    const pending = user ? this.readPending(user.id) : null;
    this.pending.set(!!pending);
    this.syncError.set(pending?.blocked || '');
  }

  deleteAccount(): Observable<void> {
    return defer(async () => {
      const user = this.getUser();
      const token = this.getToken();
      if (!user || !token) throw new Error('Inicia sesión para eliminar tu cuenta.');
      if (!this.connection.online()) throw new Error('Conéctate a internet para eliminar tu cuenta.');
      if (this.syncing() || this.deleting()) throw new Error('Espera a que termine la operación actual.');
      this.deleting.set(true);
      try {
        const response = await firstValueFrom(this.http.delete<{ success: boolean }>(`${this.API_URL}/profile.php`).pipe(timeout(15000)));
        if (!response.success) throw new Error('No se pudo eliminar la cuenta.');
        localStorage.removeItem(this.pendingKey(user.id));
        if (this.getToken() === token) this.logout();
      } finally {
        this.deleting.set(false);
      }
    });
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this.pending.set(false);
    this.syncError.set('');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getUser(): AuthUser | null {
    const value = localStorage.getItem('auth_user');
    if (!value) {
      return null;
    }

    try {
      const user = JSON.parse(value) as AuthUser;
      const pending = this.readPending(user.id);
      return pending ? { ...user, name: pending.name, email: pending.email } : user;
    } catch {
      localStorage.removeItem('auth_user');
      return null;
    }
  }

  private storeUser(user: AuthUser): void {
    localStorage.setItem('auth_user', JSON.stringify(user));
    this.profileRevision++;
  }
}
