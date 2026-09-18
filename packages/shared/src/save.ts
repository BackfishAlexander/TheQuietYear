/**
 * The whole-game save file: everything needed to either resume a year that
 * was interrupted or to sit down later and read back through one that
 * finished. It carries the full game state - the undrawn deck included, so a
 * resumed game keeps dealing the same cards in the same order - alongside
 * every mark on the map.
 *
 * Files come from users, so nothing in here trusts its input: the normalizer
 * rebuilds a state field by field and reports what it could not use, rather
 * than letting a malformed file into a live room.
 */
import type {
  Card, CardEventDetail, Discussion, DiscussionEventDetail, DiscussionResponse,
  GameEvent, GameEventType, GamePhase, GameSaveFile, GameState, Player, Project,
  Season, SetupState, Stroke, TurnPhase,
} from './types.js';
import { ALL_CARDS } from './cards.js';
import { normalizeStrokes } from './drawing.js';
import { MAX_PLAYERS, PLAYER_COLORS } from './constants.js';
import { generateId } from './gameLogic.js';

export const SAVE_FORMAT = 'quiet-year-save';
export const SAVE_VERSION = 1;
export const SAVE_FILE_EXTENSION = '.quietyear-game.json';

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

const GAME_PHASES: GamePhase[] = [
  'lobby', 'setup-terrain', 'setup-resources', 'playing', 'discussion', 'game-over',
];

const TURN_PHASES: TurnPhase[] = [
  'draw-card', 'resolve-card', 'narrate-card', 'choose-action',
  'action-discover', 'action-discuss', 'action-project',
  'resolve-project', 'turn-complete',
];

const EVENT_TYPES: GameEventType[] = [
  'card', 'discovery', 'discussion',
  'project-started', 'project-completed', 'project-failed', 'project-changed',
  'contempt-taken', 'contempt-discarded',
  'resource-added', 'resource-removed', 'game-over',
];

const SETUP_PHASES: SetupState['phase'][] = [
  'terrain', 'resources-declare', 'resources-vote', 'complete',
];

const CARDS_BY_ID = new Map(ALL_CARDS.map(c => [c.id, c]));

export function buildSaveFile(game: GameState, strokes: Stroke[], roomId: string): GameSaveFile {
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: Date.now(),
    roomId,
    game,
    strokes,
  };
}

/**
 * Coerce a parsed file into a usable save, or say why it cannot be used.
 * Anything unrecognised is dropped rather than rejected outright: a file that
 * has lost a stray field is still a year worth reading.
 */
export function normalizeSaveFile(raw: unknown): { save: GameSaveFile } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'That file does not contain a saved game' };
  }
  const file = raw as Record<string, any>;
  if (file.format !== undefined && file.format !== SAVE_FORMAT) {
    return { error: 'That file is not a Quiet Year game save' };
  }
  if (!file.game || typeof file.game !== 'object') {
    return { error: 'That save file has no game in it' };
  }

  const game = normalizeGameState(file.game);
  if ('error' in game) return game;

  return {
    save: {
      format: SAVE_FORMAT,
      version: Number.isFinite(file.version) ? Number(file.version) : SAVE_VERSION,
      savedAt: Number.isFinite(file.savedAt) ? Number(file.savedAt) : Date.now(),
      roomId: str(file.roomId) || game.state.roomId,
      game: game.state,
      strokes: normalizeStrokes(file.strokes),
    },
  };
}

function normalizeGameState(raw: any): { state: GameState } | { error: string } {
  const players = normalizePlayers(raw.players);
  if (players.length === 0) return { error: 'That save file has no players in it' };

  const playerIds = new Set(players.map(p => p.id));
  const turnOrder = arr(raw.turnOrder)
    .map(str)
    .filter(id => playerIds.has(id));
  // Anyone missing from a truncated turn order still gets a seat at the table.
  for (const p of players) if (!turnOrder.includes(p.id)) turnOrder.push(p.id);

  const activePlayerIndex = clampIndex(raw.activePlayerIndex, turnOrder.length);
  const projects = arr(raw.projects).map(normalizeProject).filter(isPresent);
  const projectIds = new Set(projects.map(p => p.id));

  const state: GameState = {
    roomId: str(raw.roomId),
    phase: pick(raw.phase, GAME_PHASES, 'playing'),
    players,
    turnOrder,
    activePlayerIndex,
    currentSeason: pick(raw.currentSeason, SEASONS, 'spring'),
    deck: arr(raw.deck).map(normalizeCard).filter(isPresent),
    currentCard: normalizeCard(raw.currentCard),
    chosenPrompt: raw.chosenPrompt === 'A' || raw.chosenPrompt === 'B' ? raw.chosenPrompt : null,
    turnPhase: pick(raw.turnPhase, TURN_PHASES, 'draw-card'),
    projects,
    abundances: normalizeStringList(raw.abundances),
    scarcities: normalizeStringList(raw.scarcities),
    names: normalizeStringList(raw.names),
    weekNumber: Math.max(1, Math.round(num(raw.weekNumber, 1))),
    discussion: normalizeDiscussion(raw.discussion, playerIds),
    events: arr(raw.events).map(e => normalizeEvent(e, players)).filter(isPresent),
    setup: normalizeSetup(raw.setup, players.length),
    skipDiceReduction: raw.skipDiceReduction === true,
    pendingResolutions: arr(raw.pendingResolutions).map(str).filter(id => projectIds.has(id)),
  };

  return { state };
}

