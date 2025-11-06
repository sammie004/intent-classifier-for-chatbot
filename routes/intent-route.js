// routes/intent.js
const express = require("express");
const router = express.Router();
const { Predict } = require("../sub-main/submain");

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

const MIN_CONFIDENCE_FOR_DIRECT = 0.55; // when detectIntents already good enough
const LOW_CONFIDENCE_BANKING_THRESHOLD = 0.30; // when model low-conf but msg is banking related
const HARD_FALLBACK_THRESHOLD = 0.40; // when both irrelevant and low confidence => fallback

// ---------- In-memory conversation memory ----------
// structure: conversationMemory[userId] = { displayName, context: {}, history: [], prefs: {} }
const conversationMemory = {};

// ---------- Utility helpers ----------
function ensureUserRecord(rawUser) {
  // rawUser can be: "samuel"  OR  { id: "u123", name: "Samuel" }
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
      prefs: {
        suppressGreetings: false, // user preference: avoid "Hello X" every reply
      },
      lastSeen: Date.now(),
    };
  } else {
    // update displayName if provided now
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
  let count = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) count++;
  }
  return count;
}

function checkRelevance(text = "") {
  const lower = (text || "").toLowerCase();
  const mentionsLapo = LAPO_KEYWORDS.some((kw) => lower.includes(kw));
  const mentionsBanking = BANKING_KEYWORDS.some((kw) => lower.includes(kw));

  if (mentionsBanking && mentionsLapo) return { relevant: true, level: "very-high" };
  if (mentionsBanking) return { relevant: true, level: "high" };
  if (mentionsLapo) return { relevant: true, level: "medium" };
  return { relevant: false, level: "none" };
}

function extractNameIfPresent(message = "") {
  // naive extraction: "my name is samuel" / "i am samuel" / "call me samuel"
  const lower = message.toLowerCase();
  const namePatterns = [
    /my name is\s+([a-zA-Z]{2,20})/i,
    /i am\s+([a-zA-Z]{2,20})/i,
    /i'm\s+([a-zA-Z]{2,20})/i,
    /call me\s+([a-zA-Z]{2,20})/i,
    /name:\s*([a-zA-Z]{2,20})/i
  ];
  for (const p of namePatterns) {
    const m = lower.match(p);
    if (m && m[1]) {
      // capitalize first letter
      return m[1].charAt(0).toUpperCase() + m[1].slice(1);
    }
  }
  return null;
}

function stripRepeatedGreeting(aiText = "", displayName = null, prefs = {}) {
  // If user prefers no greeting, remove leading greeting like "Good morning, Sam!" or "Hello Sam,"
  if (!prefs || !prefs.suppressGreetings) return aiText;
  if (!displayName) return aiText;
  const greetRegex = new RegExp(`^(good\\s(morning|afternoon|evening)|hello|hi|hey)[,\\s]*${displayName}[,\\s]*`, "i");
  return aiText.replace(greetRegex, "").trim();
}

