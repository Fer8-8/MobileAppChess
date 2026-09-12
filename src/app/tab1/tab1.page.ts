import { Component, ElementRef, QueryList, ViewChildren } from '@angular/core';


@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
})
export class Tab1Page {

  @ViewChildren('fieldset') fieldsets!: QueryList<ElementRef>;

  currentStep = 0;
  animating = false;

  constructor() {}

  next(): void {
    if (this.animating) {
      return;
    }

    const fieldsets = this.fieldsets.toArray();

    if (this.currentStep >= fieldsets.length - 1) {
      return;
    }

    this.animating = true;

    const currentFs = fieldsets[this.currentStep].nativeElement;
    const nextFs = fieldsets[this.currentStep + 1].nativeElement;

    // Activar siguiente paso
    this.currentStep++;

    // Mostrar el siguiente fieldset
    nextFs.style.display = 'block';
    nextFs.style.position = 'absolute';

    // Animación
    this.animateNext(currentFs, nextFs);
  }

  previous(): void {
    if (this.animating) {
      return;
    }

    const fieldsets = this.fieldsets.toArray();

    if (this.currentStep <= 0) {
      return;
    }

    this.animating = true;

    const currentFs = fieldsets[this.currentStep].nativeElement;
    const previousFs = fieldsets[this.currentStep - 1].nativeElement;

    // Desactivar paso actual
    this.currentStep--;

    // Mostrar el anterior
    previousFs.style.display = 'block';

    // Animación
    this.animatePrevious(currentFs, previousFs);
  }

  private animateNext(
    currentFs: HTMLElement,
    nextFs: HTMLElement
  ): void {

    const duration = 800;
    const startTime = performance.now();

    const animate = (currentTime: number) => {

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Equivalente aproximado a la animación original
      const now = 1 - progress;

      // 1. Scale del fieldset actual
      const scale = 1 - (1 - now) * 0.2;

      // 2. Mover el siguiente desde la derecha
      const left = now * 50;

      // 3. Opacidad del siguiente
      const opacity = 1 - now;

      currentFs.style.transform = `scale(${scale})`;
      currentFs.style.position = 'absolute';

      nextFs.style.left = `${left}%`;
      nextFs.style.opacity = `${opacity}`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        currentFs.style.display = 'none';
        currentFs.style.position = '';
        currentFs.style.transform = '';

        nextFs.style.position = '';
        nextFs.style.left = '0';
        nextFs.style.opacity = '1';

        this.animating = false;
      }
    };

    requestAnimationFrame(animate);
  }

  private animatePrevious(
    currentFs: HTMLElement,
    previousFs: HTMLElement
  ): void {

    const duration = 800;
    const startTime = performance.now();

    const animate = (currentTime: number) => {

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const now = 1 - progress;

      // 1. Scale del fieldset anterior
      const scale = 0.8 + (1 - now) * 0.2;

      // 2. Mover el actual hacia la derecha
      const left = (1 - now) * 50;

      // 3. Opacidad del anterior
      const opacity = 1 - now;

      currentFs.style.left = `${left}%`;

      previousFs.style.transform = `scale(${scale})`;
      previousFs.style.opacity = `${opacity}`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        currentFs.style.display = 'none';
        currentFs.style.left = '';

        previousFs.style.transform = '';
        previousFs.style.opacity = '1';

        this.animating = false;
      }
    };

    requestAnimationFrame(animate);
  }
}
