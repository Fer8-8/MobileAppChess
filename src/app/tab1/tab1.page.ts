import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowForward, flash, logOutOutline, trophy, trendingUp } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [IonContent, IonIcon, RouterLink],
})
export class Tab1Page {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly user = this.authService.getUser();

  constructor() {
    addIcons({ arrowForward, flash, logOutOutline, trophy, trendingUp });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
