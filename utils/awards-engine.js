const { getAwardsFromDb, saveAwardsToDb, getGuestProfiles, getConfigValue } = require('./db');

// In-memory runtime state for live voting timers and SSE listeners per event
const eventAwardsRuntime = {};
const sseClients = {}; // key: eventId -> array of res objects

const DEFAULT_AWARD_CATEGORIES = [
  {
    id: 'award_manija',
    title: 'El Más Manija de la Noche',
    icon: '🔥',
    description: 'El que no paró un segundo, arengó a todos y contagió la fiesta.',
    status: 'idle', // 'idle' | 'voting' | 'awarded'
    nominees: [],
    winner: null,
    timerEndsAt: null
  },
  {
    id: 'award_outfit',
    title: 'Mejor Outfit de la Fiesta',
    icon: '✨',
    description: 'El look más deslumbrante y elegante de la alfombra roja.',
    status: 'idle',
    nominees: [],
    winner: null,
    timerEndsAt: null
  },
  {
    id: 'award_pista',
    title: 'Rey / Reina de la Pista',
    icon: '💃',
    description: 'Se bailó absolutamente todos los temas desde el minuto uno.',
    status: 'idle',
    nominees: [],
    winner: null,
    timerEndsAt: null
  },
  {
    id: 'award_glam',
    title: 'Mejor Peinado & Make-Up',
    icon: '👑',
    description: 'Producción total, glamour y detalles impecables.',
    status: 'idle',
    nominees: [],
    winner: null,
    timerEndsAt: null
  },
  {
    id: 'award_meme',
    title: 'El Meme de la Fiesta',
    icon: '🤣',
    description: 'El más espontáneo, gracioso y divertido del salón.',
    status: 'idle',
    nominees: [],
    winner: null,
    timerEndsAt: null
  },
  {
    id: 'award_barra',
    title: 'Embajador de la Barra',
    icon: '🍹',
    description: 'Catador oficial de tragos y el primero en llegar al brindis.',
    status: 'idle',
    nominees: [],
    winner: null,
    timerEndsAt: null
  }
];

/**
 * Initializes or retrieves runtime state for an event.
 */
async function getOrCreateEventAwards(eventId = 'default') {
  const cleanId = eventId || 'default';
  if (!eventAwardsRuntime[cleanId]) {
    // Attempt to load from DB
    let stored = [];
    if (typeof getAwardsFromDb === 'function') {
      try {
        stored = await getAwardsFromDb(cleanId);
      } catch (e) {
        console.warn(`[Awards Engine] Error loading awards from DB for ${cleanId}:`, e.message);
      }
    }

    if (!stored || stored.length === 0) {
      stored = JSON.parse(JSON.stringify(DEFAULT_AWARD_CATEGORIES));
      if (typeof saveAwardsToDb === 'function') {
        try {
          await saveAwardsToDb(cleanId, stored);
        } catch (e) {}
      }
    }

    eventAwardsRuntime[cleanId] = {
      eventId: cleanId,
      activeAwardId: null,
      awards: stored
    };
  }

  // Check timers and auto-close expired votings
  const now = Date.now();
  eventAwardsRuntime[cleanId].awards.forEach(award => {
    if (award.status === 'voting' && award.timerEndsAt && award.timerEndsAt <= now) {
      award.status = 'closed'; // voting finished, waiting for winner reveal
    }
  });

  return eventAwardsRuntime[cleanId];
}

/**
 * Gets formatted state of awards for mobile clients and admin.
 */
async function getAwardsState(eventId = 'default') {
  const runtime = await getOrCreateEventAwards(eventId);
  return {
    eventId: runtime.eventId,
    activeAwardId: runtime.activeAwardId,
    awards: runtime.awards
  };
}

/**
 * Adds or updates an award category.
 */
