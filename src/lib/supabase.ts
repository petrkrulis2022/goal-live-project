import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── DB row types (mirror the SQL schema) ──────────────────────────────────────

export interface DbMatch {
  id: string;
  external_match_id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: "pre-match" | "live" | "halftime" | "finished" | "cancelled";
  current_minute: number;
  score_home: number;
  score_away: number;
  half: 1 | 2;
  is_demo: boolean;
  oracle_address: string | null;
  odds_api_provider: string | null;
  odds_api_config: Record<string, unknown>;
  contract_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPlayer {
  id: string;
  match_id: string;
  external_player_id: string;
  name: string;
  team: "home" | "away";
  jersey_number: number | null;
  position: string | null;
  odds: number;
  updated_at: string;
}

export interface DbBet {
  id: string;
  bettor_wallet: string;
  match_id: string;
  bet_type: "NEXT_GOAL_SCORER" | "MATCH_WINNER";
  original_player_id: string;
  current_player_id: string;
  outcome: "home" | "away" | "draw" | null;
  original_amount: number;
  current_amount: number;
  total_penalties: number;
  change_count: number;
  odds: number;
  status:
    | "active"
    | "provisional_win"
    | "provisional_loss"
    | "settled_won"
    | "settled_lost"
    | "void";
  placed_at: string;
  placed_at_minute: number;
  goal_window_at_placement: number | null;
  blockchain_bet_id: string | null;
  blockchain_lock_tx: string | null;
  blockchain_settle_tx: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbBetChange {
  id: string;
  bet_id: string;
  from_player_id: string;
  to_player_id: string;
  penalty_amount: number;
  penalty_pct: number;
  match_minute: number;
  changed_at: string;
  blockchain_tx: string | null;
}

export interface DbGoalEvent {
  id: string;
  match_id: string;
  player_id: string;
  player_name: string;
  team: "home" | "away";
  minute: number;
  event_type: "GOAL" | "VAR_OVERTURNED" | "VAR_CORRECTED";
  confirmed: boolean;
  source: "chainlink_cre" | "mock_oracle" | "manual";
  raw_payload: Record<string, unknown>;
  created_at: string;
}
