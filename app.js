const NOTE_DATA = [
  { name: "C4", label: "C", y: 110, freq: 261.63 },
  { name: "D4", label: "D", y: 102, freq: 293.66 },
  { name: "E4", label: "E", y: 94, freq: 329.63 },
  { name: "F4", label: "F", y: 86, freq: 349.23 },
  { name: "G4", label: "G", y: 78, freq: 392.0 },
  { name: "A4", label: "A", y: 70, freq: 440.0 },
  { name: "B4", label: "B", y: 62, freq: 493.88 }
];

const STAGES = [
  {
    id: 0,
    title: "Stage 0 — Neural Priming",
    goal: "Visual familiarity only. No scoring, no wrong answers.",
    description: "Observe high / middle / low positions. Let the staff become familiar.",
    mode: "priming",
    exposuresRequired: 9
  },
  {
    id: 1,
    title: "Stage 1 — Single Note Imprinting",
    goal: "Burn each note into memory with slow, focused repetition.",
    description: "One note at a time. Reach ≥90% accuracy with minimum reps.",
    mode: "single",
    minRepsPerNote: 8,
    accuracyTarget: 0.9
  },
  {
    id: 2,
    title: "Stage 2 — Multi-Note Discrimination",
    goal: "Recognize 3–5 notes without hesitation.",
    description: "Timed flashcards. Weak notes repeat more often.",
    mode: "multi",
    noteCount: 4,
    timeLimitMs: 4000,
    accuracyTarget: 0.9,
    reactionTargetMs: 2800
  },
  {
    id: 3,
    title: "Stage 3 — Reflex Acceleration",
    goal: "Remove conscious thinking. Speed proves mastery.",
    description: "Strict 3-second limit. Streaks only.",
    mode: "reflex",
    timeLimitMs: 3000,
    streakTarget: 10,
    accuracyTarget: 0.9
  },
  {
    id: 4,
    title: "Stage 4 — Sensory Binding",
    goal: "Bind eye + ear. Audio leads, vision confirms.",
    description: "Hear → identify, then confirm visually.",
    mode: "audio",
    timeLimitMs: 3500,
    accuracyTarget: 0.9
  },
  {
    id: 5,
    title: "Stage 5 — Automaticity & Stress Test",
    goal: "Prove mastery under pressure.",
    description: "Time attack. Mixed chaos. No patterns.",
    mode: "stress",
    timeLimitMs: 2500,
    accuracyTarget: 0.9,
    reactionTargetMs: 2000,
    questionTarget: 20
  },
  {
    id: 6,
    title: "Stage 6 — Retention Lock-In",
    goal: "Prevent decay using spaced repetition.",
    description: "Daily micro sessions, weak notes first.",
    mode: "retention",
    timeLimitMs: 3000
  }
];

const STORAGE_KEY = "note-instinct-system";
const DECAY_PER_DAY = 2;

const homePanel = document.getElementById("home");
const trainingPanel = document.getElementById("training");
const startButton = document.getElementById("startButton");
const backButton = document.getElementById("backButton");
const answerGrid = document.getElementById("answerGrid");
const feedback = document.getElementById("feedback");
const memoryIndicator = document.getElementById("memoryIndicator");
const memoryValue = document.getElementById("memoryValue");
const statMastered = document.getElementById("statMastered");
const statAccuracy = document.getElementById("statAccuracy");
const statStreak = document.getElementById("statStreak");
const statReaction = document.getElementById("statReaction");
const lastSession = document.getElementById("lastSession");
const noteHead = document.getElementById("noteHead");
const noteStem = document.getElementById("noteStem");
const timerBar = document.getElementById("timerBar");
const statsButton = document.getElementById("statsButton");
const resetButton = document.getElementById("resetButton");
const statsModal = document.getElementById("statsModal");
const statsList = document.getElementById("statsList");
const closeStats = document.getElementById("closeStats");
const stageList = document.getElementById("stageList");
const stageLabel = document.getElementById("stageLabel");
const stageTitle = document.getElementById("stageTitle");
const stageGoal = document.getElementById("stageGoal");
const phaseStatus = document.getElementById("phaseStatus");
const sessionAccuracy = document.getElementById("sessionAccuracy");
const sessionReaction = document.getElementById("sessionReaction");
const noteOverlay = document.getElementById("noteOverlay");
const continueButton = document.getElementById("continueButton");

