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

// Inicjalizacja Firebase (teraz używamy globalnego obiektu firebase)
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); 
const functions = firebase.functions(); 
const submitScoreFunction = functions.httpsCallable('submitScore'); // Odwołanie do naszej funkcji chmurowej

// ===================================================================

// Pobieranie referencji do elementów DOM
const backgroundTractor = document.getElementById('animated-background-tractor');
const ozzyContainer = document.getElementById('ozzy-container'); 
const ozzyImage = document.getElementById('ozzy-image'); 
const healthBarFill = document.getElementById('health-bar-fill'); 
const scoreDisplay = document.getElementById('score');
const messageDisplay = document.getElementById('message-display'); // Do ogólnych komunikatów
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
let PUNCH_DAMAGE = 10; // Zmieniono na let, bo będzie modyfikowane przez Szał Bojowy
let currentUserId = null; 
let isGameActive = false; 

// --- Referencje i zmienne dla obrazków cytatów ---
const quoteImagesContainer = document.getElementById('quote-images-container');
const quoteImagePaths = [
    'ozzy1.png', 'ozzy2.png', 'ozzy3.png', 
    'ozzy4.png', 'ozzy5.png', 'ozzy6.png'
];
const QUOTE_DISPLAY_DURATION_MS = 2000;
const QUOTE_SIZE_PX = 150;

// --- Elementy i zmienne dla supermocy ---
const superpowerButtonsContainer = document.getElementById('superpower-buttons-container');
const btnLightning = document.getElementById('btn-lightning');
const btnFreeze = document.getElementById('btn-freeze'); // ID pozostaje 'btn-freeze'
const btnFrenzy = document.getElementById('btn-frenzy');

// Oryginalne teksty przycisków (do wyświetlania po zakończeniu cooldownu)
const originalLightningText = '⚡ Piorun Zagłady';
const originalFreezeText = '❄️ Lodowy Wybuch';
const originalFrenzyText = '🔥 Szał Bojowy';


const lightningEffect = document.getElementById('lightning-effect');
const freezeEffect = document.getElementById('freeze-effect'); // ID pozostaje 'freeze-effect'
const frenzyEffect = document.getElementById('frenzy-effect');

const PUNCHES_PER_POWERUP = 10; // Ile uderzeń do aktywacji supermocy (próg)

const COOLDOWN_DURATION_MS = 60 * 1000; // 60 sekund

let lastUsedLightningTime = 0; // Timestamp ostatniego użycia Pioruna
let lastUsedFreezeTime = 0; // Timestamp ostatniego użycia Lodowego Wybuchu
let lastUsedFrenzyTime = 0; // Timestamp ostatniego użycia Szału Bojowego

let frenzyModeActive = false;
let frenzyTimerId;
const FRENZY_DAMAGE_MULTIPLIER = 3; // Np. 3 razy większe obrażenia
const FRENZY_DURATION_MS = 5000; // Czas trwania Szału Bojowego (5 sekund)

const ICE_BLAST_DAMAGE = 50; // Obrażenia zadawane przez Lodowy Wybuch
const FRENZY_INITIAL_DAMAGE = 30; // Początkowe obrażenia zadawane przez Szał Bojowy

let superpowerCooldownIntervalId; // ID dla setInterval do aktualizacji timerów

// --- Referencje do elementów audio ---
const backgroundMusic = document.getElementById('background-music');
// punch.mp3 jest odtwarzane dynamicznie w JS

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
        // Zmieniono na składnię kompatybilnościową dla Firestore
        const snapshot = await db.collection("leaderboard")
                                 .orderBy("score", "desc")
                                 .orderBy("timestamp", "asc")
                                 .limit(10)
                                 .get();

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

