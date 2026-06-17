import { Component, output } from '@angular/core';
import { ButtonPrimaryComponent } from '../../../shared/components/button-primary/button-primary.component';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [ButtonPrimaryComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {
  newSurvey = output<void>();
}
