import { Component, computed, input, output } from '@angular/core';
import type { Poll } from '../../../core/models';
import { BadgeComponent, type BadgeVariant } from '../badge/badge.component';

@Component({
  selector: 'app-survey-card',
  standalone: true,
  imports: [BadgeComponent],
  templateUrl: './survey-card.component.html',
  styleUrl: './survey-card.component.scss',
})
export class SurveyCardComponent {
  poll = input.required<Poll>();
  variant = input<'dark' | 'list' | 'ending-soon-card'>('dark');
  showDelete = input<boolean>(false);
  cardClick = output<Poll>();
  deleteClick = output<string>();

  /** - Calculates the remaining full days until the poll deadline */
  daysUntilDeadline = computed(() => {
    const deadline = this.poll().deadline;
    if (!deadline) return null;
    return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  });

  /** - Returns a human-readable deadline label (e.g. "Ends in 2 Days") */
  deadlineLabel = computed<string | null>(() => {
    const days = this.daysUntilDeadline();
    if (days === null) return null;
    if (days <= 0) return 'Ended';
    if (days === 1) return 'Ends in 1 Day';
    return `Ends in ${days} Days`;
  });

  /** - Returns the badge variant depending on remaining days until deadline */
  deadlineBadgeVariant = computed<BadgeVariant>(() =>
    (this.daysUntilDeadline() ?? 1) <= 0 ? 'past' : 'ending-soon',
  );
}
