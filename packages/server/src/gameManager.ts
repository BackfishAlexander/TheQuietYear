import {
  GameState, GameEvent, Player, Project, ProjectStatus, Discussion, SetupState,
  buildDeck, drawCard, tickProjects, advanceTurn, isGameOver, generateId,
  MIN_PROJECT_WEEKS, MAX_PROJECT_WEEKS,
} from '@quiet-year/shared';

export function createInitialGameState(roomId: string, players: Player[]): GameState {
  const turnOrder = players.map(p => p.id);

  return {
    roomId,
    phase: 'setup-terrain',
    players: players.map(p => ({ ...p, contemptTokens: 0 })),
    turnOrder,
    activePlayerIndex: 0,
    currentSeason: 'spring',
    deck: buildDeck(),
    currentCard: null,
    chosenPrompt: null,
    turnPhase: 'draw-card',
    projects: [],
    abundances: [],
    scarcities: [],
    names: [],
    weekNumber: 1,
    discussion: null,
    events: [],
    setup: {
      resourceDeclarations: [],
      abundanceVotes: [],
      phase: 'terrain',
      currentDeclarerIndex: 0,
    },
    skipDiceReduction: false,
    pendingResolutions: [],
  };
}

function addEvent(
  state: GameState, playerId: string, type: GameEvent['type'], text: string,
  extra: Partial<GameEvent> = {},
): GameState {
  const player = state.players.find(p => p.id === playerId);
  const event: GameEvent = {
    id: generateId(),
    week: state.weekNumber,
    season: state.currentSeason,
    playerId,
    playerName: player?.name ?? 'Unknown',
    type,
    text,
    timestamp: Date.now(),
    ...extra,
  };
  return { ...state, events: [...state.events, event] };
}

/**
 * Fold new information into the most recent matching event instead of
 * appending a fresh line. This is what keeps a turn's card, the prompt chosen
 * from it and the answer given as a single entry in the chronicle.
 */
function amendLastEvent(
  state: GameState,
  match: (e: GameEvent) => boolean,
  patch: (e: GameEvent) => GameEvent,
): GameState {
  for (let i = state.events.length - 1; i >= 0; i--) {
    if (!match(state.events[i])) continue;
    const events = [...state.events];
    events[i] = patch(events[i]);
    return { ...state, events };
  }
  return state;
}

export function finishTerrain(state: GameState): GameState {
  return {
    ...state,
    setup: { ...state.setup, phase: 'resources-declare', currentDeclarerIndex: 0 },
  };
}

export function declareResource(state: GameState, playerId: string, resource: string): GameState {
  const declarations = [...state.setup.resourceDeclarations, { playerId, resource }];
  const nextIndex = state.setup.currentDeclarerIndex + 1;
  const allDeclared = nextIndex >= state.players.length;

  return {
    ...state,
    setup: {
      ...state.setup,
      resourceDeclarations: declarations,
      currentDeclarerIndex: nextIndex,
      phase: allDeclared ? 'resources-vote' : 'resources-declare',
    },
  };
}

export function voteAbundance(state: GameState, playerId: string, resource: string): GameState {
  const votes = [...state.setup.abundanceVotes, { playerId, resource }];

  if (votes.length < state.players.length) {
    return { ...state, setup: { ...state.setup, abundanceVotes: votes } };
  }

  // Tally votes - most voted resource becomes abundance
  const tally: Record<string, number> = {};
  for (const v of votes) {
    tally[v.resource] = (tally[v.resource] || 0) + 1;
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const abundance = sorted[0][0];

  const allResources = state.setup.resourceDeclarations.map(d => d.resource);
  const scarcities = allResources.filter(r => r !== abundance);

  return {
    ...state,
    phase: 'playing',
    abundances: [abundance],
    scarcities,
    setup: { ...state.setup, phase: 'complete', abundanceVotes: votes },
  };
}

export function handleDrawCard(state: GameState, playerId: string): GameState | { error: string } {
  if (state.phase !== 'playing') return { error: 'Game not in playing phase' };
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'draw-card') return { error: 'Not time to draw a card' };

  const result = drawCard(state.deck);
  if (!result) return { error: 'Deck is empty' };

  const { card, remainingDeck } = result;

  if (isGameOver(card)) {
    let newState = {
      ...state,
      deck: remainingDeck,
      currentCard: card,
      phase: 'game-over' as const,
      turnPhase: 'turn-complete' as const,
      currentSeason: card.season,
    };
    return addEvent(newState, playerId, 'game-over', 'The Frost Shepherds arrive. The game is over.');
  }

  let newState = {
    ...state,
    deck: remainingDeck,
    currentCard: card,
    currentSeason: card.season,
    turnPhase: card.promptB ? 'resolve-card' as const : 'resolve-card' as const,
  };

  return addEvent(newState, playerId, 'card', '', {
    card: {
      rank: card.rank,
      suit: card.suit,
      season: card.season,
      choice: null,
      promptText: null,
      specialRules: card.specialRules,
    },
  });
}

