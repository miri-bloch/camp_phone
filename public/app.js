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

// שם להצגה: מעדיפים את קבוצת הבנות, ואם ריקה — מחלצים שם מהשם המלא
function displayName(attrs) {
    if (attrs.group && String(attrs.group).trim()) {
        return attrs.group;
    }
    const before = String(attrs.name || "").split(/\s*סמינר\s*פוירשטיין/)[0].trim();
    return before || attrs.name || "";
}

// ============================================
// שליפת כל קבוצות סמינר פוירשטיין
// השרת מגביל כל חיפוש לכ-100 תוצאות, ולכן סורקים לפי קידומות
// (1..99). רק קבוצות עם קוד רלוונטי (עד 950) נכללות.
// הקריאות מדורגות אחת-אחת במרווח קצר כדי לא להעמיס על השרת.
// ============================================
const MAX_TEAM_CODE = 950; // אין בנות מעל קוד 950 — הן לא רלוונטיות

// מחלץ את מספר הקבוצה מתוך השם "סמינר פוירשטיין N"
function teamCode(attrs) {
    const name = String(attrs.name || "");
    const m = name.match(/סמינר\s*פוירשטיין\s*(\d+)/);
    return m ? Number(m[1]) : NaN;
}

async function fetchAllFeursteinTeams() {
    const all = new Map(); // slug -> team

    const fetchPrefix = async (prefix) => {
        const url = "https://api.charidy.com/api/v1/campaign/47850/teams?q=" +
            encodeURIComponent("סמינר פוירשטיין " + prefix);
        try {
            const response = await fetch(url);
            if (!response.ok) return;
            const json = await response.json();
            for (const t of (json.data || [])) {
                const attrs = t.attributes || {};
                const code = teamCode(attrs);
                // רק קבוצות פוירשטיין, עם slug, וקוד רלוונטי (עד MAX_TEAM_CODE)
                if (!isFeursteinTeam(attrs) || !attrs.slug) continue;
                if (isNaN(code) || code > MAX_TEAM_CODE) continue;
                all.set(attrs.slug, t);
            }
        } catch (e) {
            // מדלגים על תקלה של קידומת אחת וממשיכים לאחרות
            console.warn("שגיאה בשליפת קידומת", prefix, e);
        }
    };

    // סורקים לפי קידומות 1..99, אחת-אחת ובמרווח קצר בין הקריאות
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let n = 1; n <= 99; n++) {
        await fetchPrefix(String(n));
        // הפסקה קצרה בין הקריאות כדי לא להציף את השרת
        await delay(150);
    }

    return [...all.values()];
}

// ============================================
// הפעלת הדשבורד
// ============================================
async function loadDashboard() {
    try {
        // שולפים את כל קבוצות סמינר פוירשטיין דרך כל הקידומות
        const teams = await fetchAllFeursteinTeams();
        if (teams.length === 0) throw new Error("לא נמצאו קבוצות");

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
                <span class="rank">${index + 1}. ${displayName(attrs)}</span>
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
// הגלילה לא מתאפסת בכל רענון — רק הסכומים מתעדכנים,
// כדי שגם הבנות שבסוף הרשימה יגיעו אליהן.
// ============================================

// סדרת ה-slug הנוכחית ברשימה (לבדיקה אם הסדרה השתנתה)
let tickerSlugs = [];

// בונה את הרשימה אם עדיין לא קיימת, ומחדשת את הסכומים במקום
function buildSideTicker(teams) {
    const list = document.getElementById("side-ticker-list");
    if (!list) return;

    // מסננים רק בנות עם התרמה מעל ₪1
    const aboveOne = teams
        .filter(t => (t.attributes.donated || 0) > 1)
        .sort((a, b) => b.attributes.donated - a.attributes.donated);

    if (aboveOne.length === 0) return;

    const newSlugs = aboveOne.map(t => t.attributes.slug);

    // אם הסדרה זהה למה שכבר מוצג — רק מעדכנים את הסכומים בלי לגעת בגלילה
    if (tickerSlugs.join("|") === newSlugs.join("|") && list.children.length === aboveOne.length * 2) {
        aboveOne.forEach((t, i) => {
            const amt = (t.attributes.donated || 0).toLocaleString();
            const first = list.children[i];
            const second = list.children[i + aboveOne.length];
            if (first) first.querySelector(".t-amount").textContent = "₪ " + amt;
            if (second) second.querySelector(".t-amount").textContent = "₪ " + amt;
        });
        return;
    }

    // הסדרה השתנתה — בונים רשימה חדשה ומתחילים גלילה
    tickerSlugs = newSlugs;

    const itemHtml = aboveOne.map(t => {
        const name = displayName(t.attributes);
        const amt = (t.attributes.donated || 0).toLocaleString();
        return `<li><span class="t-name">${name}</span><span class="t-amount">₪ ${amt}</span></li>`;
    }).join("");

    // משכפלים פעמיים כדי שהגלילה תהיה חלקה ואינסופית
    list.classList.remove("scrolling");
    list.innerHTML = itemHtml + itemHtml;

    // מחשבים אורך גלילה לפי מספר הפריטים
    const itemsPerScreen = Math.max(4, aboveOne.length);
    const durationSeconds = itemsPerScreen * 2.2;

    // מריץ את האנימציה מחדש
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

// רענון נתוני הדשבורד כל 5 דקות (רק כשהדף גלוי).
// הקריאות עצמן מפוזרות אחת-אחת בתוך לולאת השליפה,
// והנתונים מוצגים רק אחרי שכולן חזרו.
setInterval(() => {
    if (!document.hidden) loadDashboard();
}, 300000);