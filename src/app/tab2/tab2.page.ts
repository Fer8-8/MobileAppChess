import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBack, arrowForward, chevronDown, openOutline, swapVertical } from 'ionicons/icons';
import { ChessEventsService, EventSection, RatingMode, UpsetGame } from '../services/chess-events.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [IonContent, IonIcon, FormsModule, RouterLink],
})
export class Tab2Page implements OnInit {
  private readonly chessEvents = inject(ChessEventsService);
  readonly events = this.chessEvents.events;
  readonly section = signal<EventSection>('all');
  readonly round = signal<number | 'all'>(11);
  readonly ratingMode = signal<RatingMode>('rated');
  readonly rounds = Array.from({ length: 11 }, (_, index) => index + 1);
  readonly loading = this.chessEvents.loading;
  readonly loadError = this.chessEvents.loadError;
  readonly broadcastCount = this.chessEvents.broadcastCount;
  readonly isCached = this.chessEvents.isCached;
  readonly selectedEventId = signal('samarkand-2026');
  readonly selectedEvent = computed(() => this.events.find(event => event.id === this.selectedEventId()) ?? this.events[0]);
  readonly games = computed(() => {
    return this.chessEvents.games()
      .sort((a, b) => this.ratingGap(b) - this.ratingGap(a));
  });

  constructor() {
    addIcons({ arrowBack, arrowForward, chevronDown, openOutline, swapVertical });
  }

  ngOnInit(): void { this.loadGames(); }

  setSection(section: EventSection): void { this.section.set(section); this.loadGames(); }
  setRound(value: string): void { this.round.set(value === 'all' ? 'all' : Number(value)); this.loadGames(); }
  setExcludeUnrated(exclude: boolean): void {
    this.ratingMode.set(exclude ? 'rated' : 'all');
    this.loadGames();
  }
  selectEvent(id: string): void {
    const event = this.events.find(item => item.id === id);
    if (!event || event.status === 'soon') return;
    this.selectedEventId.set(id);
    this.round.set(11);
    this.loadGames();
  }
  loadGames(): void {
    this.chessEvents.loadUpsets(this.selectedEventId(), this.section(), this.round(), this.ratingMode());
  }
  ratingGap(game: UpsetGame): number {
    return game.ratingGap ?? (game.opponent.rating ?? 0) - (game.winner.rating ?? 0);
  }
  initials(name: string): string { return name.split(' ').map(part => part[0]).slice(0, 2).join(''); }
  ratingLabel(rating: number | null): string { return rating === null ? 'UNR' : String(rating); }
}
