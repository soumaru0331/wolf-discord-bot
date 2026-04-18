export type Team = 'village' | 'werewolf' | 'fox' | 'lover' | 'zombie' | 'santa' | 'devil' | 'solo' | 'other';

export type EffectType =
  | 'reveal_role'
  | 'reveal_team'
  | 'protect'
  | 'kill'
  | 'copy_role'
  | 'transform'
  | 'curse'
  | 'vote_weight'
  | 'extra_action'
  | 'block_action'
  | 'revive'
  | 'custom';

export type GameState = 'waiting' | 'playing' | 'ended';
export type PhaseType = 'day' | 'night';

export type TimingType = 'night' | 'day' | 'vote' | 'death' | 'passive' | 'start';

export interface RoleDef {
  id: string;
  name: string;
  team: Team;
  description: string;
  timing: TimingType;
  hasTarget: boolean;
  priority: number;
  winCondition: string;
  effect: EffectType;
}

export interface Player {
  userId: string;
  roleId: string;
  isAlive: boolean;
  isProtected: boolean;
  isCursed: boolean;
  voteWeight: number;
  isBlocked: boolean;
  deathPhase?: number;
  deathCause?: string;
}

export interface GameSettings {
  dayDuration: number;
  nightDuration: number;
  voteDuration: number;
  maxRevotes: number;
  tieDeath: 'random' | 'no_execute' | 'all_execute';
  anonymousVote: boolean;
  revealRoleOnDeath: boolean;
}

export interface NightAction {
  actorId: string;
  targetId: string;
  roleId: string;
  priority: number;
}

export interface VoteRecord {
  voterId: string;
  targetId: string;
}

export interface VoteResult {
  targetId: string;
  count: number;
  voters: string[];
}

export interface NightResult {
  killed: string[];
  notifications: Map<string, string>;
}

export interface GameRow {
  id: number;
  guild_id: string;
  channel_id: string;
  state: GameState;
  settings: string;
  phase: PhaseType;
  day: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerRow {
  game_id: number;
  user_id: string;
  role_id: string;
  is_alive: number;
  is_protected: number;
  is_cursed: number;
  vote_weight: number;
  is_blocked: number;
  death_phase: number | null;
  death_cause: string | null;
}
