import { Component, input } from '@angular/core';

export type BadgeVariant = 'published' | 'draft' | 'ending-soon' | 'category' | 'past';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span class="badge badge--{{ variant() }}">{{ label() }}</span>`,
  styleUrl: './badge.component.scss',
})
export class BadgeComponent {
  variant = input<BadgeVariant>('published');
  label = input.required<string>();
}
