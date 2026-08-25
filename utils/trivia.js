// TRIVIA INTERACTIVA - MOTOR DE COORDINACIÓN EN TIEMPO REAL
// Especialmente diseñado para bodas, 15 años, cumpleaños y eventos de gala

const TRIVIA_TEMPLATES = {
  casamiento: {
    id: 'casamiento',
    name: '💍 Boda de Gala: Secretos de los Novios',
    description: 'Preguntas románticas y divertidas sobre la historia de amor, anécdotas, convivencia y el viaje soñado de los novios.',
    category: 'Casamientos & Bodas',
    icon: '💍',
    questions: [
      {
        questionText: '¿Dónde y cómo fue la primera cita oficial de los novios?',
        options: ['Un café íntimo y romántico', 'Una cena con amigos en un bar', 'Una fiesta / boliche inolvidable', 'Por una charla interminable en redes'],
        correctOptionIndex: 0,
        timeLimit: 20,
        category: 'El Comienzo'
      },
      {
        questionText: '¿Quién dio el primer paso para formalizar la relación?',
        options: ['Él / Novio', 'Ella / Novia', 'Fue mutuo y espontáneo', 'Los amigos tuvieron que empujar'],
        correctOptionIndex: 2,
        timeLimit: 15,
        category: 'Romance'
      },
      {
        questionText: '¿Cuál es el destino soñado para la Luna de Miel?',
        options: ['Playas paradisíacas del Caribe', 'Recorrido histórico por Europa', 'Aventura exótica en Asia', 'Nieve y cabaña en la Patagonia'],
        correctOptionIndex: 0,
        timeLimit: 20,
        category: 'Aventuras'
      },
      {
        questionText: '¿Quién es más propenso a quedarse dormido viendo una película?',
        options: ['El novio', 'La novia', 'Ambos por igual a los 10 minutos', 'Ninguno, son noctámbulos'],
        correctOptionIndex: 0,
        timeLimit: 15,
        category: 'Convivencia'
      },
      {
        questionText: '🌟 PREGUNTA DE ORO: ¿Qué fecha exacta comenzaron su noviazgo oficial?',
        options: ['Un fin de semana de primavera', 'En plenas vacaciones de verano', 'En un cumpleaños inolvidable', 'Una noche de fin de año'],
        correctOptionIndex: 0,
        timeLimit: 20,
        doublePoints: true,
        category: 'Ronda de Oro'
      }
    ]
  },

  quince_anos: {
    id: 'quince_anos',
    name: '👑 Mis 15 Mágicos: ¿Cuánto conocés a la Quinceañera?',
    description: 'Trivias emocionantes y divertidas sobre su infancia, sus gustos favoritos, anécdotas con amigas y pasiones.',
    category: '15 Años',
    icon: '👑',
    questions: [
      {
        questionText: '¿Cuál era el juego o dibujo animado preferido de su infancia?',
        options: ['Princesas Disney', 'Barbie / Muñecas', 'Bailar frente al espejo', 'Juegos al aire libre'],
        correctOptionIndex: 1,
        timeLimit: 20,
        category: 'Infancia'
      },
      {
        questionText: '¿Qué es lo primero que hace al despertarse cada mañana?',
        options: ['Revisar el celular / TikTok', 'Tomar un café o chocolatada', 'Poner música a todo volumen', 'Quedarse 15 minutos más en la cama'],
        correctOptionIndex: 0,
        timeLimit: 15,
        category: 'Rutinas'
      },
      {
        questionText: '¿Cuál es su comida favorita indiscutida?',
        options: ['Sushi', 'Hamburguesas completas', 'Milanesas con papas fritas', 'Pastas caseras'],
        correctOptionIndex: 2,
        timeLimit: 15,
        category: 'Gustos'
      },
      {
        questionText: 'Si pudiera viajar mañana mismo a cualquier lugar del mundo, ¿a dónde iría?',
        options: ['París / Francia', 'Disney World / Orlando', 'Nueva York / Estados Unidos', 'Playa en Cancún / Caribe'],
        correctOptionIndex: 1,
        timeLimit: 20,
        category: 'Sueños'
      },
      {
        questionText: '🌟 PREGUNTA DE ORO: ¿Cuál es la materia del colegio en la que más se destaca?',
        options: ['Arte / Música', 'Historia / Literatura', 'Educación Física / Deportes', 'Matemáticas / Ciencias'],
        correctOptionIndex: 0,
        timeLimit: 20,
        doublePoints: true,
        category: 'Ronda de Oro'
      }
    ]
  },

  cumple_adultos: {
    id: 'cumple_adultos',
    name: '🎉 Gran Cumpleaños: Vida, Anécdotas & Hitos',
    description: 'Preguntas sobre la vida del cumpleañero/a, recuerdos de juventud, viajes con amigos y manías cómicas.',
    category: 'Cumpleaños',
    icon: '🎉',
    questions: [
      {
        questionText: '¿Cuál fue su primer trabajo o emprendimiento en la juventud?',
        options: ['Atención en local comercial', 'Pasantía en oficina', 'Profesor / Clases particulares', 'Emprendimiento con amigos'],
        correctOptionIndex: 0,
        timeLimit: 20,
        category: 'Historia'
      },
      {
        questionText: '¿Cuál es la bebida con la que nunca falla en un brindis?',
        options: ['Vino Malbec de reserva', 'Gin Tonic bien preparado', 'Cerveza bien fría', 'Fernet con cola'],
        correctOptionIndex: 1,
        timeLimit: 15,
        category: 'Estilo'
      },
      {
        questionText: '¿Qué banda o artista sonaba sin parar en sus años dorados de juventud?',
        options: ['Rock Nacional Clásico', 'Los 80s Internacionales / Pop', 'Cumbia de los 90s / 2000s', 'Baladas Románticas'],
        correctOptionIndex: 0,
        timeLimit: 20,
        category: 'Música'
      },
      {
        questionText: '¿Cuál es su pasatiempo preferido durante el fin de semana?',
        options: ['Hacer un buen asado para la familia', 'Hacer deportes o caminatas al aire libre', 'Maratonear series y películas', 'Proyectos de jardín / bricolaje'],
        correctOptionIndex: 0,
        timeLimit: 15,
        category: 'Hobbies'
      },
      {
        questionText: '🌟 PREGUNTA DE ORO: ¿En qué ciudad o rincón del mundo vivió su anécdota más graciosa?',
        options: ['En un viaje de egresados a Bariloche', 'En unas vacaciones en la Costa', 'En una escapada al exterior con amigos', 'En su propia casa en una fiesta inolvidable'],
        correctOptionIndex: 1,
        timeLimit: 20,
        doublePoints: true,
        category: 'Ronda de Oro'
      }
    ]
  },

  corporativo: {
    id: 'corporativo',
    name: '💼 Company Challenge: Cultura, Logros & Compañeros',
    description: 'Trivia de integración laboral: hitos de la empresa, anécdotas de oficina y desafíos en equipo.',
    category: 'Corporativo & Empresa',
    icon: '💼',
    questions: [
      {
        questionText: '¿En qué año se fundó la compañía o se inauguró este gran equipo?',
        options: ['Hace más de 10 años', 'Entre 5 y 10 años', 'Entre 2 y 5 años', 'Es una división nuevecita y exitosa'],
        correctOptionIndex: 1,
        timeLimit: 20,
        category: 'Historia'
      },
      {
        questionText: '¿Qué es lo que nunca falta en la cocina / sala de descanso de la empresa?',
        options: ['Café recién preparado a litros', 'Mate con bizcochitos compartidos', 'Fruta y snacks saludables', 'Charlas y risas entre proyectos'],
        correctOptionIndex: 0,
        timeLimit: 15,
        category: 'Cultura'
      },
      {
        questionText: '¿Cuál fue el mayor hito alcanzado por el equipo en el último año?',
        options: ['Récord de ventas / clientes satisfechos', 'Lanzamiento de una nueva sede o producto', 'Crecimiento y duplicación del equipo', 'Superar todas las metas propuestas'],
        correctOptionIndex: 3,
        timeLimit: 15,
        category: 'Logros'
      },
      {
        questionText: '🌟 PREGUNTA DE ORO: ¿Quién es el más propenso a decir "estoy muteado" en una videollamada?',
        options: ['El Gerente / Líder del equipo', 'El más tecnológico del grupo', 'Todos al menos 3 veces por semana', 'Los que se conectan desde el auto'],
        correctOptionIndex: 2,
        timeLimit: 20,
        doublePoints: true,
        category: 'Ronda de Oro'
      }
    ]
  },

  musica_fiesta: {
    id: 'musica_fiesta',
    name: '🎵 Fiesta & Pop Hits: ¿Quién sabe más de música?',
    description: 'Desafío musical de fiesta con clásicos de fiesta, boliche, cumbia, rock y hits internacionales.',
    category: 'Música & Fiesta',
    icon: '🎵',
    questions: [
      {
        questionText: '¿Qué canción nunca puede faltar cuando la pista de baile explota?',
        options: ['Clásicos de Cumbia y Cuarteto', 'Reggaeton Old School / 2000s', 'Rock Nacional para cantar a coro', 'Electrónica / Pop internacional'],
        correctOptionIndex: 0,
        timeLimit: 15,
        category: 'Pista de Baile'
      },
      {
        questionText: '¿Quién es el rey o reina indiscutida del karaoke en este grupo?',
        options: ['El que desafina pero le pone toda la pasión', 'El que se sabe todas las letras de memoria', 'El que canta baladas con los ojos cerrados', 'Todos después del tercer brindis'],
        correctOptionIndex: 3,
        timeLimit: 15,
        category: 'Karaoke'
      },
      {
        questionText: '🌟 PREGUNTA DE ORO: ¿A qué hora suele comenzar la mejor tanda de fiesta de la noche?',
        options: ['Apenas termina el postre', 'En la tanda de baile central', 'En el cotillón / show de luces', 'Desde que pisamos el salón hasta el amanecer'],
        correctOptionIndex: 3,
        timeLimit: 20,
        doublePoints: true,
        category: 'Ronda de Oro'
      }
    ]
  }
};

