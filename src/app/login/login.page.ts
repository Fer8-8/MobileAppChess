import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowForward, lockClosed, mail } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, FormsModule, RouterLink],
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  credentials = {
    email: '',
    password: '',
  };

  loading = false;
  errorMessage = '';
  registered = false;

  constructor() {
    addIcons({ arrowForward, lockClosed, mail });
    this.registered = history.state?.registered === true;
  }

  login(): void {
    if (!this.credentials.email || !this.credentials.password) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.registered = false;

    this.authService.login(
      this.credentials.email,
      this.credentials.password
    ).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/tabs']);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage =
          error?.error?.message || 'Correo o contraseña incorrectos.';
      },
    });
  }
}
