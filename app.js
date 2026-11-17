
"use strict";

// =====================================================
// BLACKJACK - APP.JS
// =====================================================

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const CARD_VALUES = {
    A: 11,
    J: 10,
    Q: 10,
    K: 10
};

let supportPlayer = [];
let supportDealer = [];
let supportHistory = [];

let gameDeck = [];
let gamePlayer = [];
let gameDealer = [];

let gameActive = false;
let gameFinished = false;
let currentDifficulty = "normal";

let stats = {
    games: 0,
    wins: 0,
    losses: 0,
    pushes: 0
};

// =====================================================
// STORAGE
// =====================================================

function loadStats() {
    try {
        const saved = localStorage.getItem("blackjack_stats");

        if (saved) {
            const parsed = JSON.parse(saved);

            stats = {
                games: Number(parsed.games) || 0,
                wins: Number(parsed.wins) || 0,
                losses: Number(parsed.losses) || 0,
                pushes: Number(parsed.pushes) || 0
            };
        }
    } catch (error) {
        console.error("İstatistikler yüklenemedi:", error);
    }

    updateStats();
}

function saveStats() {
    try {
        localStorage.setItem("blackjack_stats", JSON.stringify(stats));
    } catch (error) {
        console.error("İstatistikler kaydedilemedi:", error);
    }
}

function updateStats() {
    document.getElementById("games").textContent = stats.games;
    document.getElementById("wins").textContent = stats.wins;
    document.getElementById("losses").textContent = stats.losses;
    document.getElementById("pushes").textContent = stats.pushes;
}

function addResult(result) {
    stats.games++;

    if (result === "win") stats.wins++;
    if (result === "lose") stats.losses++;
    if (result === "push") stats.pushes++;

    saveStats();
    updateStats();
}

// =====================================================
// CARD HELPERS
// =====================================================

function cardValue(rank) {
    if (rank === "A") return 11;
    if (["J", "Q", "K"].includes(rank)) return 10;
    return Number(rank);
}

function handValue(hand) {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
        total += cardValue(card.rank);

        if (card.rank === "A") {
            aces++;
        }
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return {
        total,
        soft: aces > 0
    };
}

function isBlackjack(hand) {
    return hand.length === 2 && handValue(hand).total === 21;
}

function makeCard(rank, suit = "♠") {
    return { rank, suit };
}

function formatCard(card) {
    return `${card.rank}${card.suit}`;
}

function isRedSuit(suit) {
    return suit === "♥" || suit === "♦";
}

// =====================================================
// SUPPORT MODE
// =====================================================

function selectCard(rank) {
    const card = makeCard(rank);

    const playerTurn = supportPlayer.length <= supportDealer.length;

    if (playerTurn) {
        supportPlayer.push(card);
        supportHistory.push("player");
    } else {
        supportDealer.push(card);
        supportHistory.push("dealer");
    }

    updateSupport();
}

function undoCard() {
    const last = supportHistory.pop();

    if (!last) {
        showToast("Geri alınacak kart yok!");
        return;
    }

    if (last === "player") {
        supportPlayer.pop();
    } else {
        supportDealer.pop();
    }

    updateSupport();
}

function resetSupport() {
    supportPlayer = [];
    supportDealer = [];
    supportHistory = [];

    updateSupport();
    showToast("Kartlar sıfırlandı.");
}

function updateSupport() {
    renderSupportCards();

    document.getElementById("playerTotal").textContent =
        supportPlayer.length ? handValue(supportPlayer).total : 0;

    document.getElementById("dealerTotal").textContent =
        supportDealer.length ? handValue(supportDealer).total : 0;

    updateAdvice();
}

function renderSupportCards() {
    renderCardList("playerCards", supportPlayer, "Henüz kart seçilmedi");
    renderCardList("dealerCards", supportDealer, "Henüz kart seçilmedi");
}

function renderCardList(elementId, cards, emptyText) {
    const element = document.getElementById(elementId);

    if (!cards.length) {
        element.innerHTML = `<span class="empty-card">${emptyText}</span>`;
        return;
    }

    element.innerHTML = cards.map(card => `
        <div class="playing-card ${isRedSuit(card.suit) ? "red" : ""}">
            <span>${card.rank}</span>
            <span class="suit">${card.suit}</span>
        </div>
    `).join("");
}

