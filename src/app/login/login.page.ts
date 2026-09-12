import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class LoginPage {
  credentials = {
    email: '',
    password: '',
  };

  loading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login(): void {
    if (!this.credentials.email || !this.credentials.password) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

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