// --- Funkcje Cytatów ---
function spawnRandomQuote() {
    const randomImagePath = quoteImagePaths[Math.floor(Math.random() * quoteImagePaths.length)];
    
    const img = document.createElement('img');
    img.src = randomImagePath;
    img.classList.add('quote-image'); // Klasa dla stylizacji CSS
    
    // Losowa pozycja w obrębie gameContainer, ale unikając krawędzi
    const gameContainerRect = gameContainer.getBoundingClientRect();
    const maxX = gameContainerRect.width - QUOTE_SIZE_PX;
    const maxY = gameContainerRect.height - QUOTE_SIZE_PX;

    // Upewnij się, że nie wychodzi poza kontener i ma trochę marginesu
    const randomX = Math.random() * Math.max(0, maxX);
    const randomY = Math.random() * Math.max(0, maxY);
    
    img.style.left = `${randomX}px`;
    img.style.top = `${randomY}px`;

    // Losowy kąt obrotu (-45 do +45 stopni)
    const randomRotation = Math.random() * 90 - 45; // Losuje od -45 do 45
    img.style.transform = `rotate(${randomRotation}deg)`;

    quoteImagesContainer.appendChild(img);

    // Aktywuj animację pojawiania się
    setTimeout(() => {
        img.classList.add('active');
    }, 10); // Małe opóźnienie, aby CSS transition zadziałało

    // Ustaw czas zniknięcia
    setTimeout(() => {
        img.classList.remove('active'); // Rozpocznij animację znikania
        setTimeout(() => {
            img.remove(); // Usuń element z DOM po zakończeniu animacji
        }, 500); // Czas trwania animacji opactiy
    }, QUOTE_DISPLAY_DURATION_MS);
}

// --- NOWA FUNKCJA: Ujednolicone zadawanie obrażeń ---
function applyDamageToOzzy(damageAmount) {
    ozzyHealth -= damageAmount;
    ozzyHealth = Math.max(0, ozzyHealth);
    updateHealthBar();
    if (ozzyHealth <= 0) {
        handleOzzyKnockout();
    }
}

// --- Funkcje supermocy ---
function updateSuperpowerButtons() {
    const now = Date.now();

    // Sprawdź próg uderzeń ORAZ cooldown dla każdego przycisku
    const canUseLightning = (punchesSinceLastPowerup >= PUNCHES_PER_POWERUP) && 
                            ((now - lastUsedLightningTime >= COOLDOWN_DURATION_MS) || lastUsedLightningTime === 0) && 
                            isGameActive;
    
    const canUseFreeze = (punchesSinceLastPowerup >= PUNCHES_PER_POWERUP) && 
                         ((now - lastUsedFreezeTime >= COOLDOWN_DURATION_MS) || lastUsedFreezeTime === 0) && 
                         isGameActive;
    
    const canUseFrenzy = (punchesSinceLastPowerup >= PUNCHES_PER_POWERUP) && 
                         ((now - lastUsedFrenzyTime >= COOLDOWN_DURATION_MS) || lastUsedFrenzyTime === 0) && 
                         isGameActive;

    btnLightning.disabled = !canUseLightning;
    btnFreeze.disabled = !canUseFreeze;
    btnFrenzy.disabled = !canUseFrenzy;

    // Kontener przycisków jest klikalny, jeśli którykolwiek przycisk jest aktywny
    if (canUseLightning || canUseFreeze || canUseFrenzy) {
        superpowerButtonsContainer.style.pointerEvents = 'auto'; 
    } else {
        superpowerButtonsContainer.style.pointerEvents = 'none';
    }

    // Aktualizuj wyświetlanie cooldownów
    updateSuperpowerCooldownDisplays();
}

// NOWA FUNKCJA: Aktualizuje tekst na przyciskach supermocy o pozostały czas cooldownu
function updateSuperpowerCooldownDisplays() {
    const now = Date.now();

    const updateButtonText = (button, lastUsedTime, originalText) => {
        // Jeśli gra nieaktywna lub przycisk jest aktywny (dostępny), wyświetl oryginalny tekst
        if (!isGameActive || (!button.disabled && lastUsedTime === 0)) {
             button.textContent = originalText;
             return;
        }

        const timeLeft = Math.ceil((lastUsedTime + COOLDOWN_DURATION_MS - now) / 1000);
        if (timeLeft > 0) {
            button.textContent = `${timeLeft}s`;
        } else {
            button.textContent = originalText; // Cooldown minął, pokaż oryginalny tekst
        }
    };

    updateButtonText(btnLightning, lastUsedLightningTime, originalLightningText);
    updateButtonText(btnFreeze, lastUsedFreezeTime, originalFreezeText);
    updateButtonText(btnFrenzy, lastUsedFrenzyTime, originalFrenzyText);
}