async function saveAwardCategory(eventId = 'default', awardData) {
  const runtime = await getOrCreateEventAwards(eventId);
  const existingIdx = runtime.awards.findIndex(a => a.id === awardData.id);

  if (existingIdx >= 0) {
    runtime.awards[existingIdx] = {
      ...runtime.awards[existingIdx],
      ...awardData,
      id: runtime.awards[existingIdx].id // preserve id
    };
  } else {
    const newAward = {
      id: awardData.id || `award_${Date.now()}`,
      title: awardData.title || 'Nueva Categoría',
      icon: awardData.icon || '🏆',
      description: awardData.description || '',
      status: 'idle',
      nominees: awardData.nominees || [],
      winner: null,
      timerEndsAt: null
    };
    runtime.awards.push(newAward);
  }

  if (typeof saveAwardsToDb === 'function') {
    await saveAwardsToDb(eventId, runtime.awards);
  }
  broadcastAwardsUpdate(eventId);
  return runtime.awards;
}

/**
 * Deletes an award category.
 */
async function deleteAwardCategory(eventId = 'default', awardId) {
  const runtime = await getOrCreateEventAwards(eventId);
  runtime.awards = runtime.awards.filter(a => a.id !== awardId);
  if (runtime.activeAwardId === awardId) {
    runtime.activeAwardId = null;
  }
  if (typeof saveAwardsToDb === 'function') {
    await saveAwardsToDb(eventId, runtime.awards);
  }
  broadcastAwardsUpdate(eventId);
  return runtime.awards;
}

/**
 * Assigns nominees to an award category.
 * Nominees: Array of { id, name, avatarUrl, tableNumber }
 */
async function setAwardNominees(eventId = 'default', awardId, nominees) {
  const runtime = await getOrCreateEventAwards(eventId);
  const award = runtime.awards.find(a => a.id === awardId);
  if (!award) throw new Error('Premio no encontrado');

  award.nominees = (nominees || []).map((n, idx) => ({
    id: n.id || `nom_${idx}_${Date.now()}`,
    name: n.name || 'Invitado',
    avatarUrl: n.avatarUrl || '/assets/coronamain.png',
    tableNumber: n.tableNumber || '',
    votesCount: 0,
    voters: {}
  }));

  if (typeof saveAwardsToDb === 'function') {
    await saveAwardsToDb(eventId, runtime.awards);
  }
  broadcastAwardsUpdate(eventId);
  return award;
}

/**
 * Casts a vote from a guest to a nominee.
 */
async function voteAwardNominee(eventId = 'default', awardId, nomineeId, voterId = 'anon') {
  const runtime = await getOrCreateEventAwards(eventId);
  const award = runtime.awards.find(a => a.id === awardId);
  if (!award) throw new Error('Categoría de premio no encontrada');

  const now = Date.now();
  if (award.status !== 'voting' || (award.timerEndsAt && award.timerEndsAt <= now)) {
    throw new Error('La votación para este premio no está abierta en este momento');
  }

  // Remove previous vote by this voter in this award if any
  award.nominees.forEach(nom => {
    if (!nom.voters) nom.voters = {};
    if (nom.voters[voterId]) {
      delete nom.voters[voterId];
      nom.votesCount = Math.max(0, Object.keys(nom.voters).length);
    }
  });

  const targetNominee = award.nominees.find(n => n.id === nomineeId);
  if (!targetNominee) throw new Error('Nominado no encontrado');

  if (!targetNominee.voters) targetNominee.voters = {};
  targetNominee.voters[voterId] = true;
  targetNominee.votesCount = Object.keys(targetNominee.voters).length;

  if (typeof saveAwardsToDb === 'function') {
    await saveAwardsToDb(eventId, runtime.awards);
  }
  broadcastAwardsUpdate(eventId);
  return { success: true, award };
}

/**
 * Starts live voting mode for an award (e.g. 60 or 120 seconds).
 */
