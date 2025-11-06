const express = require("express");
const bodyParser = require('body-parser');
const app = express();

// Parse JSON and urlencoded form data from Twilio
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import intent route (already handles Twilio XML response)
const predict = require('./routes/intent-route');

// Use your intent route for /api
app.use('/api', predict);

// Optional: forward WhatsApp webhook to /api/intent
app.post("/whatsapp", (req, res) => {
    // Just forward the request to the /api/intent route handler
    req.body.user = req.body.From;
    req.body.message = req.body.Body;
    predict.handle(req, res); // call route handler directly
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
