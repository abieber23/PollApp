import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'survey/:id',
    loadComponent: () =>
      import('./features/survey-detail/survey-detail.component').then(
        (m) => m.SurveyDetailComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