TRIVIA_TEMPLATES.cumpleanos = TRIVIA_TEMPLATES.cumple_adultos;

class TriviaCoordinator {
  constructor() {
    this.sessions = {};
  }

  getTemplates() {
    return TRIVIA_TEMPLATES;
  }

  detectTheme(questions) {
    if (!Array.isArray(questions) || questions.length === 0) return 'casamiento';
    const text = questions.map(q => (q.questionText || q.question || '') + ' ' + (q.options || []).join(' ')).join(' ').toLowerCase();
    if (text.includes('15') || text.includes('quince') || text.includes('infancia') || text.includes('vals') || text.includes('sebardo')) return 'quince_anos';
    if (text.includes('empresa') || text.includes('compañía') || text.includes('trabajo') || text.includes('oficina') || text.includes('team') || text.includes('corporativo')) return 'corporativo';
    if (text.includes('cumpleañ') || text.includes('asado') || text.includes('hitos') || text.includes('edad')) return 'cumple_adultos';
    if (text.includes('música') || text.includes('canción') || text.includes('karaoke') || text.includes('pista') || text.includes('baile') || text.includes('dj') || text.includes('hit')) return 'musica_fiesta';
    if (text.includes('novio') || text.includes('novia') || text.includes('boda') || text.includes('casamiento') || text.includes('luna de miel') || text.includes('pareja')) return 'casamiento';
    return 'casamiento';
  }

