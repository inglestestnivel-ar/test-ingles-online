// 🔁 Reemplaza con tu URL real de Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycby18vFHB8bUHjBn37i9LlgQJIdtuWKqAerzLJ5ZkFkCmA1vs88XDkxmNlILkogM7u2e-w/exec";

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
  console.log("✅ [INIT] DOM completamente cargado y listo.");
  
  // Cargar estado desde localStorage
  const saved = JSON.parse(localStorage.getItem("englishTestState"));
  if (saved && !saved.testCompleted) {
    console.log("💾 [LOAD] Estado recuperado de localStorage:", saved);
    Object.assign(this, saved);
    if (saved.formSubmitted) {
      formContainer.style.display = "none";
      showInstructions();
    }
  } else {
    console.log("🆕 [STATE] No hay estado guardado. Iniciando desde cero.");
  }
});

// ========================
// 🔒 Detección de acciones sospechosas
// ========================
document.addEventListener("copy", (e) => logSuspicious("Intento de copiar"));
document.addEventListener("cut", (e) => logSuspicious("Intento de cortar"));
document.addEventListener("paste", (e) => logSuspicious("Intento de pegar"));

document.addEventListener("keydown", (e) => {
  if (e.keyCode === 44) logSuspicious("Presionó Print Screen (posible captura)");
  if (e.ctrlKey && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
    logSuspicious(`Atajo: Ctrl + ${e.key}`);
  }
  if (e.metaKey && ['c', 'v'].includes(e.key.toLowerCase())) {
    logSuspicious(`Atajo: Cmd + ${e.key}`);
  }
});

function logSuspicious(action) {
  console.warn("🚨 [SOSPECHOSO] Acción detectada:", action);
  if (!window.suspiciousActions) window.suspiciousActions = [];
  window.suspiciousActions.push({
    action,
    timestamp: new Date().toISOString()
  });
}

