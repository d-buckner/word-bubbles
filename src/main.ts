import './styles.css';
import { loadDictionary } from './dictionary';
import { GameEngine } from './game';
import {
  showScreen,
  renderGame,
  animateWordAccepted,
  animateRejection,
  showEndCard,
  updateTimer,
  setupInputHandlers,
  setupDifficultySelector,
} from './ui';

async function init(): Promise<void> {
  showScreen('loading-screen');

  let dict;
  try {
    dict = await loadDictionary();
  } catch (err) {
    console.error('Failed to load dictionary:', err);
    document.getElementById('loading-screen')!.innerHTML =
      '<p style="color:#ff5757;padding:24px;text-align:center;line-height:1.8">' +
      'Failed to load dictionary.<br>' +
      'Run <code style="font-family:monospace;background:#1a2b3d;padding:2px 6px;border-radius:4px">' +
      'bash scripts/download-words.sh</code> then refresh.</p>';
    return;
  }

  let engine: GameEngine | null = null;

  // Wire input handlers once — they delegate to current engine via getter
  setupInputHandlers(() => engine);

  const startGame = (levelIndex: number): void => {
    engine?.destroy();

    engine = new GameEngine(dict, {
      onStateChange(state) {
        if (state.status === 'playing') {
          renderGame(state, engine!);
          return;
        }
        renderGame(state, engine!);
        showEndCard(
          state,
          engine!,
          () => { engine!.retryLevel(); },
          () => { engine!.nextLevel(); },
          () => { showScreen('start-screen'); },
        );
      },

      onWordAccepted(word, slotId) {
        animateWordAccepted(slotId, word);
      },

      onWordRejected(reason) {
        animateRejection(reason);
      },

      onTick(timeRemaining) {
        const state = engine?.getState();
        if (!state) return;
        updateTimer(timeRemaining, state.level.duration);
      },
    });

    showScreen('game-screen');
    engine.startLevel(levelIndex);
  };

  setupDifficultySelector((startIndex) => {
    startGame(startIndex);
  });

  showScreen('start-screen');
}

init();
