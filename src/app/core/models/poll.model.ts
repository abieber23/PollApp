import type { Question } from './question.model';

export interface Poll {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  category?: string;
  status: 'draft' | 'published';
  created_at: string;
  questions?: Question[];
}

export interface CreatePollDto {
  title: string;
  description?: string;
  deadline?: string;
  category?: string;
  status: 'draft' | 'published';
}
