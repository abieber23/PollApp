import { Component, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Poll, Vote } from '../../core/models';
import { PollService } from '../../core/services/poll.service';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { SurveyResultsComponent } from './survey-results/survey-results.component';

@Component({
  selector: 'app-survey-detail',
  standalone: true,
  imports: [RouterLink, BadgeComponent, SurveyResultsComponent],
  templateUrl: './survey-detail.component.html',
  styleUrl: './survey-detail.component.scss',
})
export class SurveyDetailComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pollService = inject(PollService);
  private readonly platformId = inject(PLATFORM_ID);
  private subscription: RealtimeChannel | null = null;

  poll = signal<Poll | null>(null);
  voteCounts = signal<Record<string, number>>({});
  selectedOptions = signal<Record<string, string[]>>({});
  voted = signal(false);
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.init();
    }
  }

  get isPast(): boolean {
    const deadline = this.poll()?.deadline;
    return !!deadline && new Date(deadline) < new Date();
  }

  get canSubmit(): boolean {
    const questions = this.poll()?.questions ?? [];
    return questions.length > 0 && questions.every(
      (q) => (this.selectedOptions()[q.id] ?? []).length > 0,
    );
  }

  private async init(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/']);
      return;
    }
    try {
      const [poll, counts] = await Promise.all([
        this.pollService.getPollById(id),
        this.pollService.getVoteCounts(id),
      ]);
      this.poll.set(poll);
      this.voteCounts.set(counts);

      this.subscription = this.pollService.subscribeToVotes(id, (vote: Vote) => {
        this.voteCounts.update((c) => ({ ...c, [vote.option_id]: (c[vote.option_id] ?? 0) + 1 }));
      });
    } catch {
      this.error.set('Failed to load survey.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleOption(questionId: string, optionId: string, allowMultiple: boolean): void {
    if (this.voted() || this.isPast) return;
    this.selectedOptions.update((sel) => {
      const current = sel[questionId] ?? [];
      if (allowMultiple) {
        return {
          ...sel,
          [questionId]: current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId],
        };
      }
      return { ...sel, [questionId]: current.includes(optionId) ? [] : [optionId] };
    });
  }

  isSelected(questionId: string, optionId: string): boolean {
    return (this.selectedOptions()[questionId] ?? []).includes(optionId);
  }

  async submitVotes(): Promise<void> {
    const poll = this.poll();
    if (!poll || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      for (const question of poll.questions ?? []) {
        for (const optionId of this.selectedOptions()[question.id] ?? []) {
          await this.pollService.vote(poll.id, question.id, optionId);
        }
      }
      this.voted.set(true);
    } catch {
      this.error.set('Failed to submit. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  optionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  async deletePoll(): Promise<void> {
    const poll = this.poll();
    if (!poll) return;
    if (!confirm('Umfrage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    try {
      await this.pollService.deletePoll(poll.id);
      this.router.navigate(['/']);
    } catch {
      this.error.set('Löschen fehlgeschlagen. Bitte erneut versuchen.');
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
