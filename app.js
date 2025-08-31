// 🔁 Reemplaza con tu URL de Google Apps Script
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

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
  // Habilitar botón al cargar
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

  // Mostrar estado de carga
  questionText.textContent = "Cargando pregunta...";
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";
  correctionInput.value = "";
  submitBtn.disabled = true;

  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.error) {
        showError(`❌ Error: ${data.error}`);
        console.error("API Error:", data.error);
        return;
      }

      currentQuestion = data;
      displayQuestion(data);
      submitBtn.disabled = false;
    })
    .catch(err => {
      showError(`⚠️ No se pudo cargar la pregunta: ${err.message}`);
      console.error("Fetch error:", err);
      submitBtn.disabled = false;
    });
}

/**
 * Muestra la pregunta según su tipo
 */
function displayQuestion(question) {
  questionText.textContent = question.Pregunta;
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";
  correctionInput.value = "";
  resultMessage.textContent = "";
  resultMessage.className = "";

  if (question.Tipo === "MC" || question.Tipo === "COMP") {
    try {
      const options = JSON.parse(question.Opciones);
      options.forEach(option => {
        const label = document.createElement("label");
        label.innerHTML = `
          <input type="radio" name="answer" value="${option}">
          ${option}
        `;
        optionsContainer.appendChild(label);
      });
    } catch (e) {
      showError("Opciones no válidas.");
    }
  } else if (question.Tipo === "CORR") {
    correctionInput.style.display = "block";
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
  } else {
    userAnswer = correctionInput.value.trim();
  }

  if (!userAnswer) {
    alert("Por favor, escribe o selecciona una respuesta.");
    return;
  }

  submitBtn.disabled = true;

  const validateUrl = `${API_URL}?action=validateAnswer&id=${currentQuestion.ID}&answer=${encodeURIComponent(userAnswer)}`;

  fetch(validateUrl)
    .then(res => res.json())
    .then(data => {
      if (data.correct) {
        showSuccess(`✅ ¡Correcto! +${data.points} puntos`);
        currentScore += data.points;
      } else {
        showError(`❌ Incorrecto. La respuesta era: "${data.message?.split(": ")[1] || data.correctAnswer || "Desconocida"}"`);
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
      showError(`Error al validar: ${err.message}`);
      console.error(err);
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
