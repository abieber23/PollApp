import { Component, input, output, signal } from '@angular/core';

type ButtonState = 'normal' | 'success';

@Component({
  selector: 'app-button-primary',
  standalone: true,
  templateUrl: './button-primary.component.html',
  styleUrl: './button-primary.component.scss',
})
export class ButtonPrimaryComponent {
  label = input<string>('New survey');
  action = output<void>();

  state = signal<ButtonState>('normal');

  /**
   * - Prevents double-click while in success state
   * - Emits action, sets success state, resets after 1.8 s
   */
  onClick(): void {
    if (this.state() === 'success') return;
    this.state.set('success');
    this.action.emit();
    setTimeout(() => this.state.set('normal'), 1800);
  }
}
