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

  private pressStartedInsideModal = false;

  /**
   * - Records whether the press that started this interaction began inside the modal card
   * - Based purely on the mousedown origin, so a text-selection drag that ends outside the
   *   modal is never mistaken for a backdrop click (independent of where the click event
   *   itself ends up resolving to)
   */
  onOverlayMouseDown(event: MouseEvent): void {
    this.pressStartedInsideModal = !!(event.target as HTMLElement).closest('.modal');
  }

  /** - Closes the modal only when the interaction both started and ended on the backdrop */
  onOverlayClick(): void {
    if (!this.pressStartedInsideModal) {
      this.closed.emit();
    }
  }

  title = signal('');
  description = signal('');
  deadline = signal('');
  category = signal('');
  questions = signal<QuestionForm[]>([{ text: '', allow_multiple: false, options: ['', ''] }]);
  submitting = signal(false);
  error = signal<string | null>(null);

  /** - Today's date as yyyy-MM-dd, used as the min attribute for the deadline input */
  readonly minDate = new Date().toISOString().slice(0, 10);

  /** - Latest selectable date, used as the max attribute for the deadline input */
  readonly maxDate = '2100-12-31';

  /** - Returns true when a deadline is set and is before today or after maxDate */
  get isDeadlineInvalid(): boolean {
    return !!this.deadline() && (this.deadline() < this.minDate || this.deadline() > this.maxDate);
  }

  /** - Returns true when title and at least 2 options per question are filled */
  get isValid(): boolean {
    if (!this.title().trim()) return false;
    if (this.isDeadlineInvalid) return false;
    return this.questions().every(
      (q) => q.text.trim() && q.options.filter((o) => o.trim()).length >= 2,
    );
  }

  /** - Clears the survey name field */
  clearTitle(): void {
    this.title.set('');
  }

  /** - Clears the describing text field */
  clearDescription(): void {
    this.description.set('');
  }

  /** - Clears the end date field (it's optional, so this just removes the selection) */
  clearDeadline(): void {
    this.deadline.set('');
  }

  /** - Appends a new empty question with two blank options */
  addQuestion(): void {
    this.questions.update((qs) => [...qs, { text: '', allow_multiple: false, options: ['', ''] }]);
  }

  /** - Removes the question at the given index */
  removeQuestion(index: number): void {
    this.questions.update((qs) => qs.filter((_, i) => i !== index));
  }

  /** - Blanks out a question's text and all of its option texts, keeping the same fields in place */
  private clearQuestionFields(index: number): void {
    this.questions.update((qs) =>
      qs.map((q, i) => (i === index ? { ...q, text: '', options: q.options.map(() => '') } : q)),
    );
  }

  /**
   * - The survey must always keep at least one question, so question 1 can only be cleared, never removed
   * - Every other question is removed entirely
   */
  onDeleteQuestionClick(index: number): void {
    if (index === 0) {
      this.clearQuestionFields(index);
    } else {
      this.removeQuestion(index);
    }
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

  /** - Blanks the text of the option at oIndex, keeping the field in place */
  private clearOptionText(qIndex: number, oIndex: number): void {
    this.questions.update((qs) =>
      qs.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? '' : o)) }
          : q,
      ),
    );
  }

  /**
   * - A question must always keep at least its first 2 answer options, so those are only
   *   ever cleared, never removed
   * - The 3rd option and any further one are removed entirely
   */
  onDeleteOptionClick(qIndex: number, oIndex: number): void {
    if (oIndex < 2) {
      this.clearOptionText(qIndex, oIndex);
    } else {
      this.removeOption(qIndex, oIndex);
    }
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