let state = null;
let currentNote = null;
let timerTimeout = null;
let audioContext = null;
let questionStart = null;
let primingIndex = 0;
let sessionAttempts = 0;
let sessionCorrect = 0;
let sessionReactionTotal = 0;
let stressQuestions = 0;

const getDefaultState = () => ({
  notes: NOTE_DATA.map((note) => ({
    ...note,
    correct: 0,
    attempts: 0,
    reactionTotal: 0,
    mastery: 40
  })),
  totalAttempts: 0,
  totalCorrect: 0,
  streak: 0,
  lastSession: null,
  currentStage: 0,
  stageProgress: {
    primingExposures: 0,
    singleNoteIndex: 0
  }
});

const loadState = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return getDefaultState();
  try {
    const parsed = JSON.parse(saved);
    const base = getDefaultState();
    return {
      ...base,
      ...parsed,
      stageProgress: {
        ...base.stageProgress,
        ...(parsed.stageProgress || {})
      },
      notes: (parsed.notes || base.notes).map((note, index) => ({
        ...base.notes[index],
        ...note
      }))
    };
  } catch (error) {
    return getDefaultState();
  }
};

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const applyDecay = () => {
  if (!state.lastSession) return;
  const last = new Date(state.lastSession);
  const now = new Date();
  const days = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  if (days <= 0) return;
  state.notes.forEach((note) => {
    note.mastery = Math.max(0, note.mastery - days * DECAY_PER_DAY);
  });
};

const updateDashboard = () => {
  const mastered = state.notes.filter((note) => note.mastery >= 85).length;
  const accuracy = state.totalAttempts
    ? Math.round((state.totalCorrect / state.totalAttempts) * 100)
    : 0;
  const avgReaction = state.totalCorrect
    ? (state.notes.reduce((sum, note) => sum + note.reactionTotal, 0) / state.totalCorrect) / 1000
    : 0;
  statMastered.textContent = mastered.toString();
  statAccuracy.textContent = `${accuracy}%`;
  statStreak.textContent = state.streak.toString();
  statReaction.textContent = `${avgReaction.toFixed(1)}s`;
  lastSession.textContent = state.lastSession
    ? `Last session: ${new Date(state.lastSession).toLocaleString()}`
    : "New session ready.";
};

const showPanel = (panel) => {
  homePanel.classList.remove("panel-active");
  trainingPanel.classList.remove("panel-active");
  panel.classList.add("panel-active");
};

const updateStageList = () => {
  stageList.innerHTML = "";
  STAGES.forEach((stage, index) => {
    const card = document.createElement("div");
    card.className = "stage-card";
    const locked = index > state.currentStage;
    if (locked) card.classList.add("locked");
    const status = index < state.currentStage ? "Complete" : locked ? "Locked" : "Active";
    card.innerHTML = `
      <div>
        <h3>${stage.title}</h3>
        <p>${stage.description}</p>
      </div>
      <div class="stage-status">${status}</div>
    `;
    stageList.appendChild(card);
  });
};

const updateStageHeader = () => {
  const stage = STAGES[state.currentStage];
  stageLabel.textContent = `Stage ${stage.id}`;
  stageTitle.textContent = stage.title;
  stageGoal.textContent = stage.goal;
};

const updateSessionStats = () => {
  const accuracy = sessionAttempts ? Math.round((sessionCorrect / sessionAttempts) * 100) : 0;
  const reaction = sessionCorrect ? (sessionReactionTotal / sessionCorrect) / 1000 : 0;
  sessionAccuracy.textContent = `${accuracy}%`;
  sessionReaction.textContent = `${reaction.toFixed(1)}s`;
};

