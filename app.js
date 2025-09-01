// 🔁 Reemplaza con tu URL real de Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbyOJC4aJgnwZFQ2sEex66mgyvD-ef4iF_zfy2Vs404-xNwLh86hp6YICyejrVzQ0-SV1g/exec";

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
let answerHistory = [];
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

  try {
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
  } catch (err) {
    console.error("🚨 [ERROR] No se pudo cargar el estado guardado:", err);
    showError("No se pudo recuperar el estado. Recarga la página.");
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
  console.log("📝 [FORM] Formulario enviado");

  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const pais = document.getElementById("pais").value;
  const nivelAutoevaluado = document.getElementById("nivel-autoevaluado").value;
  const motivo = document.getElementById("motivo").value.trim();
  const referencia = document.getElementById("referencia").value;

  if (!nombre || !email || !pais) {
    alert("Por favor, completa los campos obligatorios: nombre, email y país.");
    return;
  }

  const params = new URLSearchParams({
    action: "saveLead",
    nombre, email, telefono, pais, nivelAutoevaluado, motivo, referencia
  });

  const leadUrl = `${API_URL}?${params}`;
  console.log("📤 [FETCH] Enviando lead a:", leadUrl);

  fetch(leadUrl)
    .then(res => {
      console.log("📥 [RESPONSE] Estado HTTP:", res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      console.log("📦 [DATA] Respuesta del servidor:", data);

      if (data.success === true) {
        userName = nombre;
        userEmail = email;
        formContainer.style.display = "none";
        showInstructions();
        saveState();
      } else {
        console.error("❌ [ERROR] saveLead falló:", data);
        alert("Error al guardar tus datos: " + (data.error || "Inténtalo de nuevo"));
      }
    })
    .catch(err => {
      console.error("🚨 [ERROR] No se pudo guardar el lead:", err);
      alert("Hubo un error de conexión. Por favor, inténtalo de nuevo.\n\nDetalles: " + err.message);
    });
});

// ========================
// 📘 Mostrar instrucciones
// ========================
function showInstructions() {
  console.log("📘 [INSTRUCTIONS] Mostrando página de instrucciones...");
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
    console.log("▶️ [START] Usuario hizo clic en 'Comenzar Test'");
    container.remove();
    testContainer.style.display = "block";
    loadQuestion();
  });
}

// ========================
// ❓ Cargar pregunta
// ========================
function loadQuestion() {
  if (testCompleted) {
    console.log("🛑 [BLOCK] Test finalizado. No se puede cargar más preguntas.");
    return;
  }

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
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      console.log("📦 [DATA] Pregunta recibida:", data);

      if (data.error) {
        console.error("❌ [ERROR] Error de API:", data.error);
        showError(`❌ ${data.error}`);
        submitBtn.disabled = false;
        return;
      }

      // Normalizar claves a minúsculas
      const normalized = {};
      for (const [k, v] of Object.entries(data)) {
        normalized[k.toLowerCase()] = v;
      }

      // Validar datos mínimos
      if (!normalized.id || !normalized.pregunta) {
        console.error("❌ [ERROR] Pregunta incompleta:", normalized);
        showError("❌ Pregunta inválida recibida del servidor.");
        submitBtn.disabled = false;
        return;
      }

      // Evitar preguntas repetidas
      if (answeredQuestions.includes(normalized.id.toLowerCase())) {
        console.log("🔁 [SKIP] Pregunta ya respondida. Cargando otra...");
        loadQuestion();
        return;
      }

      currentQuestion = normalized;
      answeredQuestions.push(normalized.id.toLowerCase()); // Guardar en minúsculas
      displayQuestion(normalized);
      submitBtn.disabled = false;
      saveState();
    })
    .catch(err => {
      console.error("🚨 [ERROR] No se pudo cargar la pregunta:", err);
      showError(`⚠️ No se pudo cargar la pregunta. Detalle: ${err.message}`);
      submitBtn.disabled = false;
    });
}

