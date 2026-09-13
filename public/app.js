// ============================================
// הגדרות
// ============================================
const API_URL = "https://api.charidy.com/api/v1/campaign/47850/teams?q=%D7%A4%D7%95%D7%99%D7%A8%D7%A9%D7%98%D7%99%D7%99%D7%9F";
const GOAL = 941 * 4800; // = 4,516,800

// ============================================
// הפעלת הדשבורד
// ============================================
async function loadDashboard() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`שגיאת שרת: ${response.status}`);
        const json = await response.json();
        const teams = json.data || [];

        // === סה"כ גויס ===
        const totalRaised = teams.reduce(
            (sum, t) => sum + (t.attributes.donated_real || 0), 0
        );

        document.getElementById("total-amount").textContent =
            "₪ " + totalRaised.toLocaleString();
        document.getElementById("target").textContent =
            "₪ " + GOAL.toLocaleString();

        const percent = GOAL > 0 ? Math.round((totalRaised / GOAL) * 100) : 0;
        document.getElementById("progress").textContent = percent + "%";
        document.getElementById("progress-fill").style.width =
            Math.min(percent, 100) + "%";

        // === עשרת המובילות ===
        const sorted = teams
            .slice()
            .sort((a, b) => b.attributes.donated_real - a.attributes.donated_real)
            .slice(0, 10);

        const topNames = sorted.map(t => t.attributes.group);

        const topList = document.getElementById("top-list");
        topList.innerHTML = "";
        sorted.forEach((team, index) => {
            const attrs = team.attributes;
            const li = document.createElement("li");
            li.innerHTML = `
                <span class="rank">${index + 1}. ${attrs.group}</span>
                <span class="amount">₪ ${(attrs.donated_real || 0).toLocaleString()}</span>
            `;
            topList.appendChild(li);
        });

        // === שומרים נתונים עדכניים ומציירים בועות ===
        rememberData(teams, topNames);
        spawnBubbles();

    } catch (err) {
        console.error("שגיאה בטעינת נתונים:", err);
    }
}

// ============================================
// בועות רקע — מתחלפות כל כמה שניות
// ============================================
let lastTeams = [];
let lastTopNames = [];
let bubbleTimer = null;

// שומרים את הנתונים העדכניים לשימוש בהחלפת הבועות
function rememberData(teams, topNames) {
    lastTeams = teams;
    lastTopNames = topNames;
}

// בוחרת בנות שלא במובילות ויוצרת מהן בועות שמתחלפות
function spawnBubbles() {
    const bubblesBox = document.getElementById("bubbles");
    if (!bubblesBox) return;

    // בנות שלא בעשרת המובילות
    let pool = lastTeams.filter(t =>
        !lastTopNames.includes(t.attributes.group)
    );

    // אם אין מספיק — לוקחים גם מהמובילות כדי לא להשאיר ריק
    if (pool.length < 8) {
        pool = lastTeams.slice();
    }

    drawRandomBubbles(bubblesBox, pool);
}

// מציירת בועות על רשת — מפוזרות, לא חופפות, בחירה אקראית
function drawRandomBubbles(bubblesBox, pool) {
    bubblesBox.innerHTML = "";

    // בחירה אקראית של עד 25 בנות
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 25);

    // רשת 5x5 כדי לפזר על כל המסך בלי חפיפה
    const cols = 5;
    const rows = 5;

    selected.forEach((team, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        const cellX = (col / cols) * 90 + 2;   // אחוז מרוחב
        const cellY = (row / rows) * 90 + 2;   // אחוז מגובה

        // קטנה אקראית בתוך התא — שלא ייראה "מרובע"
        const jitterX = (Math.random() - 0.5) * 15;
        const jitterY = (Math.random() - 0.5) * 15;

        const attrs = team.attributes;
        const b = document.createElement("div");
        b.className = "bubble";

        b.style.left = (cellX + jitterX) + "%";
        b.style.top = (cellY + jitterY) + "%";

        // גודל אחיד יחסית כדי שלא יחפפו
        const size = 60 + Math.random() * 30;
        b.style.width = size + "px";
        b.style.height = size + "px";

        b.style.animationDelay = (Math.random() * 3) + "s";
        b.style.animationDuration = (2.5 + Math.random() * 2) + "s";

        b.innerHTML = `${attrs.group}<br><small>₪ ${(attrs.donated_real || 0).toLocaleString()}</small>`;
        bubblesBox.appendChild(b);
    });
}

// מחליפה את הבועות כל 15 שניות — בנות אחרות בכל פעם
function startBubbleRotation() {
    if (bubbleTimer) clearInterval(bubbleTimer);
    bubbleTimer = setInterval(() => {
        if (lastTeams.length > 0) {
            spawnBubbles();
        }
    }, 15000);
}

// ============================================
// קונפטי נופל
// ============================================
const confettiColors = ["#ffd700", "#ff5252", "#448aff", "#ffffff", "#ffab00"];
const confettiBox = document.querySelector(".confetti-container");

function spawnConfetti() {
    for (let i = 0; i < 45; i++) {
        const piece = document.createElement("span");
        piece.style.left = Math.random() * 100 + "%";
        piece.style.background = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        piece.style.animationDuration = (Math.random() * 3.5 + 2.5) + "s";
        piece.style.animationDelay = Math.random() * 6 + "s";
        piece.style.width = (Math.random() * 8 + 6) + "px";
        piece.style.height = (Math.random() * 8 + 6) + "px";
        confettiBox.appendChild(piece);
    }
}
spawnConfetti();

// ============================================
// הפעלה
// ============================================
async function init() {
    await loadDashboard();
    startBubbleRotation();
}

init();

// רענון נתוני הדשבורד כל 2 דקות (רק כשהדף גלוי)
setInterval(() => {
    if (!document.hidden) loadDashboard();
}, 120000);