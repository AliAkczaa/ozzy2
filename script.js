// === Firebase Configuration (Musisz Zastąpić Własnymi Kluczami!) ===
// Przejdź do Firebase Console -> Twój Projekt -> Ustawienia projektu (zębatka) -> Dodaj aplikację (ikona </> dla web)
// Skopiuj obiekt firebaseConfig i wklej go tutaj:
const firebaseConfig = {
    apiKey: "AIzaSyASSmHw3LVUu7lSql0QwGmmBcFkaNeMups", // Twoje klucze Firebase
    authDomain: "ozzy-14c19.firebaseapp.com",
    projectId: "ozzy-14c19",
    storageBucket: "ozzy-14c19.firebasestorage.app",
    messagingSenderId: "668337469201",
    appId: "1:668337469201:web:cd9d84d45c93d9b6e3feb0"
};

// === DODANE: Importy modularne Firebase SDK v10.0.0 ===
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
import { getFirestore, collection, getDocs, orderBy, query, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js'; 
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-functions.js'; 

// Inicjalizacja Firebase (teraz używamy modularnych funkcji)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 
const functions = getFunctions(app); 
const submitScoreFunction = httpsCallable(functions, 'submitScore'); // Odwołanie do naszej funkcji chmurowej

// ===================================================================

// Pobieranie referencji do elementów DOM
const backgroundTractor = document.getElementById('animated-background-tractor');
const ozzyContainer = document.getElementById('ozzy-container'); 
const ozzyImage = document.getElementById('ozzy-image'); 
const healthBarFill = document.getElementById('health-bar-fill'); 
const scoreDisplay = document.getElementById('score');
const messageDisplay = document.getElementById('message-display');
const gameContainer = document.getElementById('game-container');

const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const nicknameInput = document.getElementById('nickname-input');
const showLeaderboardButton = document.getElementById('show-leaderboard-button');

let playerNickname = "Gracz";

const endScreen = document.getElementById('end-screen');
const finalScoreDisplay = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');
const showLeaderboardAfterGameButton = document.getElementById('show-leaderboard-after-game-button'); 

const leaderboardScreen = document.getElementById('leaderboard-screen');
const leaderboardList = document.getElementById('leaderboard-list');
const backToStartButton = document.getElementById('back-to-start-button');

let score = 0; 
let ozzyHealth = 100; 
let INITIAL_OZZY_HEALTH = 100; 
const PUNCH_DAMAGE = 10; 
let isOzzyDown = false; 
let currentUserId = null; 
let isGameActive = false; 


// --- Referencje do elementów audio ---
const backgroundMusic = document.getElementById('background-music');
const punchSound = document.getElementById('punch-sound'); 


// --- Funkcje Leaderboarda ---
async function saveScoreToLeaderboard(nickname, score) {
    console.log("saveScoreToLeaderboard wywołane z nickiem:", nickname, "wynikiem:", score); 
    if (score > 200) { 
        showMessage("Spierdalaj frajerze cheaterze! Wynik nierealny!", 3000); 
        console.warn(`Próba zapisu nierealnego wyniku (${score}) przez ${nickname}. Zablokowano po stronie klienta.`);
        setTimeout(resetGame, 3000); 
        return; 
    }

    if (score > 0 && currentUserId) { 
        try {
            const result = await submitScoreFunction({ nickname: nickname, score: score });
            console.log("Odpowiedź z funkcji chmurowej:", result.data);
            showMessage(result.data.message, 2000); 
        } catch (error) {
            console.error("Błąd podczas wywoływania funkcji chmurowej:", error.code, error.message);
            showMessage(`Błąd zapisu: ${error.message}`, 3000); 
        }
    } else if (!currentUserId) { 
        console.warn("Nie można zapisać wyniku: Użytkownik nie jest uwierzytelniony. Sprawdź konfigurację Firebase Auth.");
        showMessage("Błąd: Brak uwierzytelnienia do zapisu wyniku.", 3000);
    }
}

async function fetchAndDisplayLeaderboard() {
    console.log("fetchAndDisplayLeaderboard wywołane."); 
    leaderboardList.innerHTML = ''; // Wyczyść listę przed załadowaniem
    try {
        const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), orderBy("timestamp", "asc"), limit(10));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            leaderboardList.innerHTML = '<li>Brak wyników w rankingu. Bądź pierwszy!</li>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const li = document.createElement('li');
            li.textContent = `${data.nickname || 'Anonim'}: ${data.score} znokautowań`;
            leaderboardList.appendChild(li);
        });
    } catch (e) {
        console.error("Błąd podczas pobierania rankingu: ", e);
        leaderboardList.innerHTML = '<li>Wystąpił błąd podczas ładowania rankingu.</li>';
    }
}