// ---------- Main route ----------
router.post("/intent", async (req, res) => {
  try {
    const rawUser = req.body.user;
    const messageRaw = sanitizeText(req.body.message || "");
    if (!messageRaw || !rawUser) {
      return res.status(400).json({ error: "Both 'message' and 'user' are required" });
    }

    // normalize user and ensure memory
    const { id: userId, record: userMemory } = ensureUserRecord(rawUser);

    // update displayName if user said "my name is X" in the message
    const maybeName = extractNameIfPresent(messageRaw);
    if (maybeName) {
      userMemory.displayName = maybeName;
    }

    // run your predictor
    const reply = await Predict(messageRaw, userId); // keep passing userId so Predict can use it if desired
    // reply expected: { intent, confidence, response, ... }
    const replyConfidence = typeof reply.confidence === "number" ? reply.confidence : 0;

    // store interaction to history (keep last 20)
    userMemory.history.push({ ts: Date.now(), userMessage: messageRaw, aiReply: reply.response, aiIntent: reply.intent, aiConfidence: replyConfidence });
    if (userMemory.history.length > 50) userMemory.history = userMemory.history.slice(-30);

    // Compute relevance for message and response
    const msgRel = checkRelevance(messageRaw);
    const resRel = checkRelevance(reply.response || "");

    // Heuristic: keyword counts (useful for borderline cases)
    const msgBankMatches = countKeywordMatches(messageRaw, BANKING_KEYWORDS);
    const resBankMatches = countKeywordMatches(reply.response || "", BANKING_KEYWORDS);

    // Combined signals
    const messageIsBanking = msgRel.relevant || msgBankMatches >= 1;
    const responseIsBanking = resRel.relevant || resBankMatches >= 1;
    const overallRelevant = messageIsBanking || responseIsBanking;

    // --- Smart handling: low-confidence but message is banking-related ---
    if (replyConfidence < LOW_CONFIDENCE_BANKING_THRESHOLD && messageIsBanking) {
      // Instead of sending low-confidence AI reply, force a helpful banking clarification.
      const display = userMemory.displayName || userId;
      return res.json({
        intent: "banking_inquiry",
        confidence: replyConfidence,
        response: `I think you’re asking about banking with LAPO. Could you tell me exactly what you want to do — open an account, check balance, apply for a loan, or something else?`,
        memoryContext: {
          displayName: userMemory.displayName || null,
          lastIntentGuess: reply.intent || null,
        }
      });
    }

    // --- If neither message nor response looks relevant and confidence is low => hard fallback ---
    if (!overallRelevant && (replyConfidence ?? 0) < HARD_FALLBACK_THRESHOLD) {
      const display = userMemory.displayName || userId;
      return res.json({
        intent: "webhook_fallback",
        confidence: replyConfidence || 0,
        response: `Hi${userMemory.displayName && !userMemory.prefs.suppressGreetings ? " " + userMemory.displayName : ""}! I specialize in LAPO banking services (loans, savings, transfers, branches). Could you rephrase to a banking-related question?`,
        memoryContext: {
          displayName: userMemory.displayName || null,
        }
      });
    }

    // --- Intent correction: if AI said greeting or low-confidence and message strongly indicates banking, correct intent ---
    let correctedIntent = reply.intent || "webhook_fallback";
    if ((reply.intent === "greeting" || replyConfidence < 0.35) && messageIsBanking) {
      correctedIntent = "banking_inquiry";
    }

    // --- Enrichment: auto-insert helpful info for common topics (education loan, business loan, savings) ---
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

    // If AI's response starts with a greeting and user prefers suppressGreetings, strip it
    if (userMemory.prefs && userMemory.prefs.suppressGreetings && userMemory.displayName) {
      enhancedResponse = stripRepeatedGreeting(enhancedResponse, userMemory.displayName, userMemory.prefs);
    }

    // Provide an extra helpful hint if AI responded with low confidence but result is somewhat relevant
    const displayName = userMemory.displayName || userId;
    if (replyConfidence < 0.45 && overallRelevant && !enhancedResponse.toLowerCase().includes("please rephrase")) {
      enhancedResponse += `\n\n(If you want more detailed help, reply with "Tell me how" or "Connect me to an officer".)`;
    }

    // Trim huge responses if any (safety)
    if (enhancedResponse.length > 4000) enhancedResponse = enhancedResponse.slice(0, 3996) + "...";

    // Save correctedIntent into memory context for follow-ups
    userMemory.context.lastIntent = correctedIntent;
    userMemory.context.lastConfidence = replyConfidence;

    // Trim user history to keep memory small
    if (userMemory.history.length > 40) userMemory.history = userMemory.history.slice(-30);

    // Final JSON to return
    return res.json({
      ...reply,
      intent: correctedIntent,
      confidence: replyConfidence,
      response: enhancedResponse,
      memoryContext: {
        displayName: userMemory.displayName || null,
        prefs: userMemory.prefs || {},
        lastIntent: userMemory.context.lastIntent || null
      }
    });

  } catch (err) {
    console.error("Error in /intent route:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
