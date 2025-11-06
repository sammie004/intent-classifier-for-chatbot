const express = require("express");
const bodyParser = require('body-parser');
const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true })); // Twilio sends form-urlencoded data

// require your intent route
const predict = require('./routes/intent-route');

// usages
app.use('/api', predict);

// WhatsApp webhook route
app.post("/whatsapp", async (req, res) => {
    const incomingMsg = req.body.Body;      // message sent
    const from = req.body.From;             // sender number

    // Call your intent API
    try {
        const axios = require("axios");
        const response = await axios.post("https://intent-classifier-for-chatbot.onrender.com/api/intent", {
            user: from,
            message: incomingMsg
        });

        // Send Twilio response back in TwiML format
        res.set('Content-Type', 'text/xml');
        return res.send(`
            <Response>
                <Message>${response.data.reply || "I didn't understand that."}</Message>
            </Response>
        `);

    } catch (error) {
        console.error(error);
        res.set('Content-Type', 'text/xml');
        return res.send(`
            <Response>
                <Message>Sorry, I couldn't process your message.</Message>
            </Response>
        `);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
