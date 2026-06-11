/* ═══════════════════════════════════════════════════════════════════
   db.js — Supabase Leaderboard Manager
   ─────────────────────────────────────────────────────────────────
   SETUP INSTRUCTIONS:
   1. Go to https://supabase.com and create a free project
   2. In the SQL Editor, run the SQL below to create the table
   3. Replace SUPABASE_URL and SUPABASE_ANON_KEY with your values

   SQL to run in Supabase → SQL Editor:
   ─────────────────────────────────────
   create table if not exists leaderboard (
     id          bigserial primary key,
     nickname    text        not null,
     score       integer     not null,
     wave        integer     not null default 1,
     kills       integer     not null default 0,
     created_at  timestamptz not null default now()
   );

   -- Index for fast ranking queries
   create index if not exists leaderboard_score_idx on leaderboard (score desc);

   -- Allow anyone to read & insert (no auth required for this game)
   alter table leaderboard enable row level security;
   create policy "public read"   on leaderboard for select using (true);
   create policy "public insert" on leaderboard for insert with check (true);
   ─────────────────────────────────────────────────────────────────
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ── ⚙️  YOUR SUPABASE CREDENTIALS — FILL THESE IN ─────────────── */
const SUPABASE_URL      = 'https://dkveqztlrovnwpmqndvc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrdmVxenRscm92bndwbXFuZHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk1OTgsImV4cCI6MjA5Njc2NTU5OH0.TGQocuWMDGMxooexHHThibH3afqBz68KiHVE7QPB3P8';
/* ─────────────────────────────────────────────────────────────────── */

const TABLE = 'leaderboard';

class LeaderboardDB {
  constructor() {
    this._ready = false;
    this._client = null;
    this._init();
  }

  _init() {
    // Check credentials are configured
    if (
      SUPABASE_URL.includes('YOUR_PROJECT_ID') ||
      SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')
    ) {
      console.warn(
        '⚠️  Leaderboard: Supabase credentials not configured.\n' +
        'Open db.js and fill in SUPABASE_URL and SUPABASE_ANON_KEY.\n' +
        'The game will run in offline mode (localStorage only).'
      );
      this._ready = false;
      return;
    }

    try {
      this._client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      this._ready  = true;
      console.log('✅ Leaderboard: Supabase connected');
    } catch (e) {
      console.error('❌ Leaderboard: Supabase init failed', e);
      this._ready = false;
    }
  }

  get isReady() { return this._ready; }

  /* ── Submit a score ─────────────────────────────────────────────
     Returns { rank, total } — the player's global rank after insert
  ─────────────────────────────────────────────────────────────────── */
  async submitScore({ nickname, score, wave, kills }) {
    if (!this._ready) return null;

    try {
      // Sanitise nickname
      const name = String(nickname).trim().slice(0, 16) || 'PILOT';

      const { error } = await this._client
        .from(TABLE)
        .insert([{ nickname: name, score, wave, kills }]);

      if (error) throw error;

      // Fetch rank right after insert
      const rank = await this.getRank(score);
      return rank;

    } catch (e) {
      console.error('LeaderboardDB.submitScore:', e.message);
      return null;
    }
  }

  /* ── Get rank for a given score (how many scores beat it + 1) ── */
  async getRank(score) {
    if (!this._ready) return null;
    try {
      const { count, error } = await this._client
        .from(TABLE)
        .select('*', { count: 'exact', head: true })
        .gt('score', score);

      if (error) throw error;
      return { rank: (count ?? 0) + 1 };
    } catch (e) {
      console.error('LeaderboardDB.getRank:', e.message);
      return null;
    }
  }

  /* ── Fetch top N scores (all-time) ─────────────────────────────── */
  async getTopScores(limit = 15) {
    if (!this._ready) return [];
    try {
      const { data, error } = await this._client
        .from(TABLE)
        .select('nickname, score, wave, kills, created_at')
        .order('score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    } catch (e) {
      console.error('LeaderboardDB.getTopScores:', e.message);
      return [];
    }
  }

  /* ── Fetch top N scores for today only ─────────────────────────── */
  async getTodayScores(limit = 15) {
    if (!this._ready) return [];
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await this._client
        .from(TABLE)
        .select('nickname, score, wave, kills, created_at')
        .gte('created_at', todayStart.toISOString())
        .order('score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    } catch (e) {
      console.error('LeaderboardDB.getTodayScores:', e.message);
      return [];
    }
  }

  /* ── Format timestamp to readable string ───────────────────────── */
  static formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

/* Singleton — available globally as window.leaderboardDB */
window.leaderboardDB = new LeaderboardDB();