function normalizePlayers(raw: unknown): Player[] {
  const seen = new Set<string>();
  const players: Player[] = [];
  for (const item of arr(raw)) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, any>;
    const id = str(p.id) || generateId();
    if (seen.has(id)) continue;
    seen.add(id);
    players.push({
      id,
      name: str(p.name).slice(0, 40) || `Player ${players.length + 1}`,
      contemptTokens: Math.max(0, Math.round(num(p.contemptTokens, 0))),
      // Hosting is decided by whoever opens the room, not by the file.
      isHost: false,
      connected: false,
      color: str(p.color) || PLAYER_COLORS[players.length % PLAYER_COLORS.length],
      canDraw: p.canDraw !== false,
    });
    if (players.length >= MAX_PLAYERS) break;
  }
  return players;
}

/** Cards are rebuilt from the deck definition, so prompts can never be forged. */
function normalizeCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, any>;
  const byId = CARDS_BY_ID.get(str(c.id));
  if (byId) return byId;
  const bySuitRank = CARDS_BY_ID.get(`${str(c.suit)}-${str(c.rank)}`);
  return bySuitRank ?? null;
}

function normalizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, any>;
  const name = str(p.name);
  if (!name) return null;
  const position = p.position && typeof p.position === 'object'
    ? { x: num((p.position as any).x, 0), y: num((p.position as any).y, 0) }
    : { x: 0, y: 0 };
  return {
    id: str(p.id) || generateId(),
    name,
    description: str(p.description),
    weeksRemaining: Math.max(0, Math.round(num(p.weeksRemaining, 0))),
    position,
    createdBy: str(p.createdBy),
    completed: p.completed === true,
    failed: p.failed === true,
    resolution: str(p.resolution) || null,
  };
}

function normalizeDiscussion(raw: unknown, playerIds: Set<string>): Discussion | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, any>;
  return {
    topic: str(d.topic),
    initiatedBy: str(d.initiatedBy),
    responses: normalizeResponses(d.responses),
    expectedResponders: arr(d.expectedResponders).map(str).filter(id => playerIds.has(id)),
  };
}

function normalizeResponses(raw: unknown): DiscussionResponse[] {
  return arr(raw)
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, any>;
      return {
        playerId: str(r.playerId),
        playerName: str(r.playerName) || 'Unknown',
        text: str(r.text),
      };
    })
    .filter(isPresent);
}

function normalizeEvent(raw: unknown, players: Player[]): GameEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, any>;
  const type = pick(e.type, EVENT_TYPES, null);
  if (!type) return null;

  const playerId = str(e.playerId);
  const event: GameEvent = {
    id: str(e.id) || generateId(),
    week: Math.max(1, Math.round(num(e.week, 1))),
    season: pick(e.season, SEASONS, 'spring'),
    playerId,
    playerName: str(e.playerName)
      || players.find(p => p.id === playerId)?.name
      || 'Unknown',
    type,
    text: str(e.text),
    timestamp: Number.isFinite(e.timestamp) ? Number(e.timestamp) : 0,
  };

  const detail = str(e.detail);
  if (detail) event.detail = detail;
  const projectId = str(e.projectId);
  if (projectId) event.projectId = projectId;

  const card = normalizeCardDetail(e.card);
  if (card) event.card = card;
  const discussion = normalizeDiscussionDetail(e.discussion);
  if (discussion) event.discussion = discussion;

  return event;
}

function normalizeCardDetail(raw: unknown): CardEventDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, any>;
  const card = normalizeCard(c);
  if (!card) return null;
  const choice = c.choice === 'A' || c.choice === 'B' ? c.choice : null;
  // The prompt text is taken from the deck, not from the file.
  const promptText = choice === 'A' ? card.promptA : choice === 'B' ? card.promptB : null;
  return {
    rank: card.rank,
    suit: card.suit,
    season: card.season,
    choice,
    promptText,
    specialRules: card.specialRules,
  };
}

function normalizeDiscussionDetail(raw: unknown): DiscussionEventDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, any>;
  return {
    topic: str(d.topic),
    initiatedBy: str(d.initiatedBy),
    responses: normalizeResponses(d.responses),
    complete: d.complete === true,
  };
}

function normalizeSetup(raw: unknown, playerCount: number): SetupState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const declarations = arr(s.resourceDeclarations)
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const d = item as Record<string, any>;
      const resource = str(d.resource);
      return resource ? { playerId: str(d.playerId), resource } : null;
    })
    .filter(isPresent);
  const votes = arr(s.abundanceVotes)
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const v = item as Record<string, any>;
      const resource = str(v.resource);
      return resource ? { playerId: str(v.playerId), resource } : null;
    })
    .filter(isPresent);

  return {
    resourceDeclarations: declarations,
    abundanceVotes: votes,
    phase: pick(s.phase, SETUP_PHASES, 'complete'),
    currentDeclarerIndex: Math.min(
      Math.max(0, Math.round(num(s.currentDeclarerIndex, 0))),
      Math.max(0, playerCount),
    ),
  };
}

function normalizeStringList(raw: unknown): string[] {
  return arr(raw).map(str).filter(v => v.length > 0).map(v => v.slice(0, 200));
}

// --- small coercion helpers ------------------------------------------------

function arr(raw: unknown): any[] {
  return Array.isArray(raw) ? raw : [];
}

function str(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

function num(raw: unknown, fallback: number): number {
  return Number.isFinite(raw) ? Number(raw) : fallback;
}

function pick<T extends string, F extends T | null>(raw: unknown, allowed: T[], fallback: F): T | F {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

function clampIndex(raw: unknown, length: number): number {
  if (length === 0) return 0;
  const n = Math.round(num(raw, 0));
  return Math.min(Math.max(0, n), length - 1);
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
