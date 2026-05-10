import type { LevelConfig, Difficulty, DictionaryIndex } from './types';

export const CURATED_LEVELS: LevelConfig[] = [
  // ── Easy (prefix 2 chars, 3 slots, total word length 4–6, 90s) ──────────
  { prefix: 'st', slots: [4, 5, 6], duration: 90, difficulty: 'easy' },
  { prefix: 'pr', slots: [4, 5, 6], duration: 90, difficulty: 'easy' },
  { prefix: 'tr', slots: [4, 5, 6], duration: 90, difficulty: 'easy' },
  { prefix: 'ch', slots: [4, 5, 6], duration: 90, difficulty: 'easy' },
  { prefix: 'sh', slots: [4, 5, 6], duration: 90, difficulty: 'easy' },

  // ── Medium (prefix 2–3 chars, 4 slots, total 5–8, 75s) ──────────────────
  { prefix: 'str', slots: [5, 6, 7, 8], duration: 75, difficulty: 'medium' },
  { prefix: 'pro', slots: [5, 6, 7, 8], duration: 75, difficulty: 'medium' },
  { prefix: 'un',  slots: [5, 6, 7, 8], duration: 75, difficulty: 'medium' },
  { prefix: 'pre', slots: [5, 6, 7, 8], duration: 75, difficulty: 'medium' },
  { prefix: 'com', slots: [5, 6, 7, 8], duration: 75, difficulty: 'medium' },

  // ── Hard (prefix 3 chars, 5 slots, total 6–9, 60s) ──────────────────────
  { prefix: 'con', slots: [6, 7, 7, 8, 9], duration: 60, difficulty: 'hard' },
  { prefix: 'dis', slots: [6, 7, 7, 8, 9], duration: 60, difficulty: 'hard' },
  { prefix: 'int', slots: [6, 7, 8, 8, 9], duration: 60, difficulty: 'hard' },
  { prefix: 'exp', slots: [6, 7, 7, 8, 9], duration: 60, difficulty: 'hard' },
  { prefix: 'tra', slots: [6, 7, 7, 8, 9], duration: 60, difficulty: 'hard' },

  // ── Expert (prefix 3–4 chars, 6 slots, total 7–10, 50s) ─────────────────
  { prefix: 'over', slots: [7, 8, 8, 9, 10, 10], duration: 50, difficulty: 'expert' },
  { prefix: 'mis',  slots: [7, 8, 8, 9, 10, 10], duration: 50, difficulty: 'expert' },
  { prefix: 'anti', slots: [7, 8, 9, 9, 10, 10], duration: 50, difficulty: 'expert' },
  { prefix: 'comp', slots: [7, 8, 8, 9, 10, 10], duration: 50, difficulty: 'expert' },
  { prefix: 'out',  slots: [7, 8, 8, 9, 10, 10], duration: 50, difficulty: 'expert' },
];

const MIN_WORDS_PER_SLOT = 3;

interface DifficultyParams {
  prefixLengths: number[];
  slotCount: number;
  slotRange: [number, number];
  duration: number;
}

const DIFFICULTY_PARAMS: Record<Difficulty, DifficultyParams> = {
  easy:   { prefixLengths: [2],    slotCount: 3, slotRange: [4, 6],  duration: 90 },
  medium: { prefixLengths: [2, 3], slotCount: 4, slotRange: [5, 8],  duration: 75 },
  hard:   { prefixLengths: [3],    slotCount: 5, slotRange: [6, 9],  duration: 60 },
  expert: { prefixLengths: [3, 4], slotCount: 6, slotRange: [7, 10], duration: 50 },
};

export function validateLevel(config: LevelConfig, dict: DictionaryIndex): boolean {
  for (const slotLen of config.slots) {
    const words = dict.get(config.prefix)?.get(slotLen);
    if (!words || words.size < MIN_WORDS_PER_SLOT) return false;
  }
  return true;
}

export function generateLevel(
  difficulty: Difficulty,
  dict: DictionaryIndex,
): LevelConfig | null {
  const params = DIFFICULTY_PARAMS[difficulty];
  const [minSlot, maxSlot] = params.slotRange;

  // Collect all prefixes of the right lengths that have viable slot options
  const candidates: string[] = [];
  for (const [prefix, lengthMap] of dict) {
    if (!params.prefixLengths.includes(prefix.length)) continue;

    const viableLengths = Array.from(lengthMap.entries()).filter(
      ([len, words]) =>
        len >= minSlot && len <= maxSlot && words.size >= MIN_WORDS_PER_SLOT,
    );

    if (viableLengths.length >= 2) candidates.push(prefix);
  }

  if (candidates.length === 0) return null;

  // Shuffle and try up to 20 candidate prefixes
  for (let attempt = 0; attempt < Math.min(20, candidates.length); attempt++) {
    const idx = Math.floor(Math.random() * candidates.length);
    const prefix = candidates.splice(idx, 1)[0];

    const lengthMap = dict.get(prefix)!;
    const viableLengths = Array.from(lengthMap.entries())
      .filter(
        ([len, words]) =>
          len >= minSlot && len <= maxSlot && words.size >= MIN_WORDS_PER_SLOT,
      )
      .map(([len]) => len);

    if (viableLengths.length < 2) continue;

    // Pick slotCount lengths (sampling with replacement from viable lengths)
    const slots: number[] = Array.from({ length: params.slotCount }, () =>
      viableLengths[Math.floor(Math.random() * viableLengths.length)],
    );

    // Need at least 2 distinct lengths per spec
    if (new Set(slots).size < 2) continue;

    return {
      prefix,
      slots: [...slots].sort((a, b) => a - b),
      duration: params.duration,
      difficulty,
    };
  }

  return null;
}

export function firstLevelForDifficulty(difficulty: Difficulty): number {
  const idx = CURATED_LEVELS.findIndex((l) => l.difficulty === difficulty);
  return idx === -1 ? 0 : idx;
}