function activateLightningStrike() {
    if (!isGameActive || btnLightning.disabled) return;

    showMessage("PIORUN ZAGŁADY!", 1500);
    punchesSinceLastPowerup = 0; // Resetuj licznik uderzeń
    lastUsedLightningTime = Date.now(); // Ustaw czas ostatniego użycia
    updateSuperpowerButtons(); // Zablokuj przyciski i zaktualizuj timery

    // Efekt wizualny błyskawicy (generowany kodem)
    const segments = 10; // Liczba segmentów błyskawicy
    const ozzyRect = ozzyContainer.getBoundingClientRect();
    const startX = ozzyRect.left + ozzyRect.width / 2;
    const startY = ozzyRect.top - 50; // Zaczyna się nad Ozzym

    for (let i = 0; i < segments; i++) {
        const segment = document.createElement('div');
        segment.classList.add('lightning-segment');
        
        const length = Math.random() * 50 + 30; // Długość segmentu
        const angle = Math.random() * 40 - 20; // Kąt odchylenia
        const width = Math.random() * 5 + 3; // Grubość segmentu

        segment.style.width = `${width}px`;
        segment.style.height = `${length}px`;
        segment.style.left = `${startX + (Math.random() - 0.5) * 50}px`; // Losowe przesunięcie
        segment.style.top = `${startY + i * (ozzyRect.height / segments) + (Math.random() - 0.5) * 20}px`;
        segment.style.transform = `rotate(${angle}deg)`;
        segment.style.transformOrigin = `center top`; // Obracaj od góry

        lightningEffect.appendChild(segment);
    }

    lightningEffect.classList.remove('hidden');
    // Znokautuj Ozzy'ego natychmiast
    applyDamageToOzzy(ozzyHealth); // Zadaj obrażenia równe aktualnemu zdrowiu

    setTimeout(() => {
        lightningEffect.classList.add('hidden');
        lightningEffect.innerHTML = ''; // Usuń segmenty
    }, 1000); // Czas trwania efektu
}

function activateIceBlast() { // Zmieniono nazwę funkcji dla jasności
    if (!isGameActive || btnFreeze.disabled) return; // Używamy btnFreeze, bo ID HTML się nie zmienia

    showMessage("LODOWY WYBUCH!", 1500);
    punchesSinceLastPowerup = 0; // Resetuj licznik uderzeń
    lastUsedFreezeTime = Date.now(); // Ustaw czas ostatniego użycia
    updateSuperpowerButtons(); // Zablokuj przyciski i zaktualizuj timery

    freezeEffect.classList.remove('hidden');
    freezeEffect.classList.add('active');

    // Efekt kryształków lodu
    const ozzyRect = ozzyContainer.getBoundingClientRect();
    for (let i = 0; i < 15; i++) {
        const shard = document.createElement('div');
        shard.classList.add('ice-shard');
        shard.style.left = `${ozzyRect.left + Math.random() * ozzyRect.width}px`;
        shard.style.top = `${ozzyRect.top + Math.random() * ozzyRect.height}px`;
        freezeEffect.appendChild(shard);
    }

    applyDamageToOzzy(ICE_BLAST_DAMAGE); // Zadaj bezpośrednie obrażenia

    setTimeout(() => {
        freezeEffect.classList.add('hidden');
        freezeEffect.classList.remove('active');
        freezeEffect.innerHTML = ''; // Usuń kryształki
    }, 1000); // Czas trwania efektu wizualnego
}

