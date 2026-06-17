import type { Option } from './option.model';

export interface Question {
  id: string;
  poll_id: string;
  text: string;
  allow_multiple: boolean;
  order_index: number;
  created_at: string;
  options?: Option[];
}

export interface CreateQuestionDto {
  text: string;
  allow_multiple: boolean;
  options: string[];
}
