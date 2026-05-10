import type { RoundState, SlotState, SubmitResult } from './types';
import type { GameEngine } from './game';
import { CURATED_LEVELS } from './levels';

// ── Element refs ──────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element as T;
}

// ── Announcement (ARIA live region) ───────────────────────────────────────

let announceClearHandle: ReturnType<typeof setTimeout> | null = null;

function announce(msg: string): void {
  const region = el('announcement');
  region.textContent = '';
  if (announceClearHandle) clearTimeout(announceClearHandle);
  // Force re-announcement even for same text
  requestAnimationFrame(() => {
    region.textContent = msg;
    announceClearHandle = setTimeout(() => { region.textContent = ''; }, 3000);
  });
}

// ── Screen management ─────────────────────────────────────────────────────

function showScreen(id: 'loading-screen' | 'start-screen' | 'game-screen'): void {
  for (const screenId of ['loading-screen', 'start-screen', 'game-screen'] as const) {
    el(screenId).classList.toggle('hidden', screenId !== id);
  }
}

// ── Bubble grid ───────────────────────────────────────────────────────────

function buildLetterBox(char: string | null, kind: 'prefix' | 'suffix' | 'filled'): HTMLElement {
  const box = document.createElement('span');
  box.className = `letter-box is-${kind}`;
  box.textContent = char ?? '';
  box.setAttribute('aria-hidden', 'true');
  return box;
}

function buildSlotElement(slot: SlotState, prefix: string): HTMLElement {
  const li = document.createElement('li');
  li.className = 'bubble-slot';
  li.dataset.slotId = String(slot.id);
  li.setAttribute('role', 'listitem');

  if (slot.filled && slot.word) {
    // All letters visible
    for (const ch of slot.word) {
      li.appendChild(buildLetterBox(ch, 'filled'));
    }
    const label = `${slot.word} (${slot.targetLength} letters, filled)`;
    li.setAttribute('aria-label', label);
  } else {
    // Prefix portion pre-filled, suffix empty
    for (let i = 0; i < slot.targetLength; i++) {
      if (i < prefix.length) {
        li.appendChild(buildLetterBox(prefix[i], 'prefix'));
      } else {
        li.appendChild(buildLetterBox(null, 'suffix'));
      }
    }
    li.setAttribute('aria-label', `Empty slot, ${slot.targetLength} letters`);
  }

  return li;
}

function renderBubbleGrid(slots: SlotState[], prefix: string): void {
  const grid = el('bubble-grid');
  grid.innerHTML = '';
  for (const slot of slots) {
    grid.appendChild(buildSlotElement(slot, prefix));
  }
}

// ── Timer ─────────────────────────────────────────────────────────────────

const TIMER_MILESTONES = new Set([30, 15, 10, 5]);

function timerColorClass(pct: number): 'danger' | 'warn' | '' {
  if (pct < 0.25) return 'danger';
  if (pct < 0.5) return 'warn';
  return '';
}

export function updateTimer(timeRemaining: number, duration: number): void {
  const pct = duration > 0 ? timeRemaining / duration : 0;
  const bar = el('timer-bar');
  const txt = el<HTMLDivElement>('timer-text');

  bar.style.width = `${Math.max(0, pct * 100).toFixed(2)}%`;

  const colorClass = timerColorClass(pct);
  bar.className = `timer-bar ${colorClass}`.trim();
  txt.className = `timer-text ${colorClass}`.trim();
  txt.textContent = `${timeRemaining}s`;

  if (TIMER_MILESTONES.has(timeRemaining)) {
    announce(`${timeRemaining} seconds remaining`);
  }
}

// ── Header ────────────────────────────────────────────────────────────────

function updateHeader(levelIndex: number, sessionScore: number): void {
  el('level-num').textContent = String(levelIndex + 1);
  el('session-score').textContent = String(sessionScore);
}

// ── Full game render ──────────────────────────────────────────────────────

export function renderGame(state: RoundState, engine: GameEngine): void {
  const { level, slots, timeRemaining } = state;

  el('prefix-display').textContent = level.prefix.toUpperCase();
  el('prefix-display').setAttribute('aria-label', `Prefix: ${level.prefix}`);

  renderBubbleGrid(slots, level.prefix);
  updateTimer(timeRemaining, level.duration);

  // During play, add current round's in-progress score to the session total.
  // On win/lost, sessionScore already includes the completed round.
  const displayScore =
    state.status === 'playing'
      ? engine.sessionScore + state.score
      : engine.sessionScore;
  updateHeader(engine.levelIndex, displayScore);

  // Hide end card on fresh render
  el('end-card').classList.add('hidden');

  // Manage input state
  const input = el<HTMLInputElement>('word-input');
  const submitBtn = el<HTMLButtonElement>('submit-btn');
  const isPlaying = state.status === 'playing';
  input.disabled = !isPlaying;
  submitBtn.disabled = !isPlaying;

  if (isPlaying) {
    requestAnimationFrame(() => input.focus());
    announce(`Level ${engine.levelIndex + 1}: type words starting with ${level.prefix}`);
  }
}

// ── Word accepted animation ───────────────────────────────────────────────