async function startAwardVoting(eventId = 'default', awardId, durationSeconds = 90) {
  const runtime = await getOrCreateEventAwards(eventId);
  const award = runtime.awards.find(a => a.id === awardId);
  if (!award) throw new Error('Premio no encontrado');

  award.status = 'voting';
  award.timerEndsAt = Date.now() + durationSeconds * 1000;
  runtime.activeAwardId = awardId;

  if (typeof saveAwardsToDb === 'function') {
    await saveAwardsToDb(eventId, runtime.awards);
  }
  broadcastAwardsUpdate(eventId);
  return award;
}

/**
 * Declares the winner of an award (manual or based on highest votes).
 */
async function declareAwardWinner(eventId = 'default', awardId, winnerNomineeId = null) {
  const runtime = await getOrCreateEventAwards(eventId);
  const award = runtime.awards.find(a => a.id === awardId);
  if (!award) throw new Error('Premio no encontrado');

  let winner = null;
  if (winnerNomineeId) {
    winner = award.nominees.find(n => n.id === winnerNomineeId);
  } else if (award.nominees && award.nominees.length > 0) {
    // Pick the nominee with maximum votes
    winner = [...award.nominees].sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0))[0];
  }

  award.status = 'awarded';
  award.winner = winner ? {
    id: winner.id,
    name: winner.name,
    avatarUrl: winner.avatarUrl,
    tableNumber: winner.tableNumber,
    votesCount: winner.votesCount || 0
  } : null;
  
  runtime.activeAwardId = awardId;

  if (typeof saveAwardsToDb === 'function') {
    await saveAwardsToDb(eventId, runtime.awards);
  }
  broadcastAwardsUpdate(eventId);
  return award;
}

/**
 * Resets an award to idle state.
 */
async function resetAward(eventId = 'default', awardId) {
  const runtime = await getOrCreateEventAwards(eventId);
  const award = runtime.awards.find(a => a.id === awardId);
  if (!award) throw new Error('Premio no encontrado');

  award.status = 'idle';
  award.winner = null;
  award.timerEndsAt = null;
  if (award.nominees) {
    award.nominees.forEach(n => {
      n.votesCount = 0;
      n.voters = {};
    });
  }

  if (runtime.activeAwardId === awardId) {
    runtime.activeAwardId = null;
  }

  if (typeof saveAwardsToDb === 'function') {
    await saveAwardsToDb(eventId, runtime.awards);
  }
  broadcastAwardsUpdate(eventId);
  return award;
}

/**
 * SSE Stream subscription for salon projection screen and clients.
 */
function subscribeAwardsStream(eventId = 'default', res) {
  const cleanId = eventId || 'default';
  if (!sseClients[cleanId]) {
    sseClients[cleanId] = [];
  }
  sseClients[cleanId].push(res);

  // Send initial state immediately
  getAwardsState(cleanId).then(state => {
    res.write(`data: ${JSON.stringify(state)}\n\n`);
  }).catch(() => {});

  // Cleanup on client disconnect
  res.on('close', () => {
    sseClients[cleanId] = sseClients[cleanId].filter(client => client !== res);
  });
}

/**
 * Broadcasts award state updates to all active SSE subscribers.
 */
async function broadcastAwardsUpdate(eventId = 'default') {
  const cleanId = eventId || 'default';
  if (!sseClients[cleanId] || sseClients[cleanId].length === 0) return;

  try {
    const state = await getAwardsState(cleanId);
    const dataString = `data: ${JSON.stringify(state)}\n\n`;
    sseClients[cleanId].forEach(client => {
      try {
        client.write(dataString);
      } catch (e) {}
    });
  } catch (err) {
    console.error('[Awards Engine] Error in broadcastAwardsUpdate:', err);
  }
}

module.exports = {
  getAwardsState,
  saveAwardCategory,
  deleteAwardCategory,
  setAwardNominees,
  voteAwardNominee,
  startAwardVoting,
  declareAwardWinner,
  resetAward,
  subscribeAwardsStream,
  broadcastAwardsUpdate,
  DEFAULT_AWARD_CATEGORIES
};
