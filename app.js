// 🔁 Reemplaza con tu URL real de Google Apps Script
const API_URL = https://script.google.com/macros/s/AKfycbzB3uUAFkxL38ib2u53-e8HeMr7FqYEJ_x0hKrOmanvBy7uAPhWsWU65GlIHDMiJSGydQ/exec";

// Estado del test
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
let answerHistory = []; // Para guardar el historial
window.suspiciousActions = [];

// Elementos del DOM
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

// ========================
// 🚀 Inicialización
// ========================
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ [INIT] DOM cargado. Iniciando test...");

  const saved = JSON.parse(localStorage.getItem("englishTestState"));
  if (saved && !saved.testCompleted) {
    console.log("💾 [LOAD] Estado recuperado:", saved);
    Object.assign(this, saved);
    answerHistory = saved.answerHistory || [];
    if (saved.formSubmitted) {
      formContainer.style.display = "none";
      showInstructions();
    }
  }
});

// ========================
// 🔒 Detección de acciones sospechosas
// ========================
document.addEventListener("copy", () => logSuspicious("Intento de copiar"));
document.addEventListener("cut", () => logSuspicious("Intento de cortar"));
document.addEventListener("paste", () => logSuspicious("Intento de pegar"));

document.addEventListener("keydown", e => {
  if (e.keyCode === 44) logSuspicious("Presionó Print Screen");
  if (e.ctrlKey && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
    logSuspicious(`Ctrl + ${e.key}`);
  }
  if (e.metaKey && ['c', 'v'].includes(e.key.toLowerCase())) {
    logSuspicious(`Cmd + ${e.key}`);
  }
});

function logSuspicious(action) {
  console.warn("🚨 [SOSPECHOSO]", action);
  if (!window.suspiciousActions) window.suspiciousActions = [];
  window.suspiciousActions.push({ action, time: new Date().toISOString() });
}

// ========================
// 📝 Enviar formulario de contacto
// ========================
leadForm.addEventListener("submit", function(e) {
  e.preventDefault();
  console.log("📝 [FORM] Enviando datos...");

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
    action: "saveLead", nombre, email, telefono, pais, nivelAutoevaluado, motivo, referencia
  });

  fetch(`${API_URL}?${params}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        userName = nombre;
        userEmail = email;
        formContainer.style.display = "none";
        showInstructions();
        saveState();
      } else {
        alert("Error al guardar tus datos.");
      }
    })
    .catch(() => alert("Error de conexión."));
});

// ========================
// 📘 Mostrar instrucciones
// ========================
function showInstructions() {
  const container = document.createElement("div");
  container.id = "instructions-container";
  container.innerHTML = `
    <h1>📘 Bienvenido, ${userName}</h1>
    <p>Este test evaluará tu nivel de inglés (A1 a C2) con diferentes tipos de ejercicios. No hay límite de tiempo. Responde con honestidad para obtener un resultado preciso.</p>

    <h2>🧩 Tipos de preguntas que encontrarás</h2>
    <p>Verás preguntas de opción múltiple, corrección de errores, comprensión lectora, completar espacios y ordenar palabras.</p>

    <h2>⚠️ Reglas importantes</h2>
    <ul>
      <li>✅ No copies ni pegues</li>
      <li>✅ No abras otras pestañas</li>
      <li>✅ No uses traductores</li>
      <li>✅ Responde solo tú</li>
    </ul>

    <button id="start-test-btn" class="btn-submit">Comenzar Test</button>
  `;
  document.body.appendChild(container);

  document.getElementById("start-test-btn").addEventListener("click", () => {
    container.remove();
    testContainer.style.display = "block";
    loadQuestion();
  });
}

// ========================
// ❓ Cargar pregunta
// ========================
function loadQuestion() {
  if (testCompleted) return;

  const url = inProgressMode
    ? `${API_URL}?action=getNextQuestion&level=${currentLevel}`
    : `${API_URL}?action=getInitialQuestion&level=${currentLevel}`;

  console.log("🔍 [LOAD] Cargando pregunta desde:", url);

  questionText.textContent = "Cargando pregunta...";
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";
  correctionInput.value = "";
  resultMessage.textContent = "";
  resultMessage.className = "";
  submitBtn.disabled = true;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showError(`❌ ${data.error}`);
        submitBtn.disabled = false;
        return;
      }

      const normalized = {};
      for (const [k, v] of Object.entries(data)) {
        normalized[k.toLowerCase()] = v;
      }

      if (answeredQuestions.includes(normalized.id)) {
        loadQuestion();
        return;
      }

      currentQuestion = normalized;
      answeredQuestions.push(normalized.id);
      displayQuestion(normalized);
      submitBtn.disabled = false;
      saveState();
    })
    .catch(err => {
      showError(`⚠️ Error: ${err.message}`);
      console.error(err);
      submitBtn.disabled = false;
    });
}

function displayQuestion(question) {
  const pregunta = question.pregunta || question.Pregunta;
  const tipo = (question.tipo || question.Tipo || "").toLowerCase();

  if (!pregunta) {
    showError("❌ No se encontró la pregunta.");
    return;
  }

  questionText.textContent = pregunta;
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";

  if (tipo === "mc" || tipo === "comp") {
    try {
      const opts = JSON.parse(question.opciones || question.Opciones);
      opts.forEach(opt => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="radio" name="answer" value="${opt}"> ${opt}`;
        optionsContainer.appendChild(label);
      });
    } catch (e) {
      showError("Opciones no válidas.");
    }
  } else if (["corr", "fill", "order", "match"].includes(tipo)) {
    correctionInput.style.display = "block";
  }
}