// =====================================================
// BASIC STRATEGY
// =====================================================

function getStrategy(playerHand, dealerHand) {
    if (!playerHand.length || !dealerHand.length) {
        return {
            action: "WAIT",
            title: "Kartlarını seç",
            description: "Önce kendi kartlarını ve dağıtıcının açık kartını seç."
        };
    }

    const player = handValue(playerHand);
    const dealer = handValue(dealerHand);

    const total = player.total;
    const dealerUp = dealer.total;

    if (total > 21) {
        return {
            action: "LOSE",
            title: "Bust!",
            description: "Toplamın 21'i geçti. Bu el kaybedilmiş."
        };
    }

    if (isBlackjack(playerHand)) {
        return {
            action: "STAND",
            title: "BLACKJACK!",
            description: "İki kartla 21 yaptın. Kart çekmene gerek yok."
        };
    }

    const dealerWeak = dealerUp >= 2 && dealerUp <= 6;
    const dealerStrong = dealerUp >= 7 && dealerUp <= 11;

    // Pairs
    if (playerHand.length === 2 && playerHand[0].rank === playerHand[1].rank) {
        const pair = playerHand[0].rank;

        if (pair === "A" || pair === "8") {
            return {
                action: "SPLIT",
                title: "SPLIT",
                description: "Bu çifti iki ayrı ele bölmek genellikle en iyi seçenektir."
            };
        }

        if (pair === "10" || ["J", "Q", "K"].includes(pair)) {
            return {
                action: "STAND",
                title: "STAND",
                description: "20 puanla kalmak en mantıklı seçimdir."
            };
        }

        if (pair === "9") {
            if ([2, 3, 4, 5, 6, 8, 9].includes(dealerUp)) {
                return {
                    action: "SPLIT",
                    title: "SPLIT",
                    description: "9 çiftini iki ele ayırmak avantaj sağlayabilir."
                };
            }

            return {
                action: "STAND",
                title: "STAND",
                description: "Mevcut 18 puanla kal."
            };
        }

        if (pair === "7") {
            if (dealerUp <= 7) {
                return {
                    action: "SPLIT",
                    title: "SPLIT",
                    description: "7 çiftini ayırmak iyi bir seçenektir."
                };
            }
        }

        if (pair === "6") {
            if (dealerUp <= 6) {
                return {
                    action: "SPLIT",
                    title: "SPLIT",
                    description: "6 çiftini ayırabilirsin."
                };
            }
        }

        if (pair === "4") {
            if (dealerUp >= 5 && dealerUp <= 6) {
                return {
                    action: "SPLIT",
                    title: "SPLIT",
                    description: "Bu durumda çifti ayırmak değerlendirilebilir."
                };
            }
        }

        if (pair === "2" || pair === "3") {
            if (dealerUp <= 7) {
                return {
                    action: "SPLIT",
                    title: "SPLIT",
                    description: "Düşük çiftini ayırmak avantajlı olabilir."
                };
            }
        }
    }

    // Soft hands
    if (player.soft) {
        if (total >= 19) {
            return {
                action: "STAND",
                title: "STAND",
                description: "Güçlü bir elin var. Olduğun yerde kal."
            };
        }

        if (total === 18) {
            if (dealerUp >= 9) {
                return {
                    action: "HIT",
                    title: "HIT",
                    description: "Dağıtıcının güçlü kartına karşı elini geliştirmeyi dene."
                };
            }

            return {
                action: "STAND",
                title: "STAND",
                description: "18 puanla kalmak uygun."
            };
        }

        return {
            action: "HIT",
            title: "HIT",
            description: "Elin esnek. Kart çekmek genellikle mantıklı."
        };
    }

    // Hard hands
    if (total >= 17) {
        return {
            action: "STAND",
            title: "STAND",
            description: "17 veya üzerindesin. Kart çekmek riskli."
        };
    }

    if (total >= 13 && total <= 16) {
        if (dealerWeak) {
            return {
                action: "STAND",
                title: "STAND",
                description: "Dağıtıcının zayıf kartına karşı kal."
            };
        }

        return {
            action: "HIT",
            title: "HIT",
            description: "Dağıtıcının güçlü kartına karşı elini geliştir."
        };
    }

    if (total === 12) {
        if (dealerUp >= 4 && dealerUp <= 6) {
            return {
                action: "STAND",
                title: "STAND",
                description: "Dağıtıcının zayıf kartına karşı kal."
            };
        }

        return {
            action: "HIT",
            title: "HIT",
            description: "12 puanla kart çekmek daha uygun."
        };
    }

    return {
        action: "HIT",
        title: "HIT",
        description: "Düşük toplamını yükseltmek için kart çek."
    };
}

