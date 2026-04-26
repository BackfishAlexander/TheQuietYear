export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'ace' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'jack' | 'queen' | 'king';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  season: Season;
  promptA: string;
  promptB: string | null;
  specialRules: string | null;
}

export interface Player {
  id: string;
  name: string;
  contemptTokens: number;
  isHost: boolean;
  connected: boolean;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  weeksRemaining: number;
  position: { x: number; y: number };
  createdBy: string;
  completed: boolean;
  failed: boolean;
}

export type GamePhase = 'lobby' | 'setup-terrain' | 'setup-resources' | 'playing' | 'discussion' | 'game-over';

export type TurnPhase =
  | 'draw-card'
  | 'resolve-card'
  | 'choose-action'
  | 'action-discover'
  | 'action-discuss'
  | 'action-project'
  | 'turn-complete';

export interface Discussion {
  topic: string;
  initiatedBy: string;
  responses: { playerId: string; playerName: string; text: string }[];
  expectedResponders: string[];
}

export interface GameEvent {
  id: string;
  week: number;
  season: Season;
  playerId: string;
  playerName: string;
  type: 'card-drawn' | 'prompt-chosen' | 'discovery' | 'discussion' | 'project-started' | 'project-completed' | 'project-failed' | 'contempt-taken' | 'contempt-discarded' | 'resource-added' | 'game-over';
  text: string;
  timestamp: number;
}

export interface SetupState {
  resourceDeclarations: { playerId: string; resource: string }[];
  abundanceVotes: { playerId: string; resource: string }[];
  phase: 'terrain' | 'resources-declare' | 'resources-vote' | 'complete';
  currentDeclarerIndex: number;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  turnOrder: string[];
  activePlayerIndex: number;
  currentSeason: Season;
  deck: Card[];
  currentCard: Card | null;
  chosenPrompt: 'A' | 'B' | null;
  turnPhase: TurnPhase;
  projects: Project[];
  abundances: string[];
  scarcities: string[];
  names: string[];
  weekNumber: number;
  discussion: Discussion | null;
  events: GameEvent[];
  setup: SetupState;
  skipDiceReduction: boolean;
}

export interface RoomState {
  roomId: string;
  players: Player[];
  hostId: string;
  gameStarted: boolean;
}

// Drawing types - separate from game state
export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  playerId: string;
  tool: 'pen' | 'eraser';
  points: StrokePoint[];
  color: string;
  width: number;
}

// Client -> Server events
export interface ClientEvents {
  'room:create': (data: { playerName: string }) => void;
  'room:join': (data: { roomId: string; playerName: string }) => void;
  'game:start': () => void;
  'setup:declareResource': (data: { resource: string }) => void;
  'setup:voteAbundance': (data: { resource: string }) => void;
  'setup:finishTerrain': () => void;
  'turn:drawCard': () => void;
  'turn:choosePrompt': (data: { choice: 'A' | 'B' }) => void;
  'turn:action': (data: { action: 'discover' | 'discuss' | 'project' }) => void;
  'turn:discover': (data: { description: string }) => void;
  'turn:startProject': (data: { name: string; description: string; duration: number; position: { x: number; y: number } }) => void;
  'turn:startDiscussion': (data: { topic: string }) => void;
  'turn:endTurn': () => void;
  'discussion:respond': (data: { text: string }) => void;
  'contempt:take': () => void;
  'contempt:discard': (data: { reason: string }) => void;
  'resource:addAbundance': (data: { resource: string }) => void;
  'resource:addScarcity': (data: { resource: string }) => void;
  'resource:removeAbundance': (data: { resource: string }) => void;
  'resource:removeScarcity': (data: { resource: string }) => void;
  'resource:addName': (data: { name: string }) => void;
  'draw:stroke': (data: Stroke) => void;
  'draw:undo': () => void;
}

// Server -> Client events
export interface ServerEvents {
  'room:created': (data: { roomId: string; playerId: string }) => void;
  'room:joined': (data: { playerId: string }) => void;
  'room:state': (data: RoomState) => void;
  'room:error': (data: { message: string }) => void;
  'game:state': (data: GameState) => void;
  'draw:stroke': (data: Stroke) => void;
  'draw:history': (data: Stroke[]) => void;
  'draw:undo': (data: { playerId: string; strokeId: string }) => void;
}
