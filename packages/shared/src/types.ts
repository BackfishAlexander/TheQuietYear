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
  /** Host-controlled: may this player draw on the shared map? */
  canDraw: boolean;
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
  /** How the project turned out, narrated when it resolved. */
  resolution: string | null;
}

/** The three states a project can be put into from the project tab. */
export type ProjectStatus = 'active' | 'completed' | 'failed';

export type GamePhase = 'lobby' | 'setup-terrain' | 'setup-resources' | 'playing' | 'discussion' | 'game-over';

export type TurnPhase =
  | 'draw-card'
  | 'resolve-card'
  | 'narrate-card'
  | 'choose-action'
  | 'action-discover'
  | 'action-discuss'
  | 'action-project'
  | 'resolve-project'
  | 'turn-complete';

export interface DiscussionResponse {
  playerId: string;
  playerName: string;
  text: string;
}

export interface Discussion {
  topic: string;
  initiatedBy: string;
  responses: DiscussionResponse[];
  /**
   * Who still owes an answer, in the order they weigh in: around the table
   * from the initiator's left, with the initiator themselves last.
   */
  expectedResponders: string[];
}

export type GameEventType =
  | 'card'
  | 'discovery'
  | 'discussion'
  | 'project-started'
  | 'project-completed'
  | 'project-failed'
  | 'project-changed'
  | 'contempt-taken'
  | 'contempt-discarded'
  | 'resource-added'
  | 'game-over';

/** The card a turn was built around, filled in as the turn progresses. */
export interface CardEventDetail {
  rank: Rank;
  suit: Suit;
  season: Season;
  /** Null until the active player picks a prompt. */
  choice: 'A' | 'B' | null;
  promptText: string | null;
  specialRules: string | null;
}

/** A whole discussion, so the chronicle keeps the question with its answers. */
export interface DiscussionEventDetail {
  topic: string;
  initiatedBy: string;
  responses: DiscussionResponse[];
  complete: boolean;
}

/**
 * One entry in the chronicle. A single event carries everything that belongs
 * together - a card with the prompt chosen and the answer given, a discussion
 * with every response - so the log can render it as one grouped block rather
 * than as loose lines the reader has to stitch back together.
 */
export interface GameEvent {
  id: string;
  week: number;
  season: Season;
  playerId: string;
  playerName: string;
  type: GameEventType;
  /** The headline content: the narration, the topic, the project name. */
  text: string;
  /** Secondary line: a project's description, then its resolution. */
  detail?: string;
  card?: CardEventDetail;
  discussion?: DiscussionEventDetail;
  projectId?: string;
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
  /**
   * Projects that have just resolved and still want a few words on how they
   * turned out. The active player is prompted for each in turn.
   */
  pendingResolutions: string[];
}

export interface RoomState {
  roomId: string;
  players: Player[];
  hostId: string;
  gameStarted: boolean;
}

// Drawing types - separate from game state.
// All coordinates are WORLD coordinates on an unbounded canvas; the viewport
// maps them to screen pixels at render time.
export interface StrokePoint {
  x: number;
  y: number;
}

/** Tools that lay down a freehand path. */
export type PathTool = 'pen' | 'marker' | 'highlighter' | 'eraser';
/** Tools defined by a drag from one corner/end to another. */
export type ShapeTool = 'line' | 'arrow' | 'rect' | 'ellipse' | 'triangle';
/** Every tool the toolbar can select, including ones that make no stroke. */
export type DrawTool = PathTool | ShapeTool | 'fill' | 'pan';

export interface StrokeBase {
  id: string;
  playerId: string;
  /** Server-assigned z-order. Higher draws later. */
  seq: number;
  color: string;
  width: number;
  /** 0-1, defaults to 1 when absent. */
  opacity?: number;
}

export interface PathStroke extends StrokeBase {
  kind: 'path';
  tool: PathTool;
  points: StrokePoint[];
}

export interface ShapeStroke extends StrokeBase {
  kind: 'shape';
  tool: ShapeTool;
  start: StrokePoint;
  end: StrokePoint;
  /** Interior colour, or null for an outline-only shape. */
  fillColor: string | null;
}

/**
 * A bucket fill, stored as traced polygon contours rather than pixels so it
 * stays resolution-independent and cheap to sync. Rendered with the even-odd
 * rule so interior contours punch holes.
 */
export interface FillStroke extends StrokeBase {
  kind: 'fill';
  tool: 'fill';
  contours: StrokePoint[][];
}

export type Stroke = PathStroke | ShapeStroke | FillStroke;

/** The on-disk shape of a saved canvas file. */
export interface CanvasFile {
  format: 'quiet-year-canvas';
  version: number;
  savedAt: number;
  roomId?: string;
  strokes: Stroke[];
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
  'turn:narrate': (data: { text: string }) => void;
  'turn:action': (data: { action: 'discover' | 'discuss' | 'project' }) => void;
  'turn:discover': (data: { description: string }) => void;
  'turn:startProject': (data: { name: string; description: string; duration: number; position: { x: number; y: number } }) => void;
  'turn:startDiscussion': (data: { topic: string }) => void;
  'turn:endTurn': () => void;
  'turn:resolveProject': (data: { projectId: string; resolution: string }) => void;
  'discussion:respond': (data: { text: string }) => void;
  'discussion:skipResponder': () => void;
  'project:setDice': (data: { projectId: string; weeksRemaining: number }) => void;
  'project:setStatus': (data: { projectId: string; status: ProjectStatus }) => void;
  'project:remove': (data: { projectId: string }) => void;
  'contempt:take': () => void;
  'contempt:discard': (data: { reason: string }) => void;
  'resource:addAbundance': (data: { resource: string }) => void;
  'resource:addScarcity': (data: { resource: string }) => void;
  'resource:removeAbundance': (data: { resource: string }) => void;
  'resource:removeScarcity': (data: { resource: string }) => void;
  'resource:addName': (data: { name: string }) => void;
  'draw:stroke': (data: Stroke) => void;
  'draw:undo': () => void;
  'draw:redo': () => void;
  'draw:clear': () => void;
  'draw:load': (data: { strokes: Stroke[] }) => void;
  'admin:setDrawPermission': (data: { playerId: string; canDraw: boolean }) => void;
  'admin:setAllDrawPermissions': (data: { canDraw: boolean }) => void;
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
  /** A stroke was undone (or removed by an admin) and should disappear. */
  'draw:remove': (data: { playerId: string; strokeId: string }) => void;
  /** A previously undone stroke came back; re-insert it by seq. */
  'draw:restore': (data: Stroke) => void;
}