function activateFrenzy() {
    if (!isGameActive || btnFrenzy.disabled) return;

    showMessage("SZAŁ BOJOWY!", 1500);
    punchesSinceLastPowerup = 0; // Resetuj licznik uderzeń
    lastUsedFrenzyTime = Date.now(); // Ustaw czas ostatniego użycia
    updateSuperpowerButtons(); // Zablokuj przyciski i zaktualizuj timery

    applyDamageToOzzy(FRENZY_INITIAL_DAMAGE); // Zadaj początkowe obrażenia

    frenzyModeActive = true;
    PUNCH_DAMAGE *= FRENZY_DAMAGE_MULTIPLIER; // Zwiększ obrażenia od uderzeń
    frenzyEffect.classList.remove('hidden');
    frenzyEffect.classList.add('active');

    clearTimeout(frenzyTimerId); // Upewnij się, że poprzedni timer szału jest wyczyszczony
    frenzyTimerId = setTimeout(() => {
        frenzyModeActive = false;
        PUNCH_DAMAGE = 10; // Przywróć normalne obrażenia
        frenzyEffect.classList.add('hidden');
        frenzyEffect.classList.remove('active');
        showMessage("Szał minął. Normalne uderzenia.", 1500);
    }, FRENZY_DURATION_MS);
}


// --- Funkcje Gry ---
function resetGame() {
    console.log("resetGame wywołane."); 
    score = 0;
    scoreDisplay.textContent = score;
    INITIAL_OZZY_HEALTH = 100; 
    ozzyHealth = INITIAL_OZZY_HEALTH;
    PUNCH_DAMAGE = 10; // Upewnij się, że obrażenia są zresetowane
    updateHealthBar();
    ozzyImage.classList.remove('hit-effect'); 
    ozzyContainer.classList.add('hidden'); // Ukryj Ozzy'ego na starcie

    // Usuń wszystkie cytaty z ekranu przy resecie
    quoteImagesContainer.innerHTML = ''; 

    // Resetuj stan supermocy i cooldowny
    punchesSinceLastPowerup = 0;
    lastUsedLightningTime = 0;
    lastUsedFreezeTime = 0;
    lastUsedFrenzyTime = 0;
    
    frenzyModeActive = false;
    clearTimeout(frenzyTimerId); // Wyczyść timer szału

    lightningEffect.classList.add('hidden');
    freezeEffect.classList.add('hidden');
    frenzyEffect.classList.add('hidden');
    lightningEffect.innerHTML = ''; // Wyczyść segmenty błyskawicy
    freezeEffect.innerHTML = ''; // Wyczyść kryształki lodu


    messageDisplay.style.display = 'none'; // Ukryj ogólny komunikat
    // Usuń wszystkie aktywne komunikaty nokautu, jeśli jakieś są
    document.querySelectorAll('.knockout-message').forEach(el => el.remove());


    isGameActive = false; 
    endScreen.classList.add('hidden');
    leaderboardScreen.classList.add('hidden'); 
    startScreen.classList.remove('hidden'); // Pokaż ekran startowy
    
    // Zatrzymanie intervalu timera cooldownów
    clearInterval(superpowerCooldownIntervalId);
    updateSuperpowerCooldownDisplays(); // Końcowa aktualizacja, by pokazać oryginalny tekst

    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0; 
    }
}

// Funkcja do wyświetlania OGÓLNYCH komunikatów (nadal blokująca kliknięcia pod spodem, jeśli nie ma pointer-events: none)
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
    console.log("Po hidden: startScreen display", window.getComputedStyle(startScreen).display); 
    ozzyContainer.classList.remove('hidden'); // Pokaż Ozzy'ego
    scoreDisplay.classList.remove('hidden'); // Pokaż licznik
    isGameActive = true;
    score = 0;
    scoreDisplay.textContent = score;
    INITIAL_OZZY_HEALTH = 100; 
    ozzyHealth = INITIAL_OZZY_HEALTH; 
    PUNCH_DAMAGE = 10; // Upewnij się, że obrażenia są zresetowane
    updateHealthBar(); 
    ozzyImage.classList.remove('hit-effect'); 

    // Resetuj supermoce na start gry
    punchesSinceLastPowerup = 0;
    lastUsedLightningTime = 0;
    lastUsedFreezeTime = 0;
    lastUsedFrenzyTime = 0;
    
    frenzyModeActive = false;
    clearTimeout(frenzyTimerId); // Wyczyść timer szału

    lightningEffect.classList.add('hidden');
    freezeEffect.classList.add('hidden');
    frenzyEffect.classList.add('hidden');
    lightningEffect.innerHTML = '';
    freezeEffect.innerHTML = '';
    // Usuń wszystkie aktywne komunikaty nokautu, jeśli jakieś są
    document.querySelectorAll('.knockout-message').forEach(el => el.remove());


    // Usuń cytaty, jeśli jakieś zostały z poprzedniej sesji gry
    quoteImagesContainer.innerHTML = '';

    // Uruchomienie intervalu timera cooldownów
    clearInterval(superpowerCooldownIntervalId); // Wyczyść poprzedni, jeśli istnieje
    superpowerCooldownIntervalId = setInterval(updateSuperpowerCooldownDisplays, 1000);
    updateSuperpowerButtons(); // Początkowa aktualizacja stanu i tekstu przycisków

    if (backgroundMusic) {
        backgroundMusic.play().catch(e => console.error("Błąd odtwarzania backgroundMusic:", e));
    }
}