  initializeSession(eventId, questions, explicitTheme = null) {
    let finalQuestions = questions || [];
    if (finalQuestions.length === 0) {
      finalQuestions = TRIVIA_TEMPLATES.casamiento.questions;
    }

    const normalizedQuestions = finalQuestions.map(q => ({
      questionText: q.questionText || q.question || '',
      options: Array.isArray(q.options) ? q.options : [],
      correctOptionIndex: q.correctOptionIndex !== undefined ? parseInt(q.correctOptionIndex) : (q.correctIndex !== undefined ? parseInt(q.correctIndex) : 0),
      timeLimit: parseInt(q.timeLimit) || 20,
      doublePoints: q.doublePoints === true || q.isDouble === true,
      category: q.category || 'Trivia en Vivo'
    }));

    // Clear existing timer if any
    if (this.sessions[eventId] && this.sessions[eventId].timerId) {
      clearTimeout(this.sessions[eventId].timerId);
    }

    const existingClients = this.sessions[eventId] ? this.sessions[eventId].clients : [];
    const existingCustomDuration = this.sessions[eventId] ? this.sessions[eventId].customDuration : null;

    this.sessions[eventId] = {
      status: 'LOBBY', // 'LOBBY', 'COUNTDOWN', 'QUESTION_ACTIVE', 'REVEAL_ANSWER', 'LEADERBOARD', 'PODIUM'
      questions: normalizedQuestions,
      theme: explicitTheme || this.detectTheme(normalizedQuestions),
      currentQuestionIndex: 0,
      players: {}, // nickname: { score: 0, streak: 0, highestStreak: 0, lastCorrect: false, lastPoints: 0, totalTimeMs: 0, previousRank: 0 }
      responses: {}, // questionIndex: { nickname: { optionIndex, timeTakenMs, points, isCorrect, streakBonus, doubleBonus } }
      stateExpiresAt: null,
      pausedRemainingTime: null,
      paused: false,
      clients: existingClients, // preserve connected SSE clients
      autoMode: false,
      autoAdvanceAllAnswered: true,
      customDuration: existingCustomDuration,
      timerId: null,
      inTransition: false
    };

    // Auto-repopulate players from already connected player clients
    existingClients.forEach(client => {
      if (client.role === 'player' && client.nickname) {
        this.addPlayer(eventId, client.nickname);
      }
    });

    this.broadcastState(eventId);
  }

