import { Component, input } from '@angular/core';
import type { Poll } from '../../../core/models';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';

@Component({
  selector: 'app-survey-results',
  standalone: true,
  imports: [ProgressBarComponent],
  templateUrl: './survey-results.component.html',
  styleUrl: './survey-results.component.scss',
})
export class SurveyResultsComponent {
  poll = input.required<Poll>();
  voteCounts = input<Record<string, number>>({});

  /** - Sums all votes across all options for the given question */
  totalVotesForQuestion(questionId: string): number {
    const question = this.poll().questions?.find((q) => q.id === questionId);
    if (!question) return 0;
    return (question.options ?? []).reduce(
      (sum, opt) => sum + (this.voteCounts()[opt.id] ?? 0),
      0,
    );
  }

  /** - Returns the percentage share of an option out of total question votes */
  percentage(optionId: string, questionId: string): number {
    const total = this.totalVotesForQuestion(questionId);
    if (total === 0) return 0;
    return Math.round(((this.voteCounts()[optionId] ?? 0) / total) * 100);
  }

  /** - Converts a zero-based index to a letter (0 → A) */
  optionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
}
