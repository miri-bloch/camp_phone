// ============================================
// שרת Node.js — מגיש דשבורד + מקבל פניות מה-IVR
// השרת אחראי על שליפת הנתונים מצ'רידי (פעם אחת),
// שמירתם במטמון, והגשתם לכל המשתמשים — כך ש-Charidy
// מקבלת בין סוללת קריאות אחת, בלי חסימה.
// ============================================
const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));

// מגיש את קבצי הדשבורד
app.use(express.static("public"));

// ============================================
// שליפת כל קבוצות סמינר פוירשטיין מצ'רידי
// ============================================
const CAMPAIGN_ID = 47850;
const BASE = `https://api.charidy.com/api/v1/campaign/${CAMPAIGN_ID}/teams?q=`;
// אין בנות מעל קוד 950 — הן לא רלוונטיות
const MAX_TEAM_CODE = 950;
// כמה אלפיות שנייה בין קריאה לקריאה (פריסה איטית ובטוחה)
const CALL_GAP_MS = 1200;

// מחלץ את מספר הקבוצה מתוך "סמינר פוירשטיין N"
function teamCode(name) {
    const m = String(name || "").match(/סמינר\s*פוירשטיין\s*(\d+)/);
    return m ? Number(m[1]) : NaN;
}

async function fetchAllTeams() {
    const bySlug = new Map();
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    for (let n = 1; n <= 99; n++) {
        const url = BASE + encodeURIComponent("סמינר פוירשטיין " + n);
        try {
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                for (const t of (json.data || [])) {
                    const attrs = t.attributes || {};
                    const code = teamCode(attrs.name);
                    if (!attrs.slug) continue;
                    if (isNaN(code) || code > MAX_TEAM_CODE) continue;
                    bySlug.set(attrs.slug, t);
                }
            }
        } catch (e) {
            console.warn("שגיאה בשליפת קידומת", n, e.message);
        }
        // הפסקה איטית בין הקריאות כדי לא להעמיס/להיחסם
        await delay(CALL_GAP_MS);
    }

    const teams = [...bySlug.values()];
    const total = teams.reduce(
        (sum, t) => sum + Number((t.attributes || {}).donated || 0), 0
    );
    return { teams, total };
}

// ============================================
// מטמון תוצאות — מתעדכן בשרת, מוגש לכולם
// ============================================
const cache = {
    data: null,      // { total, teams }
    updatedAt: null,
    loading: null,   // הבטחה של השליפה הנוכחית (מניעת כפילות)
};

// כמה זמן לשמור את המטמון לפני רענון (10 דקות)
const CACHE_TTL_MS = 10 * 60 * 1000;

// מחזיר את הנתונים מיד; אם המטמון ריק/ישן — יוזם שליפה ברקע
// ומחזיר את מה שיש כרגע (כדי שלא נחכה דקות בטעינה הראשונה).
async function getDashboardData() {
    const now = Date.now();
    const fresh = cache.data && cache.updatedAt && (now - cache.updatedAt < CACHE_TTL_MS);
    if (fresh) return cache.data;

    // אם שליפה כבר רצה — מחזירים מיד את מה שיש עכשיו
    if (!cache.loading) {
        cache.loading = (async () => {
            try {
                console.log("בוחן נתונים מצ'רידי (פעם אחת בשרת)...");
                const { teams, total } = await fetchAllTeams();
                cache.data = { total, teams };
                cache.updatedAt = Date.now();
                console.log("עודכן מטמון: סה\"כ", total, "| קבוצות:", teams.length);
            } catch (e) {
                console.error("שגיאה בשליפת נתונים מצ'רידי:", e.message);
            } finally {
                cache.loading = null;
            }
        })();
    }

    // מחזירים את הנתונים הקיימים (או ערכים ריקים אם אין עדיין כלום)
    return cache.data || { total: 0, teams: [] };
}

// ============================================
// נקודות קצה
// ============================================
// נתוני הדשבורד — כל הדפדפנים קוראים אותם מכאן
app.get("/api/dashboard", async (req, res) => {
    try {
        const data = await getDashboardData();
        res.json({
            total: data.total,
            updatedAt: data.updatedAt,
            teamCount: data.teams.length,
            // שולחים גם נתוני תצוגה (עשרת המובילות + רשימת הגלילה)
            top: data.teams
                .slice()
                .sort((a, b) => Number(b.attributes.donated) - Number(a.attributes.donated))
                .slice(0, 10)
                .map(t => ({ name: displayNameLocal(t.attributes), amount: Number(t.attributes.donated || 0) })),
            ticker: data.teams
                .filter(t => (t.attributes.donated || 0) > 1)
                .map(t => ({ name: displayNameLocal(t.attributes), amount: Number(t.attributes.donated || 0) }))
                .sort((a, b) => b.amount - a.amount),
        });
    } catch (e) {
        console.error("שגיאה בנתוני הדשבורד:", e);
        res.status(500).json({ error: "שגיאה בשליפת נתונים" });
    }
});

// שם להצגה (ערך count between client and server)
function displayNameLocal(attrs) {
    if (attrs.group && String(attrs.group).trim()) return attrs.group;
    const before = String(attrs.name || "").split(/\s*סמינר\s*פוירשטיין/)[0].trim();
    return before || attrs.name || "";
}

// נקודת הקצה שה-IVR שולח אליה
app.get("/api/yemot", (req, res) => {
    console.log("התקבלה פנייה מה-IVR:");
    console.log(req.query);
    res.send("OK");
});

// הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`השרת רץ בכתובת: http://localhost:${PORT}`);
});