const updateMemoryIndicator = (note) => {
  memoryValue.textContent = Math.round(note.mastery).toString();
  if (note.mastery < 40) {
    memoryIndicator.style.borderColor = "rgba(255,95,122,0.6)";
    memoryIndicator.style.color = "var(--danger)";
  } else if (note.mastery < 70) {
    memoryIndicator.style.borderColor = "rgba(242,201,76,0.6)";
    memoryIndicator.style.color = "var(--warning)";
  } else {
    memoryIndicator.style.borderColor = "rgba(75,245,138,0.6)";
    memoryIndicator.style.color = "var(--success)";
  }
};

const playNote = (freq) => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = freq;
  gain.gain.value = 0.15;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5);
};

const renderNote = (note) => {
  noteHead.setAttribute("cy", note.y);
  const stemTop = note.y < 70 ? note.y + 35 : note.y - 35;
  noteStem.setAttribute("y1", note.y);
  noteStem.setAttribute("y2", stemTop);
};

const buildChoices = (correctLabel, pool) => {
  const labels = pool.map((note) => note.label);
  const choices = new Set([correctLabel]);
  while (choices.size < 4) {
    const randomLabel = labels[Math.floor(Math.random() * labels.length)];
    choices.add(randomLabel);
  }
  return Array.from(choices).sort(() => Math.random() - 0.5);
};

const resetFeedback = () => {
  feedback.textContent = "";
  const staffWrapper = document.getElementById("staffWrapper");
  staffWrapper.classList.remove("correct", "wrong");
};

const setFeedback = (message, status) => {
  feedback.textContent = message;
  const staffWrapper = document.getElementById("staffWrapper");
  staffWrapper.classList.remove("correct", "wrong");
  if (status) {
    staffWrapper.classList.add(status);
  }
};

const stopTimer = () => {
  timerBar.style.transition = "none";
  timerBar.style.transform = "scaleX(0)";
  clearTimeout(timerTimeout);
};

const startTimer = (durationMs) => {
  stopTimer();
  timerBar.style.transition = "none";
  timerBar.style.transform = "scaleX(1)";
  requestAnimationFrame(() => {
    timerBar.style.transition = `transform ${durationMs}ms linear`;
    timerBar.style.transform = "scaleX(0)";
  });
  timerTimeout = setTimeout(() => {
    handleAnswer(null);
  }, durationMs);
};

const weightedRandomNote = (pool) => {
  const weights = pool.map((note) => 120 - note.mastery);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = Math.random() * total;
  for (let i = 0; i < pool.length; i += 1) {
    threshold -= weights[i];
    if (threshold <= 0) {
      return pool[i];
    }
  }
  return pool[pool.length - 1];
};

const adjustMastery = (note, correct) => {
  const delta = correct ? 6 : -12;
  note.mastery = Math.min(100, Math.max(0, note.mastery + delta));
};

const setPhaseStatus = (text) => {
  phaseStatus.textContent = text;
};

const recordReaction = () => {
  if (!questionStart) return 0;
  return Date.now() - questionStart;
};

const updateStatsModal = () => {
  statsList.innerHTML = "";
  state.notes.forEach((note) => {
    const accuracy = note.attempts
      ? Math.round((note.correct / note.attempts) * 100)
      : 0;
    const reaction = note.correct
      ? (note.reactionTotal / note.correct) / 1000
      : 0;
    const div = document.createElement("div");
    div.textContent = `${note.label} • ${accuracy}% • ${reaction.toFixed(1)}s • Mastery ${Math.round(note.mastery)}`;
    statsList.appendChild(div);
  });
};

