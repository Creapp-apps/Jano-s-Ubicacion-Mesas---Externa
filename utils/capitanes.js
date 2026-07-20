const defaultDb = require('./db');

class CapitanesCoordinator {
  constructor(dbInstance = defaultDb) {
    this.db = dbInstance;
    this.sessions = {};
  }

  async getOrInitializeSession(eventId = 'default') {
    if (this.sessions[eventId]) {
      return this.sessions[eventId];
    }

    // Load configuration and progress from the database
    let config = { gameMode: 'general', timeLimit: 600, quests: [], captains: {} };
    let progress = {};

    try {
      config = await this.db.getCapitanesConfig(eventId);
    } catch (e) {
      console.error('[Capitanes Init Error] Failed to load config:', e);
    }

    try {
      progress = await this.db.getCapitanesProgress(eventId);
    } catch (e) {
      console.error('[Capitanes Init Error] Failed to load progress:', e);
    }

    this.sessions[eventId] = {
      status: 'LOBBY', // LOBBY, PLAYING, PAUSED, FINISHED
      gameMode: config.gameMode || 'general',
      timeLimit: config.timeLimit || 600,
      quests: config.quests || [],
      captains: config.captains || {},
      progress: progress || {},
      stateExpiresAt: null,
      pausedRemainingTime: null,
      timeoutId: null,
      clients: []
    };

    return this.sessions[eventId];
  }

  getSessionState(eventId = 'default') {
    const session = this.sessions[eventId];
    if (!session) {
      return {
        status: 'INACTIVE',
        gameMode: 'general',
        timeLimit: 600,
        stateExpiresAt: null,
        pausedRemainingTime: null,
        quests: [],
        captains: {},
        progress: {}
      };
    }

    // Lazy expire timer check if currently playing and past expiry
    if (session.status === 'PLAYING' && session.stateExpiresAt && Date.now() > session.stateExpiresAt) {
      session.status = 'FINISHED';
      session.stateExpiresAt = null;
      if (session.timeoutId) {
        clearTimeout(session.timeoutId);
        session.timeoutId = null;
      }
    }

    return {
      status: session.status,
      gameMode: session.gameMode,
      timeLimit: session.timeLimit,
      stateExpiresAt: session.stateExpiresAt,
      pausedRemainingTime: session.pausedRemainingTime,
      quests: session.quests,
      captains: session.captains || {},
      progress: session.progress
    };
  }

  async reloadConfig(eventId = 'default') {
    const session = await this.getOrInitializeSession(eventId);
    try {
      const config = await this.db.getCapitanesConfig(eventId);
      session.gameMode = config.gameMode || 'general';
      session.timeLimit = config.timeLimit || 600;
      session.quests = config.quests || [];
      session.captains = config.captains || {};
      this.broadcastState(eventId);
    } catch (e) {
      console.error('[Capitanes Reload Config Error]', e);
    }
  }

  startGame(eventId = 'default') {
    const session = this.sessions[eventId];
    if (!session) return;

    if (session.status === 'LOBBY' || session.status === 'FINISHED') {
      session.status = 'PLAYING';
      session.pausedRemainingTime = null;
      session.stateExpiresAt = Date.now() + (session.timeLimit * 1000);

      if (session.timeoutId) clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(() => {
        this.expireTimer(eventId);
      }, session.timeLimit * 1000);

      this.broadcastState(eventId);
    }
  }

  pauseGame(eventId = 'default') {
    const session = this.sessions[eventId];
    if (!session || session.status !== 'PLAYING') return;

    session.status = 'PAUSED';
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = null;
    }

    const remaining = session.stateExpiresAt ? Math.max(0, Math.round((session.stateExpiresAt - Date.now()) / 1000)) : 0;
    session.pausedRemainingTime = remaining;
    session.stateExpiresAt = null;

