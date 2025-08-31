// 🔁 Reemplaza con tu URL real de Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbx8jLCr9RqrwBYZqNFiamBhqHW7AObFus82lLyRZ6rBUqAwRPFPrluj_7iZoZzE--zUTw/exec";

// Estado del test
let currentLevel = "A1";
let currentScore = 0;
let totalPointsNeeded = 100;
let inProgressMode = false;
let currentQuestion = null;
let userEmail = "";
let userName = "";

// Elementos del DOM
const formContainer = document.getElementById("form-container");
const testContainer = document.getElementById("test-container");
const leadForm = document.getElementById("lead-form");

// === FORMULARIO DE CONTACTO ===
leadForm.addEventListener("submit", function(e) {
  e.preventDefault();

  // Obtener valores del formulario
  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const pais = document.getElementById("pais").value;
  const nivelAutoevaluado = document.getElementById("nivel-autoevaluado").value;
  const motivo = document.getElementById("motivo").value.trim();
  const referencia = document.getElementById("referencia").value;

  // Validación básica
  if (!nombre || !email || !pais) {
    alert("Por favor, completa los campos obligatorios: nombre, email y país.");
    return;
  }

  // Crear URL con todos los parámetros
  const leadUrl = `${API_URL}?action=saveLead` +
    `&nombre=${encodeURIComponent(nombre)}` +
    `&email=${encodeURIComponent(email)}` +
    `&telefono=${encodeURIComponent(telefono)}` +
    `&pais=${encodeURIComponent(pais)}` +
    `&nivelAutoevaluado=${encodeURIComponent(nivelAutoevaluado)}` +
    `&motivo=${encodeURIComponent(motivo)}` +
    `&referencia=${encodeURIComponent(referencia)}`;

  console.log("🔍 [DEBUG] Enviando lead a:", leadUrl);

  fetch(leadUrl)
    .then(res => res.json())
    .then(data => {
      console.log("📦 [DEBUG] Respuesta del servidor:", data);

      if (data.success) {
        userName = nombre;
        userEmail = email;
        formContainer.style.display = "none";
        testContainer.style.display = "block";
        loadQuestion();
      } else {
        alert("Error al guardar tus datos: " + (data.error || "Inténtalo de nuevo"));
      }
    })
    .catch(err => {
      console.error("🚨 [ERROR] No se pudo guardar el lead:", err);
      alert("Hubo un error al enviar tus datos. Por favor, revisa tu conexión e inténtalo de nuevo.");
    });
});

// === LÓGICA DEL TEST ===
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const correctionInput = document.getElementById("correction-input");
const submitBtn = document.getElementById("submit-btn");
const resultMessage = document.getElementById("result-message");
const currentLevelEl = document.getElementById("current-level");
const scoreEl = document.getElementById("score");

function loadQuestion() {
  const url = inProgressMode
    ? `${API_URL}?action=getNextQuestion&level=${currentLevel}&score=${currentScore}`
    : `${API_URL}?action=getInitialQuestion&level=${currentLevel}`;

  console.log("🔍 [DEBUG] Cargando pregunta desde:", url);

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
      console.log("📦 [DEBUG] Pregunta recibida:", data);

      if (data.error) {
        showError(`❌ ${data.error}`);
        return;
      }

      // Normalizar claves a minúsculas para compatibilidad con mayúsculas en Google Sheets
      const normalized = {};
      for (const [key, value] of Object.entries(data)) {
        normalized[key.toLowerCase()] = value;
      }

      currentQuestion = normalized;
      displayQuestion(normalized);
      submitBtn.disabled = false;
    })
    .catch(err => {
      showError(`⚠️ Error al cargar la pregunta: ${err.message}`);
      console.error("🚨 [ERROR]", err);
      submitBtn.disabled = false;
    });
}

function displayQuestion(question) {
  const pregunta = question.pregunta || question.Pregunta;
  const tipo = (question.tipo || question.Tipo || "").toLowerCase();

  if (!pregunta) {
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
        label.innerHTML = `<input type="radio" name="answer" value="${opcion}"> ${opcion}`;
        optionsContainer.appendChild(label);
      });
    } catch (e) {
      showError("Opciones no válidas.");
    }
  } else if (tipo === "corr") {
    correctionInput.style.display = "block";
  } else {
    console.warn("⚠️ Tipo de pregunta no soportado:", tipo);
  }
}

submitBtn.addEventListener("click", submitAnswer);

function submitAnswer() {
  let userAnswer = "";
  const radioSelected = document.querySelector('input[name="answer"]:checked');
  userAnswer = radioSelected ? radioSelected.value : correctionInput.value.trim();

  if (!userAnswer) {
    alert("Por favor, escribe o selecciona una respuesta.");
    return;
  }

  submitBtn.disabled = true;

  const validateUrl = `${API_URL}?action=validateAnswer&id=${currentQuestion.id || currentQuestion.ID}&answer=${encodeURIComponent(userAnswer)}`;

  fetch(validateUrl)
    .then(res => res.json())
    .then(data => {
      if (data.correct) {
        showSuccess(`✅ ¡Correcto! +${data.points} puntos`);
        currentScore += data.points;
      } else {
        showError(`❌ Incorrecto.`);
      }

      updateScoreDisplay();

      // Si falla la pregunta difícil, entra en modo acumulativo
      if (!inProgressMode && !data.correct) {
        inProgressMode = true;
        showError("❌ Fallaste. Ahora debes alcanzar el 100% para subir de nivel.");
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
        // Si acierta la pregunta difícil, sube directamente
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
      console.error("🚨 [ERROR]", err);
      submitBtn.disabled = false;
    });
}

function updateScoreDisplay() {
  const percentage = Math.min(100, Math.round((currentScore / totalPointsNeeded) * 100));
  scoreEl.textContent = percentage;
  currentLevelEl.textContent = currentLevel;
}

function resetLevel() {
  currentScore = 0;
  inProgressMode = false;
  updateScoreDisplay();
  loadQuestion();
}

function nextLevel(level) {
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const i = levels.indexOf(level);
  return i < levels.length - 1 ? levels[i + 1] : null;
}

function endTest() {
  document.getElementById("question-container").style.display = "none";
  showSuccess(`✅ Test finalizado, ${userName}. ¡Gracias por participar!`);
  setTimeout(() => {
    alert(`📩 Pronto recibirás un correo con tu nivel y ofertas de cursos a ${userEmail}`);
  }, 1000);
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
