import {
  GameState, GameEvent, Player, Project, Discussion, SetupState,
  buildDeck, drawCard, tickProjects, advanceTurn, isGameOver, generateId,
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
  };
}

function addEvent(state: GameState, playerId: string, type: GameEvent['type'], text: string): GameState {
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
  };
  return { ...state, events: [...state.events, event] };
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

  return addEvent(newState, playerId, 'card-drawn', `Drew the ${card.rank} of ${card.suit} (${card.season})`);
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

  newState = addEvent(newState, playerId, 'prompt-chosen',
    `Chose option ${choice}: "${choice === 'A' ? card.promptA : card.promptB}"`);

  return newState;
}

export function handleNarrate(state: GameState, playerId: string, text: string): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'narrate-card') return { error: 'Not time to narrate' };

  let newState = { ...state, turnPhase: 'choose-action' as const };
  if (text.trim()) {
    newState = addEvent(newState, playerId, 'prompt-chosen', text.trim());
  }
  return newState;
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

  let newState = { ...state, turnPhase: 'turn-complete' as const };
  return addEvent(newState, playerId, 'discovery', description);
}

export function handleStartDiscussion(state: GameState, playerId: string, topic: string): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'action-discuss') return { error: 'Not in discuss phase' };

  const otherPlayers = state.turnOrder.filter(id => id !== playerId);
  const discussion: Discussion = {
    topic,
    initiatedBy: playerId,
    responses: [],
    expectedResponders: otherPlayers,
  };

  let newState = { ...state, discussion, phase: 'discussion' as const };
  return addEvent(newState, playerId, 'discussion', `Started discussion: "${topic}"`);
}

export function handleDiscussionResponse(state: GameState, playerId: string, text: string): GameState | { error: string } {
  if (!state.discussion) return { error: 'No active discussion' };
  if (!state.discussion.expectedResponders.includes(playerId)) return { error: 'Not expected to respond' };

  const player = state.players.find(p => p.id === playerId);
  const responses = [...state.discussion.responses, {
    playerId,
    playerName: player?.name ?? 'Unknown',
    text,
  }];
  const expectedResponders = state.discussion.expectedResponders.filter(id => id !== playerId);

  if (expectedResponders.length === 0) {
    // Discussion complete
    return {
      ...state,
      discussion: { ...state.discussion, responses, expectedResponders: [] },
      phase: 'playing',
      turnPhase: 'turn-complete',
    };
  }

  return {
    ...state,
    discussion: { ...state.discussion, responses, expectedResponders },
  };
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
    name,
    description,
    weeksRemaining: duration,
    position,
    createdBy: playerId,
    completed: false,
    failed: false,
  };

  let newState = {
    ...state,
    projects: [...state.projects, project],
    turnPhase: 'turn-complete' as const,
  };
  return addEvent(newState, playerId, 'project-started', `Started project: "${name}" (${duration} weeks)`);
}

export function handleEndTurn(state: GameState, playerId: string): GameState | { error: string } {
  if (state.turnOrder[state.activePlayerIndex] !== playerId) return { error: 'Not your turn' };
  if (state.turnPhase !== 'turn-complete') return { error: 'Turn not complete yet' };

  // Tick down projects
  let newState = tickProjects(state);
  // Log completed projects
  for (const p of newState.projects) {
    if (p.completed && !state.projects.find(op => op.id === p.id)?.completed) {
      newState = addEvent(newState, playerId, 'project-completed', `Project completed: "${p.name}"`);
    }
  }

  return advanceTurn(newState);
}

export function handleContempt(state: GameState, playerId: string, action: 'take' | 'discard', reason?: string): GameState {
  const players = state.players.map(p => {
    if (p.id !== playerId) return p;
    const delta = action === 'take' ? 1 : -1;
    return { ...p, contemptTokens: Math.max(0, p.contemptTokens + delta) };
  });

  let newState = { ...state, players };
  const type = action === 'take' ? 'contempt-taken' : 'contempt-discarded';
  const text = action === 'take' ? 'Took a contempt token' : `Discarded a contempt token: ${reason || ''}`;
  return addEvent(newState, playerId, type, text);
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

export function handleProjectFinishEarly(state: GameState, projectId: string, playerId: string): GameState | { error: string } {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return { error: 'Project not found' };
  if (project.completed || project.failed) return { error: 'Project already done' };

  const projects = state.projects.map(p =>
    p.id === projectId ? { ...p, weeksRemaining: 0, completed: true } : p
  );
  let newState = { ...state, projects };
  return addEvent(newState, playerId, 'project-completed', `Project finished early: "${project.name}"`);
}

export function handleProjectFail(state: GameState, projectId: string, playerId: string): GameState | { error: string } {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return { error: 'Project not found' };
  if (project.completed || project.failed) return { error: 'Project already done' };

  const projects = state.projects.map(p =>
    p.id === projectId ? { ...p, failed: true } : p
  );
  let newState = { ...state, projects };
  return addEvent(newState, playerId, 'project-failed', `Project failed: "${project.name}"`);
}
