import { Component, input, output } from '@angular/core';
import type { Poll } from '../../../core/models';
import { SurveyCardComponent } from '../../../shared/components/survey-card/survey-card.component';

@Component({
  selector: 'app-ending-soon',
  standalone: true,
  imports: [SurveyCardComponent],
  templateUrl: './ending-soon.component.html',
  styleUrl: './ending-soon.component.scss',
})
export class EndingSoonComponent {
  polls = input<Poll[]>([]);
  pollSelected = output<Poll>();
  pollDelete = output<string>();
}