export function handleChoosePrompt(state: GameState, playerId: string, choice: 'A' | 'B'): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'resolve-card') return { error: 'Not time to choose a prompt' };
  if (!state.currentCard) return { error: 'No card drawn' };
  if (choice === 'B' && !state.currentCard.promptB) return { error: 'No option B for this card' };

  // Apply special card rules
  let newState = { ...state, chosenPrompt: choice, turnPhase: 'narrate-card' as const };

  // Handle skip dice reduction flags
  const card = state.currentCard;
  const rules = card.specialRules || '';
  if (rules.toLowerCase().includes('do not reduce project dice')) {
    newState.skipDiceReduction = true;
  }

  const promptText = choice === 'A' ? card.promptA : card.promptB;
  return amendLastEvent(
    newState,
    e => e.type === 'card' && e.card?.choice === null,
    e => ({ ...e, card: { ...e.card!, choice, promptText } }),
  );
}

export function handleNarrate(state: GameState, playerId: string, text: string): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'narrate-card') return { error: 'Not time to narrate' };

  const newState = { ...state, turnPhase: 'choose-action' as const };
  const answer = text.trim();
  if (!answer) return newState;

  return amendLastEvent(
    newState,
    e => e.type === 'card' && e.playerId === playerId,
    e => ({ ...e, text: answer }),
  );
}

export function handleAction(state: GameState, playerId: string, action: 'discover' | 'discuss' | 'project'): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'choose-action') return { error: 'Not time to choose an action' };

  const phaseMap = {
    discover: 'action-discover',
    discuss: 'action-discuss',
    project: 'action-project',
  } as const;

  return { ...state, turnPhase: phaseMap[action] };
}

export function handleDiscover(state: GameState, playerId: string, description: string): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'action-discover') return { error: 'Not in discover phase' };

  const newState = { ...state, turnPhase: 'turn-complete' as const };
  return addEvent(newState, playerId, 'discovery', description.trim());
}

/**
 * Everyone weighs in going around the table from the initiator's left, and
 * the one who raised the topic has the last word - so they come last in the
 * order rather than being skipped.
 */
function respondOrder(turnOrder: string[], initiatedBy: string): string[] {
  const start = turnOrder.indexOf(initiatedBy);
  const order: string[] = [];
  for (let i = 1; i < turnOrder.length; i++) {
    order.push(turnOrder[(start + i) % turnOrder.length]);
  }
  order.push(initiatedBy);
  return order;
}

export function handleStartDiscussion(state: GameState, playerId: string, topic: string): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'action-discuss') return { error: 'Not in discuss phase' };

  const discussion: Discussion = {
    topic,
    initiatedBy: playerId,
    responses: [],
    expectedResponders: respondOrder(state.turnOrder, playerId),
  };

  const newState = { ...state, discussion, phase: 'discussion' as const };
  return addEvent(newState, playerId, 'discussion', topic, {
    discussion: { topic, initiatedBy: playerId, responses: [], complete: false },
  });
}

export function handleDiscussionResponse(state: GameState, playerId: string, text: string): GameState | { error: string } {
  if (!state.discussion) return { error: 'No active discussion' };
  if (!state.discussion.expectedResponders.includes(playerId)) return { error: 'Not expected to respond' };
  if (state.discussion.expectedResponders[0] !== playerId) {
    return { error: 'Wait your turn to weigh in' };
  }

  const player = state.players.find(p => p.id === playerId);
  const response = { playerId, playerName: player?.name ?? 'Unknown', text: text.trim() };
  return advanceDiscussion(state, response);
}

/** Let the table move past someone who has dropped out mid-discussion. */
export function handleSkipResponder(state: GameState): GameState | { error: string } {
  if (!state.discussion) return { error: 'No active discussion' };
  if (state.discussion.expectedResponders.length === 0) return { error: 'Nobody left to skip' };
  return advanceDiscussion(state, null);
}

