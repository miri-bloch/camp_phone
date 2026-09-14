// ============================================
// הגדרות
// ============================================
const API_URL = "https://api.charidy.com/api/v1/campaign/47850/teams?q=%D7%A4%D7%95%D7%99%D7%A8%D7%A9%D7%98%D7%99%D7%99%D7%9F";
const GOAL = 941 * 4800; // = 4,516,800

// ============================================
// סינון קבוצות — רק "סמינר פוירשטיין" + מספר
// ============================================
function isFeursteinTeam(attrs) {
    const name = attrs.name || "";
    return /סמינר\s*פוירשטיין\s*\d+/.test(name);
}

// ============================================
// הפעלת הדשבורד
// ============================================
async function loadDashboard() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`שגיאת שרת: ${response.status}`);
        const json = await response.json();
        const rawTeams = json.data || [];

        // מסננים רק קבוצות בשם "סמינר פוירשטיין N"
        const teams = rawTeams.filter(t => isFeursteinTeam(t.attributes));

        // === סה"כ גויס ===
        const totalRaised = teams.reduce(
            (sum, t) => sum + Number(t.attributes.donated || 0), 0
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
            .sort((a, b) => Number(b.attributes.donated) - Number(a.attributes.donated))
            .slice(0, 10);

        const topList = document.getElementById("top-list");
        topList.innerHTML = "";
        sorted.forEach((team, index) => {
            const attrs = team.attributes;
            const li = document.createElement("li");
            li.innerHTML = `
                <span class="rank">${index + 1}. ${attrs.group}</span>
                <span class="amount">₪ ${(attrs.donated || 0).toLocaleString()}</span>
            `;
            topList.appendChild(li);
        });

        // === שומרים נתונים עדכניים ===
        rememberData(teams);
        updateSideTicker();

    } catch (err) {
        console.error("שגיאה בטעינת נתונים:", err);
    }
}

// ============================================
// נתונים עדכניים לשימוש ברשימה הדינמית
// ============================================
let lastTeams = [];

// זוכרת את הנתונים העדכניים לצד הרשימה הצדדית
function rememberData(teams) {
    lastTeams = teams;
}

// ============================================
// רשימה דינמית בצד — כל הבנות עם התרמה מעל ₪1
// ============================================

// בונה את הרשימה בכל שליפה ומפעיל גלילה רציפה
function buildSideTicker(teams) {
    const list = document.getElementById("side-ticker-list");
    if (!list) return;

    // מסננים רק בנות עם התרמה מעל ₪1
    const aboveOne = teams
        .filter(t => (t.attributes.donated || 0) > 1)
        .sort((a, b) => b.attributes.donated - a.attributes.donated);

    if (aboveOne.length === 0) return;

    // מרכיבים רשימה יחידה
    const itemHtml = aboveOne.map(t => {
        const name = t.attributes.group;
        const amt = (t.attributes.donated || 0).toLocaleString();
        return `<li><span class="t-name">${name}</span><span class="t-amount">₪ ${amt}</span></li>`;
    }).join("");

    // משכפלים פעמיים כדי שהגלילה תהיה חלקה ואינסופית
    list.classList.remove("scrolling");
    list.innerHTML = itemHtml + itemHtml;

    // מחשבים אורך גלילה לפי מספר הפריטים
    const itemsPerScreen = Math.max(4, aboveOne.length);
    const durationSeconds = itemsPerScreen * 2.2; // כמה שניות לכל "מסך" של רשימה

    // מריץ את האנימציה מחדש (עם ריסט לבטל אנימציה ישנה)
    void list.offsetWidth; // forcing reflow
    list.style.animationDuration = durationSeconds + "s";
    list.classList.add("scrolling");
}

// נעדכן גם מהקריאה הראשית — נקרא מתוך loadDashboard
function updateSideTicker() {
    if (lastTeams.length > 0) {
        buildSideTicker(lastTeams);
    }
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
}

init();

// רענון נתוני הדשבורד כל 2 דקות (רק כשהדף גלוי)
setInterval(() => {
    if (!document.hidden) loadDashboard();
}, 120000);