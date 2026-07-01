import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Poll } from '../../core/models';
import { PollService } from '../../core/services/poll.service';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

interface QuestionForm {
  text: string;
  allow_multiple: boolean;
  options: string[];
}

@Component({
  selector: 'app-create-survey-modal',
  standalone: true,
  imports: [FormsModule, BadgeComponent],
  templateUrl: './create-survey-modal.component.html',
  styleUrl: './create-survey-modal.component.scss',
})
export class CreateSurveyModalComponent {
  private readonly pollService = inject(PollService);

  closed = output<void>();
  pollCreated = output<Poll>();

  title = signal('');
  description = signal('');
  deadline = signal('');
  category = signal('');
  questions = signal<QuestionForm[]>([{ text: '', allow_multiple: false, options: ['', ''] }]);
  submitting = signal(false);
  error = signal<string | null>(null);

  /** - Returns true when title and at least 2 options per question are filled */
  get isValid(): boolean {
    if (!this.title().trim()) return false;
    return this.questions().every(
      (q) => q.text.trim() && q.options.filter((o) => o.trim()).length >= 2,
    );
  }

  /** - Appends a new empty question with two blank options */
  addQuestion(): void {
    this.questions.update((qs) => [...qs, { text: '', allow_multiple: false, options: ['', ''] }]);
  }

  /** - Removes the question at the given index */
  removeQuestion(index: number): void {
    this.questions.update((qs) => qs.filter((_, i) => i !== index));
  }

  /** - Appends a blank option to the question at qIndex */
  addOption(qIndex: number): void {
    this.questions.update((qs) =>
      qs.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q)),
    );
  }

  /** - Removes the option at oIndex from the question at qIndex */
  removeOption(qIndex: number, oIndex: number): void {
    this.questions.update((qs) =>
      qs.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.filter((_, j) => j !== oIndex) } : q,
      ),
    );
  }

  /** - Updates the text of the question at the given index */
  setQuestionText(index: number, text: string): void {
    this.questions.update((qs) => qs.map((q, i) => (i === index ? { ...q, text } : q)));
  }

  /** - Updates the text of a specific option within a question */
  setOptionText(qIndex: number, oIndex: number, text: string): void {
    this.questions.update((qs) =>
      qs.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? text : o)) }
          : q,
      ),
    );
  }

  /** - Toggles the allow_multiple flag of the question at the given index */
  toggleMultiple(index: number): void {
    this.questions.update((qs) =>
      qs.map((q, i) => (i === index ? { ...q, allow_multiple: !q.allow_multiple } : q)),
    );
  }

  /** - Converts a zero-based index to a letter (0 → A) */
  optionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  /**
   * - Validates and publishes the survey via PollService
   * - Emits pollCreated on success, sets error signal on failure
   */
  async publish(): Promise<void> {
    if (!this.isValid || this.submitting()) return;
    console.log('[publish] questions signal:', JSON.stringify(this.questions()));
    this.error.set(null);
    this.submitting.set(true);
    try {
      const poll = await this.pollService.createPoll(
        {
          title: this.title().trim(),
          description: this.description().trim() || undefined,
          deadline: this.deadline() ? new Date(this.deadline()).toISOString() : undefined,
          category: this.category().trim() || undefined,
          status: 'published',
        },
        this.questions().map((q) => ({
          text: q.text.trim(),
          allow_multiple: q.allow_multiple,
          options: q.options.filter((o) => o.trim()),
        })),
      );
      this.pollCreated.emit(poll);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('[CreateSurvey]', err);
      this.error.set(`Fehler: ${msg}`);
    } finally {
      this.submitting.set(false);
    }
  }
}
