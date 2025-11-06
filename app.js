const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { MessagingResponse } = require("twilio").twiml;

const app = express();

// Twilio sends data as form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ---------- WhatsApp webhook ----------
app.post("/whatsapp", async (req, res) => {
    const incomingMsg = req.body.Body;   // Message sent by user
    const from = req.body.From;          // WhatsApp number of sender

    console.log("Incoming message from", from, ":", incomingMsg);

    if (!incomingMsg || !from) {
        const twiml = new MessagingResponse();
        twiml.message("Sorry, we could not read your message.");
        return res.type("text/xml").send(twiml.toString());
    }

    try {
        // Call your intent classifier API
        const response = await axios.post("https://intent-classifier-for-chatbot.onrender.com/api/intent", {
            user: from,
            message: incomingMsg
        });

        const aiReply = response.data.response || "I didn't understand that.";

        // Respond to WhatsApp in TwiML
        const twiml = new MessagingResponse();
        twiml.message(aiReply);

        return res.type("text/xml").send(twiml.toString());
    } catch (err) {
        console.error("Error calling intent API:", err.message || err);
        const twiml = new MessagingResponse();
        twiml.message("Sorry, I couldn't process your message.");
        return res.type("text/xml").status(500).send(twiml.toString());
    }
});

// Optional: Test endpoint
app.get("/", (req, res) => {
    res.send("Server is running...");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