// --- Funkcje Gry ---
function resetGame() {
    console.log("resetGame wywołane."); 
    score = 0;
    scoreDisplay.textContent = score;
    INITIAL_OZZY_HEALTH = 100; 
    ozzyHealth = INITIAL_OZZY_HEALTH;
    updateHealthBar();
    ozzyImage.classList.remove('hit-effect'); 
    ozzyContainer.classList.add('hidden'); // Ukryj Ozzy'ego na starcie

    messageDisplay.style.display = 'none';

    isGameActive = false; 
    isOzzyDown = false; 
    endScreen.classList.add('hidden');
    leaderboardScreen.classList.add('hidden'); // Ukryj ranking
    startScreen.classList.remove('hidden'); // Pokaż ekran startowy
    
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0; 
    }
}

function showMessage(message, duration = 1500) {
    messageDisplay.textContent = message;
    messageDisplay.style.display = 'block';
    messageDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    messageDisplay.style.borderColor = 'lime';
    messageDisplay.style.color = 'white';
    setTimeout(() => {
        messageDisplay.style.display = 'none';
    }, duration);
}

function updateHealthBar() {
    const healthPercentage = (ozzyHealth / INITIAL_OZZY_HEALTH) * 100;
    healthBarFill.style.width = `${healthPercentage}%`;
    if (healthPercentage > 50) {
        healthBarFill.style.backgroundColor = 'limegreen';
    } else if (healthPercentage > 20) {
        healthBarFill.style.backgroundColor = 'orange';
    } else {
        healthBarFill.style.backgroundColor = 'red';
    }
}

function startGame() {
    console.log("startGame wywołane."); 
    startScreen.classList.add('hidden'); 
    ozzyContainer.classList.remove('hidden'); // Pokaż Ozzy'ego
    scoreDisplay.classList.remove('hidden'); // Pokaż licznik
    isGameActive = true;
    score = 0;
    scoreDisplay.textContent = score;
    INITIAL_OZZY_HEALTH = 100; 
    ozzyHealth = INITIAL_OZZY_HEALTH; 
    updateHealthBar(); 
    ozzyImage.classList.remove('hit-effect'); 

    if (backgroundMusic) {
        backgroundMusic.play().catch(e => console.error("Błąd odtwarzania backgroundMusic:", e));
    }
}

function endGame(message) {
    console.log("endGame wywołane z wiadomością:", message); 
    isGameActive = false;
    ozzyContainer.classList.add('hidden'); // Ukryj Ozzy'ego po zakończeniu gry
    scoreDisplay.classList.add('hidden'); // Ukryj licznik
    messageDisplay.style.display = 'none';

    document.getElementById('end-message').textContent = message;
    finalScoreDisplay.textContent = score;

    saveScoreToLeaderboard(playerNickname, score);

    endScreen.classList.remove('hidden');

    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
}

