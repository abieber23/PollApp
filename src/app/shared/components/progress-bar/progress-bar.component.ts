import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  template: `
    <div class="progress-bar">
      <div class="progress-bar__fill" [style.width]="clampedWidth()"></div>
    </div>
  `,
  styleUrl: './progress-bar.component.scss',
})
export class ProgressBarComponent {
  percentage = input<number>(0);
  clampedWidth = computed(() => `${Math.min(100, Math.max(0, this.percentage()))}%`);
}