function updateAdvice() {
    const adviceElement = document.getElementById("advice");

    const result = getStrategy(supportPlayer, supportDealer);

    const colors = {
        HIT: "#75b9ed",
        STAND: "#75d6a8",
        SPLIT: "#d6bd75",
        LOSE: "#f08a8a",
        WAIT: "#929292"
    };

    adviceElement.innerHTML = `
        <div style="font-size:10px; font-weight:900; letter-spacing:1px; color:${colors[result.action] || "#fff"}; margin-bottom:8px;">
            ${result.action}
        </div>
        <strong>${result.title}</strong>
        <div style="margin-top:6px;">${result.description}</div>
    `;
}

// =====================================================
// SUPPORT RESULT
// =====================================================

function recordResult(result) {
    if (!supportPlayer.length || !supportDealer.length) {
        showToast("Önce iki tarafın kartlarını seç!");
        return;
    }

    addResult(result);
    resetSupport();
    showToast("Sonuç kaydedildi!");
}

// =====================================================
// DECK
// =====================================================

function createDeck(deckCount) {
    const deck = [];

    for (let i = 0; i < deckCount; i++) {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                deck.push(makeCard(rank, suit));
            }
        }
    }

    return shuffle(deck);
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

function drawCard(hand) {
    if (!gameDeck.length) {
        gameDeck = createDeck(getDeckCount());
    }

    const card = gameDeck.pop();
    hand.push(card);

    return card;
}

function getDeckCount() {
    if (currentDifficulty === "easy") return 1;
    if (currentDifficulty === "normal") return 4;
    return 6;
}

// =====================================================
// GAME START
// =====================================================

function startGame() {
    currentDifficulty = document.getElementById("difficulty").value;

    gameDeck = createDeck(getDeckCount());

    gamePlayer = [];
    gameDealer = [];

    gameActive = true;
    gameFinished = false;

    drawCard(gamePlayer);
    drawCard(gameDealer);
    drawCard(gamePlayer);
    drawCard(gameDealer);

    document.getElementById("gameMessage").textContent =
        "Sıra sende. HIT veya STAND seç.";

    updateGame();

    document.getElementById("hitButton").disabled = false;
    document.getElementById("standButton").disabled = false;

    if (isBlackjack(gamePlayer) || isBlackjack(gameDealer)) {
        finishInitialHand();
    }
}

function finishInitialHand() {
    const playerBJ = isBlackjack(gamePlayer);
    const dealerBJ = isBlackjack(gameDealer);

    if (playerBJ && dealerBJ) {
        finishGame("push", "İki taraf da Blackjack! Berabere.");
    } else if (playerBJ) {
        finishGame("win", "BLACKJACK! Kazandın!");
    } else if (dealerBJ) {
        finishGame("lose", "Dağıtıcı Blackjack yaptı. Kaybettin.");
    }
}

// =====================================================
// GAME ACTIONS
// =====================================================

function hit() {
    if (!gameActive || gameFinished) return;

    drawCard(gamePlayer);

    const value = handValue(gamePlayer).total;

    updateGame();

    if (value > 21) {
        finishGame("lose", "21'i geçtin. Kaybettin!");
        return;
    }

    if (value === 21) {
        stand();
        return;
    }

    document.getElementById("gameMessage").textContent =
        "Yeni kart geldi. Devam etmek ister misin?";
}

function stand() {
    if (!gameActive || gameFinished) return;

    document.getElementById("gameMessage").textContent =
        "Dağıtıcı oynuyor...";

    dealerTurn();
}

