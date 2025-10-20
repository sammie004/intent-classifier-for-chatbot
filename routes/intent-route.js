const express = require("express");
const router = express.Router();
const { Predict } = require("../sub-main/submain");

router.post("/intent", (req, res) => {
  const { message, user } = req.body;

  if (!message || !user) {
    return res.status(400).json({ error: "Both 'message' and 'user' are required" });
  }

  const reply = Predict(message, user);
  res.json({ reply });
});

module.exports = router;
