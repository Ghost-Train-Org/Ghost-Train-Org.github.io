const express = require("express");
const app = express();

let users = new Set();

// user joins
app.get("/api/join", (req, res) => {
    users.add(req.ip);
    res.json({ ok: true });
});

// user leaves (simple cleanup hack)
app.get("/api/leave", (req, res) => {
    users.delete(req.ip);
    res.json({ ok: true });
});

// get count
app.get("/api/users", (req, res) => {
    res.json({ count: users.size });
});

app.listen(3000, () => console.log("Server running"));
