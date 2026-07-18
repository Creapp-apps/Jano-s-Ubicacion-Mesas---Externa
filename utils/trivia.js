class TriviaCoordinator {
  constructor() {
    this.sessions = {};
  }

  initializeSession(eventId, questions) {
    const normalizedQuestions = (questions || []).map(q => ({
      questionText: q.questionText || q.question || '',
      options: q.options || [],
      correctOptionIndex: q.correctOptionIndex !== undefined ? q.correctOptionIndex : (q.correctIndex !== undefined ? q.correctIndex : 0),
      timeLimit: q.timeLimit || 20
    }));
    this.sessions[eventId] = {
      status: 'LOBBY', // 'LOBBY', 'QUESTION_ACTIVE', 'REVEAL_ANSWER', 'LEADERBOARD', 'PODIUM'
      questions: normalizedQuestions,
      currentQuestionIndex: 0,
      players: {}, // nickname: { score: 0, lastCorrect: false, lastPoints: 0 }
      responses: {}, // questionIndex: { nickname: { optionIndex, timeTakenMs, points } }
      stateExpiresAt: null,
      clients: [] // SSE connections: { res, role, nickname }
    };
  }

  getSessionState(eventId) {
    const session = this.sessions[eventId];
    if (!session) return { status: 'INACTIVE', players: [], questionsCount: 0, totalQuestions: 0 };
    return {
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      players: Object.keys(session.players).map(nick => ({
        nickname: nick,
        score: session.players[nick].score
      })),
      questionsCount: session.questions.length,
      totalQuestions: session.questions.length,
      currentQuestion: (session.status === 'QUESTION_ACTIVE' || session.status === 'REVEAL_ANSWER') ? {
        questionText: session.questions[session.currentQuestionIndex].questionText,
        options: session.questions[session.currentQuestionIndex].options,
        timeLimit: session.questions[session.currentQuestionIndex].timeLimit,
        remainingTime: session.stateExpiresAt ? Math.max(0, Math.round((session.stateExpiresAt - Date.now()) / 1000)) : session.questions[session.currentQuestionIndex].timeLimit,
        correctOptionIndex: session.status === 'REVEAL_ANSWER' ? session.questions[session.currentQuestionIndex].correctOptionIndex : undefined,
        optionStats: (() => {
          const stats = [0, 0, 0, 0];
          const responses = session.responses[session.currentQuestionIndex] || {};
          Object.values(responses).forEach(r => {
            if (r.optionIndex !== undefined && r.optionIndex >= 0 && r.optionIndex < 4) {
              stats[r.optionIndex]++;
            }
          });
          return stats;
        })()
      } : null
    };
  }

  addPlayer(eventId, nickname) {
    if (!this.sessions[eventId]) {
      this.initializeSession(eventId, []);
    }
    const session = this.sessions[eventId];
    const cleanNick = nickname.trim();
    if (!cleanNick) return false;
    if (!session.players[cleanNick]) {
      session.players[cleanNick] = { score: 0, lastCorrect: false, lastPoints: 0 };
      this.broadcastState(eventId);
    }
    return true;
  }

  startQuestion(eventId) {
    const session = this.sessions[eventId];
    if (!session || session.status === 'PODIUM') return;
    session.status = 'QUESTION_ACTIVE';
    session.stateExpiresAt = Date.now() + (session.questions[session.currentQuestionIndex].timeLimit * 1000);
    this.broadcastState(eventId);
  }

  submitAnswer(eventId, nickname, optionIndex, timeTakenMs) {
    const session = this.sessions[eventId];
    if (!session || session.status !== 'QUESTION_ACTIVE') return false;

    // Check timeout with 1.5s grace period
    if (Date.now() > session.stateExpiresAt + 1500) return false;

    const question = session.questions[session.currentQuestionIndex];
    const isCorrect = parseInt(optionIndex) === question.correctOptionIndex;

    let points = 0;
    if (isCorrect) {
      const limitMs = question.timeLimit * 1000;
      const speedFactor = Math.max(0, (limitMs - timeTakenMs) / limitMs);
      points = Math.round(1000 * (0.3 + 0.7 * speedFactor));
    }

    if (!session.responses[session.currentQuestionIndex]) {
      session.responses[session.currentQuestionIndex] = {};
    }

    session.responses[session.currentQuestionIndex][nickname] = {
      optionIndex,
      timeTakenMs,
      points,
      isCorrect
    };

    return true;
  }

  revealAnswer(eventId) {
    const session = this.sessions[eventId];
    if (!session || session.status !== 'QUESTION_ACTIVE') return;
    session.status = 'REVEAL_ANSWER';

    const responses = session.responses[session.currentQuestionIndex] || {};
    Object.keys(session.players).forEach(nick => {
      const resp = responses[nick];
      if (resp && resp.isCorrect) {
        session.players[nick].score += resp.points;
        session.players[nick].lastCorrect = true;
        session.players[nick].lastPoints = resp.points;
      } else {
        session.players[nick].lastCorrect = false;
        session.players[nick].lastPoints = 0;
      }
    });

    this.broadcastState(eventId);
  }

  getLeaderboard(eventId) {
    const session = this.sessions[eventId];
    if (!session) return [];
    return Object.keys(session.players).map(nick => ({
      nickname: nick,
      score: session.players[nick].score,
      lastCorrect: session.players[nick].lastCorrect,
      lastPoints: session.players[nick].lastPoints
    })).sort((a, b) => b.score - a.score);
  }

  showLeaderboard(eventId) {
    const session = this.sessions[eventId];
    if (!session) return;
    session.status = 'LEADERBOARD';
    this.broadcastState(eventId);
  }

  nextQuestion(eventId) {
    const session = this.sessions[eventId];
    if (!session) return;
    if (session.currentQuestionIndex + 1 < session.questions.length) {
      session.currentQuestionIndex++;
      session.status = 'LOBBY';
      this.broadcastState(eventId);
    } else {
      session.status = 'PODIUM';
      this.broadcastState(eventId);
    }
  }

  broadcastState(eventId) {
    const session = this.sessions[eventId];
    if (!session) return;
    const payload = JSON.stringify({ type: 'STATE_UPDATE', data: this.getSessionState(eventId) });
    session.clients.forEach(client => {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch (err) {
        // Handle dead connections
      }
    });
  }
}

module.exports = { TriviaCoordinator, triviaCoordinator: new TriviaCoordinator() };
