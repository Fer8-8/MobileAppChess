import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowForward, lockClosed, mail, person } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  imports: [IonContent, IonIcon, FormsModule, RouterLink],
})
export class RegisterPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  account = { name: '', email: '', password: '', confirmPassword: '' };
  loading = false;
  errorMessage = '';

  constructor() { addIcons({ arrowForward, lockClosed, mail, person }); }

  register(): void {
    if (this.account.password !== this.account.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.authService.register(this.account.name, this.account.email, this.account.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/login'], { state: { registered: true } });
      },
      error: error => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'Could not create the account.';
      },
    });
  }
}
