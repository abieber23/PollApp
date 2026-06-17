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

  totalVotesForQuestion(questionId: string): number {
    const question = this.poll().questions?.find((q) => q.id === questionId);
    if (!question) return 0;
    return (question.options ?? []).reduce(
      (sum, opt) => sum + (this.voteCounts()[opt.id] ?? 0),
      0,
    );
  }

  percentage(optionId: string, questionId: string): number {
    const total = this.totalVotesForQuestion(questionId);
    if (total === 0) return 0;
    return Math.round(((this.voteCounts()[optionId] ?? 0) / total) * 100);
  }

  optionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
}
