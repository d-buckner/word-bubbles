export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export type SubmitResult =
  | 'accepted'
  | 'wrong_prefix'
  | 'wrong_length'
  | 'not_a_word'
  | 'already_used'
  | 'empty';

export interface LevelConfig {
  prefix: string;
  slots: number[];
  duration: number;
  difficulty: Difficulty;
}

export interface SlotState {
  id: number;
  targetLength: number;
  filled: boolean;
  word: string | null;
}

export interface RoundState {
  level: LevelConfig;
  slots: SlotState[];
  usedWords: Set<string>;
  timeRemaining: number;
  score: number;
  status: GameStatus;
}

export type DictionaryIndex = Map<string, Map<number, Set<string>>>;
