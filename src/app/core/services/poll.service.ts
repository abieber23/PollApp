import { Injectable, inject } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import type { Poll, CreatePollDto, CreateQuestionDto, Vote } from '../models';

@Injectable({ providedIn: 'root' })
export class PollService {
  private readonly supabase = inject(SupabaseService);
  private get db() {
    return this.supabase.client;
  }

  async getActivePolls(): Promise<Poll[]> {
    const { data, error } = await this.db
      .from('polls')
      .select('*, questions(*, options(*))')
      .eq('status', 'published')
      .or(`deadline.is.null,deadline.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Poll[];
  }

  async getPastPolls(): Promise<Poll[]> {
    const { data, error } = await this.db
      .from('polls')
      .select('*, questions(*, options(*))')
      .eq('status', 'published')
      .lt('deadline', new Date().toISOString())
      .order('deadline', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Poll[];
  }

  async getEndingSoonPolls(): Promise<Poll[]> {
    const now = new Date();
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const { data, error } = await this.db
      .from('polls')
      .select('*, questions(*, options(*))')
      .eq('status', 'published')
      .gt('deadline', now.toISOString())
      .lt('deadline', inThreeDays.toISOString())
      .order('deadline', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Poll[];
  }

  async getPollById(id: string): Promise<Poll | null> {
    const { data, error } = await this.db
      .from('polls')
      .select('*, questions(*, options(*))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Poll;
  }

  async getVoteCounts(pollId: string): Promise<Record<string, number>> {
    const { data, error } = await this.db
      .from('votes')
      .select('option_id')
      .eq('poll_id', pollId);
    if (error) throw error;
    const counts: Record<string, number> = {};
    (data ?? []).forEach((v) => {
      counts[v.option_id] = (counts[v.option_id] ?? 0) + 1;
    });
    return counts;
  }

  async vote(pollId: string, questionId: string, optionId: string): Promise<void> {
    const { error } = await this.db
      .from('votes')
      .insert({ poll_id: pollId, question_id: questionId, option_id: optionId });
    if (error) throw error;
  }

  async createPoll(pollDto: CreatePollDto, questions: CreateQuestionDto[]): Promise<Poll> {
    const { data: poll, error: pollError } = await this.db
      .from('polls')
      .insert(pollDto)
      .select()
      .single();
    if (pollError) throw new Error(`polls INSERT: ${pollError.message} (code: ${pollError.code})`);

    console.log(`[createPoll] ${questions.length} question(s) to insert:`, questions.map(q => q.text));

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      console.log(`[createPoll] inserting question[${i}]:`, q.text, '| options:', q.options);

      const { data: question, error: qError } = await this.db
        .from('questions')
        .insert({ poll_id: poll.id, text: q.text, allow_multiple: q.allow_multiple, order_index: i })
        .select()
        .single();
      if (qError) throw new Error(`questions INSERT: ${qError.message} (code: ${qError.code})`);
      console.log(`[createPoll] question[${i}] created with id:`, question.id);

      const { error: oError } = await this.db
        .from('options')
        .insert(q.options.map((label) => ({ question_id: question.id, poll_id: poll.id, label })));
      if (oError) throw new Error(`options INSERT: ${oError.message} (code: ${oError.code})`);
      console.log(`[createPoll] options for question[${i}] inserted`);
    }

    return poll as Poll;
  }

  async deletePoll(id: string): Promise<void> {
    const { data, error } = await this.db
      .from('polls')
      .delete()
      .eq('id', id)
      .select();
    if (error) throw new Error(`polls DELETE: ${error.message}`);
    if (!data || data.length === 0) {
      throw new Error('RLS blockiert das Löschen – bitte die Supabase DELETE-Policy für "polls" hinzufügen.');
    }
  }

  subscribeToVotes(pollId: string, callback: (vote: Vote) => void): RealtimeChannel {
    return this.db
      .channel(`poll-votes:${pollId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `poll_id=eq.${pollId}` },
        (payload) => callback(payload.new as Vote),
      )
      .subscribe();
  }
}
