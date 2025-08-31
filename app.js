const API_URL = "https://script.google.com/macros/s/AKfycby18vFHB8bUHjBn37i9LlgQJIdtuWKqAerzLJ5ZkFkCmA1vs88XDkxmNlILkogM7u2e-w/exec";

// Estado
let currentLevel = "A1";
let currentScore = 0;
let totalPointsNeeded = 100;
let inProgressMode = false;
let currentQuestion = null;
let userEmail = "";
let userName = "";
let errorCount = 0;
let answeredQuestions = [];
let testCompleted = false;
window.suspiciousActions = [];

// Elementos
const formContainer = document.getElementById("form-container");
const testContainer = document.getElementById("test-container");
const leadForm = document.getElementById("lead-form");
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const correctionInput = document.getElementById("correction-input");
const submitBtn = document.getElementById("submit-btn");
const resultMessage = document.getElementById("result-message");
const currentLevelEl = document.getElementById("current-level");
const scoreEl = document.getElementById("score");

// Cargar estado al iniciar
document.addEventListener("DOMContentLoaded", () => {
  const saved = JSON.parse(localStorage.getItem("englishTestState"));
  if (saved && !saved.testCompleted) {
    Object.assign(this, saved);
    if (saved.formSubmitted) {
      formContainer.style.display = "none";
      testContainer.style.display = "block";
      updateScoreDisplay();
      loadQuestion();
    }
  }
});

// Bloquear acciones sospechosas
document.addEventListener("copy", () => logSuspicious("Copiar"));
document.addEventListener("cut", () => logSuspicious("Cortar"));
document.addEventListener("paste", () => logSuspicious("Pegar"));
document.addEventListener("keydown", e => {
  if (e.keyCode === 44) logSuspicious("Print Screen");
  if (e.ctrlKey && ['c', 'v', 'x'].includes(e.key)) logSuspicious(`Ctrl + ${e.key}`);
  if (e.metaKey && ['c', 'v'].includes(e.key)) logSuspicious(`Cmd + ${e.key}`);
});

function logSuspicious(action) {
  console.warn("🚨", action);
  window.suspiciousActions.push({ action, time: new Date().toISOString() });
}

// Enviar formulario
leadForm.addEventListener("submit", function(e) {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const pais = document.getElementById("pais").value;
  const nivelAutoevaluado = document.getElementById("nivel-autoevaluado").value;
  const motivo = document.getElementById("motivo").value.trim();
  const referencia = document.getElementById("referencia").value;

  if (!nombre || !email || !pais) {
    alert("Completa nombre, email y país.");
    return;
  }

  const params = new URLSearchParams({
    action: "saveLead",
    nombre, email, telefono, pais, nivelAutoevaluado, motivo, referencia
  });

  fetch(`${API_URL}?${params}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        userName = nombre;
        userEmail = email;
        formContainer.style.display = "none";
        testContainer.style.display = "block";
        saveState();
        loadQuestion();
      } else {
        alert("Error al guardar datos.");
      }
    })
    .catch(() => alert("Error de conexión."));
});

// Cargar pregunta
function loadQuestion() {
  if (testCompleted) return;

  const url = inProgressMode
    ? `${API_URL}?action=getNextQuestion&level=${currentLevel}`
    : `${API_URL}?action=getInitialQuestion&level=${currentLevel}`;

  questionText.textContent = "Cargando...";
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";
  submitBtn.disabled = true;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.error) return showError(data.error);

      const normalized = {};
      for (const [k, v] of Object.entries(data)) {
        normalized[k.toLowerCase()] = v;
      }

      if (answeredQuestions.includes(normalized.id)) return loadQuestion();

      currentQuestion = normalized;
      answeredQuestions.push(normalized.id);
      displayQuestion(normalized);
      submitBtn.disabled = false;
      saveState();
    })
    .catch(() => showError("Error al cargar pregunta."));
}

function displayQuestion(question) {
  questionText.textContent = question.pregunta;
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";

  if (["mc", "comp"].includes(question.tipo?.toLowerCase())) {
    try {
      const opts = JSON.parse(question.opciones);
      opts.forEach(opt => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="radio" name="answer" value="${opt}"> ${opt}`;
        optionsContainer.appendChild(label);
      });
    } catch (e) {
      showError("Opciones no válidas.");
    }
  } else if (question.tipo?.toLowerCase() === "corr") {
    correctionInput.style.display = "block";
  }
}

