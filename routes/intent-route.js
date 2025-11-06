// routes/intent.js
const express = require("express");
const router = express.Router();
const { Predict } = require("../sub-main/submain");
const { MessagingResponse } = require("twilio").twiml;

// ---------- Configuration / keyword lists ----------
const BANKING_KEYWORDS = [
  "loan", "bank", "account", "balance", "transfer", "savings", "deposit",
  "withdrawal", "credit", "debit", "branch", "funds", "interest",
  "microfinance", "payment", "repayment", "finance", "eligibility", "loan officer",
  "open account", "education loan", "business loan", "sme loan"
];

const LAPO_KEYWORDS = [
  "lapo", "lift above poverty", "microfinance organization", "godwin",
  "ehigiamusoe", "founder", "lapo bank", "microfinance bank"
];

const MIN_CONFIDENCE_FOR_DIRECT = 0.55;
const LOW_CONFIDENCE_BANKING_THRESHOLD = 0.30;
const HARD_FALLBACK_THRESHOLD = 0.40;

// ---------- In-memory conversation memory ----------
const conversationMemory = {}; // conversationMemory[userId] = { displayName, context, history, prefs }

// ---------- Utility helpers ----------
function ensureUserRecord(rawUser) {
  let id, name;
  if (!rawUser) throw new Error("user missing");
  if (typeof rawUser === "string") {
    id = rawUser;
    name = null;
  } else if (typeof rawUser === "object") {
    id = rawUser.id || rawUser.user || rawUser.username || rawUser.name || JSON.stringify(rawUser);
    name = rawUser.name || rawUser.displayName || null;
  } else {
    id = String(rawUser);
    name = null;
  }

  if (!conversationMemory[id]) {
    conversationMemory[id] = {
      displayName: name,
      context: {},
      history: [],
      prefs: { suppressGreetings: false },
      lastSeen: Date.now(),
    };
  } else {
    if (name) conversationMemory[id].displayName = name;
    conversationMemory[id].lastSeen = Date.now();
  }

  return { id, record: conversationMemory[id] };
}

function sanitizeText(t = "") {
  if (!t) return "";
  return String(t).trim();
}

function countKeywordMatches(text = "", keywords = []) {
  const lower = text.toLowerCase();
  return keywords.reduce((count, kw) => lower.includes(kw) ? count + 1 : count, 0);
}

function checkRelevance(text = "") {
  const lower = (text || "").toLowerCase();
  const mentionsLapo = LAPO_KEYWORDS.some(kw => lower.includes(kw));
  const mentionsBanking = BANKING_KEYWORDS.some(kw => lower.includes(kw));

  if (mentionsBanking && mentionsLapo) return { relevant: true, level: "very-high" };
  if (mentionsBanking) return { relevant: true, level: "high" };
  if (mentionsLapo) return { relevant: true, level: "medium" };
  return { relevant: false, level: "none" };
}

function extractNameIfPresent(message = "") {
  const lower = message.toLowerCase();
  const patterns = [
    /my name is\s+([a-zA-Z]{2,20})/i,
    /i am\s+([a-zA-Z]{2,20})/i,
    /i'm\s+([a-zA-Z]{2,20})/i,
    /call me\s+([a-zA-Z]{2,20})/i,
    /name:\s*([a-zA-Z]{2,20})/i
  ];
  for (const p of patterns) {
    const m = lower.match(p);
    if (m && m[1]) return m[1].charAt(0).toUpperCase() + m[1].slice(1);
  }
  return null;
}

function stripRepeatedGreeting(aiText = "", displayName = null, prefs = {}) {
  if (!prefs || !prefs.suppressGreetings) return aiText;
  if (!displayName) return aiText;
  const greetRegex = new RegExp(`^(good\\s(morning|afternoon|evening)|hello|hi|hey)[,\\s]*${displayName}[,\\s]*`, "i");
  return aiText.replace(greetRegex, "").trim();
}

