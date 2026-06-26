import { Component, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Poll, Vote } from '../../core/models';
import { PollService } from '../../core/services/poll.service';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { SurveyResultsComponent } from './survey-results/survey-results.component';
import { ButtonPrimaryComponent } from '../../shared/components/button-primary/button-primary.component';
import { CreateSurveyModalComponent } from '../create-survey/create-survey-modal.component';

@Component({
  selector: 'app-survey-detail',
  standalone: true,
  imports: [RouterLink, BadgeComponent, SurveyResultsComponent, ButtonPrimaryComponent, CreateSurveyModalComponent],
  templateUrl: './survey-detail.component.html',
  styleUrl: './survey-detail.component.scss',
})
export class SurveyDetailComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pollService = inject(PollService);
  private readonly platformId = inject(PLATFORM_ID);
  private realtimeSubscription: RealtimeChannel | null = null;
  private routeSub: Subscription | null = null;

  showCreateModal = signal(false);
  showToast = signal(false);
  private pendingPoll = signal<Poll | null>(null);
  poll = signal<Poll | null>(null);
  voteCounts = signal<Record<string, number>>({});
  selectedOptions = signal<Record<string, string[]>>({});
  voted = signal(false);
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.routeSub = this.route.paramMap.subscribe((params) => {
        const id = params.get('id');
        if (id) this.init(id);
        else this.router.navigate(['/']);
      });
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

  private async init(id: string): Promise<void> {
    this.realtimeSubscription?.unsubscribe();
    this.poll.set(null);
    this.voteCounts.set({});
    this.selectedOptions.set({});
    this.voted.set(false);
    this.loading.set(true);
    this.error.set(null);
    try {
      const [poll, counts] = await Promise.all([
        this.pollService.getPollById(id),
        this.pollService.getVoteCounts(id),
      ]);
      this.poll.set(poll);
      this.voteCounts.set(counts);

      this.realtimeSubscription = this.pollService.subscribeToVotes(id, (vote: Vote) => {
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
      setTimeout(() => this.router.navigate(['/']), 2000);
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

  onPollCreated(poll: Poll): void {
    this.pendingPoll.set(poll);
    this.showToast.set(true);
    setTimeout(() => {
      this.showToast.set(false);
      this.showCreateModal.set(false);
      this.router.navigate(['/survey', poll.id]);
    }, 1800);
  }

  dismissToast(): void {
    this.showToast.set(false);
    this.showCreateModal.set(false);
    const poll = this.pendingPoll();
    if (poll) this.router.navigate(['/survey', poll.id]);
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
    this.realtimeSubscription?.unsubscribe();
    this.routeSub?.unsubscribe();
  }
}
