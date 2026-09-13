// ============================================
// שרת Node.js — מגיש דשבורד + מקבל פניות מה-IVR
// ============================================
const express = require('express');
const app = express();
// מאפשר לשרת לקרוא תוכן של בקשת POST
app.use(express.urlencoded({ extended: true }));

// מגיש את קבצי הדשבורד
app.use(express.static("public"));

// ============================================
// נקודת הקצה שה-IVR שולח אליה
// ============================================
app.get("/api/yemot", (req, res) => {
    console.log("התקבלה פנייה מה-IVR:");
    console.log(req.query); // מציג את כל הפרמטרים שנשלחו

    // כרגע רק מדפיסים — נעדכן את המסד בהמשך
    res.send("OK");
});

// הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`השרת רץ בכתובת: http://localhost:${PORT}`);
});