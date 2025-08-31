// 🔁 Reemplaza con tu URL real de Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzAtwATYi-Uzxh4wDXpx723-Oom248RQqMbV_AdAnePXEtlKj9LThYsWOXLHPMTiVtFWw/exec";

// Estado del test
let currentLevel = "A1";
let currentScore = 0;
let totalPointsNeeded = 100;
let inProgressMode = false;
let currentQuestion = null;

// Elementos del DOM
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const correctionInput = document.getElementById("correction-input");
const submitBtn = document.getElementById("submit-btn");
const resultMessage = document.getElementById("result-message");
const currentLevelEl = document.getElementById("current-level");
const scoreEl = document.getElementById("score");

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM cargado. Iniciando test...");
  submitBtn.disabled = false;
  loadQuestion();
});

/**
 * Carga una pregunta del nivel actual
 */
function loadQuestion() {
  const url = inProgressMode
    ? `${API_URL}?action=getNextQuestion&level=${currentLevel}&score=${currentScore}`
    : `${API_URL}?action=getInitialQuestion&level=${currentLevel}`;

  // 🔍 Debug: Mostrar la URL que se está llamando
  console.log("🔍 [DEBUG] Llamando a la API:", url);

  // Mostrar estado de carga
  questionText.textContent = "Cargando pregunta...";
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";
  correctionInput.value = "";
  resultMessage.textContent = "";
  resultMessage.className = "";
  submitBtn.disabled = true;

  fetch(url)
    .then(response => {
      // 🔍 Debug: Verificar si la respuesta fue exitosa
      console.log("📥 [DEBUG] Respuesta recibida:", response.status, response.statusText);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      // 🔍 Debug: Mostrar los datos recibidos
      console.log("📦 [DEBUG] Datos recibidos de la API:", data);

      if (data.error) {
        showError(`❌ Error de API: ${data.error}`);
        return;
      }

      // Normalizar claves del objeto a minúsculas
      const normalizedData = {};
      for (const [key, value] of Object.entries(data)) {
        normalizedData[key.toLowerCase()] = value;
      }

      currentQuestion = normalizedData;
      displayQuestion(normalizedData);
      submitBtn.disabled = false;
    })
    .catch(err => {
      // ❌ Debug: Mostrar cualquier error
      console.error("🚨 [ERROR] Error al cargar la pregunta:", err);
      showError(`⚠️ No se pudo cargar la pregunta. Detalle: ${err.message}`);
      submitBtn.disabled = false;
    });
}

/**
 * Muestra la pregunta según su tipo
 */
function displayQuestion(question) {
  // Buscar claves normalizadas
  const pregunta = question.pregunta || question.pregunta;
  const tipo = (question.tipo || question.tipo || "").toLowerCase();
  const opciones = question.opciones || question.opciones;

  console.log("🎨 [DEBUG] Mostrando pregunta:", pregunta);
  console.log("🔘 [DEBUG] Tipo:", tipo);

  if (!pregunta) {
    showError("❌ No se encontró el texto de la pregunta.");
    return;
  }

  questionText.textContent = pregunta;
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";
  correctionInput.value = "";
  resultMessage.textContent = "";
  resultMessage.className = "";

  if (tipo === "mc" || tipo === "comp") {
    try {
      const optionsList = JSON.parse(opciones);
      console.log("📋 [DEBUG] Opciones parseadas:", optionsList);

      optionsList.forEach(option => {
        const label = document.createElement("label");
        label.innerHTML = `
          <input type="radio" name="answer" value="${option}">
          ${option}
        `;
        optionsContainer.appendChild(label);
      });
    } catch (e) {
      console.error("❌ [ERROR] No se pudieron parsear las opciones:", e);
      showError("Opciones no válidas.");
    }
  } else if (tipo === "corr") {
    console.log("✏️ [DEBUG] Tipo: Corrección de texto");
    correctionInput.style.display = "block";
  } else {
    console.warn("⚠️ [WARNING] Tipo de pregunta desconocido:", tipo);
    showError("Tipo de pregunta no soportado.");
  }
}

/**
 * Envía la respuesta del usuario
 */
function submitAnswer() {
  let userAnswer = "";

  const radioSelected = document.querySelector('input[name="answer"]:checked');
  if (radioSelected) {
    userAnswer = radioSelected.value;
    console.log("📝 [DEBUG] Respuesta seleccionada (MC):", userAnswer);
  } else {
    userAnswer = correctionInput.value.trim();
    console.log("📝 [DEBUG] Respuesta escrita (CORR):", userAnswer);
  }

  if (!userAnswer) {
    alert("Por favor, escribe o selecciona una respuesta.");
    return;
  }

  submitBtn.disabled = true;

  const validateUrl = `${API_URL}?action=validateAnswer&id=${currentQuestion.id || currentQuestion.ID}&answer=${encodeURIComponent(userAnswer)}`;
  console.log("🔍 [DEBUG] Validando respuesta en:", validateUrl);

  fetch(validateUrl)
    .then(res => res.json())
    .then(data => {
      console.log("✅ [DEBUG] Resultado de validación:", data);

      if (data.correct) {
        showSuccess(`✅ ¡Correcto! +${data.points} puntos`);
        currentScore += data.points;
      } else {
        const correctAnswer = data.message?.split(": ")[1] || "Desconocida";
        showError(`❌ Incorrecto. La respuesta era: "${correctAnswer}"`);
      }

      updateScoreDisplay();

      // Si falló la pregunta difícil → entra en modo acumulativo
      if (!inProgressMode && !data.correct) {
        inProgressMode = true;
        showError("❌ Fallaste la pregunta de salto. Ahora debes alcanzar el 100% para subir de nivel.");
      }

      // Si está en modo acumulativo y llega al 100%
      if (inProgressMode && currentScore >= totalPointsNeeded) {
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
        // Sube directamente si acertó la pregunta difícil
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
        // Siguiente pregunta en modo acumulativo
        setTimeout(loadQuestion, 1500);
      }
    })
    .catch(err => {
      console.error("🚨 [ERROR] Error al validar respuesta:", err);
      showError(`Error al validar: ${err.message}`);
      submitBtn.disabled = false;
    });
}

// Asociar botón
document.getElementById("submit-btn").addEventListener("click", submitAnswer);

/**
 * Actualiza la barra de progreso
 */
function updateScoreDisplay() {
  const percentage = Math.min(100, Math.round((currentScore / totalPointsNeeded) * 100));
  scoreEl.textContent = percentage;
  currentLevelEl.textContent = currentLevel;
}

/**
 * Reinicia el nivel (para subir de nivel)
 */
function resetLevel() {
  console.log("🔄 [DEBUG] Reiniciando nivel:", currentLevel);
  currentScore = 0;
  inProgressMode = false;
  updateScoreDisplay();
  loadQuestion();
}

/**
 * Obtiene el siguiente nivel
 */
function nextLevel(level) {
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const i = levels.indexOf(level);
  return i < levels.length - 1 ? levels[i + 1] : null;
}

/**
 * Finaliza el test
 */
function endTest() {
  console.log("🏁 [DEBUG] Test finalizado.");
  document.getElementById("question-container").style.display = "none";
  showSuccess("✅ Test finalizado. ¡Felicidades por completar todos los niveles!");
}

// Funciones de UI
function showError(msg) {
  resultMessage.textContent = msg;
  resultMessage.className = "error";
}

function showSuccess(msg) {
  resultMessage.textContent = msg;
  resultMessage.className = "success";
}