function endGame(message) {
    console.log("endGame wywołane z wiadomością:", message); 
    isGameActive = false;
    ozzyContainer.classList.add('hidden'); // Ukryj Ozzy'ego po zakończeniu gry
    scoreDisplay.classList.add('hidden'); // Ukryj licznik
    messageDisplay.style.display = 'none'; // Ukryj ogólny komunikat
    quoteImagesContainer.innerHTML = ''; // Usuń wszystkie cytaty po zakończeniu gry
    // Usuń wszystkie aktywne komunikaty nokautu, jeśli jakieś są
    document.querySelectorAll('.knockout-message').forEach(el => el.remove());


    // Zresetuj wszystkie aktywne supermoce po zakończeniu gry
    frenzyModeActive = false;
    PUNCH_DAMAGE = 10; // Przywróć normalne obrażenia
    clearTimeout(frenzyTimerId);
    lightningEffect.classList.add('hidden');
    freezeEffect.classList.add('hidden');
    frenzyEffect.classList.add('hidden');
    lightningEffect.innerHTML = '';
    freezeEffect.innerHTML = '';
    punchesSinceLastPowerup = 0; // Resetuj licznik do supermocy
    lastUsedLightningTime = 0;
    lastUsedFreezeTime = 0;
    lastUsedFrenzyTime = 0;
    updateSuperpowerButtons(); // Zaktualizuj stan przycisków

    // Zatrzymanie intervalu timera cooldownów
    clearInterval(superpowerCooldownIntervalId);


    document.getElementById('end-message').textContent = message;
    finalScoreDisplay.textContent = score;

    saveScoreToLeaderboard(playerNickname, score);

    endScreen.classList.remove('hidden');

    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
}

// NOWA FUNKCJA: Obsługuje znokautowanie Ozzy'ego (wydzielona z handlePunch)
function handleOzzyKnockout() {
    score++; 
    scoreDisplay.textContent = score;

    // --- POPRAWKA: Usuń istniejące komunikaty nokautu przed utworzeniem nowego ---
    document.querySelectorAll('.knockout-message').forEach(el => el.remove());
    // -------------------------------------------------------------------------

    // Utwórz i wyświetl nieblokujący komunikat o nokaucie
    const knockoutMsgElement = document.createElement('div');
    knockoutMsgElement.textContent = 'Ozzy zajebany!';
    knockoutMsgElement.classList.add('knockout-message');
    gameContainer.appendChild(knockoutMsgElement);

    // Ozzy znika natychmiast po nokaucie
    ozzyContainer.classList.add('hidden'); 
    
    // --- KLUCZOWA ZMIANA: Zdrowie Ozzy'ego odnawia się natychmiast ---
    if (score > 0 && score % 5 === 0) { 
         INITIAL_OZZY_HEALTH += 20; 
         // Komunikat o zwiększeniu zdrowia nadal wyświetlany przez showMessage
         showMessage(`Ozzy jest silniejszy! Jego zdrowie to ${INITIAL_OZZY_HEALTH}!`, 2000);
    }
    ozzyHealth = INITIAL_OZZY_HEALTH; 
    updateHealthBar(); // Pasek zdrowia aktualizuje się natychmiast
    // ---------------------------------------------------------------

    // Ozzy pojawia się ponownie po krótkim opóźnieniu (wizualny efekt "powstawania")
    setTimeout(() => {
        ozzyContainer.classList.remove('hidden'); 
        ozzyImage.classList.remove('hit-effect'); 
    }, 1000); // Ozzy wizualnie wstaje po 1 sekundzie

    // Komunikat o nokaucie znika po zakończeniu animacji (2 sekundy)
    setTimeout(() => {
        knockoutMsgElement.remove();
    }, 2000); // Dopasowane do czasu trwania animacji CSS (fadeOutUp)
}