// ========================
// 🖼️ Mostrar pregunta
// ========================
function displayQuestion(question) {
  const pregunta = question.pregunta || question.Pregunta;
  const tipo = (question.tipo || question.Tipo || "").toLowerCase();

  if (!pregunta) {
    console.error("❌ [ERROR] No se encontró el texto de la pregunta.");
    showError("❌ No se pudo cargar la pregunta.");
    return;
  }

  questionText.textContent = pregunta;
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";

  if (tipo === "mc" || tipo === "comp") {
    try {
      const opciones = JSON.parse(question.opciones || question.Opciones);
      opciones.forEach(opcion => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="radio" name="answer" value="${opcion.trim().toLowerCase()}"> ${opcion}`;
        optionsContainer.appendChild(label);
      });
    } catch (e) {
      console.error("❌ [PARSE] No se pudieron parsear las opciones:", e);
      showError("Opciones no válidas.");
    }
  } else if (["corr", "fill", "order", "match"].includes(tipo)) {
    correctionInput.style.display = "block";
    correctionInput.placeholder = tipo === "corr" ? "Escribe la corrección" :
                                  tipo === "fill" ? "Completa el espacio" :
                                  tipo === "order" ? "Ordena las palabras" :
                                  tipo === "match" ? "Ej: 1-a, 2-b" : "";
  } else {
    console.warn("⚠️ [WARNING] Tipo de pregunta no soportado:", tipo);
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
  userAnswer = radio ? radio.value.trim().toLowerCase() : correctionInput.value.trim().toLowerCase();

  if (!userAnswer) {
    alert("Por favor, escribe o selecciona una respuesta.");
    return;
  }

  console.log("📝 [ANSWER] Respuesta enviada:", userAnswer);
  submitBtn.disabled = true;

  const validateUrl = `${API_URL}?action=validateAnswer&id=${currentQuestion.id}&answer=${encodeURIComponent(userAnswer)}`;
  console.log("🔍 [VALIDATE] Validando en:", validateUrl);

  fetch(validateUrl)
    .then(res => res.json())
    .then(data => {
      console.log("✅ [RESULT] Resultado de validación:", data);

      // ✅ Guardar en historial (normalizado)
      answerHistory.push({
        id: currentQuestion.id.toLowerCase(),
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

      if (!inProgressMode && !data.correct) {
        inProgressMode = true;
        showError("❌ Fallaste. Ahora debes alcanzar el 100% para subir de nivel.");
        saveState();
      }

      updateScoreDisplay();
      saveState();

      if (inProgressMode && currentScore >= 100) {
        const next = nextLevel(currentLevel);
        if (next) {
          alert(`🎉 Subiste al nivel ${next}!`);
          currentLevel = next;
          resetLevel();
        } else {
          alert("🎉 ¡Has alcanzado el nivel C2!");
          endTest();
        }
      } else if (!inProgressMode && data.correct) {
        const next = nextLevel(currentLevel);
        if (next) {
          alert(`🎉 Subiste al nivel ${next}!`);
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
    .catch(err => {
      console.error("🚨 [ERROR] Validación fallida:", err);
      showError(`Error al validar: ${err.message}`);
      submitBtn.disabled = false;
    });
}

// ========================
// 📊 Actualizar puntaje
// ========================
function updateScoreDisplay() {
  const percentage = Math.min(100, Math.round((currentScore / 100) * 100));
  scoreEl.textContent = percentage;
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
    .catch(err => console.error("❌ No se pudo enviar el correo:", err));

  setTimeout(() => {
    alert(`📩 Gracias, ${userName}. Hemos enviado tu nivel a inglestestnivel@gmail.com`);
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
  try {
    localStorage.setItem("englishTestState", JSON.stringify(state));
    console.log("💾 [SAVE] Estado guardado:", state);
  } catch (err) {
    console.error("🚨 [ERROR] No se pudo guardar en localStorage:", err);
  }
}

// ========================
// 🎨 Mostrar mensajes
// ========================
function showError(msg) {
  resultMessage.textContent = msg;
  resultMessage.className = "error";
}

function showSuccess(msg) {
  resultMessage.textContent = msg;
  resultMessage.className = "success";
}