// ---------- Main route ----------
router.post("/intent", async (req, res) => {
  try {
    const rawUser = req.body.user || req.body.From;
    const messageRaw = sanitizeText(req.body.message || req.body.Body);
    if (!messageRaw || !rawUser) {
      return res.status(400).json({ error: "Both 'message' and 'user' are required" });
    }

    const { id: userId, record: userMemory } = ensureUserRecord(rawUser);

    // ---------- Name handling ----------
    const maybeName = extractNameIfPresent(messageRaw);
    const twiml = new MessagingResponse();

    if (maybeName) {
      userMemory.displayName = maybeName;
      twiml.message(`Thanks ${maybeName}! I'll remember your name for future chats.`);
      return res.type("text/xml").send(twiml.toString());
    }

    if (messageRaw.toLowerCase().includes("my name")) {
      if (userMemory.displayName) {
        twiml.message(`Your name is ${userMemory.displayName}!`);
      } else {
        twiml.message(`Hey! I don't know your name yet. You can tell me by saying "My name is ..."`);
      }
      return res.type("text/xml").send(twiml.toString());
    }

    // ---------- AI Prediction ----------
    const reply = await Predict(messageRaw, userId);
    const replyConfidence = typeof reply.confidence === "number" ? reply.confidence : 0;

    // Store interaction to history
    userMemory.history.push({
      ts: Date.now(),
      userMessage: messageRaw,
      aiReply: reply.response,
      aiIntent: reply.intent,
      aiConfidence: replyConfidence
    });
    if (userMemory.history.length > 50) userMemory.history = userMemory.history.slice(-30);

    // Check relevance
    const msgRel = checkRelevance(messageRaw);
    const resRel = checkRelevance(reply.response || "");
    const msgBankMatches = countKeywordMatches(messageRaw, BANKING_KEYWORDS);
    const resBankMatches = countKeywordMatches(reply.response || "", BANKING_KEYWORDS);
    const messageIsBanking = msgRel.relevant || msgBankMatches >= 1;
    const responseIsBanking = resRel.relevant || resBankMatches >= 1;
    const overallRelevant = messageIsBanking || responseIsBanking;

    // Low-confidence banking-related handling
    if (replyConfidence < LOW_CONFIDENCE_BANKING_THRESHOLD && messageIsBanking) {
      twiml.message(`I think you’re asking about banking with LAPO. Could you tell me exactly what you want to do — open an account, check balance, apply for a loan, or something else?`);
      return res.type("text/xml").send(twiml.toString());
    }

    // Hard fallback
    if (!overallRelevant && (replyConfidence ?? 0) < HARD_FALLBACK_THRESHOLD) {
      twiml.message(`Hi${userMemory.displayName && !userMemory.prefs.suppressGreetings ? " " + userMemory.displayName : ""}! I specialize in LAPO banking services (loans, savings, transfers, branches). Could you rephrase to a banking-related question?`);
      return res.type("text/xml").send(twiml.toString());
    }

    // Intent correction
    let correctedIntent = reply.intent || "webhook_fallback";
    if ((reply.intent === "greeting" || replyConfidence < 0.35) && messageIsBanking) {
      correctedIntent = "banking_inquiry";
    }

    // Enrichment
    let enhancedResponse = (reply.response || "").trim();
    const lowerMsg = messageRaw.toLowerCase();

    if (lowerMsg.includes("education loan") || lowerMsg.includes("student loan") || lowerMsg.includes("education")) {
      if (!enhancedResponse.toLowerCase().includes("education loan")) {
        enhancedResponse += `\n\n🎓 LAPO’s Education Loan helps students and parents cover school fees and education-related expenses. We can check eligibility or connect you with a loan officer — would you like that?`;
      }
    } else if (lowerMsg.includes("business loan") || lowerMsg.includes("sme loan") || lowerMsg.includes("small business")) {
      if (!enhancedResponse.toLowerCase().includes("business")) {
        enhancedResponse += `\n\n💼 LAPO’s Business/SME loans support traders and entrepreneurs. I can give eligibility details or connect you with a loan officer. Which would you prefer?`;
      }
    } else if ((lowerMsg.includes("open account") || lowerMsg.includes("savings account") || lowerMsg.includes("open a savings"))) {
      if (!enhancedResponse.toLowerCase().includes("open")) {
        enhancedResponse += `\n\n💰 To open a LAPO savings account: you can visit any branch or start with our customer support. Would you like the nearest branch or the required documents?`;
      }
    }

    if (userMemory.prefs && userMemory.prefs.suppressGreetings && userMemory.displayName) {
      enhancedResponse = stripRepeatedGreeting(enhancedResponse, userMemory.displayName, userMemory.prefs);
    }

    if (replyConfidence < 0.45 && overallRelevant && !enhancedResponse.toLowerCase().includes("please rephrase")) {
      enhancedResponse += `\n\n(If you want more detailed help, reply with "Tell me how" or "Connect me to an officer".)`;
    }

    if (enhancedResponse.length > 4000) enhancedResponse = enhancedResponse.slice(0, 3996) + "...";

    // Update memory context
    userMemory.context.lastIntent = correctedIntent;
    userMemory.context.lastConfidence = replyConfidence;

    // ---------- Twilio response ----------
    twiml.message(enhancedResponse);
    return res.type("text/xml").send(twiml.toString());

  } catch (err) {
    console.error("Error in /intent route:", err);
    const twiml = new MessagingResponse();
    twiml.message("Sorry, I couldn't process your message.");
    return res.type("text/xml").status(500).send(twiml.toString());
  }
});

module.exports = router;
