const NOTE_DATA = [
  { name: "C4", label: "C", y: 110, freq: 261.63, memory: 50 },
  { name: "D4", label: "D", y: 102, freq: 293.66, memory: 50 },
  { name: "E4", label: "E", y: 94, freq: 329.63, memory: 50 },
  { name: "F4", label: "F", y: 86, freq: 349.23, memory: 50 },
  { name: "G4", label: "G", y: 78, freq: 392.0, memory: 50 },
  { name: "A4", label: "A", y: 70, freq: 440.0, memory: 50 },
  { name: "B4", label: "B", y: 62, freq: 493.88, memory: 50 }
];

const STORAGE_KEY = "note-instinct-data";

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
const lastSession = document.getElementById("lastSession");
const reactionToggle = document.getElementById("reactionToggle");
const audioToggle = document.getElementById("audioToggle");
const noteHead = document.getElementById("noteHead");
const noteStem = document.getElementById("noteStem");
const timerBar = document.getElementById("timerBar");
const statsButton = document.getElementById("statsButton");
const resetButton = document.getElementById("resetButton");
const statsModal = document.getElementById("statsModal");
const statsList = document.getElementById("statsList");
const closeStats = document.getElementById("closeStats");

let state = null;
let currentNote = null;
let timerTimeout = null;
let timerInterval = null;
let audioContext = null;

const loadState = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return {
      notes: NOTE_DATA.map((note) => ({ ...note, correct: 0, attempts: 0 })),
      totalAttempts: 0,
      totalCorrect: 0,
      streak: 0,
      lastSession: null
    };
  }
  try {
    const parsed = JSON.parse(saved);
    return {
      ...parsed,
      notes: parsed.notes.map((note, index) => ({
        ...NOTE_DATA[index],
        ...note
      }))
    };
  } catch (error) {
    return {
      notes: NOTE_DATA.map((note) => ({ ...note, correct: 0, attempts: 0 })),
      totalAttempts: 0,
      totalCorrect: 0,
      streak: 0,
      lastSession: null
    };
  }
};

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const updateDashboard = () => {
  const mastered = state.notes.filter((note) => note.memory >= 80).length;
  const accuracy = state.totalAttempts
    ? Math.round((state.totalCorrect / state.totalAttempts) * 100)
    : 0;
  statMastered.textContent = mastered.toString();
  statAccuracy.textContent = `${accuracy}%`;
  statStreak.textContent = state.streak.toString();
  lastSession.textContent = state.lastSession
    ? `Last session: ${new Date(state.lastSession).toLocaleString()}`
    : "New session ready!";
};

const showPanel = (panel) => {
  homePanel.classList.remove("panel-active");
  trainingPanel.classList.remove("panel-active");
  panel.classList.add("panel-active");
};

const weightedRandomNote = () => {
  const weights = state.notes.map((note) => 110 - note.memory);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = Math.random() * total;
  for (let i = 0; i < state.notes.length; i += 1) {
    threshold -= weights[i];
    if (threshold <= 0) {
      return state.notes[i];
    }
  }
  return state.notes[state.notes.length - 1];
};

const updateMemoryIndicator = (note) => {
  memoryValue.textContent = Math.round(note.memory).toString();
  if (note.memory < 40) {
    memoryIndicator.style.borderColor = "rgba(255,95,122,0.6)";
    memoryIndicator.style.color = "var(--danger)";
  } else if (note.memory < 70) {
    memoryIndicator.style.borderColor = "rgba(247,208,107,0.6)";
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

const buildChoices = (correctLabel) => {
  const labels = NOTE_DATA.map((note) => note.label);
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

const updateTimer = () => {
  timerBar.style.transition = "none";
  timerBar.style.transform = "scaleX(1)";
  requestAnimationFrame(() => {
    timerBar.style.transition = "transform 3s linear";
    timerBar.style.transform = "scaleX(0)";
  });
};

const stopTimer = () => {
  timerBar.style.transition = "none";
  timerBar.style.transform = "scaleX(0)";
  clearTimeout(timerTimeout);
  clearInterval(timerInterval);
};

const startTimer = () => {
  stopTimer();
  updateTimer();
  timerTimeout = setTimeout(() => {
    handleAnswer(null);
  }, 3000);
};

const updateStatsModal = () => {
  statsList.innerHTML = "";
  state.notes.forEach((note) => {
    const div = document.createElement("div");
    const accuracy = note.attempts
      ? Math.round((note.correct / note.attempts) * 100)
      : 0;
    div.textContent = `${note.label} • ${accuracy}% • Memory ${Math.round(note.memory)}`;
    statsList.appendChild(div);
  });
};

const nextQuestion = () => {
  resetFeedback();
  currentNote = weightedRandomNote();
  renderNote(currentNote);
  updateMemoryIndicator(currentNote);

  if (audioToggle.checked) {
    playNote(currentNote.freq);
  }

  const choices = buildChoices(currentNote.label);
  answerGrid.innerHTML = "";
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.textContent = choice;
    button.addEventListener("click", () => handleAnswer(choice));
    answerGrid.appendChild(button);
  });

  if (reactionToggle.checked) {
    startTimer();
  } else {
    stopTimer();
  }
};

const adjustMemory = (note, correct) => {
  const delta = correct ? 6 : -12;
  note.memory = Math.min(100, Math.max(0, note.memory + delta));
};

const handleAnswer = (choice) => {
  if (!currentNote) return;
  stopTimer();
  state.totalAttempts += 1;
  currentNote.attempts += 1;
  const isCorrect = choice === currentNote.label;

  if (isCorrect) {
    state.totalCorrect += 1;
    state.streak += 1;
    currentNote.correct += 1;
    adjustMemory(currentNote, true);
    setFeedback("Nice! Locked in.", "correct");
    playNote(880);
  } else {
    state.streak = 0;
    adjustMemory(currentNote, false);
    const answerText = choice ? `Correct: ${currentNote.label}` : `Time's up! ${currentNote.label}`;
    setFeedback(answerText, "wrong");
  }

  state.lastSession = new Date().toISOString();
  saveState();
  updateDashboard();
  updateMemoryIndicator(currentNote);

  setTimeout(nextQuestion, 850);
};

const resetProgress = () => {
  state = loadState();
  state.notes = NOTE_DATA.map((note) => ({ ...note, correct: 0, attempts: 0 }));
  state.totalAttempts = 0;
  state.totalCorrect = 0;
  state.streak = 0;
  state.lastSession = null;
  saveState();
  updateDashboard();
  if (trainingPanel.classList.contains("panel-active")) {
    nextQuestion();
  }
};

const init = () => {
  state = loadState();
  updateDashboard();

  startButton.addEventListener("click", () => {
    showPanel(trainingPanel);
    nextQuestion();
  });

  backButton.addEventListener("click", () => {
    showPanel(homePanel);
  });

  reactionToggle.addEventListener("change", () => {
    if (reactionToggle.checked) {
      startTimer();
    } else {
      stopTimer();
    }
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
};

init();
