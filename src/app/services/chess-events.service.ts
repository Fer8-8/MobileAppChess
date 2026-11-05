import { HttpClient, HttpParams } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription, timeout } from 'rxjs';
import { ConnectivityService } from './connectivity.service';
import { environment } from '../../environments/environment';

export type EventSection = 'all' | 'open' | 'women';
export type RatingMode = 'rated' | 'unrated' | 'all';
export interface ChessEvent { id: string; name: string; place: string; date: string; status: 'complete' | 'live' | 'soon'; }
export interface UpsetGame {
  id: string; round: number; section: Exclude<EventSection, 'all'>;
  winner: { name: string; title: string; rating: number | null; country: string; color: 'white' | 'black' };
  opponent: { name: string; title: string; rating: number | null; country: string; color: 'white' | 'black' };
  opening: string; result: string; lichessUrl: string;
  ratingGap?: number | null;
  isUnrated?: boolean;
}

interface UpsetsResponse {
  success: boolean;
  data: UpsetGame[];
  meta: { broadcastCount: number; cached: boolean; failedBroadcasts: unknown[] };
}

@Injectable({ providedIn: 'root' })
export class ChessEventsService {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(ConnectivityService);
  private request?: Subscription;
  private selection?: [string, EventSection, number | 'all', RatingMode];
  readonly savedAt = signal<string | null>(null);
  readonly localCopy = signal(false);