export function animateWordAccepted(slotId: number, word: string): void {
  const grid = el('bubble-grid');
  const slotEl = grid.querySelector<HTMLElement>(`[data-slot-id="${slotId}"]`);
  if (!slotEl) return;

  // Replace slot contents with filled letters
  slotEl.innerHTML = '';
  for (const ch of word) {
    slotEl.appendChild(buildLetterBox(ch, 'filled'));
  }
  slotEl.setAttribute('aria-label', `${word} (${word.length} letters, filled)`);

  // Trigger pop animation
  slotEl.classList.add('pop');
  slotEl.addEventListener('animationend', () => slotEl.classList.remove('pop'), { once: true });

  // Clear and re-focus input
  const input = el<HTMLInputElement>('word-input');
  input.value = '';
  requestAnimationFrame(() => input.focus());
}

// ── Rejection animation ───────────────────────────────────────────────────

const REJECTION_MESSAGES: Record<SubmitResult, string> = {
  wrong_prefix: 'Word must start with the prefix',
  wrong_length: 'No slot matches that word length',
  not_a_word: 'Not a valid word',
  already_used: 'Already used',
  empty: '',
  accepted: '',
};

export function animateRejection(reason: SubmitResult): void {
  if (reason === 'empty' || reason === 'accepted') return;

  const input = el<HTMLInputElement>('word-input');
  input.classList.remove('shake');
  // Force reflow to restart animation
  void input.offsetWidth;
  input.classList.add('shake');
  input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });

  const msg = REJECTION_MESSAGES[reason];
  if (msg) announce(msg);
}

// ── End card ──────────────────────────────────────────────────────────────

export function showEndCard(state: RoundState, engine: GameEngine, onRetry: () => void, onNext: () => void, onMenu: () => void): void {
  const won = state.status === 'won';

  el('end-icon').textContent = won ? '🏆' : '⏱️';

  const title = el('end-title');
  title.textContent = won ? 'You Win!' : 'Time\'s Up!';
  title.className = `end-title ${won ? 'won' : 'lost'}`;

  const stats = el('end-stats');
  const wordScore = state.slots
    .filter((s) => s.filled && s.word)
    .reduce((acc, s) => acc + (s.word?.length ?? 0) * 10, 0);
  const timeBonus = won ? state.timeRemaining * 5 : 0;

  stats.innerHTML = `
    <div>Words score: <span class="end-stat-value">${wordScore}</span></div>
    ${won ? `<div>Time bonus: <span class="end-stat-value">+${timeBonus}</span></div>` : ''}
    <div>Round score: <span class="end-stat-value">${state.score}</span></div>
    <div>Session total: <span class="end-stat-value">${engine.sessionScore}</span></div>
  `;

  const actions = el('end-actions');
  actions.innerHTML = '';

  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn-action';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', onRetry);
  actions.appendChild(retryBtn);

  if (engine.hasNextLevel()) {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-action primary';
    nextBtn.textContent = won ? 'Next Level →' : 'Skip Level →';
    nextBtn.addEventListener('click', onNext);
    actions.appendChild(nextBtn);
  }

  const menuBtn = document.createElement('button');
  menuBtn.className = 'btn-action';
  menuBtn.textContent = 'Menu';
  menuBtn.addEventListener('click', onMenu);
  actions.appendChild(menuBtn);

  el('end-card').classList.remove('hidden');

  const msg = won
    ? `You win! Round score: ${state.score}. Session total: ${engine.sessionScore}`
    : `Time's up! Session total: ${engine.sessionScore}`;
  announce(msg);

  // Delay focus so any Enter keyup from word submission doesn't auto-click
  setTimeout(() => (actions.firstElementChild as HTMLElement | null)?.focus(), 150);
}

// ── Input handlers ────────────────────────────────────────────────────────

/** Call once at startup. Uses a getter so it always talks to the current engine. */
export function setupInputHandlers(getEngine: () => GameEngine | null): void {
  const input = el<HTMLInputElement>('word-input');
  const submitBtn = el<HTMLButtonElement>('submit-btn');

  // Strip non-alpha characters on every input event
  input.addEventListener('input', () => {
    const clean = input.value.replace(/[^a-zA-Z]/g, '');
    if (clean !== input.value) input.value = clean;
  });

  const doSubmit = (): void => {
    const engine = getEngine();
    if (!engine) return;
    const state = engine.getState();
    if (!state || state.status !== 'playing') return;
    if (input.value.trim().length === 0) return;
    engine.submitWord(input.value);
    // results handled via GameEngine callbacks (onWordAccepted / onWordRejected)
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSubmit(); }
    if (e.key === 'Escape') { input.value = ''; }
  });

  submitBtn.addEventListener('click', doSubmit);
}

// ── Difficulty selector ───────────────────────────────────────────────────

export function setupDifficultySelector(onSelect: (startIndex: number) => void): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.diff-btn');
  let selectedDiff = 'easy';

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDiff = btn.dataset.difficulty ?? 'easy';
    });
  });

  el<HTMLButtonElement>('start-btn').addEventListener('click', () => {
    const startIndex = CURATED_LEVELS.findIndex((l) => l.difficulty === selectedDiff);
    onSelect(startIndex === -1 ? 0 : startIndex);
  });
}

export { showScreen };