    this.broadcastState(eventId);
  }

  resumeGame(eventId = 'default') {
    const session = this.sessions[eventId];
    if (!session || session.status !== 'PAUSED') return;

    session.status = 'PLAYING';
    const remainingSeconds = session.pausedRemainingTime || 600;
    session.stateExpiresAt = Date.now() + (remainingSeconds * 1000);
    session.pausedRemainingTime = null;

    if (session.timeoutId) clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(() => {
      this.expireTimer(eventId);
    }, remainingSeconds * 1000);

    this.broadcastState(eventId);
  }

  expireTimer(eventId = 'default') {
    const session = this.sessions[eventId];
    if (!session) return;

    session.status = 'FINISHED';
    session.stateExpiresAt = null;
    session.pausedRemainingTime = null;
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = null;
    }

    this.broadcastState(eventId);
  }

  async resetGame(eventId = 'default') {
    const session = this.sessions[eventId];
    if (!session) return;

    session.status = 'LOBBY';
    session.stateExpiresAt = null;
    session.pausedRemainingTime = null;
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = null;
    }

    session.progress = {};
    try {
      await this.db.saveCapitanesProgress(eventId, session.progress);
    } catch (e) {
      console.error('[Capitanes Reset Error] Save progress failed:', e);
    }

    this.broadcastState(eventId);
  }

  async submitQuest(eventId = 'default', mesa, questId, photoUrl = '') {
    const session = await this.getOrInitializeSession(eventId);
    
    if (!session.progress[mesa]) {
      session.progress[mesa] = {};
    }

    session.progress[mesa][questId] = {
      status: 'SUBMITTED',
      photoUrl,
      timestamp: Date.now()
    };

    try {
      await this.db.saveCapitanesProgress(eventId, session.progress);
    } catch (e) {
      console.error('[Capitanes Submit Error] Save progress failed:', e);
    }

    this.broadcastState(eventId);
  }

  async approveQuest(eventId = 'default', mesa, questId) {
    const session = await this.getOrInitializeSession(eventId);
    
    if (!session.progress[mesa] || !session.progress[mesa][questId]) {
      return;
    }

    session.progress[mesa][questId].status = 'APPROVED';
    session.progress[mesa][questId].approvedAt = Date.now();

    try {
      await this.db.saveCapitanesProgress(eventId, session.progress);
    } catch (e) {
      console.error('[Capitanes Approve Error] Save progress failed:', e);
    }

    this.broadcastState(eventId);
  }

  async rejectQuest(eventId = 'default', mesa, questId) {
    const session = await this.getOrInitializeSession(eventId);
    
    if (!session.progress[mesa] || !session.progress[mesa][questId]) {
      return;
    }

    // Set back to PENDING (by setting status to PENDING or removing the key)
    session.progress[mesa][questId] = {
      status: 'PENDING',
      timestamp: Date.now()
    };

    try {
      await this.db.saveCapitanesProgress(eventId, session.progress);
    } catch (e) {
      console.error('[Capitanes Reject Error] Save progress failed:', e);
    }

    this.broadcastState(eventId);
  }

  addClient(eventId = 'default', res) {
    this.getOrInitializeSession(eventId).then(session => {
      session.clients.push(res);
    });
  }

  removeClient(eventId = 'default', res) {
    const session = this.sessions[eventId];
    if (session) {
      session.clients = session.clients.filter(c => c !== res);
    }
  }

  broadcastState(eventId = 'default') {
    const session = this.sessions[eventId];
    if (!session || !session.clients || session.clients.length === 0) return;

    const statePayload = JSON.stringify({
      type: 'STATE_UPDATE',
      data: this.getSessionState(eventId)
    });

    session.clients.forEach(client => {
      try {
        client.write(`data: ${statePayload}\n\n`);
      } catch (err) {
        console.error('[Capitanes Broadcast Error]', err);
      }
    });
  }
}

// Global coordinator instance
const capitanesCoordinator = new CapitanesCoordinator();

module.exports = {
  CapitanesCoordinator,
  capitanesCoordinator
};
