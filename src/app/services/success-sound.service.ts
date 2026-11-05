import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SuccessSoundService {
  private audioContext?: AudioContext;
  private activeOscillators = new Set<OscillatorNode>();
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
  }

  playFanfare(): void {
    if (this.muted) {
      return;
    }

    this.unlock();
    const context = this.audioContext;
    if (!context) {
      return;
    }

    this.stop();
    const start = context.currentTime + 0.04;
    const notes = [
      { frequency: 196, time: 0, duration: 0.12, type: 'square' as OscillatorType },
      { frequency: 392, time: 0.16, duration: 0.2, type: 'square' as OscillatorType },
      { frequency: 523.25, time: 0.4, duration: 0.2, type: 'square' as OscillatorType },
      { frequency: 659.25, time: 0.64, duration: 0.22, type: 'square' as OscillatorType },
      { frequency: 783.99, time: 0.9, duration: 0.18, type: 'square' as OscillatorType },
      { frequency: 659.25, time: 1.12, duration: 0.16, type: 'triangle' as OscillatorType },
      { frequency: 880, time: 1.32, duration: 0.5, type: 'square' as OscillatorType },
      { frequency: 1174.66, time: 1.68, duration: 0.58, type: 'triangle' as OscillatorType },
    ];

    notes.forEach((note, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + note.time;
      const noteEnd = noteStart + note.duration;

      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      if (index === notes.length - 1) {
        oscillator.frequency.exponentialRampToValueAtTime(note.frequency * 1.06, noteEnd);
      }

      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.055, noteStart + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
      this.activeOscillators.add(oscillator);
      oscillator.addEventListener('ended', () => this.activeOscillators.delete(oscillator));
    });
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stop();
    } else {
      this.playFanfare();
    }
    return this.muted;
  }

  stop(): void {
    this.activeOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // The oscillator already finished naturally.
      }
    });
    this.activeOscillators.clear();
  }
}
