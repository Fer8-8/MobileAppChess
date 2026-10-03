import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

interface RegisterResponse {
  success: boolean;
  message: string;
  user_id: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
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
        tap((response) => {
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('auth_user', JSON.stringify(response.user));
        })
      );
  }

  register(name: string, email: string, password: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.API_URL}/create_user.php`, {
      name,
      email,
      password,
    });
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getUser(): { id: number; name: string; email: string } | null {
    const value = localStorage.getItem('auth_user');
    return value ? JSON.parse(value) : null;
  }
}