function handlePunch(event) {
    console.log("handlePunch wywołane."); 
    // Usunięto warunek isOzzyDown, aby umożliwić klikanie Ozzy'ego zaraz po nokaucie
    if (!isGameActive) { 
        return;
    }

    const punchSoundInstance = new Audio('punch.mp3');
    punchSoundInstance.play().catch(e => console.error("Błąd odtwarzania punchSoundInstance:", e));
    punchSoundInstance.onended = () => {
        punchSoundInstance.remove();
    };

    applyDamageToOzzy(PUNCH_DAMAGE); 

    ozzyImage.classList.add('hit-effect');
    setTimeout(() => {
        ozzyImage.classList.remove('hit-effect');
    }, 150); 
    
    // Sprawdzamy, czy Ozzy został trafiony i czy jest szansa na pojawienie się cytatu
    if (ozzyHealth > 0 && Math.random() < 0.3) { // 30% szans na pojawienie się cytatu po trafieniu
        spawnRandomQuote();
    }

    // Zwiększ licznik uderzeń do supermocy
    punchesSinceLastPowerup++;
    updateSuperpowerButtons(); // Aktualizuj stan przycisków supermocy (w tym cooldowny)
}

// Ważne: to sprawdza, czy skrypt jest w ogóle uruchamiany
console.log("Script.js jest uruchamiany!"); 

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: DOM został załadowany!"); 
    
    // Upewnij się, że wszystkie ekrany są początkowo ukryte, z wyjątkiem startScreen
    endScreen.classList.add('hidden');
    leaderboardScreen.classList.add('hidden');
    ozzyContainer.classList.add('hidden');
    scoreDisplay.classList.add('hidden'); 
    messageDisplay.style.display = 'none';
    quoteImagesContainer.innerHTML = ''; // Upewnij się, że kontener cytatów jest pusty na starcie
    // Usuń wszystkie aktywne komunikaty nokautu, jeśli jakieś są
    document.querySelectorAll('.knockout-message').forEach(el => el.remove());


    resetGame(); // Ta funkcja również resetuje supermoce i cooldowny

    console.log("Initial game container dimensions:", gameContainer.offsetWidth, gameContainer.offsetHeight);
    console.log("Initial target image (Ozzy) dimensions:", ozzyImage.offsetWidth, ozzyImage.offsetHeight);

    // Inicjalizacja uwierzytelniania anonimowego po załadowaniu DOM
    try {
        const userCredential = await auth.signInAnonymously();
        currentUserId = userCredential.user.uid;
        console.log("Zalogowano anonimowo. UID:", currentUserId);
    } catch (error) {
        console.error("Błąd logowania anonimowego:", error);
        showMessage("Błąd połączenia z rankingiem. Spróbuj odświeżyć stronę.", 5000);
    }
    console.log("DOMContentLoaded: Uwierzytelnianie zakończone."); 

    // --- Obsługa zdarzeń ---
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
        leaderboardScreen.classList.add('hidden'); 
        startScreen.classList.remove('hidden'); 
    });

    // Obsługa kliknięć przycisków supermocy
    btnLightning.addEventListener('click', activateLightningStrike);
    btnFreeze.addEventListener('click', activateIceBlast); // Zmieniono na activateIceBlast
    btnFrenzy.addEventListener('click', activateFrenzy);
});