const checkStageCompletion = () => {
  const stage = STAGES[state.currentStage];
  if (stage.mode === "priming") {
    if (state.stageProgress.primingExposures >= stage.exposuresRequired) {
      return true;
    }
  }
  if (stage.mode === "single") {
    if (state.stageProgress.singleNoteIndex >= NOTE_DATA.length) {
      return true;
    }
  }
  if (stage.mode === "multi") {
    const accuracy = sessionAttempts ? sessionCorrect / sessionAttempts : 0;
    const reaction = sessionCorrect ? sessionReactionTotal / sessionCorrect : Infinity;
    if (accuracy >= stage.accuracyTarget && reaction <= stage.reactionTargetMs) {
      return true;
    }
  }
  if (stage.mode === "reflex") {
    const accuracy = sessionAttempts ? sessionCorrect / sessionAttempts : 0;
    if (accuracy >= stage.accuracyTarget && state.streak >= stage.streakTarget) {
      return true;
    }
  }
  if (stage.mode === "audio") {
    const accuracy = sessionAttempts ? sessionCorrect / sessionAttempts : 0;
    if (accuracy >= stage.accuracyTarget && sessionAttempts >= 12) {
      return true;
    }
  }
  if (stage.mode === "stress") {
    const accuracy = sessionAttempts ? sessionCorrect / sessionAttempts : 0;
    const reaction = sessionCorrect ? sessionReactionTotal / sessionCorrect : Infinity;
    if (
      accuracy >= stage.accuracyTarget &&
      reaction <= stage.reactionTargetMs &&
      stressQuestions >= stage.questionTarget
    ) {
      return true;
    }
  }
  if (stage.mode === "retention") {
    if (sessionAttempts >= 10) {
      return true;
    }
  }
  return false;
};

const advanceStage = () => {
  if (state.currentStage < STAGES.length - 1) {
    state.currentStage += 1;
    sessionAttempts = 0;
    sessionCorrect = 0;
    sessionReactionTotal = 0;
    stressQuestions = 0;
    state.stageProgress.primingExposures = 0;
    state.stageProgress.singleNoteIndex = 0;
    saveState();
    updateStageList();
  }
};

const startPrimingStep = () => {
  const positions = [
    { label: "Low", y: 102 },
    { label: "Middle", y: 86 },
    { label: "High", y: 62 }
  ];
  const position = positions[primingIndex % positions.length];
  noteOverlay.textContent = `${position.label} position`;
  noteOverlay.classList.add("visible");
  renderNote({ y: position.y });
  setFeedback("Observe the placement. No answers yet.", null);
};

const resetSession = () => {
  sessionAttempts = 0;
  sessionCorrect = 0;
  sessionReactionTotal = 0;
  stressQuestions = 0;
  updateSessionStats();
};

const nextQuestion = () => {
  resetFeedback();
  const stage = STAGES[state.currentStage];
  noteOverlay.classList.remove("visible");
  continueButton.classList.add("hidden");

  if (stage.mode === "priming") {
    answerGrid.innerHTML = "";
    stopTimer();
    startPrimingStep();
    continueButton.classList.remove("hidden");
    setPhaseStatus(`Exposure ${state.stageProgress.primingExposures + 1}/${stage.exposuresRequired}`);
    return;
  }

  let pool = state.notes;
  if (stage.mode === "single") {
    const index = state.stageProgress.singleNoteIndex;
    pool = [state.notes[index]];
    setPhaseStatus(`Note ${pool[0].label}`);
  } else if (stage.mode === "multi") {
    pool = state.notes.slice(0, stage.noteCount);
    setPhaseStatus("Discrimination set");
  } else if (stage.mode === "reflex") {
    setPhaseStatus(`Streak ${state.streak}/${stage.streakTarget}`);
  } else if (stage.mode === "audio") {
    setPhaseStatus("Audio leads");
  } else if (stage.mode === "stress") {
    setPhaseStatus(`Pressure ${stressQuestions}/${stage.questionTarget}`);
  } else if (stage.mode === "retention") {
    setPhaseStatus("Retention drill");
  }

  currentNote = weightedRandomNote(pool);
  renderNote(currentNote);
  updateMemoryIndicator(currentNote);

  if (stage.mode === "audio") {
    noteOverlay.textContent = "Listen";
    noteOverlay.classList.add("visible");
    playNote(currentNote.freq);
    setTimeout(() => noteOverlay.classList.remove("visible"), 600);
  }

  const choices = buildChoices(currentNote.label, pool);
  answerGrid.innerHTML = "";
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.textContent = choice;
    button.addEventListener("click", () => handleAnswer(choice));
    answerGrid.appendChild(button);
  });

  questionStart = Date.now();
  if (stage.timeLimitMs) {
    startTimer(stage.timeLimitMs);
  } else {
    stopTimer();
  }
};