/**
 * Record (or pass over) the current responder, mirroring the transcript into
 * its chronicle entry so the log carries the answers, not just the question.
 */
function advanceDiscussion(state: GameState, response: Discussion['responses'][number] | null): GameState {
  const disc = state.discussion!;
  const responses = response ? [...disc.responses, response] : disc.responses;
  const expectedResponders = disc.expectedResponders.slice(1);
  const complete = expectedResponders.length === 0;

  const newState: GameState = {
    ...state,
    discussion: { ...disc, responses, expectedResponders },
    ...(complete ? { phase: 'playing' as const, turnPhase: 'turn-complete' as const } : {}),
  };

  return amendLastEvent(
    newState,
    e => e.type === 'discussion' && e.discussion?.complete === false,
    e => ({ ...e, discussion: { ...e.discussion!, responses, complete } }),
  );
}

export function handleStartProject(
  state: GameState, playerId: string,
  name: string, description: string, duration: number, position: { x: number; y: number }
): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'action-project') return { error: 'Not in project phase' };
  if (duration < 1 || duration > 6) return { error: 'Duration must be 1-6 weeks' };

  const project: Project = {
    id: generateId(),
    name: name.trim(),
    description: description.trim(),
    weeksRemaining: duration,
    position,
    createdBy: playerId,
    completed: false,
    failed: false,
    resolution: null,
  };

  const newState = {
    ...state,
    projects: [...state.projects, project],
    turnPhase: 'turn-complete' as const,
  };
  return addEvent(newState, playerId, 'project-started', project.name, {
    detail: project.description || undefined,
    projectId: project.id,
  });
}

export function handleEndTurn(state: GameState, playerId: string): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'turn-complete') return { error: 'Turn not complete yet' };
  if (state.pendingResolutions.length > 0) return { error: 'Resolve the finished project first' };

  const ticked = tickProjects(state);
  const justFinished = ticked.projects.filter(
    p => p.completed && !state.projects.find(op => op.id === p.id)?.completed,
  );

  // The dice come off as the week rolls over, not during anyone's turn, so the
  // player taking up the new week is the one who says how those projects went.
  let newState = advanceTurn(ticked);
  if (justFinished.length === 0) return newState;

  const nextPlayerId = newState.turnOrder[newState.activePlayerIndex];
  for (const p of justFinished) {
    newState = addEvent(newState, nextPlayerId, 'project-completed', p.name, { projectId: p.id });
  }

  return {
    ...newState,
    pendingResolutions: [...newState.pendingResolutions, ...justFinished.map(p => p.id)],
    turnPhase: 'resolve-project',
  };
}

/**
 * Record how a resolved project turned out. A project the dice ran out on is
 * resolved at the top of the new turn, so clearing the last one is what lets
 * the incoming player get on with drawing their card.
 */
export function handleResolveProject(
  state: GameState, playerId: string, projectId: string, resolution: string,
): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (!state.pendingResolutions.includes(projectId)) return { error: 'Nothing to resolve for that project' };

  const text = resolution.trim();
  let newState: GameState = {
    ...state,
    projects: state.projects.map(p => (p.id === projectId ? { ...p, resolution: text || null } : p)),
    pendingResolutions: state.pendingResolutions.filter(id => id !== projectId),
  };

  if (text) {
    newState = amendLastEvent(
      newState,
      e => e.projectId === projectId && (e.type === 'project-completed' || e.type === 'project-failed'),
      e => ({ ...e, detail: text }),
    );
  }

  return openTurnIfResolved(newState);
}

export function handleContempt(state: GameState, playerId: string, action: 'take' | 'discard', reason?: string): GameState {
  const players = state.players.map(p => {
    if (p.id !== playerId) return p;
    const delta = action === 'take' ? 1 : -1;
    return { ...p, contemptTokens: Math.max(0, p.contemptTokens + delta) };
  });

  const newState = { ...state, players };
  const type = action === 'take' ? 'contempt-taken' : 'contempt-discarded';
  return addEvent(newState, playerId, type, (reason ?? '').trim());
}

export function handleAddAbundance(state: GameState, playerId: string, resource: string): GameState {
  let newState = { ...state, abundances: [...state.abundances, resource] };
  return addEvent(newState, playerId, 'resource-added', `Added abundance: ${resource}`);
}

