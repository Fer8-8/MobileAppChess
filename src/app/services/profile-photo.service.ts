import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { parse } from 'exifr';

export interface PhotoMetadataItem {
  label: string;
  value: string;
}

export interface ProfilePhoto {
  filePath: string;
  webviewPath: string;
  metadata: PhotoMetadataItem[];
}

interface StoredProfilePhoto {
  filePath: string;
  metadata: PhotoMetadataItem[];
}

@Injectable({ providedIn: 'root' })
export class ProfilePhotoService {
  async chooseAndSave(userId: number): Promise<ProfilePhoto> {
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.Uri,
      quality: 90,
      allowEditing: false,
      saveToGallery: false,
    });

    if (!photo.webPath && !photo.path) {
      throw new Error('No se pudo leer la imagen seleccionada.');
    }

    const blob = photo.webPath ? await this.readBlob(photo.webPath) : null;
    const metadata = blob ? await this.readMetadata(blob) : [];
    const base64 = await this.readAsBase64(photo, blob);
    const extension = this.safeExtension(photo.format);
    const filePath = `profile-images/user-${userId}.${extension}`;
    const previous = await this.getStored(userId);

    const saved = await Filesystem.writeFile({
      path: filePath,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });

    const stored: StoredProfilePhoto = { filePath, metadata };
    await Preferences.set({ key: this.storageKey(userId), value: JSON.stringify(stored) });

    if (previous && previous.filePath !== filePath) {
      await this.removeFile(previous.filePath);
    }

    return {
      filePath,
      webviewPath: Capacitor.isNativePlatform()
        ? Capacitor.convertFileSrc(saved.uri)
        : this.asDataUrl(base64, extension),
      metadata,
    };
  }

  async remove(userId: number): Promise<void> {
    const stored = await this.getStored(userId);
    if (stored) await this.removeFile(stored.filePath);
    await Preferences.remove({ key: this.storageKey(userId) });
  }

  async load(userId: number): Promise<ProfilePhoto | null> {
    const stored = await this.getStored(userId);
    if (!stored) {
      return null;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const uri = await Filesystem.getUri({ path: stored.filePath, directory: Directory.Data });
        return {
          ...stored,
          webviewPath: Capacitor.convertFileSrc(uri.uri),
        };
      }

      const file = await Filesystem.readFile({
        path: stored.filePath,
        directory: Directory.Data,
      });
      const extension = stored.filePath.split('.').pop() || 'jpeg';
      const data = typeof file.data === 'string' ? file.data : await this.blobToBase64(file.data);
      return { ...stored, webviewPath: this.asDataUrl(data, extension) };
    } catch {
      await Preferences.remove({ key: this.storageKey(userId) });
      return null;
    }
  }

  private async readMetadata(blob: Blob): Promise<PhotoMetadataItem[]> {
    try {
      const result = await parse(blob, {
        pick: [
          'Make', 'Model', 'LensModel', 'Software', 'DateTimeOriginal', 'CreateDate',
          'ImageWidth', 'ImageHeight', 'ExposureTime', 'FNumber', 'ISO', 'FocalLength',
          'latitude', 'longitude', 'Orientation',
        ],
      }) as Record<string, unknown> | undefined;

      if (!result) {
        return [];
      }

      const labels: Record<string, string> = {
        Make: 'Fabricante', Model: 'Modelo', LensModel: 'Lente', Software: 'Software',
        DateTimeOriginal: 'Fecha de captura', CreateDate: 'Fecha de creación',
        ImageWidth: 'Ancho', ImageHeight: 'Alto', ExposureTime: 'Exposición',
        FNumber: 'Apertura', ISO: 'ISO', FocalLength: 'Distancia focal',
        latitude: 'Latitud', longitude: 'Longitud', Orientation: 'Orientación',
      };

      return Object.entries(result)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => ({
          label: labels[key] ?? key,
          value: this.formatMetadataValue(key, value),
        }));
    } catch {
      return [];
    }
  }

  private formatMetadataValue(key: string, value: unknown): string {
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    if (key === 'ExposureTime' && typeof value === 'number' && value > 0 && value < 1) {
      return `1/${Math.round(1 / value)} s`;
    }
    if (key === 'FNumber') {
      return `f/${value}`;
    }
    if (key === 'FocalLength') {
      return `${value} mm`;
    }
    if (key === 'ImageWidth' || key === 'ImageHeight') {
      return `${value} px`;
    }
    return String(value);
  }

  private async readAsBase64(photo: Photo, blob: Blob | null): Promise<string> {
    if (Capacitor.isNativePlatform() && photo.path) {
      const file = await Filesystem.readFile({ path: photo.path });
      return typeof file.data === 'string' ? file.data : this.blobToBase64(file.data);
    }
    if (blob) {
      return this.blobToBase64(blob);
    }
    throw new Error('No se pudo convertir la imagen para guardarla.');
  }

  private async readBlob(path: string): Promise<Blob> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('No se pudo abrir la imagen seleccionada.');
    }
    return response.blob();
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.onload = () => {
        const result = String(reader.result ?? '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.readAsDataURL(blob);
    });
  }

  private asDataUrl(base64: string, extension: string): string {
    if (base64.startsWith('data:')) {
      return base64;
    }
    const mimeExtension = extension === 'jpg' ? 'jpeg' : extension;
    return `data:image/${mimeExtension};base64,${base64}`;
  }

  private safeExtension(format: string): string {
    const normalized = format.toLowerCase().replace(/[^a-z0-9]/g, '');
    return ['jpeg', 'jpg', 'png', 'gif', 'webp', 'heic'].includes(normalized)
      ? normalized
      : 'jpeg';
  }

  private async getStored(userId: number): Promise<StoredProfilePhoto | null> {
    const { value } = await Preferences.get({ key: this.storageKey(userId) });
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as StoredProfilePhoto;
    } catch {
      return null;
    }
  }

  private async removeFile(path: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path, directory: Directory.Data });
    } catch {
      // Replacing the selected image must not fail because an old local file is missing.
    }
  }

  private storageKey(userId: number): string {
    return `profile_photo_${userId}`;
  }
}
