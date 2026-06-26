import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import type { Poll } from '../../core/models';
import { PollService } from '../../core/services/poll.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { HeroComponent } from './hero/hero.component';
import { EndingSoonComponent } from './ending-soon/ending-soon.component';
import { SurveyListComponent } from './survey-list/survey-list.component';
import { CreateSurveyModalComponent } from '../create-survey/create-survey-modal.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NavbarComponent, HeroComponent, EndingSoonComponent, SurveyListComponent, CreateSurveyModalComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly pollService = inject(PollService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  activePolls = signal<Poll[]>([]);
  pastPolls = signal<Poll[]>([]);
  endingSoonPolls = signal<Poll[]>([]);
  showCreateModal = signal(false);
  loading = signal(true);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadPolls();
    }
  }

  private async loadPolls(): Promise<void> {
    try {
      const [active, past, ending] = await Promise.all([
        this.pollService.getActivePolls(),
        this.pollService.getPastPolls(),
        this.pollService.getEndingSoonPolls(),
      ]);
      this.activePolls.set(active);
      this.pastPolls.set(past);
      this.endingSoonPolls.set(ending);
    } finally {
      this.loading.set(false);
    }
  }

  navigateToPoll(poll: Poll): void {
    this.router.navigate(['/survey', poll.id]);
  }

  showToast = signal(false);
  private pendingPoll = signal<Poll | null>(null);

  onPollCreated(poll: Poll): void {
    this.activePolls.update((polls) => [poll, ...polls]);
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

  async deletePoll(pollId: string): Promise<void> {
    if (!confirm('Umfrage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    try {
      await this.pollService.deletePoll(pollId);
      const remove = (list: Poll[]) => list.filter((p) => p.id !== pollId);
      this.activePolls.update(remove);
      this.pastPolls.update(remove);
      this.endingSoonPolls.update(remove);
    } catch (err) {
      console.error('Delete failed', err);
      alert('Löschen fehlgeschlagen. Bitte erneut versuchen.');
    }
  }
}