  startCountdown(eventId) {
    const session = this.sessions[eventId];
    if (!session) return;

    if (session.timerId) {
      clearTimeout(session.timerId);
      session.timerId = null;
    }

    session.status = 'COUNTDOWN';
    session.autoMode = true;
    session.stateExpiresAt = Date.now() + 10000;

    session.timerId = setTimeout(() => {
      this.startQuestion(eventId, true);
    }, 10000);

    this.broadcastState(eventId);
  }

  checkAndTransitionAutoState(eventId) {
    const session = this.sessions[eventId];
    if (!session || !session.autoMode || session.paused) return;

    const now = Date.now();
    if (session.status === 'QUESTION_ACTIVE') {
      if (session.stateExpiresAt && now > session.stateExpiresAt) {
        this.revealAnswer(eventId);
      }
    } else if (session.status === 'REVEAL_ANSWER') {
      if (session.stateExpiresAt && now > session.stateExpiresAt) {
        this.showLeaderboard(eventId);
      }
    } else if (session.status === 'LEADERBOARD') {
      if (session.stateExpiresAt && now > session.stateExpiresAt) {
        this.nextQuestion(eventId);
      }
    } else if (session.status === 'COUNTDOWN') {
      if (session.stateExpiresAt && now > session.stateExpiresAt) {
        this.startQuestion(eventId, true);
      }
    }
  }