function handlePunch(event) {
    console.log("handlePunch wywołane."); 
    if (!isGameActive || isOzzyDown) { 
        return;
    }

    if (punchSound) {
        punchSound.currentTime = 0; 
        punchSound.play().catch(e => console.error("Błąd odtwarzania punchSound:", e));
    }

    ozzyHealth -= PUNCH_DAMAGE;
    ozzyHealth = Math.max(0, ozzyHealth); 
    updateHealthBar(); 

    ozzyImage.classList.add('hit-effect');
    setTimeout(() => {
        ozzyImage.classList.remove('hit-effect');
    }, 150); 

    if (ozzyHealth <= 0) {
        isOzzyDown = true; 
        score++; 
        scoreDisplay.textContent = score;

        showMessage('Ozzy padł! Znokautowany!', 1500);

        setTimeout(() => {
            if (score > 0 && score % 5 === 0) { 
                 INITIAL_OZZY_HEALTH += 20; 
                 showMessage(`Ozzy jest silniejszy! Jego zdrowie to ${INITIAL_OZZY_HEALTH}!`, 2000);
            }
            ozzyHealth = INITIAL_OZZY_HEALTH; 
            updateHealthBar();
            ozzyImage.classList.remove('hit-effect'); 
            isOzzyDown = false; 
        }, 1500); 
    }
}

// Ważne: to sprawdza, czy skrypt jest w ogóle uruchamiany
console.log("Script.js jest uruchamiany!"); 

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: DOM został załadowany!"); 
    
    // Upewnij się, że wszystkie ekrany są początkowo ukryte, z wyjątkiem startScreen
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    leaderboardScreen.classList.add('hidden');
    ozzyContainer.classList.add('hidden');
    scoreDisplay.classList.add('hidden'); // Ukryj licznik punktów na starcie
    messageDisplay.style.display = 'none';

    // Pokaż ekran startowy dopiero po ukryciu wszystkich innych
    startScreen.classList.remove('hidden');

    resetGame(); // Resetuje stan gry, ale resetGame w tym momencie głównie ukryje rzeczy

    console.log("Initial game container dimensions:", gameContainer.offsetWidth, gameContainer.offsetHeight);
    console.log("Initial target image (Ozzy) dimensions:", ozzyImage.offsetWidth, ozzyImage.offsetHeight);

    // Inicjalizacja uwierzytelniania anonimowego po załadowaniu DOM
    try {
        const userCredential = await signInAnonymously(auth);
        currentUserId = userCredential.user.uid;
        console.log("Zalogowano anonimowo. UID:", currentUserId);
    } catch (error) {
        console.error("Błąd logowania anonimowego:", error);
        showMessage("Błąd połączenia z rankingiem. Spróbuj odświeżyć stronę.", 5000);
    }
    console.log("DOMContentLoaded: Uwierzytelnianie zakończone."); 

    // PRZENIESIONE OBSŁUGI ZDARZEŃ
    startButton.addEventListener('click', () => {
        console.log("Kliknięto przycisk START!"); 
        const nick = nicknameInput.value.trim();
        if (nick === "") {
            showMessage("Musisz wpisać swój nick!", 2000);
            return;
        }
        playerNickname = nick;
        startGame();
    });

    showLeaderboardButton.addEventListener('click', () => {
        console.log("Kliknięto przycisk RANKING!"); 
        startScreen.classList.add('hidden');
        leaderboardScreen.classList.remove('hidden');
        fetchAndDisplayLeaderboard();
    });

    restartButton.addEventListener('click', () => {
        console.log("Kliknięto przycisk RESTART!"); 
        resetGame();
    });

    ozzyContainer.addEventListener('click', handlePunch);
    ozzyContainer.addEventListener('touchstart', (event) => {
        event.preventDefault(); 
        handlePunch(event);
    }, { passive: false });

    showLeaderboardAfterGameButton.addEventListener('click', () => {
        console.log("Kliknięto przycisk ZOBACZ RANKING (po grze)!"); 
        endScreen.classList.add('hidden');
        leaderboardScreen.classList.remove('hidden');
        fetchAndDisplayLeaderboard();
    });

    backToStartButton.addEventListener('click', () => {
        console.log("Kliknięto przycisk WRÓĆ DO MENU!"); 
        leaderboardScreen.classList.add('hidden'); // Ukryj ranking
        startScreen.classList.remove('hidden'); // Pokaż ekran startowy
        resetGame(); // Zresetuj inne elementy gry
    });
});