  readonly lichessBroadcastApi = 'https://lichess.org/api/broadcast';
  readonly games = signal<UpsetGame[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly broadcastCount = signal(0);
  readonly isCached = signal(false);
  readonly events: ChessEvent[] = [
    { id: 'samarkand-2026', name: '46th FIDE Chess Olympiad', place: 'Samarkand, Uzbekistan', date: 'Sep 16–27, 2026', status: 'complete' },
    { id: 'budapest-2024', name: '45th Chess Olympiad', place: 'Budapest, Hungary', date: 'Sep 10–23, 2024', status: 'complete' },
    { id: 'candidates-2024', name: 'FIDE Candidates', place: 'Toronto, Canada', date: 'Apr 3–22, 2024', status: 'soon' },
    { id: 'norway-2024', name: 'Norway Chess', place: 'Stavanger, Norway', date: 'May 27–Jun 7, 2024', status: 'soon' },
  ];
  readonly olympiadGames: UpsetGame[] = [
    { id: 'pavlidou-maltsevskaya', round: 3, section: 'women', winner: { name: 'Ekaterini Pavlidou', title: 'WIM', rating: 2141, country: 'Greece', color: 'white' }, opponent: { name: 'Aleksandra Maltsevskaya', title: 'IM', rating: 2404, country: 'Poland', color: 'black' }, opening: 'Three queens on the board', result: '1–0', lichessUrl: 'https://lichess.org/broadcast/45th-chess-olympiad-budapest-2024--women-i/round-3/5tLXKIAf' },
    { id: 'lodici-giri', round: 3, section: 'open', winner: { name: 'Lorenzo Lodici', title: 'GM', rating: 2556, country: 'Italy', color: 'white' }, opponent: { name: 'Anish Giri', title: 'GM', rating: 2724, country: 'Netherlands', color: 'black' }, opening: 'Sicilian Defense', result: '1–0', lichessUrl: 'https://lichess.org/broadcast/45th-chess-olympiad-budapest-2024-open-i/round-3/5tLXKIAf' },
    { id: 'sonis-warmerdam', round: 3, section: 'open', winner: { name: 'Francesco Sonis', title: 'GM', rating: 2554, country: 'Italy', color: 'white' }, opponent: { name: 'Max Warmerdam', title: 'GM', rating: 2679, country: 'Netherlands', color: 'black' }, opening: 'Queen’s Pawn Game', result: '1–0', lichessUrl: 'https://lichess.org/broadcast/45th-chess-olympiad-budapest-2024-open-i/round-3/5tLXKIAf' },
    { id: 'brunello-lami', round: 3, section: 'open', winner: { name: 'Sabino Brunello', title: 'GM', rating: 2511, country: 'Italy', color: 'white' }, opponent: { name: 'Erwin L’Ami', title: 'GM', rating: 2628, country: 'Netherlands', color: 'black' }, opening: 'English Opening', result: '1–0', lichessUrl: 'https://lichess.org/broadcast/45th-chess-olympiad-budapest-2024-open-i/round-3/5tLXKIAf' },
    { id: 'gukesh-caruana', round: 10, section: 'open', winner: { name: 'Gukesh D', title: 'GM', rating: 2764, country: 'India', color: 'white' }, opponent: { name: 'Fabiano Caruana', title: 'GM', rating: 2798, country: 'United States', color: 'black' }, opening: 'Catalan Opening · Closed', result: '1–0', lichessUrl: 'https://lichess.org/broadcast/45th-chess-olympiad-budapest-2024-open-i/round-10/KXN73ABF/XevoH0F8' },
    { id: 'nguyen-yakubboev', round: 4, section: 'open', winner: { name: 'Ngoc Truong Son Nguyen', title: 'GM', rating: 2633, country: 'Vietnam', color: 'black' }, opponent: { name: 'Nodirbek Yakubboev', title: 'GM', rating: 2666, country: 'Uzbekistan', color: 'white' }, opening: 'Semi-Tarrasch · Exchange', result: '0–1', lichessUrl: 'https://lichess.org/broadcast/45th-chess-olympiad-budapest-2024-open-i/round-4/6wJduA1I/HiU6GyY2' },
  ];

  constructor() {
    effect(() => {
      const online = this.connection.online();
      if (this.selection) untracked(() => this.loadUpsets(...this.selection!, online));
    });
    const timer = window.setInterval(() => {
      if (this.connection.online() && this.loadError() && !this.loading() && this.selection) {
        this.loadUpsets(...this.selection);
      }
    }, 30000);
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      window.clearInterval(timer);
    });
  }

  loadUpsets(
    eventId = 'samarkand-2026',
    section: EventSection = 'all',
    round: number | 'all' = 11,
    rating: RatingMode = 'rated',
    forceRefresh = false
  ): void {
    this.request?.unsubscribe();
    this.selection = [eventId, section, round, rating];
    const key = `outplay:games:${JSON.stringify(this.selection)}`;
    this.loading.set(false);
    this.loadError.set(null);
    this.games.set([]);
    this.broadcastCount.set(0);
    this.isCached.set(false);
    this.localCopy.set(false);
    this.savedAt.set(null);
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Array.isArray(cached.data) && typeof cached.savedAt === 'string'
          && cached.data.every((game: UpsetGame) => game && typeof game.id === 'string' && game.winner && game.opponent)) {
        this.games.set(cached.data);
        this.broadcastCount.set(cached.broadcastCount || 0);
        this.savedAt.set(cached.savedAt);
        this.isCached.set(true);
        this.localCopy.set(true);
      }
    } catch { /* Ignore unreadable cache and try the server. */ }
    const fallbackMessage = () => this.localCopy()
      ? 'Showing games saved on this device. They may be out of date.'
      : 'No games saved for these filters. Connect to download them first.';
    if (!this.connection.online()) {
      this.loadError.set(fallbackMessage());
      return;
    }
    this.loading.set(true);
    let params = new HttpParams()
      .set('event', eventId).set('section', section).set('round', String(round))
      .set('rating', rating).set('limit', '200');
    if (forceRefresh) params = params.set('refresh', '1');
    this.request = this.http.get<UpsetsResponse>(`${environment.apiUrl}/chess/upsets.php`, { params })
      .pipe(timeout(20000)).subscribe({
        next: response => {
          if (!response.success || !Array.isArray(response.data)) {
            this.loadError.set(fallbackMessage());
            this.loading.set(false);
            return;
          }
          this.games.set(response.data);
          this.broadcastCount.set(response.meta.broadcastCount);
          this.isCached.set(response.meta.cached);
          this.localCopy.set(false);
          const savedAt = new Date().toISOString();
          try {
            // Bound storage to the twenty most recently downloaded filter combinations.
            const keys = Object.keys(localStorage).filter(item => item.startsWith('outplay:games:') && item !== key);
            keys.sort((a, b) => {
              try { return JSON.parse(localStorage.getItem(a) || '{}').savedAt.localeCompare(JSON.parse(localStorage.getItem(b) || '{}').savedAt); }
              catch { return 0; }
            });
            while (keys.length >= 20) localStorage.removeItem(keys.shift()!);
            localStorage.setItem(key, JSON.stringify({ data: response.data, broadcastCount: response.meta.broadcastCount, savedAt }));
            this.savedAt.set(savedAt);
          } catch {
            this.savedAt.set(null);
            this.loadError.set('Games loaded, but device storage is unavailable. This download was not saved offline.');
          }
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(`Service unavailable. ${fallbackMessage()}`);
          this.loading.set(false);
        },
      });
  }
}
