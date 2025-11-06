const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { MessagingResponse } = require("twilio").twiml;

const app = express();

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
const predict = require("./routes/intent-route");

// Use your intent route
app.use("/api", predict);

// Generic webhook (for any other platform)
app.post("/api/webhook", async (req, res) => {
  const { intent, user, message } = req.body;

  if (intent === "lapo_query") {
    return res.json({
      response: `Hello ${user}, I received your LAPO request about: "${message}". We'll help you find the nearest branch shortly!`,
    });
  }

  return res.json({ response: `Webhook received intent: ${intent}, message: ${message}` });
});

// WhatsApp route for Twilio Sandbox
app.post("/whatsapp", async (req, res) => {
  const incomingMsg = req.body.Body; // Incoming WhatsApp message
  const fromNumber = req.body.From;  // Sender's WhatsApp number

  console.log(`Received WhatsApp message from ${fromNumber}: ${incomingMsg}`);

  let replyMessage = "Sorry, I couldn't process your message.";

  try {
    // Forward the message to your existing intent API
    const response = await axios.post(
      "https://intent-classifier-for-chatbot.onrender.com/api/intent",
      { message: incomingMsg }
    );

    // Use the reply from your intent API
    replyMessage = response.data.reply || "I got your message!";
  } catch (err) {
    console.error("Error calling intent API:", err.message);
  }

  // Respond to Twilio with TwiML
  const twiml = new MessagingResponse();
  twiml.message(replyMessage);

  res.set("Content-Type", "text/xml");
  res.send(twiml.toString());
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