  getSessionState(eventId) {
    const session = this.sessions[eventId];
    if (!session) {
      return { 
        status: 'INACTIVE', 
        players: [], 
        questionsCount: 0, 
        totalQuestions: 0,
        connectedPlayersCount: 0,
        answeredPlayersCount: 0
      };
    }

    if (!session.inTransition) {
      session.inTransition = true;
      try {
        this.checkAndTransitionAutoState(eventId);
      } finally {
        session.inTransition = false;
      }
    }

    const playerKeys = Object.keys(session.players);
    const currentResponses = session.responses[session.currentQuestionIndex] || {};
    const answeredCount = Object.keys(currentResponses).length;
    const currentQ = session.questions[session.currentQuestionIndex];

    return {
      status: session.status,
      theme: session.theme || this.detectTheme(session.questions),
      paused: session.paused || false,
      autoMode: session.autoMode || false,
      customDuration: session.customDuration || null,
      serverTime: Date.now(),
      stateExpiresAt: session.stateExpiresAt,
      currentQuestionIndex: session.currentQuestionIndex,
      connectedPlayersCount: playerKeys.length,
      answeredPlayersCount: answeredCount,
      players: playerKeys.map(nick => ({
        nickname: nick,
        score: session.players[nick].score,
        streak: session.players[nick].streak || 0,
        highestStreak: session.players[nick].highestStreak || 0
      })),
      questionsCount: session.questions.length,
      totalQuestions: session.questions.length,
      currentQuestion: (session.status === 'QUESTION_ACTIVE' || session.status === 'REVEAL_ANSWER') && currentQ ? {
        questionText: currentQ.questionText,
        options: currentQ.options,
        category: currentQ.category || 'Trivia',
        doublePoints: !!currentQ.doublePoints,
        timeLimit: session.customDuration || currentQ.timeLimit,
        remainingTime: session.stateExpiresAt 
          ? Math.max(0, Math.round((session.stateExpiresAt - Date.now()) / 1000)) 
          : (session.pausedRemainingTime !== undefined && session.pausedRemainingTime !== null ? session.pausedRemainingTime : (session.customDuration || currentQ.timeLimit)),
        correctOptionIndex: session.status === 'REVEAL_ANSWER' ? currentQ.correctOptionIndex : undefined,
        answeredCount: answeredCount,
        totalPlayers: playerKeys.length,
        optionStats: (() => {
          const numOptions = (currentQ.options && currentQ.options.length) || 4;
          const stats = new Array(numOptions).fill(0);
          Object.values(currentResponses).forEach(r => {
            if (r.optionIndex !== undefined && r.optionIndex >= 0 && r.optionIndex < numOptions) {
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
    const cleanNick = (nickname || '').trim();
    if (!cleanNick) return false;

    if (!session.players[cleanNick]) {
      session.players[cleanNick] = { 
        score: 0, 
        streak: 0, 
        highestStreak: 0, 
        lastCorrect: false, 
        lastPoints: 0,
        totalTimeMs: 0,
        previousRank: Object.keys(session.players).length + 1
      };
      this.broadcastState(eventId);
    }
    return true;
  }

  setCustomDuration(eventId, duration) {
    const session = this.sessions[eventId];
    if (session) {
      session.customDuration = duration ? parseInt(duration) : null;
      this.broadcastState(eventId);
    }
  }

  startQuestion(eventId, autoMode = null) {
    const session = this.sessions[eventId];
    if (!session || session.status === 'PODIUM') return;
    if (!session.questions || session.questions.length === 0) {
      console.warn(`[TriviaCoordinator] Cannot start question: session ${eventId} has 0 questions.`);
      return;
    }

    if (session.timerId) {
      clearTimeout(session.timerId);
      session.timerId = null;
    }

    if (autoMode !== null) {
      session.autoMode = autoMode;
    }

    session.status = 'QUESTION_ACTIVE';
    
    const currentQ = session.questions[session.currentQuestionIndex];
    let timeLimit = session.customDuration || (currentQ ? currentQ.timeLimit : 20);
    
    if (session.pausedRemainingTime !== undefined && session.pausedRemainingTime !== null) {
      timeLimit = Math.max(1, session.pausedRemainingTime);
      session.pausedRemainingTime = null;
    }
    
    session.paused = false;
    session.stateExpiresAt = Date.now() + (timeLimit * 1000);

    if (session.autoMode) {
      session.timerId = setTimeout(() => {
        this.revealAnswer(eventId);
      }, timeLimit * 1000);
    }

    this.broadcastState(eventId);
  }

  submitAnswer(eventId, nickname, optionIndex, timeTakenMs) {
    const session = this.sessions[eventId];
    if (!session || session.status !== 'QUESTION_ACTIVE') return false;

    // Grace period for network latency (1.5s)
    if (Date.now() > session.stateExpiresAt + 1500) return false;

    const cleanNick = (nickname || '').trim();
    if (!cleanNick) return false;

    // Ensure player exists
    if (!session.players[cleanNick]) {
      this.addPlayer(eventId, cleanNick);
    }

    const question = session.questions[session.currentQuestionIndex];
    if (!question) return false;

    if (!session.responses[session.currentQuestionIndex]) {
      session.responses[session.currentQuestionIndex] = {};
    }

    // Do not allow multiple submissions for the same question
    if (session.responses[session.currentQuestionIndex][cleanNick]) {
      return true;
    }

    const parsedOpt = parseInt(optionIndex);
    const isCorrect = parsedOpt === question.correctOptionIndex;
    const limitMs = (session.customDuration || question.timeLimit) * 1000;
    const cleanTimeTaken = Math.max(100, Math.min(timeTakenMs || limitMs, limitMs));

    let points = 0;
    let streakBonus = 0;
    let doubleMultiplier = question.doublePoints ? 2 : 1;

    if (isCorrect) {
      // Speed factor: 0.3 base + up to 0.7 for instant answer (Kahoot/HQ scale 1000 base)
      const speedFactor = Math.max(0, (limitMs - cleanTimeTaken) / limitMs);
      const basePoints = Math.round(100 * (0.3 + 0.7 * speedFactor));
      
      // Streak calculation (streak combo bonus)
      const currentStreak = (session.players[cleanNick].streak || 0) + 1;
      if (currentStreak >= 2) {
        streakBonus = Math.min(50, (currentStreak - 1) * 10);
      }
      
      points = Math.round((basePoints + streakBonus) * doubleMultiplier);
    }

    session.responses[session.currentQuestionIndex][cleanNick] = {
      optionIndex: parsedOpt,
      timeTakenMs: cleanTimeTaken,
      points,
      isCorrect,
      streakBonus,
      doubleBonus: question.doublePoints
    };

    // Update player accumulated stats immediately
    session.players[cleanNick].totalTimeMs = (session.players[cleanNick].totalTimeMs || 0) + cleanTimeTaken;

    // Check if 100% of connected players have answered -> Auto-advance trigger
    const totalConnected = Object.keys(session.players).length;
    const answeredCount = Object.keys(session.responses[session.currentQuestionIndex]).length;
    
    this.broadcastState(eventId);

    if (session.autoMode && session.autoAdvanceAllAnswered && totalConnected > 0 && answeredCount >= totalConnected) {
      // If everyone answered, trigger reveal after a brief 1.2s celebration pause
      if (session.timerId) {
        clearTimeout(session.timerId);
      }
      session.timerId = setTimeout(() => {
        this.revealAnswer(eventId);
      }, 1200);
    }

    return true;
  }

  revealAnswer(eventId) {
    const session = this.sessions[eventId];
    if (!session || session.status !== 'QUESTION_ACTIVE') return;

    if (session.timerId) {
      clearTimeout(session.timerId);
      session.timerId = null;
    }

    session.status = 'REVEAL_ANSWER';
    
    if (session.autoMode) {
      session.stateExpiresAt = Date.now() + 6000;
      session.timerId = setTimeout(() => {
        this.showLeaderboard(eventId);
      }, 6000);
    } else {
      session.stateExpiresAt = null;
    }

    // Save previous ranks before applying new scores
    const previousLeaderboard = this.getLeaderboard(eventId);
    const rankMap = {};
    previousLeaderboard.forEach((p, idx) => {
      rankMap[p.nickname] = idx + 1;
    });

    const responses = session.responses[session.currentQuestionIndex] || {};
    Object.keys(session.players).forEach(nick => {
      session.players[nick].previousRank = rankMap[nick] || Object.keys(session.players).length;
      const resp = responses[nick];
      if (resp && resp.isCorrect) {
        session.players[nick].score += resp.points;
        session.players[nick].streak = (session.players[nick].streak || 0) + 1;
        if (session.players[nick].streak > (session.players[nick].highestStreak || 0)) {
          session.players[nick].highestStreak = session.players[nick].streak;
        }
        session.players[nick].lastCorrect = true;
        session.players[nick].lastPoints = resp.points;
      } else {
        session.players[nick].streak = 0;
        session.players[nick].lastCorrect = false;
        session.players[nick].lastPoints = 0;
      }
    });

    this.broadcastState(eventId);
  }

  getLeaderboard(eventId) {
    const session = this.sessions[eventId];
    if (!session) return [];

    const sorted = Object.keys(session.players).map(nick => ({
      nickname: nick,
      score: session.players[nick].score,
      streak: session.players[nick].streak || 0,
      highestStreak: session.players[nick].highestStreak || 0,
      lastCorrect: session.players[nick].lastCorrect || false,
      lastPoints: session.players[nick].lastPoints || 0,
      totalTimeMs: session.players[nick].totalTimeMs || 0,
      previousRank: session.players[nick].previousRank || 0
    })).sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Tie-breaker: least accumulated response time wins
      return a.totalTimeMs - b.totalTimeMs;
    });

    return sorted.map((player, currentIdx) => {
      const currentRank = currentIdx + 1;
      const rankDelta = player.previousRank ? (player.previousRank - currentRank) : 0;
      return {
        ...player,
        rank: currentRank,
        rankDelta: rankDelta // +X climbed, -X dropped, 0 unchanged
      };
    });
  }

  showLeaderboard(eventId) {
    const session = this.sessions[eventId];
    if (!session) return;

    if (session.timerId) {
      clearTimeout(session.timerId);
      session.timerId = null;
    }

    session.status = 'LEADERBOARD';

    if (session.autoMode) {
      session.stateExpiresAt = Date.now() + 8000;
      session.timerId = setTimeout(() => {
        this.nextQuestion(eventId);
      }, 8000);
    } else {
      session.stateExpiresAt = null;
    }

    this.broadcastState(eventId);
  }

  nextQuestion(eventId) {
    const session = this.sessions[eventId];
    if (!session) return;

    if (session.timerId) {
      clearTimeout(session.timerId);
      session.timerId = null;
    }

    if (session.currentQuestionIndex + 1 < session.questions.length) {
      session.currentQuestionIndex++;
      if (session.autoMode) {
        this.startQuestion(eventId, true);
      } else {
        session.status = 'LOBBY';
        session.stateExpiresAt = null;
        this.broadcastState(eventId);
      }
    } else {
      session.status = 'PODIUM';
      session.autoMode = false;
      session.stateExpiresAt = null;
      this.broadcastState(eventId);
    }
  }

  toggleAutoMode(eventId) {
    const session = this.sessions[eventId];
    if (!session) return false;
    session.autoMode = !session.autoMode;
    if (!session.autoMode && session.timerId) {
      clearTimeout(session.timerId);
      session.timerId = null;
    }
    this.broadcastState(eventId);
    return session.autoMode;
  }

  stopTrivia(eventId) {
    const session = this.sessions[eventId];
    if (!session) return;

    if (session.timerId) {
      clearTimeout(session.timerId);
      session.timerId = null;
    }

    session.autoMode = false;
    session.paused = true;

    if (session.status === 'COUNTDOWN') {
      session.status = 'LOBBY';
      session.paused = false;
      session.stateExpiresAt = null;
    } else if (session.status === 'QUESTION_ACTIVE' && session.stateExpiresAt) {
      session.pausedRemainingTime = Math.max(0, Math.round((session.stateExpiresAt - Date.now()) / 1000));
      session.stateExpiresAt = null;
    } else {
      session.stateExpiresAt = null;
    }

    this.broadcastState(eventId);
  }

  jumpToPodium(eventId) {
    const session = this.sessions[eventId];
    if (!session) return;

    if (session.timerId) {
      clearTimeout(session.timerId);
      session.timerId = null;
    }

    session.status = 'PODIUM';
    session.autoMode = false;
    session.stateExpiresAt = null;
    this.broadcastState(eventId);
  }

  getGameSummary(eventId) {
    const session = this.sessions[eventId];
    if (!session) return null;

    const leaderboard = this.getLeaderboard(eventId);
    const totalQuestions = session.questions.length;
    let totalAnswers = 0;
    let totalCorrect = 0;
    let fastestMs = 999999;
    let fastestPlayer = '-';

    Object.values(session.responses).forEach(qResponses => {
      Object.entries(qResponses).forEach(([nick, r]) => {
        totalAnswers++;
        if (r.isCorrect) totalCorrect++;
        if (r.timeTakenMs && r.timeTakenMs < fastestMs) {
          fastestMs = r.timeTakenMs;
          fastestPlayer = nick;
        }
      });
    });

    const accuracyRate = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

    return {
      totalQuestions,
      totalParticipants: Object.keys(session.players).length,
      totalAnswers,
      accuracyRate,
      fastestPlayer: fastestMs < 999999 ? `${fastestPlayer} (${(fastestMs / 1000).toFixed(2)}s)` : '-',
      top3: leaderboard.slice(0, 3),
      leaderboard
    };
  }

  broadcastState(eventId) {
    const session = this.sessions[eventId];
    if (!session) return;
    const payload = JSON.stringify({ type: 'STATE_UPDATE', data: this.getSessionState(eventId) });
    session.clients.forEach(client => {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch (err) {
        // Dead connection will be cleaned up on disconnect
      }
    });
  }
}

module.exports = { 
  TriviaCoordinator, 
  triviaCoordinator: new TriviaCoordinator(),
  TRIVIA_TEMPLATES
};
