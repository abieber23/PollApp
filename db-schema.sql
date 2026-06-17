-- Poll App – Supabase Schema Extension
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)

-- 1. Extend polls with category and status
ALTER TABLE polls
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- 2. New questions table (one poll → many questions)
CREATE TABLE IF NOT EXISTS questions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id       UUID        NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text          TEXT        NOT NULL,
  allow_multiple BOOLEAN    NOT NULL DEFAULT false,
  order_index   INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Link options to questions instead of directly to polls
ALTER TABLE options
  ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES questions(id) ON DELETE CASCADE;

-- 4. Track which question each vote belongs to
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES questions(id);

-- 5. Row Level Security for questions
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read questions"   ON questions FOR SELECT USING (true);
CREATE POLICY "anon insert questions" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon delete questions" ON questions FOR DELETE USING (true);

-- 6. Enable Realtime for live vote updates
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- 7. Allow anon to delete polls (cascades to questions, options, votes)
CREATE POLICY "anon delete polls" ON polls
  FOR DELETE USING (true);
