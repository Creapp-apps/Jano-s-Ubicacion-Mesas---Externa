const https = require('https');

// Store in-memory battle states per event
const eventBattles = {};

const DEFAULT_GENRES = [
  { id: 'g_cumbia', name: 'Cumbia 90s & Clásicos', icon: '🌴', active: true },
  { id: 'g_reggaeton', name: 'Reggaeton Viejo vs. Nuevo', icon: '🔥', active: true },
  { id: 'g_cuarteto', name: 'Cuarteto Cordobés', icon: '💃', active: true },
  { id: 'g_rock_nac', name: 'Rock Nacional', icon: '🎸', active: true },
  { id: 'g_disco', name: 'Disco & Funk 80s', icon: '🕺', active: true },
  { id: 'g_electronica', name: 'Electrónica & EDM', icon: '⚡', active: true },
  { id: 'g_rkt', name: 'RKT & Cumbia 420', icon: '🇦🇷', active: true },
  { id: 'g_bizarro', name: 'Retro 2000s & Bizarro', icon: '💥', active: true }
];

/**
 * Searches canonical music from iTunes Search API (public, fast, zero config needed).
 */
async function searchCanonicalMusic(query) {
  if (!query || query.trim().length < 2) return [];
  const cleanQuery = query.trim();
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=song&limit=6&country=AR`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.results) return resolve([]);
          
          const tracks = parsed.results.map(item => ({
            trackId: `itunes:${item.trackId}`,
            title: item.trackName || 'Sin título',
            artist: item.artistName || 'Artista desconocido',
            albumCover: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '300x300bb') : '/assets/coronamain.png',
            previewUrl: item.previewUrl || ''
          }));
          resolve(tracks);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => {
      resolve([]);
    });
  });
}

/**
 * Ensures an event battle structure exists in memory.
 */
function getOrCreateEventBattle(eventId = 'default') {
  const id = eventId || 'default';
  if (!eventBattles[id]) {
    const genresMap = {};
    DEFAULT_GENRES.forEach(g => {
      genresMap[g.id] = {
        ...g,
        votesCount: 0,
        voters: {}
      };
    });

    eventBattles[id] = {
      eventId: id,
      mode: 'songs', // 'songs' | 'genres'
      status: 'voting', // 'idle' | 'nominating' | 'voting' | 'closed'
      title: 'Tanda Participativa',
      category: 'Cumbia & Reggaeton',
      timerEndsAt: Date.now() + 15 * 60 * 1000, // 15 minutes default
      nominations: {}, // key: trackId
      genres: genresMap
    };
  } else if (!eventBattles[id].genres || Object.keys(eventBattles[id].genres).length === 0) {
    const genresMap = {};
    DEFAULT_GENRES.forEach(g => {
      genresMap[g.id] = {
        ...g,
        votesCount: 0,
        voters: {}
      };
    });
    eventBattles[id].genres = genresMap;
  }
  return eventBattles[id];
}

/**
 * Returns formatted state of active nominations & genres for an event.
 */
function getTandaState(eventId = 'default') {
  const battle = getOrCreateEventBattle(eventId);
  const now = Date.now();
  const remainingSeconds = Math.max(0, Math.floor((battle.timerEndsAt - now) / 1000));
  
  if (remainingSeconds === 0 && battle.status === 'voting') {
    battle.status = 'closed';
  }

  // Format nominations list (songs mode)
  const list = Object.values(battle.nominations).map(item => {
    const total = item.upvotes + item.downvotes;
    const approvalPercentage = total > 0 ? Math.round((item.upvotes / total) * 100) : 100;
    return {
      ...item,
      totalVotes: total,
      approvalPercentage
    };
  });

  list.sort((a, b) => {
    if (b.approvalPercentage !== a.approvalPercentage) {
      return b.approvalPercentage - a.approvalPercentage;
    }
    return b.totalVotes - a.totalVotes;
  });

  // Format genres list (all genres with active state)
  const genresList = Object.values(battle.genres).map(g => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    active: g.active !== false,
    votesCount: g.votesCount,
    voters: g.voters
  }));

  const activeGenres = genresList.filter(g => g.active);
  const totalGenreVotes = activeGenres.reduce((acc, g) => acc + g.votesCount, 0);

  genresList.forEach(g => {
    g.approvalPercentage = totalGenreVotes > 0 ? Math.round((g.votesCount / totalGenreVotes) * 100) : 0;
  });

  genresList.sort((a, b) => b.votesCount - a.votesCount);

  return {
    eventId: battle.eventId,
    mode: battle.mode,
    status: battle.status,
    title: battle.title,
    category: battle.category,
    remainingSeconds,
    nominations: list,
    genres: genresList,
    totalGenreVotes
  };
}

/**
 * Nominates or upvotes a canonical track.
 */
function nominateTrack(eventId, track, guestName = 'Invitado', voterId = 'anonymous') {
  if (!track || !track.trackId) {
    throw new Error('Track canónico inválido');
  }

  const battle = getOrCreateEventBattle(eventId);
  const trackId = track.trackId;

  if (battle.nominations[trackId]) {
    const target = battle.nominations[trackId];
    if (target.voters[voterId]) {
      return {
        alreadyVoted: true,
        optionName: `${target.title} - ${target.artist}`,
        state: getTandaState(eventId)
      };
    }
    target.upvotes += 1;
    target.nominationsCount += 1;
    target.voters[voterId] = 'up';
  } else {
    battle.nominations[trackId] = {
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      albumCover: track.albumCover || '/assets/coronamain.png',
      previewUrl: track.previewUrl || '',
      upvotes: 1,
      downvotes: 0,
      nominationsCount: 1,
      nominatedBy: guestName,
      voters: { [voterId]: 'up' }
    };
  }

  return {
    alreadyVoted: false,
    state: getTandaState(eventId)
  };
}

/**
 * Casts a vote (up / down) on a nominated track.
 */
function voteTrack(eventId, trackId, voteType = 'up', voterId = 'anonymous') {
  const battle = getOrCreateEventBattle(eventId);
  const targetTrack = battle.nominations[trackId];

  if (!targetTrack) {
    throw new Error('La canción no se encuentra en el ranking activo');
  }

  const previousVote = targetTrack.voters[voterId];

  if (previousVote === voteType) {
    return {
      alreadyVoted: true,
      optionName: `${targetTrack.title} - ${targetTrack.artist}`,
      state: getTandaState(eventId)
    };
  }

  if (previousVote === 'up') targetTrack.upvotes = Math.max(0, targetTrack.upvotes - 1);
  if (previousVote === 'down') targetTrack.downvotes = Math.max(0, targetTrack.downvotes - 1);

  if (voteType === 'up') targetTrack.upvotes += 1;
  if (voteType === 'down') targetTrack.downvotes += 1;

  targetTrack.voters[voterId] = voteType;

  return {
    alreadyVoted: false,
    state: getTandaState(eventId)
  };
}

/**
 * Votes for a musical genre in Genres Mode.
 */
function voteGenre(eventId, genreId, voterId = 'anonymous') {
  const battle = getOrCreateEventBattle(eventId);
  const genre = battle.genres[genreId];

  if (!genre) {
    throw new Error('El género musical no existe en la lista del evento');
  }

  if (genre.voters[voterId]) {
    return {
      alreadyVoted: true,
      optionName: genre.name,
      state: getTandaState(eventId)
    };
  }

  // Max 3 active genre votes per voter
  const activeVotedGenres = Object.values(battle.genres).filter(g => g.voters && g.voters[voterId]);
  if (activeVotedGenres.length >= 3) {
    const oldest = activeVotedGenres[0];
    oldest.votesCount = Math.max(0, oldest.votesCount - 1);
    delete oldest.voters[voterId];
  }

  genre.votesCount += 1;
  genre.voters[voterId] = true;

  return {
    alreadyVoted: false,
    state: getTandaState(eventId)
  };
}

/**
 * Adds or edits a custom musical genre for an event (Admin control).
 */
function addCustomGenre(eventId, name, icon = '🎵') {
  if (!name || !name.trim()) {
    throw new Error('Nombre de género requerido');
  }
  const battle = getOrCreateEventBattle(eventId);
  const id = 'g_custom_' + Date.now();
  battle.genres[id] = {
    id,
    name: name.trim(),
    icon: icon.trim() || '🎵',
    active: true,
    votesCount: 0,
    voters: {}
  };
  return getTandaState(eventId);
}

/**
 * Edits an existing custom or default genre (Admin control).
 */
function editCustomGenre(eventId, genreId, name, icon) {
  const battle = getOrCreateEventBattle(eventId);
  if (battle.genres[genreId]) {
    if (name && name.trim()) battle.genres[genreId].name = name.trim();
    if (icon && icon.trim()) battle.genres[genreId].icon = icon.trim();
  }
  return getTandaState(eventId);
}

/**
 * Deletes a genre from the event (Admin control).
 */
function deleteCustomGenre(eventId, genreId) {
  const battle = getOrCreateEventBattle(eventId);
  if (battle.genres[genreId]) {
    delete battle.genres[genreId];
  }
  return getTandaState(eventId);
}

/**
 * Toggles a genre ON/OFF for an event (Admin control).
 */
function toggleGenreActive(eventId, genreId, active) {
  const battle = getOrCreateEventBattle(eventId);
  if (battle.genres[genreId]) {
    battle.genres[genreId].active = Boolean(active);
  }
  return getTandaState(eventId);
}

/**
 * Sets battle mode ('songs' | 'genres').
 */
function setBattleMode(eventId, mode) {
  const battle = getOrCreateEventBattle(eventId);
  if (['songs', 'genres'].includes(mode)) {
    battle.mode = mode;
  }
  return getTandaState(eventId);
}

/**
 * Updates battle status (DJ control).
 */
function setTandaStatus(eventId, status, durationMinutes = 15) {
  const battle = getOrCreateEventBattle(eventId);
  battle.status = status;
  if (status === 'voting' || status === 'nominating') {
    battle.timerEndsAt = Date.now() + durationMinutes * 60 * 1000;
  }
  return getTandaState(eventId);
}

module.exports = {
  searchCanonicalMusic,
  getOrCreateEventBattle,
  getTandaState,
  nominateTrack,
  voteTrack,
  voteGenre,
  addCustomGenre,
  editCustomGenre,
  deleteCustomGenre,
  toggleGenreActive,
  setBattleMode,
  setTandaStatus
};