const handleAnswer = (choice) => {
  const stage = STAGES[state.currentStage];
  if (stage.mode === "priming") return;
  if (!currentNote) return;
  stopTimer();
  const reaction = recordReaction();
  const isCorrect = choice === currentNote.label;

  sessionAttempts += 1;
  state.totalAttempts += 1;
  currentNote.attempts += 1;

  if (isCorrect) {
    sessionCorrect += 1;
    state.totalCorrect += 1;
    state.streak += 1;
    currentNote.correct += 1;
    currentNote.reactionTotal += reaction;
    sessionReactionTotal += reaction;
    adjustMastery(currentNote, true);
    setFeedback("Locked in.", "correct");
  } else {
    state.streak = 0;
    adjustMastery(currentNote, false);
    const answerText = choice ? `Correct: ${currentNote.label}` : `Time's up. ${currentNote.label}`;
    setFeedback(answerText, "wrong");
  }

  if (stage.mode === "stress") {
    stressQuestions += 1;
  }

  state.lastSession = new Date().toISOString();
  saveState();
  updateDashboard();
  updateSessionStats();
  updateMemoryIndicator(currentNote);

  if (stage.mode === "single") {
    const noteAccuracy = currentNote.attempts
      ? currentNote.correct / currentNote.attempts
      : 0;
    if (
      currentNote.attempts >= stage.minRepsPerNote &&
      noteAccuracy >= stage.accuracyTarget
    ) {
      state.stageProgress.singleNoteIndex += 1;
      state.streak = 0;
      saveState();
    }
  }

  if (checkStageCompletion()) {
    setFeedback("Stage complete. Progress unlocked.", "correct");
    advanceStage();
    updateStageHeader();
    updateStageList();
    setTimeout(() => {
      showPanel(homePanel);
    }, 900);
    return;
  }

  setTimeout(nextQuestion, 650);
};

const handlePrimingContinue = () => {
  const stage = STAGES[state.currentStage];
  if (stage.mode !== "priming") return;
  state.stageProgress.primingExposures += 1;
  primingIndex += 1;
  if (checkStageCompletion()) {
    setFeedback("Stage complete. Neural priming locked in.", "correct");
    advanceStage();
    updateStageHeader();
    updateStageList();
    setTimeout(() => showPanel(homePanel), 900);
    return;
  }
  nextQuestion();
};

const resetProgress = () => {
  state = getDefaultState();
  saveState();
  updateDashboard();
  updateStageList();
  updateStageHeader();
  if (trainingPanel.classList.contains("panel-active")) {
    resetSession();
    nextQuestion();
  }
};

const init = () => {
  state = loadState();
  applyDecay();
  saveState();
  updateDashboard();
  updateStageList();
  updateStageHeader();

  startButton.addEventListener("click", () => {
    resetSession();
    showPanel(trainingPanel);
    nextQuestion();
  });

  backButton.addEventListener("click", () => {
    showPanel(homePanel);
  });

  statsButton.addEventListener("click", () => {
    updateStatsModal();
    statsModal.style.display = "flex";
  });

  closeStats.addEventListener("click", () => {
    statsModal.style.display = "none";
  });

  statsModal.addEventListener("click", (event) => {
    if (event.target === statsModal) {
      statsModal.style.display = "none";
    }
  });

  resetButton.addEventListener("click", resetProgress);
  continueButton.addEventListener("click", handlePrimingContinue);
};

init();
