import { Component, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { SuccessSoundService } from '../services/success-sound.service';

@Component({
  selector: 'app-login-success',
  templateUrl: './login-success.page.html',
  styleUrls: ['./login-success.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class LoginSuccessPage implements OnDestroy {
  private readonly router = inject(Router);
  private readonly successSound = inject(SuccessSoundService);
  private readonly displayDuration = 8000;
  private readonly captions = [
    'Magnus is still calculating your password.',
    'Hikaru literally does not care how long this takes.',
    'Kasparov has challenged the loading bar to a rematch.',
    'The engine says this login is +7.4.',
    'Preparing one deeply suspicious sacrifice…',
  ];
  private navigationTimer?: ReturnType<typeof setTimeout>;

  caption = this.captions[0];
  soundMuted = this.successSound.isMuted;

  ionViewWillEnter(): void {
    this.clearNavigationTimer();
    this.caption = this.captions[Math.floor(Math.random() * this.captions.length)];
    this.soundMuted = this.successSound.isMuted;
    this.successSound.playFanfare();
    this.navigationTimer = setTimeout(() => {
      void this.router.navigateByUrl('/tabs', { replaceUrl: true });
    }, this.displayDuration);
  }

  ionViewWillLeave(): void {
    this.clearNavigationTimer();
    this.successSound.stop();
  }

  ngOnDestroy(): void {
    this.clearNavigationTimer();
    this.successSound.stop();
  }

  toggleSound(): void {
    this.soundMuted = this.successSound.toggleMuted();
  }

  private clearNavigationTimer(): void {
    if (this.navigationTimer !== undefined) {
      clearTimeout(this.navigationTimer);
      this.navigationTimer = undefined;
    }
  }
}
