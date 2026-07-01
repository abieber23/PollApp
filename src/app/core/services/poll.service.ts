import { Injectable, inject } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import type { Poll, CreatePollDto, CreateQuestionDto, Vote } from '../models';

@Injectable({ providedIn: 'root' })
export class PollService {
  private readonly supabase = inject(SupabaseService);
  /** - Returns the typed Supabase DB client reference */
  private get db() {
    return this.supabase.client;
  }

  /** - Fetches all published polls that have not yet expired */
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

  /** - Fetches all published polls whose deadline has passed */
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

  /** - Fetches published polls ending within the next 3 days */
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

  /** - Loads a single poll with its questions and options by ID */
  async getPollById(id: string): Promise<Poll | null> {
    const { data, error } = await this.db
      .from('polls')
      .select('*, questions(*, options(*))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Poll;
  }

  /**
   * - Loads all votes for a poll
   * - Returns the vote count per option as a Record
   */
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

  /** - Inserts a single vote for the given option into the database */
  async vote(pollId: string, questionId: string, optionId: string): Promise<void> {
    const { error } = await this.db
      .from('votes')
      .insert({ poll_id: pollId, question_id: questionId, option_id: optionId });
    if (error) throw error;
  }

  /** - Inserts the poll row into the database and returns it */
  private async insertPoll(pollDto: CreatePollDto): Promise<Poll> {
    const { data: poll, error } = await this.db
      .from('polls')
      .insert(pollDto)
      .select()
      .single();
    if (error) throw new Error(`polls INSERT: ${error.message} (code: ${error.code})`);
    return poll as Poll;
  }

  /**
   * - Inserts a question with its metadata into the database
   * - Returns the created question including its generated ID
   */
  private async insertQuestion(pollId: string, q: CreateQuestionDto, index: number): Promise<{ id: string }> {
    console.log(`[createPoll] inserting question[${index}]:`, q.text, '| options:', q.options);
    const { data: question, error } = await this.db
      .from('questions')
      .insert({ poll_id: pollId, text: q.text, allow_multiple: q.allow_multiple, order_index: index })
      .select()
      .single();
    if (error) throw new Error(`questions INSERT: ${error.message} (code: ${error.code})`);
    console.log(`[createPoll] question[${index}] created with id:`, question.id);
    return question;
  }

  /** - Bulk-inserts all answer options for a question into the database */
  private async insertOptions(questionId: string, pollId: string, options: string[], index: number): Promise<void> {
    const { error } = await this.db
      .from('options')
      .insert(options.map((label) => ({ question_id: questionId, poll_id: pollId, label })));
    if (error) throw new Error(`options INSERT: ${error.message} (code: ${error.code})`);
    console.log(`[createPoll] options for question[${index}] inserted`);
  }

  /**
   * - Creates a full poll with all questions and options
   * - Runs inserts for poll, questions, and options sequentially
   */
  async createPoll(pollDto: CreatePollDto, questions: CreateQuestionDto[]): Promise<Poll> {
    const poll = await this.insertPoll(pollDto);
    console.log(`[createPoll] ${questions.length} question(s) to insert:`, questions.map(q => q.text));
    for (let i = 0; i < questions.length; i++) {
      const question = await this.insertQuestion(poll.id, questions[i], i);
      await this.insertOptions(question.id, poll.id, questions[i].options, i);
    }
    return poll;
  }

  /**
   * - Deletes a poll by ID from the database
   * - Throws if RLS blocks the deletion
   */
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

  /**
   * - Subscribes to real-time INSERT events on the votes table
   * - Returns the active Realtime channel
   */
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
