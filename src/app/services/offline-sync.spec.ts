import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';
import { ChessEventsService } from './chess-events.service';

describe('Offline persistence and synchronization', () => {
  let http: HttpTestingController;
  let connection: ConnectivityService;
  const user = { id: 900001, name: 'Original', email: 'original@example.com' };
  const pendingKey = `outplay:pending-profile:${user.id}`;
  let savedStorage: Record<string, string>;

  beforeEach(() => {
    savedStorage = {};
    for (const key of Object.keys(localStorage)) savedStorage[key] = localStorage.getItem(key)!;
    localStorage.clear();
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('auth_user', JSON.stringify(user));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    connection = TestBed.inject(ConnectivityService);
    connection.online.set(false);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
    for (const [key, value] of Object.entries(savedStorage)) localStorage.setItem(key, value);
  });

  it('deletes the remote account before clearing session and pending edits', async () => {
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.updateProfile({ name: 'Pending', email: user.email }));
    connection.online.set(true);
    const deletion = firstValueFrom(auth.deleteAccount());
    expect(auth.isLoggedIn()).toBeTrue();
    await auth.syncPending();
    http.expectNone(req => req.method === 'PUT');
    http.expectOne(req => req.method === 'DELETE' && req.url.endsWith('/profile.php'))
      .flush({ success: true });
    await deletion;
    expect(auth.getUser()).toBeNull();
    expect(auth.getToken()).toBeNull();
    expect(localStorage.getItem(pendingKey)).toBeNull();
    expect(auth.deleting()).toBeFalse();
  });

  it('preserves the account and pending edits if remote deletion fails', async () => {
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.updateProfile({ name: 'Pending', email: user.email }));
    connection.online.set(true);
    const deletion = firstValueFrom(auth.deleteAccount());
    const rejected = expectAsync(deletion).toBeRejected();
    http.expectOne(req => req.method === 'DELETE').flush({}, { status: 503, statusText: 'Unavailable' });
    await rejected;
    expect(auth.isLoggedIn()).toBeTrue();
    expect(auth.pending()).toBeTrue();
    expect(auth.deleting()).toBeFalse();
  });

  it('does not queue account deletion while offline', async () => {
    const auth = TestBed.inject(AuthService);
    await expectAsync(firstValueFrom(auth.deleteAccount())).toBeRejected();
    http.expectNone(req => req.method === 'DELETE');
    expect(auth.isLoggedIn()).toBeTrue();
  });

  it('persists offline edits and sends them automatically on reconnect', async () => {
    const auth = TestBed.inject(AuthService);
    const result = await firstValueFrom(auth.updateProfile({ name: 'Offline edit', email: user.email }));
    expect(result.queued).toBeTrue();
    expect(JSON.parse(localStorage.getItem(pendingKey)!).name).toBe('Offline edit');
    connection.online.set(true);
    TestBed.tick();
    const request = http.expectOne(req => req.method === 'PUT');
    expect(request.request.body.name).toBe('Offline edit');
    request.flush({ success: true, user: { ...user, name: 'Offline edit' } });
    await Promise.resolve();
    expect(auth.pending()).toBeFalse();
    expect(localStorage.getItem(pendingKey)).toBeNull();
    expect(auth.getUser()?.name).toBe('Offline edit');
  });

  it('restores pending edits after service initialization and preserves them on server failure', async () => {
    localStorage.setItem(pendingKey, JSON.stringify({ name: 'Pending', email: user.email }));
    const auth = TestBed.inject(AuthService);
    expect(auth.pending()).toBeTrue();
    expect((await firstValueFrom(auth.getProfile())).user.name).toBe('Pending');
    connection.online.set(true);
    const completion = auth.syncPending();
    http.expectOne(req => req.method === 'PUT').flush({}, { status: 503, statusText: 'Unavailable' });
    await completion;
    expect(auth.pending()).toBeTrue();
    expect(localStorage.getItem(pendingKey)).not.toBeNull();
  });

  it('keeps conflicts pending and does not retry until corrected or requested', async () => {
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.updateProfile({ name: 'Changed', email: 'taken@example.com' }));
    connection.online.set(true);
    const completion = auth.syncPending();
    http.expectOne(req => req.method === 'PUT').flush({ message: 'Correo ocupado' }, { status: 409, statusText: 'Conflict' });
    await completion;
    await auth.syncPending();
    http.expectNone(req => req.method === 'PUT');
    expect(auth.syncError()).toBe('Correo ocupado');
    expect(auth.pending()).toBeTrue();
  });

  it('never persists an offline password change', async () => {
    const auth = TestBed.inject(AuthService);
    await expectAsync(firstValueFrom(auth.updateProfile({ name: 'Changed', email: user.email, password: 'secret123' }))).toBeRejected();
    expect(localStorage.getItem(pendingKey)).toBeNull();
  });

  it('does not overwrite a synced profile with an older GET response', async () => {
    const auth = TestBed.inject(AuthService);
    connection.online.set(true);
    const read = firstValueFrom(auth.getProfile());
    const oldGet = http.expectOne(req => req.method === 'GET');
    const save = firstValueFrom(auth.updateProfile({ name: 'Latest edit', email: user.email }));
    http.expectOne(req => req.method === 'PUT').flush({ success: true, user: { ...user, name: 'Latest edit' } });
    await save;
    oldGet.flush({ success: true, user });
    expect((await read).user.name).toBe('Latest edit');
    expect(auth.getUser()?.name).toBe('Latest edit');
  });

  it('does not send another account’s pending edits', async () => {
    localStorage.setItem('outplay:pending-profile:999999', JSON.stringify({ name: 'Other account', email: 'other@example.com' }));
    const auth = TestBed.inject(AuthService);
    connection.online.set(true);
    await auth.syncPending();
    http.expectNone(req => req.method === 'PUT');
    expect(auth.pending()).toBeFalse();
  });

  it('persists downloaded games, restores them offline, and separates filters', () => {
    const games = TestBed.inject(ChessEventsService);
    TestBed.tick();
    connection.online.set(true);
    TestBed.tick();
    games.loadUpsets();
    http.expectOne(req => req.url.endsWith('/chess/upsets.php')).flush({
      success: true, data: [{ id: 'saved-game', winner: { name: 'Winner' }, opponent: { name: 'Opponent' } }],
      meta: { broadcastCount: 1, cached: false, failedBroadcasts: [] },
    });
    connection.online.set(false);
    TestBed.tick();
    expect(games.games()[0].id).toBe('saved-game');
    expect(games.localCopy()).toBeTrue();
    games.loadUpsets('budapest-2024');
    expect(games.games()).toEqual([]);
    expect(games.loadError()).toContain('No games saved');
  });

  it('refreshes the current filters when connectivity returns', () => {
    const games = TestBed.inject(ChessEventsService);
    games.loadUpsets('budapest-2024', 'women', 3);
    TestBed.tick();
    connection.online.set(true);
    TestBed.tick();
    const request = http.expectOne(req => req.url.endsWith('/chess/upsets.php'));
    expect(request.request.params.get('event')).toBe('budapest-2024');
    expect(request.request.params.get('section')).toBe('women');
    expect(request.request.params.get('round')).toBe('3');
    request.flush({ success: true, data: [], meta: { broadcastCount: 0, cached: false, failedBroadcasts: [] } });
    expect(games.loading()).toBeFalse();
  });

  it('cancels old filters so late responses cannot replace the selection', () => {
    const games = TestBed.inject(ChessEventsService);
    connection.online.set(true);
    TestBed.tick();
    games.loadUpsets();
    const old = http.expectOne(req => req.url.endsWith('/chess/upsets.php'));
    games.loadUpsets('budapest-2024');
    expect(old.cancelled).toBeTrue();
    http.expectOne(req => req.url.endsWith('/chess/upsets.php')).flush({
      success: true, data: [], meta: { broadcastCount: 0, cached: false, failedBroadcasts: [] },
    });
  });
});
