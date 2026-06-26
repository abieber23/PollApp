import { Component, computed, input, output, signal } from '@angular/core';
import type { Poll } from '../../../core/models';
import { SurveyCardComponent } from '../../../shared/components/survey-card/survey-card.component';

@Component({
  selector: 'app-survey-list',
  standalone: true,
  imports: [SurveyCardComponent],
  templateUrl: './survey-list.component.html',
  styleUrl: './survey-list.component.scss',
})
export class SurveyListComponent {
  activePolls = input<Poll[]>([]);
  pastPolls = input<Poll[]>([]);
  pollSelected = output<Poll>();
  pollDelete = output<string>();

  activeTab = signal<'active' | 'past'>('active');
  selectedCategory = signal<string | null>(null);
  dropdownOpen = signal(false);

  selectCategory(cat: string | null): void {
    this.selectedCategory.set(cat);
    this.dropdownOpen.set(false);
  }

  currentPolls = computed(() =>
    this.activeTab() === 'active' ? this.activePolls() : this.pastPolls(),
  );

  categories = computed(() => {
    const all = this.currentPolls()
      .map((p) => p.category)
      .filter(Boolean) as string[];
    return [...new Set(all)];
  });

  filteredPolls = computed(() => {
    const cat = this.selectedCategory();
    return cat ? this.currentPolls().filter((p) => p.category === cat) : this.currentPolls();
  });

  setTab(tab: 'active' | 'past'): void {
    this.activeTab.set(tab);
    this.selectedCategory.set(null);
  }
}
