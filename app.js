const API_URL = "https://script.google.com/macros/s/AKfycbwnvnvTNX8ISUd7Mk1SOr7_hE106d_69ze941S16xSOs7AMZIrrhs7fnHYn6_FZdWS8-A/exec";

let currentLevel = "A1";
let currentScore = 0;
let inProgressMode = false;
let currentQuestion = null;
let userEmail = "";
let userName = "";
let errorCount = 0;
let answeredQuestions = [];
let testCompleted = false;
let answerHistory = [];
window.suspiciousActions = [];

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
const progressBar = document.getElementById("progress-bar");

// ========================
// 🚀 Inicialización
// ========================
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ [INIT] DOM cargado. Iniciando test...");
  try {
    const saved = JSON.parse(localStorage.getItem("englishTestState"));
    if (saved && !testCompleted) {
      console.log("💾 [LOAD] Estado recuperado:", saved);
      Object.assign(window, saved);
      answerHistory = saved.answerHistory || [];
      if (saved.userName) {
        formContainer.style.display = "none";
        if (!testCompleted) testContainer.style.display = "block";
        updateScoreDisplay();
        updateProgressBar();
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
  if (e.ctrlKey && ['c', 'v', 'x'].includes(e.key.toLowerCase())) logSuspicious(`Ctrl + ${e.key}`);
  if (e.metaKey && ['c', 'v'].includes(e.key.toLowerCase())) logSuspicious(`Cmd + ${e.key}`);
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
    nombre, email, telefono, pais, nivelAutoevaluado, motivo, referencia,
    primerNivelAlcanzado: currentLevel,
    fechaTest: new Date().toLocaleDateString()
  });

  const leadUrl = `${API_URL}?${params}`;
  console.log("📤 [FETCH] Enviando lead a:", leadUrl);

  fetch(leadUrl)
    .then(res => res.json())
    .then(data => {
      console.log("📦 [DATA] Respuesta del servidor:", data);
      if (data.success === true || data.success === "true" || data.message?.includes("guardado")) {
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
  if (document.getElementById("instructions-container")) return;
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
    startTimer();
    loadQuestion();
  });
}

// ========================
// ⏱️ Temporizador
// ========================
let timer;
let timeLeft = 600; // 10 minutos

function startTimer() {
  const timerEl = document.createElement("div");
  timerEl.id = "timer";
  timerEl.style.cssText = "font-size: 1.2em; color: #d9534f; margin: 10px 0; font-weight: bold;";
  document.getElementById("level-info").after(timerEl);

  timer = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.textContent = `⏱️ Tiempo restante: ${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;

    if (timeLeft <= 0) {
      clearInterval(timer);
      endTestWithTimeout();
    }
    timeLeft--;
  }, 1000);
}

function endTestWithTimeout() {
  testCompleted = true;
  document.getElementById("question-container").style.display = "none";
  showError("⏰ El tiempo ha terminado. Test finalizado.");
  endTest();
}

// ========================
// ❓ Cargar pregunta
// ========================
function loadQuestion() {
  if (testCompleted) return;

  const url = `${API_URL}?action=getInitialQuestion&level=${currentLevel}&usedIds=${encodeURIComponent(JSON.stringify(answeredQuestions))}`;
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
      console.log("📦 [DATA] Pregunta recibida:", data);
      if (data.error) {
        showError(`Error: ${data.error}`);
        return;
      }

      const id = (data.ID || data.id || "").trim().toUpperCase();
      if (!id || !data.Pregunta) {
        showError("Pregunta inválida recibida.");
        return;
      }

      if (answeredQuestions.includes(id)) {
        console.log("🔁 Pregunta repetida. Cargando otra...");
        setTimeout(loadQuestion, 100);
        return;
      }

      currentQuestion = { ...data, ID: id };
      answeredQuestions.push(id);
      displayQuestion(data);
      showAssistantForQuestion(data);
      submitBtn.disabled = false;
      saveState();
      updateProgressBar();
    })
    .catch(err => {
      console.error("🚨 [FETCH ERROR] No se pudo cargar la pregunta:", err);
      showError(`No se pudo cargar la pregunta: ${err.message}`);
      submitBtn.disabled = false;
    });
}

// ========================
// 🖼️ Mostrar pregunta
// ========================
function displayQuestion(question) {
  const pregunta = question.Pregunta || question.pregunta;
  const tipo = (question.Tipo || question.tipo || "").toLowerCase();

  if (!pregunta) {
    showError("Pregunta no válida.");
    return;
  }

  questionText.textContent = pregunta;
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";

  if (tipo === "mc" || tipo === "comp") {
    const opciones = Array.isArray(question.Opciones)
      ? question.Opciones
      : (typeof question.Opciones === 'string')
        ? question.Opciones.replace(/[\[\]"]/g, '').split(',').map(o => o.trim())
        : [];

    opciones.forEach(opcion => {
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio" name="answer" value="${opcion.trim().toLowerCase()}"> ${opcion}`;
      optionsContainer.appendChild(label);
    });
  } else if (["corr", "fill", "order", "match"].includes(tipo)) {
    correctionInput.style.display = "block";
    correctionInput.placeholder = {
      corr: "Escribe la corrección",
      fill: "Completa el espacio",
      order: "Ordena las palabras",
      match: "Ej: 1-a, 2-b"
    }[tipo];
  }
}

