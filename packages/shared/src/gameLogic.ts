import { Card, Suit, GameState, Season } from './types.js';
import { getCardsBySuit } from './cards.js';

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function buildDeck(): Card[] {
  const spring = shuffleArray(getCardsBySuit('hearts'));
  const summer = shuffleArray(getCardsBySuit('diamonds'));
  const autumn = shuffleArray(getCardsBySuit('clubs'));
  const winter = shuffleArray(getCardsBySuit('spades'));
  // Stack: spring on top (drawn first), winter on bottom (drawn last)
  return [...spring, ...summer, ...autumn, ...winter];
}

export function drawCard(deck: Card[]): { card: Card; remainingDeck: Card[] } | null {
  if (deck.length === 0) return null;
  const [card, ...remainingDeck] = deck;
  return { card, remainingDeck };
}

export function getSeasonForCard(card: Card): Season {
  return card.season;
}

export function isGameOver(card: Card): boolean {
  return card.suit === 'spades' && card.rank === 'king';
}

export function tickProjects(state: GameState): GameState {
  if (state.skipDiceReduction) {
    return { ...state, skipDiceReduction: false };
  }

  const projects = state.projects.map(p => {
    if (p.completed || p.failed) return p;
    const weeksRemaining = p.weeksRemaining - 1;
    if (weeksRemaining <= 0) {
      return { ...p, weeksRemaining: 0, completed: true };
    }
    return { ...p, weeksRemaining };
  });

  return { ...state, projects };
}

export function advanceTurn(state: GameState): GameState {
  const nextIndex = (state.activePlayerIndex + 1) % state.turnOrder.length;
  return {
    ...state,
    activePlayerIndex: nextIndex,
    turnPhase: 'draw-card',
    currentCard: null,
    chosenPrompt: null,
    weekNumber: state.weekNumber + 1,
  };
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