// ========================
// 📝 Enviar formulario de contacto
// ========================
leadForm.addEventListener("submit", function(e) {
  e.preventDefault();
  console.log("📝 [FORM] Formulario enviado. Validando datos...");

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

  console.log("📤 [FORM DATA] Datos del formulario:", {
    nombre, email, telefono, pais, nivelAutoevaluado, motivo, referencia
  });

  const params = new URLSearchParams({
    action: "saveLead",
    nombre, email, telefono, pais, nivelAutoevaluado, motivo, referencia
  });

  const leadUrl = `${API_URL}?${params}`;
  console.log("📡 [FETCH] Enviando lead a:", leadUrl);

  fetch(leadUrl)
    .then(res => {
      console.log("📥 [RESPONSE] Estado HTTP:", res.status, res.statusText);
      return res.json();
    })
    .then(data => {
      console.log("📦 [DATA] Respuesta del servidor:", data);
      if (data.success) {
        userName = nombre;
        userEmail = email;
        formContainer.style.display = "none";
        showInstructions();
        saveState();
      } else {
        alert("Error al guardar tus datos: " + (data.error || "Inténtalo de nuevo"));
      }
    })
    .catch(err => {
      console.error("🚨 [ERROR] No se pudo guardar el lead:", err);
      alert("Hubo un error de conexión. Por favor, inténtalo de nuevo.");
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

    <h3>1. Opción múltiple (MC)</h3>
    <p><strong>Ejemplo:</strong> What ___ your name?</p>
    <ul><li>is</li><li>are</li><li>am</li></ul>
    <p><strong>✅ Respuesta correcta: "is"</strong></p>

    <h3>2. Corrección de errores (CORR)</h3>
    <p><strong>Ejemplo:</strong> Corrige: "She go to school."</p>
    <p><strong>⌨️ Tu respuesta:</strong> goes</p>

    <h3>3. Comprensión lectora (COMP)</h3>
    <p><strong>Ejemplo:</strong> "Tom likes apples." ¿Qué le gusta a Tom?</p>
    <ul><li>apples</li><li>bananas</li><li>oranges</li></ul>
    <p><strong>✅ Respuesta correcta: "apples"</strong></p>

    <h3>4. Completar espacios (FILL)</h3>
    <p><strong>Ejemplo:</strong> Completa: "I ___ (be) at home yesterday."</p>
    <p><strong>⌨️ Tu respuesta:</strong> was</p>

    <h3>5. Ordenar palabras (ORDER)</h3>
    <p><strong>Ejemplo:</strong> Ordena: "to / she / wants / go / home"</p>
    <p><strong>⌨️ Tu respuesta:</strong> She wants to go home</p>

    <h3>6. Emparejamiento (MATCH)</h3>
    <p><strong>Ejemplo:</strong> 1. How are you? a. I'm fine → <strong>1-a</strong></p>

    <h2>⚠️ Reglas importantes</h2>
    <ul>
      <li>✅ No copies ni pegues</li>
      <li>✅ No abras otras pestañas</li>
      <li>✅ No uses traductores</li>
      <li>✅ Responde solo tú</li>
      <li>❌ Si detectamos trampas, el test se detendrá</li>
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

  console.log("🔍 [LOAD] Intentando cargar pregunta desde:", url);

  questionText.textContent = "Cargando pregunta...";
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";
  correctionInput.value = "";
  resultMessage.textContent = "";
  resultMessage.className = "";
  submitBtn.disabled = true;

  fetch(url)
    .then(res => {
      console.log("📥 [RESPONSE] Recibido estado HTTP:", res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      console.log("📦 [DATA] Datos recibidos del servidor:", data);

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

      console.log("🔄 [NORMALIZE] Pregunta normalizada:", normalized);

      // Evitar preguntas repetidas
      if (answeredQuestions.includes(normalized.id)) {
        console.log("🔁 [SKIP] Pregunta ya respondida. Cargando otra...");
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

  console.log("🎨 [DISPLAY] Mostrando pregunta:", pregunta);
  console.log("🔤 [TYPE] Tipo de pregunta:", tipo);

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
      const optionsList = JSON.parse(question.opciones || question.Opciones);
      console.log("📋 [OPTIONS] Opciones parseadas:", optionsList);
      optionsList.forEach(option => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="radio" name="answer" value="${option}"> ${option}`;
        optionsContainer.appendChild(label);
      });
    } catch (e) {
      console.error("❌ [PARSE] No se pudieron parsear las opciones:", e);
      showError("Opciones no válidas.");
    }
  } else if (tipo === "corr" || tipo === "fill" || tipo === "order" || tipo === "match") {
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
  const radioSelected = document.querySelector('input[name="answer"]:checked');
  userAnswer = radioSelected ? radioSelected.value : correctionInput.value.trim();

  console.log("📝 [ANSWER] Respuesta enviada:", userAnswer);

  if (!userAnswer) {
    alert("Por favor, escribe o selecciona una respuesta.");
    return;
  }

  submitBtn.disabled = true;

  const validateUrl = `${API_URL}?action=validateAnswer&id=${currentQuestion.id}&answer=${encodeURIComponent(userAnswer)}`;
  console.log("🔍 [VALIDATE] Validando en:", validateUrl);

  fetch(validateUrl)
    .then(res => res.json())
    .then(data => {
      console.log("✅ [RESULT] Resultado de validación:", data);

      if (data.correct) {
        showSuccess(`✅ ¡Correcto! +${data.points} puntos`);
        currentScore += data.points;
      } else {
        showError(`❌ Incorrecto.`);
        errorCount++;

        if (errorCount >= 4) {
          console.log("🛑 [FAIL] 4 errores alcanzados. Finalizando test.");
          endTestWithFailure();
          return;
        }
      }

      updateScoreDisplay();
      saveState();

      if (inProgressMode && currentScore >= 100) {
        const next = nextLevel(currentLevel);
        if (next) {
          alert(`🎉 ¡Felicidades! Subiste al nivel ${next}.`);
          currentLevel = next;
          resetLevel();
        } else {
          alert("🎉 ¡Has alcanzado el nivel C2! Test completado.");
          endTest();
        }
      } else if (!inProgressMode && data.correct) {
        const next = nextLevel(currentLevel);
        if (next) {
          alert(`🎉 ¡Subiste al nivel ${next}!`);
          currentLevel = next;
          resetLevel();
        } else {
          alert("🎉 ¡Perfecto! Has alcanzado el nivel C2.");
          endTest();
        }
      } else {
        setTimeout(() => {
          loadQuestion().catch(err => {
            console.error("🚨 [ERROR] No se pudo cargar la siguiente pregunta:", err);
            showError("No se pudo cargar la siguiente pregunta.");
            submitBtn.disabled = false;
          });
        }, 1500);
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
  const percentage = Math.min(100, Math.round((currentScore / totalPointsNeeded) * 100));
  scoreEl.textContent = percentage;
  currentLevelEl.textContent = currentLevel;
}

// ========================
// ➕ Subir de nivel
// ========================
function resetLevel() {
  console.log("🔄 [RESET] Reiniciando nivel:", currentLevel);
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
  console.log("🏁 [END] Test finalizado. Nivel alcanzado:", currentLevel);

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

  const resultsUrl = `${API_URL}?${params}`;
  console.log("📤 [SEND] Enviando resultados a:", resultsUrl);

  fetch(resultsUrl)
    .then(res => res.json())
    .then(data => {
      console.log("✅ [EMAIL] Resultados enviados:", data);
      setTimeout(() => {
        alert(`📩 Gracias, ${userName}. Hemos enviado tu nivel (${currentLevel}) a ininglestestnivel@gmail.com`);
      }, 1000);
    })
    .catch(err => {
      console.error("🚨 [ERROR] No se pudo enviar el correo:", err);
      setTimeout(() => {
        alert(`Gracias, ${userName}. Tu nivel es ${currentLevel}. Podrías recibir información pronto.`);
      }, 1000);
    });
}

function endTestWithFailure() {
  testCompleted = true;
  saveState();
  document.getElementById("question-container").style.display = "none";
  showError("❌ Has cometido 4 errores. Test finalizado.");
  console.log("🛑 [FAIL] Test finalizado por 4 errores.");
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
    formSubmitted: !!userName
  };
  localStorage.setItem("englishTestState", JSON.stringify(state));
  console.log("💾 [SAVE] Estado guardado:", state);
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
