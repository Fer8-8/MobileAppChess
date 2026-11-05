import { networkErrorMessage } from '../services/network-error';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cameraOutline, checkmarkCircle, logOutOutline, saveOutline } from 'ionicons/icons';
import { finalize } from 'rxjs';
import { AuthService, AuthUser } from '../services/auth.service';
import { ProfilePhoto, ProfilePhotoService } from '../services/profile-photo.service';
import { ConnectivityService } from '../services/connectivity.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [IonContent, IonIcon, FormsModule, RouterLink],
})
export class ProfilePage {
  private readonly authService = inject(AuthService);
  private readonly photoService = inject(ProfilePhotoService);
  readonly online = inject(ConnectivityService).online;
  readonly pending = this.authService.pending;
  readonly syncing = this.authService.syncing;
  readonly syncError = this.authService.syncError;
  private readonly router = inject(Router);

  account = { name: '', email: '', password: '', confirmPassword: '' };
  user: AuthUser | null = null;
  photo: ProfilePhoto | null = null;
  loading = true;
  saving = false;
  confirmingDeletion = false;
  readonly deleting = this.authService.deleting;
  selectingPhoto = false;
  errorMessage = '';
  successMessage = '';

  constructor() {
    addIcons({ cameraOutline, checkmarkCircle, logOutOutline, saveOutline });
  }

  ionViewWillEnter(): void {
    const cachedUser = this.authService.getUser();
    if (cachedUser) {
      this.applyUser(cachedUser);
      void this.loadPhoto(cachedUser.id);
    }

    this.loading = true;
    this.authService.getProfile().pipe(finalize(() => (this.loading = false))).subscribe({
      next: ({ user }) => {
        this.applyUser(user);
        void this.loadPhoto(user.id);
      },
      error: (error) => {
        this.errorMessage = networkErrorMessage(error, 'No pudimos cargar tu perfil.');
      },
    });
  }

  save(): void {
    if (!this.account.name.trim() || !this.account.email.trim()) {
      this.errorMessage = 'Nombre y correo son obligatorios.';
      return;
    }
    if (this.account.password && this.account.password.length < 6) {
      this.errorMessage = 'La nueva contraseña debe tener al menos 6 caracteres.';
      return;
    }
    if (this.account.password !== this.account.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    const changes = {
      name: this.account.name.trim(),
      email: this.account.email.trim(),
      ...(this.account.password ? { password: this.account.password } : {}),
    };

    this.authService.updateProfile(changes).pipe(finalize(() => (this.saving = false))).subscribe({
      next: ({ user, queued }) => {
        this.applyUser(user);
        this.account.password = '';
        this.account.confirmPassword = '';
        this.successMessage = queued
          ? 'Cambios guardados en este dispositivo, pendientes de sincronización.'
          : 'Perfil actualizado y sincronizado correctamente.';
      },
      error: (error) => {
        this.errorMessage = networkErrorMessage(error, 'No pudimos guardar los cambios.');
      },
    });
  }

  async retrySync(): Promise<void> {
    await this.authService.syncPending(true);
    // Keep unsaved form edits intact; the status below reports the result.
  }

  async selectPhoto(): Promise<void> {
    if (!this.user || this.selectingPhoto) {
      return;
    }

    this.selectingPhoto = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      this.photo = await this.photoService.chooseAndSave(this.user.id);
      this.successMessage = 'La foto quedó guardada en este dispositivo.';
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!/cancel/i.test(message)) {
        this.errorMessage = message || 'No pudimos guardar la imagen.';
      }
    } finally {
      this.selectingPhoto = false;
    }
  }

  deleteAccount(): void {
    if (!this.confirmingDeletion || this.saving || this.selectingPhoto || this.deleting()) return;
    const userId = this.user?.id;
    this.errorMessage = '';
    this.authService.deleteAccount().subscribe({
      next: () => {
        if (userId) void this.photoService.remove(userId).catch(() => undefined);
        this.photo = null;
        this.user = null;
        void this.router.navigate(['/login'], { replaceUrl: true });
      },
      error: error => {
        this.errorMessage = networkErrorMessage(error, 'No pudimos eliminar la cuenta.');
      },
    });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  initials(): string {
    return (this.account.name || 'U')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private applyUser(user: AuthUser): void {
    this.user = user;
    this.account.name = user.name;
    this.account.email = user.email;
  }

  private async loadPhoto(userId: number): Promise<void> {
    this.photo = await this.photoService.load(userId);
  }
}
