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
  private readonly votedPollsStorageKey = 'pollapp_voted_polls';

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

  /** - Subscribes to route param changes and triggers poll loading */
  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.routeSub = this.route.paramMap.subscribe((params) => {
        const id = params.get('id');
        if (id) this.init(id);
        else this.router.navigate(['/']);
      });
    }
  }

  /** - Returns true when the poll's deadline has already passed */
  get isPast(): boolean {
    const deadline = this.poll()?.deadline;
    return !!deadline && new Date(deadline) < new Date();
  }

  /** - Returns true when every question has at least one option selected */
  get canSubmit(): boolean {
    const questions = this.poll()?.questions ?? [];
    return questions.length > 0 && questions.every(
      (q) => (this.selectedOptions()[q.id] ?? []).length > 0,
    );
  }

  /** - Unsubscribes from realtime and resets all signals to their initial values */
  private resetState(): void {
    this.realtimeSubscription?.unsubscribe();
    this.poll.set(null);
    this.voteCounts.set({});
    this.selectedOptions.set({});
    this.voted.set(false);
    this.loading.set(true);
    this.error.set(null);
  }

  /**
   * - Fetches poll and vote counts in parallel
   * - Subscribes to live vote updates via Realtime
   */
  private async loadPollData(id: string): Promise<void> {
    const [poll, counts] = await Promise.all([
      this.pollService.getPollById(id),
      this.pollService.getVoteCounts(id),
    ]);
    this.poll.set(poll);
    this.voteCounts.set(counts);
    if (poll && this.hasAlreadyVoted(poll.id)) {
      this.voted.set(true);
    }
    this.realtimeSubscription = this.pollService.subscribeToVotes(id, (vote: Vote) => {
      this.voteCounts.update((c) => ({ ...c, [vote.option_id]: (c[vote.option_id] ?? 0) + 1 }));
    });
  }

  /** - Reads the list of poll IDs the user has already voted on from localStorage */
  private getVotedPollIds(): string[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      return JSON.parse(localStorage.getItem(this.votedPollsStorageKey) ?? '[]');
    } catch {
      return [];
    }
  }

  /** - Returns true when this browser has already recorded a vote for the given poll */
  private hasAlreadyVoted(pollId: string): boolean {
    return this.getVotedPollIds().includes(pollId);
  }

  /** - Persists the given poll ID as voted in localStorage */
  private markPollAsVoted(pollId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const ids = this.getVotedPollIds();
    if (!ids.includes(pollId)) {
      localStorage.setItem(this.votedPollsStorageKey, JSON.stringify([...ids, pollId]));
    }
  }

  /**
   * - Resets state and loads poll data for the given ID
   * - Sets the error signal on failure
   */
  private async init(id: string): Promise<void> {
    this.resetState();
    try {
      await this.loadPollData(id);
    } catch {
      this.error.set('Failed to load survey.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * - Computes the new selection state for a question
   * - Supports both single-select and multi-select modes
   */
  private updatedSelection(sel: Record<string, string[]>, questionId: string, optionId: string, allowMultiple: boolean): Record<string, string[]> {
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
  }

  /** - Toggles an answer option; blocked when already voted or poll is past */
  toggleOption(questionId: string, optionId: string, allowMultiple: boolean): void {
    if (this.voted() || this.isPast) return;
    this.selectedOptions.update((sel) =>
      this.updatedSelection(sel, questionId, optionId, allowMultiple)
    );
  }

  /** - Returns true if the given option is currently selected */
  isSelected(questionId: string, optionId: string): boolean {
    return (this.selectedOptions()[questionId] ?? []).includes(optionId);
  }

  /** - Iterates all selected options and sends each as a separate vote */
  private async sendVotes(poll: Poll): Promise<void> {
    for (const question of poll.questions ?? []) {
      for (const optionId of this.selectedOptions()[question.id] ?? []) {
        await this.pollService.vote(poll.id, question.id, optionId);
      }
    }
  }

  /** - Sets the voted signal, persists it to localStorage, and navigates home after 2 s */
  private onVoteSuccess(): void {
    const poll = this.poll();
    if (poll) this.markPollAsVoted(poll.id);
    this.voted.set(true);
    setTimeout(() => this.router.navigate(['/']), 2000);
  }

  /**
   * - Validates state, sends all votes, then navigates home
   * - Sets the error signal if submission fails
   */
  async submitVotes(): Promise<void> {
    const poll = this.poll();
    if (!poll || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.sendVotes(poll);
      this.onVoteSuccess();
    } catch {
      this.error.set('Failed to submit. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  /** - Formats a date string to DD/MM/YYYY */
  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** - Converts a zero-based index to a letter (0 → A) */
  optionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  /**
   * - Shows a toast notification after poll creation
   * - Navigates to the new poll detail page after 1.8 s
   */
  onPollCreated(poll: Poll): void {
    this.pendingPoll.set(poll);
    this.showToast.set(true);
    setTimeout(() => {
      this.showToast.set(false);
      this.showCreateModal.set(false);
      this.router.navigate(['/survey', poll.id]);
    }, 1800);
  }

  /** - Closes the toast and navigates to the pending poll */
  dismissToast(): void {
    this.showToast.set(false);
    this.showCreateModal.set(false);
    const poll = this.pendingPoll();
    if (poll) this.router.navigate(['/survey', poll.id]);
  }

  /**
   * - Deletes the current poll after user confirmation
   * - Navigates home on success, sets error signal on failure
   */
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

  /** - Cleans up realtime and route subscriptions on component destruction */
  ngOnDestroy(): void {
    this.realtimeSubscription?.unsubscribe();
    this.routeSub?.unsubscribe();
  }
}
