import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { signal } from '@angular/core';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideZonelessChangeDetection(), provideIonicAngular(), provideRouter([]),
        { provide: AuthService, useValue: { syncing: signal(false), pending: signal(false) } }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('shows the initial device connection state', () => {
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const status: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');
    expect(status.textContent).toContain('Offline');
    expect(status.classList).toContain('offline');
  });

  it('updates the indicator when the connection drops and returns', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const status: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');

    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();
    expect(status.textContent).toContain('Offline');
    expect(status.textContent).toContain('Check your internet connection');
    expect(status.classList).toContain('offline');

    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(status.textContent).toContain('Online');
    expect(status.textContent).not.toContain('Check your internet connection');
    expect(status.classList).not.toContain('offline');
  });
});
