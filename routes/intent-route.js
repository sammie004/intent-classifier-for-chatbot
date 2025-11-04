const express = require("express");
const router = express.Router();
const { Predict } = require("../sub-main/submain");

router.post("/intent", async (req, res) => {
  try {
    const { message, user } = req.body;

    if (!message || !user) {
      return res
        .status(400)
        .json({ error: "Both 'message' and 'user' are required" });
    }

    // ✅ Await the async Predict function
    const reply = await Predict(message, user);

    console.log("Intent Classification Result:", reply);

    // ✅ Send proper JSON response
    return res.json(reply);
  } catch (err) {
    console.error("Error in /intent route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
