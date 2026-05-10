import type {
  LevelConfig,
  SlotState,
  RoundState,
  DictionaryIndex,
  SubmitResult,
} from './types';
import { isValidWord } from './dictionary';
import { CURATED_LEVELS } from './levels';

export interface GameCallbacks {
  onStateChange: (state: RoundState) => void;
  onWordAccepted: (word: string, slotId: number) => void;
  onWordRejected: (reason: SubmitResult) => void;
  onTick: (timeRemaining: number) => void;
}

function buildSlots(level: LevelConfig): SlotState[] {
  return level.slots.map((len, i) => ({
    id: i,
    targetLength: len,
    filled: false,
    word: null,
  }));
}

export class GameEngine {
  private readonly dict: DictionaryIndex;
  private readonly callbacks: GameCallbacks;

  private state: RoundState | null = null;
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private _levelIndex = 0;

  sessionScore = 0;

  constructor(dict: DictionaryIndex, callbacks: GameCallbacks) {
    this.dict = dict;
    this.callbacks = callbacks;
  }

  get levelIndex(): number {
    return this._levelIndex;
  }

  getState(): RoundState | null {
    return this.state;
  }

  startLevel(index: number): void {
    this._levelIndex = index;
    const level = CURATED_LEVELS[index];

    this.clearTimer();
    this.state = {
      level,
      slots: buildSlots(level),
      usedWords: new Set(),
      timeRemaining: level.duration,
      score: 0,
      status: 'playing',
    };

    this.startTimer();
    this.callbacks.onStateChange(this.state);
  }

  submitWord(raw: string): SubmitResult {
    if (!this.state || this.state.status !== 'playing') return 'empty';

    const word = raw.trim().toLowerCase();
    if (word.length === 0) return 'empty';

    const { prefix } = this.state.level;

    if (!word.startsWith(prefix)) {
      this.callbacks.onWordRejected('wrong_prefix');
      return 'wrong_prefix';
    }

    const targetSlot = this.state.slots.find(
      (s) => !s.filled && s.targetLength === word.length,
    );
    if (!targetSlot) {
      this.callbacks.onWordRejected('wrong_length');
      return 'wrong_length';
    }

    if (!isValidWord(this.dict, prefix, word)) {
      this.callbacks.onWordRejected('not_a_word');
      return 'not_a_word';
    }

    if (this.state.usedWords.has(word)) {
      this.callbacks.onWordRejected('already_used');
      return 'already_used';
    }

    // Accept the word
    targetSlot.filled = true;
    targetSlot.word = word;
    this.state.usedWords.add(word);
    this.state.score += word.length * 10;

    this.callbacks.onWordAccepted(word, targetSlot.id);

    if (this.state.slots.every((s) => s.filled)) {
      this.win();
    } else {
      this.callbacks.onStateChange(this.state);
    }

    return 'accepted';
  }

  nextLevel(): void {
    const next = this._levelIndex + 1;
    if (next < CURATED_LEVELS.length) this.startLevel(next);
  }

  retryLevel(): void {
    this.startLevel(this._levelIndex);
  }

  hasNextLevel(): boolean {
    return this._levelIndex + 1 < CURATED_LEVELS.length;
  }

  destroy(): void {
    this.clearTimer();
  }

  private win(): void {
    if (!this.state) return;
    this.clearTimer();
    const timeBonus = this.state.timeRemaining * 5;
    this.state.score += timeBonus;
    this.state.status = 'won';
    this.sessionScore += this.state.score;
    this.callbacks.onStateChange(this.state);
  }

  private lose(): void {
    if (!this.state) return;
    this.clearTimer();
    this.state.status = 'lost';
    this.sessionScore += this.state.score;
    this.callbacks.onStateChange(this.state);
  }

  private startTimer(): void {
    this.timerHandle = setInterval(() => {
      if (!this.state || this.state.status !== 'playing') return;
      this.state.timeRemaining = Math.max(0, this.state.timeRemaining - 1);
      this.callbacks.onTick(this.state.timeRemaining);
      if (this.state.timeRemaining === 0) this.lose();
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
