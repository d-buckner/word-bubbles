import type { DictionaryIndex } from './types';

const CDN_URL =
  'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';

function buildIndex(words: string[]): DictionaryIndex {
  const index: DictionaryIndex = new Map();

  for (const word of words) {
    if (word.length < 3) continue;

    // Index the word under all prefix lengths 2–4 (as long as prefix < word)
    const maxPrefixLen = Math.min(4, word.length - 1);
    for (let pLen = 2; pLen <= maxPrefixLen; pLen++) {
      const prefix = word.slice(0, pLen);

      let lengthMap = index.get(prefix);
      if (!lengthMap) {
        lengthMap = new Map();
        index.set(prefix, lengthMap);
      }

      let wordSet = lengthMap.get(word.length);
      if (!wordSet) {
        wordSet = new Set();
        lengthMap.set(word.length, wordSet);
      }

      wordSet.add(word);
    }
  }

  return index;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

export async function loadDictionary(): Promise<DictionaryIndex> {
  let text: string;

  try {
    text = await fetchText(`${import.meta.env.BASE_URL}words.txt`);
  } catch {
    console.warn('words.txt not found locally, falling back to CDN…');
    text = await fetchText(CDN_URL);
  }

  const words = text
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]{3,}$/.test(w));

  const index = buildIndex(words);
  console.log(`Dictionary: ${words.length} words indexed across ${index.size} prefixes`);
  return index;
}

export function isValidWord(
  index: DictionaryIndex,
  prefix: string,
  word: string,
): boolean {
  return index.get(prefix)?.get(word.length)?.has(word) ?? false;
}

export function wordsForSlot(
  index: DictionaryIndex,
  prefix: string,
  length: number,
): Set<string> {
  return index.get(prefix)?.get(length) ?? new Set();
}
