// ============================================
// דשבורד — לקוח
// הדפדפן קורא את הנתונים מהשרת שלנו (/api/dashboard),
// והשרת הוא זה שמדבר עם צ'רידי פעם אחת ושומר במטמון.
// כך כל המשתמשים מקבלים את אותם נתונים מיד, בלי להעמיס על צ'רידי.
// ============================================
const GOAL = 941 * 4800; // = 4,516,800

// ============================================
// שכבת טעינה
// צגת רקע מטושטש על כל המסך עד שהנתונים האמיתיים מגיעים,
// כך שלא רואים את ה־"₪ 0" בזמן ההמתנה. מהבהב הלוגו בטעינה.
// ============================================
function showLoading() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.classList.remove("hidden");
}

function hideLoading() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.classList.add("hidden");
}

// ============================================
// טעינת הדשבורד מהשרת
// ============================================
async function loadDashboard() {
    try {
        // שולפים את הנתונים המוכנים מהשרת שלנו (מהיר — נתונים כבר שמורים)
        const response = await fetch("/api/dashboard");
        if (!response.ok) throw new Error(`שגיאת שרת: ${response.status}`);
        const data = await response.json();
        renderFromServer(data);
    } catch (err) {
        console.error("שגיאה בטעינת נתונים:", err);
    }
}

// ============================================
// נתונים עדכניים לשימוש ברשימה הדינמית
// ============================================
let lastTeams = [];

function rememberData(teams) {
    lastTeams = teams;
}

// ============================================
// רשימה דינמית בצד — כל הבנות עם התרמה מעל ₪1
// הגלילה לא מתאפסת בכל רענון — רק הסכומים מתעדכנים,
// כדי שגם הבנות שבסוף הרשימה יגיעו אליהן.
// ============================================

// סדרת השמות הנוכחית ברשימה (לבדיקה אם הסדרה השתנתה)
let tickerSlugs = [];

// בונה את הרשימה אם עדיין לא קיימת, ומחדשת את הסכומים במקום
function buildSideTicker(items) {
    const list = document.getElementById("side-ticker-list");
    if (!list) return;

    const aboveOne = items ? items.slice() : [];
    if (aboveOne.length === 0) return;

    const newSlugs = aboveOne.map(item => item.name);

    // אם הסדרה זהה למה שכבר מוצג — רק מעדכן את הסכומים בלי לגעת בגלילה
    if (tickerSlugs.join("|") === newSlugs.join("|") && list.children.length === aboveOne.length * 2) {
        aboveOne.forEach((item, i) => {
            const amt = item.amount.toLocaleString();
            const first = list.children[i];
            const second = list.children[i + aboveOne.length];
            if (first) first.querySelector(".t-amount").textContent = "₪ " + amt;
            if (second) second.querySelector(".t-amount").textContent = "₪ " + amt;
        });
        return;
    }

    // הסדרה השתנתה — בונים רשימה חדשה ומתחילים גלילה
    tickerSlugs = newSlugs;

    const itemHtml = aboveOne.map(item => {
        const amt = item.amount.toLocaleString();
        return `<li><span class="t-name">${item.name}</span><span class="t-amount">₪ ${amt}</span></li>`;
    }).join("");

    // משכפלים פעמיים כדי שהגלילה תהיה חלקה ואינסופית
    list.classList.remove("scrolling");
    list.innerHTML = itemHtml + itemHtml;

    // קצב קבוע (~0.47 שניות לפריט) כך שגם עם רשימה ארוכה
    // כל הבנות עוברות במחזור סביר של כחמש דקות, ולא ~23 דקות.
    const durationSeconds = Math.max(20, Math.round(aboveOne.length * 0.47));

    void list.offsetWidth; // forcing reflow
    list.style.animationDuration = durationSeconds + "s";
    list.classList.add("scrolling");
}

function updateSideTicker(items) {
    if (items && items.length > 0) buildSideTicker(items);
    else if (lastTeams.length > 0) buildSideTicker(lastTeams);
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
// אם השרת עוד בשליפה הראשונה (טעינה ראשונה, לא קיים מטמון),
// נמשיך לבדוק כמה פעמים עד שהנתונים המלאים מגיעים.
// ============================================
async function init() {
    // מראים את שכבת הטעינה עד שנתונים אמיתיים מגיעים
    showLoading();
    await loadDashboard();
    // אם בטעינה הראשונה אין עדיין נתונים (השרת עדיין בונה מטמון)
    // — ממשיך לבדוק כל 5 שניות עד שהנתונים המלאים מגיעים
    let attempts = 0;
    while (lastTeams.length === 0 && attempts < 60) {
        attempts++;
        await new Promise((r) => setTimeout(r, 5000));
        try {
            const res = await fetch("/api/dashboard");
            if (res.ok) {
                const data = await res.json();
                if ((data.top || []).length > 0) {
                    renderFromServer(data);
                    break;
                }
            }
        } catch (e) {
            // נמשיך לבדוק בכל מקרה
        }
    }
}

function renderFromServer(data) {
    // הגיעו נתונים אמיתיים — מסירים את שכבת הטעינה והמסך מתמקד
    hideLoading();

    document.getElementById("total-amount").textContent =
        "₪ " + Number(data.total || 0).toLocaleString();
    document.getElementById("target").textContent =
        "₪ " + GOAL.toLocaleString();
    const percent = GOAL > 0 ? Math.round((data.total / GOAL) * 100) : 0;
    document.getElementById("progress").textContent = percent + "%";
    document.getElementById("progress-fill").style.width = Math.min(percent, 100) + "%";

    const topList = document.getElementById("top-list");
    topList.innerHTML = "";
    (data.top || []).forEach((item, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <span class="rank">${index + 1}. ${item.name}</span>
            <span class="amount">₪ ${item.amount.toLocaleString()}</span>
        `;
        topList.appendChild(li);
    });

    buildSideTicker(data.ticker || []);
    updateSideTicker(data.ticker || []);
    rememberData(data.ticker || []);
}

init();
