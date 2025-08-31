// 🔁 Reemplaza esto con tu URL de despliegue
const API_URL = "https://script.google.com/macros/s/AKfycbzAtwATYi-Uzxh4wDXpx723-Oom248RQqMbV_AdAnePXEtlKj9LThYsWOXLHPMTiVtFWw/exec";

let currentLevel = "A1";
let currentScore = 0;
let totalPointsNeeded = 100;
let inProgressMode = false;
let currentQuestion = null;

document.addEventListener("DOMContentLoaded", startTest);

function startTest() {
  loadQuestion();
}

function loadQuestion() {
  const url = inProgressMode
    ? `${API_URL}?action=getNextQuestion&level=${currentLevel}&score=${currentScore}`
    : `${API_URL}?action=getInitialQuestion&level=${currentLevel}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        document.getElementById("question-text").textContent = "❌ Error: " + data.error;
        console.error("Error API:", data);
        return;
      }

      currentQuestion = data;
      displayQuestion(data);
    })
    .catch(err => {
      document.getElementById("question-text").textContent = "⚠️ No se pudo cargar la pregunta.";
      console.error("Fetch error:", err);
    });
}

function displayQuestion(question) {
  document.getElementById("question-text").textContent = question.Pregunta;
  const optionsContainer = document.getElementById("options-container");
  const correctionInput = document.getElementById("correction-input");
  optionsContainer.innerHTML = "";
  correctionInput.style.display = "none";
  correctionInput.value = "";

  const resultMsg = document.getElementById("result-message");
  resultMsg.textContent = "";
  resultMsg.className = "";

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
      optionsContainer.innerHTML = "<p>Opciones no válidas.</p>";
    }
  } else if (question.Tipo === "CORR") {
    correctionInput.style.display = "block";
  }
}

document.getElementById("submit-btn").addEventListener("click", submitAnswer);

function submitAnswer() {
  let userAnswer = "";

  const radioSelected = document.querySelector('input[name="answer"]:checked');
  if (radioSelected) {
    userAnswer = radioSelected.value;
  } else {
    userAnswer = document.getElementById("correction-input").value.trim();
  }

  if (!userAnswer) {
    alert("Por favor, responde la pregunta.");
    return;
  }

  const resultMsg = document.getElementById("result-message");

  fetch(`${API_URL}?action=validateAnswer&id=${currentQuestion.ID}&answer=${encodeURIComponent(userAnswer)}`)
    .then(res => res.json())
    .then(data => {
      if (data.correct) {
        resultMsg.textContent = "✅ ¡Correcto!";
        resultMsg.className = "success";
        currentScore += data.points;
      } else {
        resultMsg.textContent = `❌ Incorrecto. Puntos ganados: 0. La respuesta era: ${data.message?.split(": ")[1] || ""}`;
        resultMsg.className = "error";
      }

      updateScoreDisplay();

      // Si falló la pregunta difícil → entra en modo acumulativo
      if (!inProgressMode && !data.correct) {
        inProgressMode = true;
        resultMsg.textContent += " Ahora debes alcanzar el 100% para subir de nivel.";
      }

      // Si está en modo acumulativo y llega al 100%
      if (inProgressMode && currentScore >= totalPointsNeeded) {
        const next = nextLevel(currentLevel);
        if (next) {
          alert(`🎉 ¡Felicidades! Subiste al nivel ${next}.`);
          currentLevel = next;
          resetLevel();
        } else {
          alert("🎉 ¡Has completado todos los niveles! Nivel máximo: C2.");
          endTest();
        }
      } else if (!inProgressMode && data.correct) {
        // Si acertó la pregunta difícil, sube de nivel
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
    });
}

function updateScoreDisplay() {
  const percentage = Math.min(100, Math.round((currentScore / totalPointsNeeded) * 100));
  document.getElementById("score").textContent = percentage;
  document.getElementById("current-level").textContent = currentLevel;
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
  const resultMsg = document.getElementById("result-message");
  resultMsg.textContent = "✅ Test finalizado. ¡Gracias por participar!";
  resultMsg.className = "success";
}