function dealerTurn() {
    while (true) {
        const value = handValue(gameDealer);

        const mustHit =
            value.total < 17 ||
            (value.total === 17 && value.soft && currentDifficulty === "hard");

        if (!mustHit) break;

        drawCard(gameDealer);
    }

    const playerTotal = handValue(gamePlayer).total;
    const dealerTotal = handValue(gameDealer).total;

    updateGame();

    if (dealerTotal > 21) {
        finishGame("win", "Dağıtıcı 21'i geçti. Kazandın!");
    } else if (playerTotal > dealerTotal) {
        finishGame("win", "Kazandın!");
    } else if (playerTotal < dealerTotal) {
        finishGame("lose", "Dağıtıcı kazandı.");
    } else {
        finishGame("push", "Berabere!");
    }
}

// =====================================================
// GAME END
// =====================================================

function finishGame(result, message) {
    if (gameFinished) return;

    gameFinished = true;
    gameActive = false;

    addResult(result);

    document.getElementById("gameMessage").textContent = message;

    document.getElementById("hitButton").disabled = true;
    document.getElementById("standButton").disabled = true;

    updateGame();
}

// =====================================================
// GAME RENDER
// =====================================================

function updateGame() {
    renderGameCards();

    const playerTotal = handValue(gamePlayer).total;
    const dealerTotal = handValue(gameDealer).total;

    document.getElementById("gamePlayerTotal").textContent =
        gamePlayer.length ? playerTotal : 0;

    const hideDealerCard = gameActive && !gameFinished;

    if (hideDealerCard && gameDealer.length > 0) {
        document.getElementById("gameDealerTotal").textContent =
            handValue([gameDealer[0]]).total;
    } else {
        document.getElementById("gameDealerTotal").textContent =
            gameDealer.length ? dealerTotal : 0;
    }

    updateTabs();
}

function renderGameCards() {
    const playerElement = document.getElementById("gamePlayerCards");
    const dealerElement = document.getElementById("gameDealerCards");

    if (!gamePlayer.length) {
        playerElement.innerHTML =
            '<span class="empty-card">Oyun başlamadı</span>';
    } else {
        playerElement.innerHTML = gamePlayer.map(card => `
            <div class="playing-card ${isRedSuit(card.suit) ? "red" : ""}">
                <span>${card.rank}</span>
                <span class="suit">${card.suit}</span>
            </div>
        `).join("");
    }

    if (!gameDealer.length) {
        dealerElement.innerHTML =
            '<span class="empty-card">Oyun başlamadı</span>';
    } else {
        dealerElement.innerHTML = gameDealer.map((card, index) => {
            if (index === 1 && gameActive && !gameFinished) {
                return `
                    <div class="playing-card" style="background:#303030;color:#fff;border:1px solid #666;">
                        <span>?</span>
                        <span class="suit">♠</span>
                    </div>
                `;
            }

            return `
                <div class="playing-card ${isRedSuit(card.suit) ? "red" : ""}">
                    <span>${card.rank}</span>
                    <span class="suit">${card.suit}</span>
                </div>
            `;
        }).join("");
    }
}

// =====================================================
// TAB SYSTEM
// =====================================================

function showPage(page) {
    if (page === "support" && gameActive) {
        showToast("Devam eden bir karşılaşma var!");
        return;
    }

    document.querySelectorAll(".page").forEach(element => {
        element.classList.remove("active");
    });

    document.querySelectorAll(".tab").forEach(element => {
        element.classList.remove("active");
    });

    if (page === "support") {
        document.getElementById("supportPage").classList.add("active");
        document.getElementById("supportTab").classList.add("active");
    } else {
        document.getElementById("gamePage").classList.add("active");
        document.getElementById("gameTab").classList.add("active");
    }
}

function updateTabs() {
    const supportTab = document.getElementById("supportTab");

    supportTab.style.opacity = gameActive ? "0.5" : "1";
}

// =====================================================
// TOAST
// =====================================================

let toastTimeout;

function showToast(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2200);
}

// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    loadStats();
    updateSupport();
    updateGame();

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker.register("./sw.js")
            .catch(error => {
                console.error("Service Worker kaydedilemedi:", error);
            });
    }
});