// ========================
// ✅ Enviar respuesta
// ========================
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

  const validateUrl = `${API_URL}?action=validateAnswer&id=${currentQuestion.id}&answer=${encodeURIComponent(userAnswer)}`;

  fetch(validateUrl)
    .then(res => res.json())
    .then(data => {
      // ✅ Guardar en historial
      answerHistory.push({
        id: currentQuestion.id,
        pregunta: currentQuestion.pregunta,
        tipo: currentQuestion.tipo,
        respuestaUsuario: userAnswer,
        respuestaCorrecta: data.correct ? currentQuestion.respuestacorrecta : null,
        correcta: data.correct,
        nivel: currentLevel,
        puntaje: data.points,
        timestamp: new Date().toISOString()
      });

      if (data.correct) {
        showSuccess(`✅ ¡Correcto! +${data.points} puntos`);
        currentScore += data.points;
      } else {
        showError(`❌ Incorrecto.`);
        errorCount++;

        if (errorCount >= 4) {
          endTestWithFailure();
          return;
        }
      }

      // Activar modo acumulativo si falla la primera
      if (!inProgressMode && !data.correct) {
        inProgressMode = true;
        showError("❌ Fallaste. Ahora debes alcanzar el 100% para subir de nivel.");
        saveState(); // 🔴 ¡Clave!
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
          alert("🎉 ¡Has alcanzado el nivel C2!");
          endTest();
        }
      } else if (!inProgressMode && data.correct) {
        const next = nextLevel(currentLevel);
        if (next) {
          alert(`🎉 Subiste a ${next}!`);
          currentLevel = next;
          resetLevel();
        } else {
          alert("🎉 ¡Perfecto! Has alcanzado el nivel C2.");
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

// ========================
// 📊 Actualizar puntaje
// ========================
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

// ========================
// 🏁 Finalizar test
// ========================
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
    sospechosos: window.suspiciousActions.length,
    answerHistory: JSON.stringify(answerHistory)
  });

  fetch(`${API_URL}?${params}`)
    .then(res => res.json())
    .then(data => console.log("📩 Resultados enviados:", data))
    .catch(err => console.error("❌ Error al enviar:", err));

  setTimeout(() => {
    alert(`📩 Gracias, ${userName}. Hemos enviado tu nivel a ininglestestnivel@gmail.com`);
  }, 1000);
}

function endTestWithFailure() {
  testCompleted = true;
  saveState();
  document.getElementById("question-container").style.display = "none";
  showError("❌ Has cometido 4 errores. Test finalizado.");
}

// ========================
// 💾 Guardar estado
// ========================
function saveState() {
  const state = {
    currentLevel,
    currentScore,
    inProgressMode,
    errorCount,
    answeredQuestions,
    testCompleted,
    userName,
    userEmail,
    answerHistory,
    formSubmitted: !!userName
  };
  localStorage.setItem("englishTestState", JSON.stringify(state));
}

function showError(msg) {
  resultMessage.textContent = msg;
  resultMessage.className = "error";
}

function showSuccess(msg) {
  resultMessage.textContent = msg;
  resultMessage.className = "success";
}
