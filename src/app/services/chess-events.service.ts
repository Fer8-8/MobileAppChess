import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
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
    this.games.set([]);
  }

  loadUpsets(
    eventId = 'samarkand-2026',
    section: EventSection = 'all',
    round: number | 'all' = 11,
    rating: RatingMode = 'rated',
    forceRefresh = false
  ): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.games.set([]);
    let params = new HttpParams()
      .set('event', eventId)
      .set('section', section)
      .set('round', String(round))
      .set('rating', rating)
      .set('limit', '200');
    if (forceRefresh) params = params.set('refresh', '1');

    this.http.get<UpsetsResponse>(
      `${environment.apiUrl}/chess/upsets.php`, { params }
    ).subscribe({
      next: response => {
        this.games.set(response.data);
        this.broadcastCount.set(response.meta.broadcastCount);
        this.isCached.set(response.meta.cached);
        this.loading.set(false);
      },
      error: () => {
        const fallback = eventId === 'budapest-2024' && rating === 'rated'
          ? this.olympiadGames.filter(game =>
              (section === 'all' || game.section === section)
              && (round === 'all' || game.round === round)
            )
          : [];
        this.games.set(fallback);
        this.loadError.set(fallback.length > 0
          ? 'Backend unavailable — showing the saved sample'
          : 'Backend unavailable — no cached games for this filter');
        this.loading.set(false);
      },
    });
  }
}
