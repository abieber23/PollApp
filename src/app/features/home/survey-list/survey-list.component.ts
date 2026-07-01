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

  /** - Sets the active category filter and closes the dropdown */
  selectCategory(cat: string | null): void {
    this.selectedCategory.set(cat);
    this.dropdownOpen.set(false);
  }

  /** - Returns polls for the active tab (active or past) */
  currentPolls = computed(() =>
    this.activeTab() === 'active' ? this.activePolls() : this.pastPolls(),
  );

  /** - Returns a deduplicated list of categories for the current poll list */
  categories = computed(() => {
    const all = this.currentPolls()
      .map((p) => p.category)
      .filter(Boolean) as string[];
    return [...new Set(all)];
  });

  /** - Filters the current poll list by the selected category */
  filteredPolls = computed(() => {
    const cat = this.selectedCategory();
    return cat ? this.currentPolls().filter((p) => p.category === cat) : this.currentPolls();
  });

  /** - Switches the active tab and resets the category filter */
  setTab(tab: 'active' | 'past'): void {
    this.activeTab.set(tab);
    this.selectedCategory.set(null);
  }
}