// ========================
// 🧠 Asistente Inteligente
// ========================
function showAssistant(message) {
  let assistant = document.getElementById("assistant");
  if (!assistant) {
    assistant = document.createElement("div");
    assistant.id = "assistant";
    assistant.style.cssText = `
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
      font-size: 0.95em;
      color: #495057;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    document.getElementById("test-container").insertBefore(assistant, document.getElementById("question-container"));
  }
  assistant.innerHTML = `<strong>🧠 Ayuda:</strong> ${message}`;
}

function showAssistantForQuestion(question) {
  const tipo = (question.Tipo || "").toLowerCase();
  const tema = question.Tema || "";

  if (tipo === "corr") {
    showAssistant("Corrige solo la parte incorrecta. Ej: 'She go' → 'goes'");
  } else if (tipo === "fill") {
    showAssistant(`Completa con la forma correcta del verbo. Tema: ${tema}`);
  } else if (tipo === "order") {
    showAssistant("Ordena las palabras para formar una oración gramatical.");
  } else if (tipo === "mc") {
    showAssistant("Elige la opción más natural en inglés.");
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

  const validateUrl = `${API_URL}?action=validateAnswer&id=${currentQuestion.ID}&answer=${encodeURIComponent(userAnswer)}`;
  console.log("🔍 [VALIDATE] Validando en:", validateUrl);

  fetch(validateUrl)
    .then(res => res.json())
    .then(data => {
      console.log("✅ [RESULT] Validación:", data);
      if (data.error) {
        showError(`Error: ${data.error}`);
        submitBtn.disabled = false;
        return;
      }

      const correcta = data.correct === true;
      const puntos = correcta ? (data.points || 10) : 0;

      answerHistory.push({
        id: currentQuestion.ID,
        pregunta: currentQuestion.Pregunta,
        tipo: currentQuestion.Tipo,
        respuestaUsuario: userAnswer,
        respuestaCorrecta: correcta ? currentQuestion.RespuestaCorrecta : null,
        correcta,
        nivel: currentLevel,
        puntaje: puntos,
        timestamp: new Date().toISOString()
      });

      if (correcta) {
        showSuccess(`✅ ¡Correcto! +${puntos} puntos`);
        currentScore += puntos;
      } else {
        showError(`❌ Incorrecto. La respuesta correcta era: <strong>${data.correctAnswer}</strong>`, 3000);
        errorCount++;
        if (errorCount >= 4) return endTestWithFailure();
      }

      updateScoreDisplay();
      saveState();

      if (currentScore >= 100) {
        const next = nextLevel(currentLevel);
        if (next) {
          alert(`🎉 Subiste al nivel ${next}!`);
          currentLevel = next;
          resetLevel();
        } else {
          alert("🎉 ¡Has alcanzado el nivel C2!");
          endTest();
        }
      } else {
        setTimeout(loadQuestion, 2000);
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

function updateProgressBar() {
  const total = Math.min(50, answeredQuestions.length);
  progressBar.style.width = `${(total / 50) * 100}%`;
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

  setTimeout(() => {
    generateCertificate();
    document.getElementById("result-message").innerHTML = `
      <div style="background:#d1ecf1; padding:15px; border-radius:8px; margin-top:20px;">
        <strong>📩 Tu test ha sido enviado para análisis.</strong><br>
        Nos pondremos en contacto contigo a la brevedad para brindarte retroalimentación personalizada.
      </div>
    `;
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
    currentLevel, currentScore, inProgressMode, errorCount, answeredQuestions,
    testCompleted, userName, userEmail, answerHistory, formSubmitted: !!userName
  };
  try {
    localStorage.setItem("englishTestState", JSON.stringify(state));
    console.log("💾 [SAVE] Estado guardado");
  } catch (err) {
    console.error("🚨 [ERROR] No se pudo guardar en localStorage:", err);
  }
}

// ========================
// 🎨 Mostrar mensajes
// ========================
function showError(msg, duration = 2000) {
  resultMessage.innerHTML = msg;
  resultMessage.className = "error";
  setTimeout(() => {
    resultMessage.textContent = "";
    resultMessage.className = "";
  }, duration);
}

function showSuccess(msg, duration = 2000) {
  resultMessage.innerHTML = msg;
  resultMessage.className = "success";
  setTimeout(() => {
    resultMessage.textContent = "";
    resultMessage.className = "";
  }, duration);
}

// ========================
// 📄 Generar constancia PDF
// ========================
function generateCertificate() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.text("Constancia de Nivel de Inglés", 20, 30);

  doc.setFontSize(16);
  doc.text(`Nombre: ${userName}`, 20, 50);
  doc.text(`Nivel alcanzado: ${currentLevel}`, 20, 70);
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 90);

  doc.setFontSize(14);
  doc.text("¡Felicitaciones por completar el test!", 20, 120);
  doc.text("Este documento acredita tu nivel de inglés evaluado.", 20, 140);

  doc.save(`${userName}_constancia.pdf`);
}