export function handleAddScarcity(state: GameState, playerId: string, resource: string): GameState {
  let newState = { ...state, scarcities: [...state.scarcities, resource] };
  return addEvent(newState, playerId, 'resource-added', `Added scarcity: ${resource}`);
}

export function handleRemoveAbundance(state: GameState, resource: string): GameState {
  return { ...state, abundances: state.abundances.filter(a => a !== resource) };
}

export function handleRemoveScarcity(state: GameState, resource: string): GameState {
  return { ...state, scarcities: state.scarcities.filter(s => s !== resource) };
}

export function handleAddName(state: GameState, name: string): GameState {
  return { ...state, names: [...state.names, name] };
}

/**
 * Cards routinely hand out or take away project dice, so the dice count is
 * directly editable. Setting a count on a resolved project puts it back in
 * progress; taking the last die off finishes it and asks for a resolution.
 */
export function handleProjectSetDice(
  state: GameState, playerId: string, projectId: string, weeksRemaining: number,
): GameState | { error: string } {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return { error: 'Project not found' };

  const dice = Math.round(weeksRemaining);
  if (dice < 0 || dice > MAX_PROJECT_WEEKS) {
    return { error: `Dice must be between 0 and ${MAX_PROJECT_WEEKS}` };
  }

  if (dice === 0) return setProjectStatus(state, playerId, projectId, 'completed');

  const newState: GameState = {
    ...state,
    projects: state.projects.map(p => (
      p.id === projectId
        ? { ...p, weeksRemaining: dice, completed: false, failed: false, resolution: null }
        : p
    )),
    // Back in progress, so any outstanding resolution request is moot.
    pendingResolutions: state.pendingResolutions.filter(id => id !== projectId),
  };

  const wasResolved = project.completed || project.failed;
  const text = wasResolved
    ? `back in progress with ${dice} ${dice === 1 ? 'die' : 'dice'}`
    : `now at ${dice} ${dice === 1 ? 'die' : 'dice'}`;
  return openTurnIfResolved(
    addEvent(newState, playerId, 'project-changed', project.name, { detail: text, projectId }),
  );
}

export function handleProjectSetStatus(
  state: GameState, playerId: string, projectId: string, status: ProjectStatus,
): GameState | { error: string } {
  if (status === 'active') {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return { error: 'Project not found' };
    const dice = project.weeksRemaining > 0 ? project.weeksRemaining : MIN_PROJECT_WEEKS;
    return handleProjectSetDice(state, playerId, projectId, dice);
  }
  return setProjectStatus(state, playerId, projectId, status);
}

function setProjectStatus(
  state: GameState, playerId: string, projectId: string, status: 'completed' | 'failed',
): GameState | { error: string } {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return { error: 'Project not found' };

  const completed = status === 'completed';
  const alreadyThere = completed ? project.completed : project.failed;
  if (alreadyThere) return state;

  let newState: GameState = {
    ...state,
    projects: state.projects.map(p => (
      p.id === projectId
        ? { ...p, weeksRemaining: 0, completed, failed: !completed, resolution: null }
        : p
    )),
  };

  newState = addEvent(
    newState, playerId,
    completed ? 'project-completed' : 'project-failed',
    project.name, { projectId },
  );

  // A project that just landed either way wants a word on how it went.
  return {
    ...newState,
    pendingResolutions: newState.pendingResolutions.includes(projectId)
      ? newState.pendingResolutions
      : [...newState.pendingResolutions, projectId],
  };
}

/** Some cards wipe a project off the map entirely. */
export function handleProjectRemove(
  state: GameState, playerId: string, projectId: string,
): GameState | { error: string } {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return { error: 'Project not found' };

  const newState: GameState = {
    ...state,
    projects: state.projects.filter(p => p.id !== projectId),
    pendingResolutions: state.pendingResolutions.filter(id => id !== projectId),
  };
  return openTurnIfResolved(
    addEvent(newState, playerId, 'project-changed', project.name, {
      detail: 'abandoned and struck from the map',
      projectId,
    }),
  );
}

/**
 * A turn that opened on a resolution can get under way once the last one is
 * dealt with, whether it was narrated, reactivated or removed.
 */
function openTurnIfResolved(state: GameState): GameState {
  if (state.turnPhase === 'resolve-project' && state.pendingResolutions.length === 0) {
    return { ...state, turnPhase: 'draw-card' };
  }
  return state;
}