submitBtn.addEventListener("click", submitAnswer);

function submitAnswer() {
  if (testCompleted) return;

  let userAnswer = "";
  const radio = document.querySelector('input[name="answer"]:checked');
  userAnswer = radio ? radio.value : correctionInput.value.trim();

  if (!userAnswer) {
    alert("Responde la pregunta.");
    return;
  }

  submitBtn.disabled = true;
  const url = `${API_URL}?action=validateAnswer&id=${currentQuestion.id}&answer=${encodeURIComponent(userAnswer)}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.correct) {
        showSuccess(`✅ +${data.points} puntos`);
        currentScore += data.points;
      } else {
        showError("❌ Incorrecto.");
        errorCount++;
        
        if (errorCount >= 4) {
          endTestWithFailure();
          return;
        }
      }

      updateScoreDisplay();
      saveState();

      if (inProgressMode && currentScore >= 100) {
        const next = nextLevel(currentLevel);
        if (next) {
          alert(`🎉 Subiste a ${next}!`);
          currentLevel = next;
          resetLevel();
        } else {
          endTest();
        }
      } else if (!inProgressMode && data.correct) {
        const next = nextLevel(currentLevel);
        if (next) {
          alert(`🎉 Subiste a ${next}!`);
          currentLevel = next;
          resetLevel();
        } else {
          endTest();
        }
      } else {
        setTimeout(loadQuestion, 1500);
      }
    })
    .catch(() => {
      showError("Error al validar.");
      submitBtn.disabled = false;
    });
}

function updateScoreDisplay() {
  scoreEl.textContent = Math.min(100, Math.round((currentScore / 100) * 100));
  currentLevelEl.textContent = currentLevel;
}

function resetLevel() {
  currentScore = 0;
  inProgressMode = false;
  updateScoreDisplay();
  saveState();
  loadQuestion();
}

function nextLevel(level) {
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const i = levels.indexOf(level);
  return i < levels.length - 1 ? levels[i + 1] : null;
}

function endTest() {
  if (testCompleted) return;
  testCompleted = true;
  saveState();

  document.getElementById("question-container").style.display = "none";
  showSuccess(`🎉 ¡Felicidades! Tu nivel es: <strong>${currentLevel}</strong>`);

  const params = new URLSearchParams({
    action: "sendResults",
    nombre: userName,
    email: userEmail,
    nivelFinal: currentLevel,
    puntajeFinal: currentScore,
    errores: errorCount,
    sospechosos: window.suspiciousActions.length
  });

  fetch(`${API_URL}?${params}`).catch(console.error);
  setTimeout(() => alert(`Gracias, ${userName}. Hemos enviado tu nivel a ininglestestnivel@gmail.com`), 1000);
}

function endTestWithFailure() {
  testCompleted = true;
  saveState();
  document.getElementById("question-container").style.display = "none";
  showError("❌ Has cometido 4 errores. Test finalizado.");
}

function saveState() {
  localStorage.setItem("englishTestState", JSON.stringify({
    currentLevel, currentScore, inProgressMode, errorCount,
    answeredQuestions, testCompleted, userName, userEmail, formSubmitted: !!userName
  }));
}

function showError(msg) {
  resultMessage.textContent = msg;
  resultMessage.className = "error";
}

function showSuccess(msg) {
  resultMessage.textContent = msg;
  resultMessage.className = "success";
}
