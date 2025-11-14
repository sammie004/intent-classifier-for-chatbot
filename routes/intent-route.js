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
  "open account", "education loan", "business loan", "sme loan", "naira", "₦",
  "customer service", "apply", "requirement", "document", "id card", "bvn"
];

const LAPO_KEYWORDS = [
  "lapo", "lift above poverty", "microfinance organization", "godwin",
  "ehigiamusoe", "founder", "lapo bank", "microfinance bank"
];

const OFF_TOPIC_KEYWORDS = [
  "recipe", "cook", "food", "pizza", "game", "movie", "music", "sport",
  "weather", "joke", "story", "sing", "dance", "play", "netflix",
  "facebook", "instagram", "twitter", "tiktok", "youtube", "politics",
  "religion", "dating", "relationship", "health", "medicine", "doctor",
  "school", "homework", "exam", "travel", "hotel", "flight", "car",
  "phone", "computer", "laptop", "shopping", "fashion", "clothes",
  "celebrity", "artist", "actor", "actress", "film", "series", "show",
  "anime", "manga", "video", "photo", "picture", "meme"
];

const MIN_CONFIDENCE_FOR_DIRECT = 0.55;
const LOW_CONFIDENCE_BANKING_THRESHOLD = 0.30;
const HARD_FALLBACK_THRESHOLD = 0.40;
const MEMORY_RETENTION_MS = 2 * 60 * 60 * 1000; // 2 hours

// ---------- In-memory conversation memory ----------
const conversationMemory = {}; 

// ---------- Memory Cleanup (runs every 15 minutes) ----------
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [userId, data] of Object.entries(conversationMemory)) {
    if (now - data.lastSeen > MEMORY_RETENTION_MS) {
      delete conversationMemory[userId];
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} inactive user sessions`);
  }
}, 15 * 60 * 1000);

// ---------- Utility helpers ----------
function ensureUserRecord(rawUser) {
  let id, name;
  
  if (!rawUser) throw new Error("user missing");
  
  // Handle WhatsApp number format (whatsapp:+1234567890)
  if (typeof rawUser === "string") {
    id = rawUser.replace(/^whatsapp:/, ""); // Remove WhatsApp prefix
    name = null;
  } else if (typeof rawUser === "object") {
    id = rawUser.id || rawUser.user || rawUser.username || rawUser.name || JSON.stringify(rawUser);
    id = id.replace(/^whatsapp:/, "");
    name = rawUser.name || rawUser.displayName || null;
  } else {
    id = String(rawUser).replace(/^whatsapp:/, "");
    name = null;
  }

  // Initialize or update user record
  if (!conversationMemory[id]) {
    conversationMemory[id] = {
      displayName: name,
      context: {
        currentIntent: null,
        pendingAction: null,
        loanType: null,
        accountType: null,
      },
      history: [],
      prefs: { 
        suppressGreetings: false,
        hasGreeted: false
      },
      lastSeen: Date.now(),
      createdAt: Date.now(),
    };
    console.log(`✅ New user session created: ${id}`);
  } else {
    if (name) conversationMemory[id].displayName = name;
    conversationMemory[id].lastSeen = Date.now();
    
    // Reset context if user has been away for more than 30 minutes
    const thirtyMinutes = 30 * 60 * 1000;
    if (Date.now() - conversationMemory[id].lastSeen > thirtyMinutes) {
      conversationMemory[id].context = {
        currentIntent: null,
        pendingAction: null,
        loanType: null,
        accountType: null,
      };
      conversationMemory[id].prefs.hasGreeted = false;
      console.log(`🔄 Reset context for returning user: ${id}`);
    }
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
  const mentionsOffTopic = OFF_TOPIC_KEYWORDS.some(kw => lower.includes(kw));

  if (mentionsOffTopic && !mentionsBanking) {
    return { relevant: false, level: "off-topic", isBanking: false };
  }
  if (mentionsBanking && mentionsLapo) {
    return { relevant: true, level: "very-high", isBanking: true };
  }
  if (mentionsBanking) {
    return { relevant: true, level: "high", isBanking: true };
  }
  if (mentionsLapo) {
    return { relevant: true, level: "medium", isBanking: true };
  }
  
  return { relevant: false, level: "none", isBanking: false };
}

function extractNameIfPresent(message = "") {
  if (!message) return null;
  const lower = message.toLowerCase().trim();

  // Skip clear location patterns like "I am in..." or "I'm at..."
  if (/^i\s*(am|'m)\s+(in|at)\b/i.test(lower)) return null;

  // Name extraction patterns
  const patterns = [
    /my name is\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
    /i am\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
    /i'm\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
    /im\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
    /i is\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
    /the name is\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
    /me is\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
    /call me\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
    /name:\s*([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();

      // Remove trailing punctuation (e.g., "I'm John!" → "John")
      name = name.replace(/[.!?,]+$/, "");

      // Capitalize each part of the name
      return name
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    }
  }

  return null;
}

// ---------- LANGUAGE DETECTION FOR NIGERIAN LANGUAGES ----------
function detectNigerianLanguage(message = "") {
  const lower = message.toLowerCase();

  const yorubaWords = ["ẹ", "rẹ", "jẹ", "ọmọ", "àwọn", "ṣé"];
  const hausaWords = ["sannu", "lafiya", "na", "kai", "kuma"];
  const igboWords = ["nna", "anyị", "bịa", "ihe", "ọzọ"];
  const pidginWords = ["how far", "abeg", "wahala", "na", "you dey"];

  if (yorubaWords.some(w => lower.includes(w))) return "yoruba";
  if (hausaWords.some(w => lower.includes(w))) return "hausa";
  if (igboWords.some(w => lower.includes(w))) return "igbo";
  if (pidginWords.some(w => lower.includes(w))) return "pidgin";

  return "english"; // default
}

function stripRepeatedGreeting(aiText = "", displayName = null, prefs = {}) {
  if (!prefs || !prefs.suppressGreetings) return aiText;
  if (!displayName) return aiText;
  
  const greetRegex = new RegExp(
    `^(good\\s+(morning|afternoon|evening)|hello|hi|hey)[,\\s]*${displayName}[!,\\s]*`,
    "i"
  );
  return aiText.replace(greetRegex, "").trim();
}

// ---------- RESPONSE VALIDATION FUNCTION ----------
function validateResponseRelevance(response = "", userMessage = "", userMemory = {}) {
  const responseLower = response.toLowerCase();
  const messageLower = userMessage.toLowerCase();
  
  // Check if response mentions banking at all
  const responseHasBanking = BANKING_KEYWORDS.some(kw => responseLower.includes(kw));
  const responseHasLapo = LAPO_KEYWORDS.some(kw => responseLower.includes(kw));
  const responseHasOffTopic = OFF_TOPIC_KEYWORDS.some(kw => responseLower.includes(kw));
  
  // User message context
  const messageHasBanking = BANKING_KEYWORDS.some(kw => messageLower.includes(kw));
  const messageHasOffTopic = OFF_TOPIC_KEYWORDS.some(kw => messageLower.includes(kw));
  
  // If user asked about banking but response is off-topic, reject it
  if (messageHasBanking && !responseHasBanking && !responseHasLapo) {
    return {
      isValid: false,
      reason: "Response doesn't address banking query",
      replacement: `I can help you with banking services at LAPO. Could you please clarify what you need — checking your balance, applying for a loan, opening an account, or something else?`
    };
  }
  
  // If response talks about off-topic things when user asked banking question
  if (messageHasBanking && responseHasOffTopic && !responseHasBanking) {
    return {
      isValid: false,
      reason: "Response went off-topic",
      replacement: `Let me help you with your banking needs at LAPO. What would you like to know about — loans, savings accounts, transfers, or our branches?`
    };
  }
  
  // Check for generic/vague responses to specific banking questions
  const specificBankingTerms = ["loan", "balance", "transfer", "account", "savings"];
  const userAskedSpecific = specificBankingTerms.some(term => messageLower.includes(term));
  const responseIsVague = response.length < 50 && !specificBankingTerms.some(term => responseLower.includes(term));
  
  if (userAskedSpecific && responseIsVague) {
    return {
      isValid: false,
      reason: "Response too vague for specific query",
      replacement: `I want to give you the right information about LAPO's banking services. Could you tell me more specifically what you need help with?`
    };
  }
  
  // Response is valid
  return {
    isValid: true,
    reason: "Response is banking-relevant"
  };
}

// ---------- WITTY OFF-TOPIC RESPONSES ----------
const WITTY_OFF_TOPIC = [
  `Ha! I like where your head's at! 😄 But I'm more of a banking whiz than anything else. How about we talk loans, savings, or transfers instead?`,
  `That's a fun question! 🤔 But my expertise is really in LAPO banking services. Can I help you with your account, a loan, or maybe a transfer?`,
  `You know what? I wish I could help with that! 😅 But I'm laser-focused on banking stuff. Need help with savings, loans, or checking your balance?`,
  `Interesting! 💡 But I'm a banking assistant through and through. Want to chat about your finances instead?`,
  `I appreciate the creativity! 😊 However, I specialize in LAPO banking. How about we discuss your account, loans, or transfers?`,
  `That's outside my wheelhouse! 🏦 I'm all about helping with banking needs. Can I assist with savings, loans, or balance inquiries?`,
];

function getRandomOffTopicResponse() {
  return WITTY_OFF_TOPIC[Math.floor(Math.random() * WITTY_OFF_TOPIC.length)];
}

// ---------- Main route ----------
router.post("/intent", async (req, res) => {
  const messageRaw = sanitizeText(req.body.Body || req.body.message); // Twilio sends 'Body'


  const requestStartTime = Date.now();
  
  try {
    // Extract user and message (WhatsApp compatible)
    const rawUser = req.body.From || req.body.user; // Twilio sends 'From'
    const messageRaw = sanitizeText(req.body.Body || req.body.message); // Twilio sends 'Body'
    
    console.log(`📨 Received message from ${rawUser}: "${messageRaw}"`);
    
    if (!messageRaw || !rawUser) {
      console.error("❌ Missing message or user");
      return res.status(400).json({ error: "Both 'Body' and 'From' are required" });
    }

    const { id: userId, record: userMemory } = ensureUserRecord(rawUser);
    const twiml = new MessagingResponse();

    // ---------- Name handling ----------
    const maybeName = extractNameIfPresent(messageRaw);
    // DETECT LANGUAGE
const detectedLanguage = detectNigerianLanguage(messageRaw);
userMemory.context.language = detectedLanguage; // store in memory
console.log(`🌍 Detected language for ${userId}: ${detectedLanguage}`);
    if (maybeName) {
      userMemory.displayName = maybeName;
      userMemory.prefs.hasGreeted = true;
      console.log(`👤 User name set: ${maybeName}`);
      
      twiml.message(`Thanks ${maybeName}! 😊 I'll remember your name. How can I help you with LAPO banking today?`);
      return res.type("text/xml").send(twiml.toString());
    }

    if (messageRaw.toLowerCase().includes("my name") && !messageRaw.toLowerCase().includes("my name is")) {
      if (userMemory.displayName) {
        twiml.message(`Your name is ${userMemory.displayName}! 👋`);
      } else {
        twiml.message(`I don't know your name yet! You can tell me by saying "My name is ..."`);
      }
      return res.type("text/xml").send(twiml.toString());
    }

    // ---------- Check if message is clearly off-topic BEFORE AI call ----------
    const quickRelevanceCheck = checkRelevance(messageRaw);
    
    if (quickRelevanceCheck.level === "off-topic") {
      console.log(`🚫 Off-topic message detected: ${messageRaw}`);
      twiml.message(getRandomOffTopicResponse());
      return res.type("text/xml").send(twiml.toString());
    }

    // ---------- AI Prediction ----------
    console.log(`🤖 Sending to AI: "${messageRaw}"`);
    const reply = await Predict(messageRaw, userId);
    const replyConfidence = typeof reply.confidence === "number" ? reply.confidence : 0;
    
    console.log(`📊 AI Response - Intent: ${reply.intent}, Confidence: ${replyConfidence}`);

    // ---------- VALIDATE RESPONSE RELEVANCE ----------
    const validation = validateResponseRelevance(reply.response || "", messageRaw, userMemory);
    
    if (!validation.isValid) {
      console.log(`⚠️ Response validation failed: ${validation.reason}`);
      twiml.message(validation.replacement);
      return res.type("text/xml").send(twiml.toString());
    }

    // Store interaction to history with better structure
    userMemory.history.push({
      ts: Date.now(),
      userMessage: messageRaw,
      aiReply: reply.response,
      aiIntent: reply.intent,
      aiConfidence: replyConfidence,
      contextSnapshot: { ...userMemory.context } // Store context at this point
    });
    
    // Keep only last 20 interactions to prevent memory bloat
    if (userMemory.history.length > 20) {
      userMemory.history = userMemory.history.slice(-20);
    }

    // Check relevance with enhanced logic
    const msgRel = checkRelevance(messageRaw);
    const resRel = checkRelevance(reply.response || "");
    const msgBankMatches = countKeywordMatches(messageRaw, BANKING_KEYWORDS);
    const resBankMatches = countKeywordMatches(reply.response || "", BANKING_KEYWORDS);
    const messageIsBanking = msgRel.isBanking || msgBankMatches >= 1;
    const responseIsBanking = resRel.isBanking || resBankMatches >= 1;
    const overallRelevant = messageIsBanking || responseIsBanking;

    // Low-confidence banking-related handling
    if (replyConfidence < LOW_CONFIDENCE_BANKING_THRESHOLD && messageIsBanking) {
      const clarificationMsg = `I think you're asking about banking with LAPO. Could you tell me exactly what you want to do?\n\n` +
        `📋 I can help with:\n` +
        `• Checking your balance\n` +
        `• Applying for a loan\n` +
        `• Opening a savings account\n` +
        `• Making transfers\n` +
        `• Finding a branch`;
      
      twiml.message(clarificationMsg);
      return res.type("text/xml").send(twiml.toString());
    }

    // Hard fallback with better guidance
    if (!overallRelevant && replyConfidence < HARD_FALLBACK_THRESHOLD) {
      const userName = userMemory.displayName && !userMemory.prefs.suppressGreetings 
        ? ` ${userMemory.displayName}` 
        : "";
      
      const fallbackMsg = `Hi${userName}! 👋 I specialize in LAPO banking services.\n\n` +
        `I can help you with:\n` +
        `💰 Loans & Credit\n` +
        `💵 Savings Accounts\n` +
        `💸 Transfers & Payments\n` +
        `🏦 Branch Locations\n` +
        `📊 Balance Inquiries\n\n` +
        `What would you like to know?`;
      
      twiml.message(fallbackMsg);
      return res.type("text/xml").send(twiml.toString());
    }

    // Intent correction with memory context
    let correctedIntent = reply.intent || "general_inquiry";
    
    if ((reply.intent === "greeting" || replyConfidence < 0.35) && messageIsBanking) {
      correctedIntent = "banking_inquiry";
    }
    
    // Update context based on detected intent
    userMemory.context.currentIntent = correctedIntent;
    
    if (correctedIntent === "loan") {
      userMemory.context.pendingAction = "loan_application";
    } else if (correctedIntent === "savings") {
      userMemory.context.pendingAction = "account_opening";
    } else if (correctedIntent === "balance") {
      userMemory.context.pendingAction = "balance_check";
    }

    // Enrichment based on specific queries
    let enhancedResponse = (reply.response || "").trim();
    const lowerMsg = messageRaw.toLowerCase();

    // Education loan enrichment
    if ((lowerMsg.includes("education") || lowerMsg.includes("student") || lowerMsg.includes("school")) && 
        (lowerMsg.includes("loan") || lowerMsg.includes("borrow"))) {
      if (!enhancedResponse.toLowerCase().includes("education loan")) {
        enhancedResponse += `\n\n🎓 *LAPO Education Loan*\n` +
          `We help students and parents cover:\n` +
          `• School fees\n` +
          `• Books & materials\n` +
          `• Accommodation\n\n` +
          `Would you like to know the eligibility requirements or speak with a loan officer?`;
      }
      userMemory.context.loanType = "education";
    }
    
    // Business loan enrichment
    else if ((lowerMsg.includes("business") || lowerMsg.includes("sme") || lowerMsg.includes("trading")) && 
             lowerMsg.includes("loan")) {
      if (!enhancedResponse.toLowerCase().includes("business")) {
        enhancedResponse += `\n\n💼 *LAPO Business/SME Loan*\n` +
          `Perfect for traders and entrepreneurs!\n` +
          `• Flexible repayment terms\n` +
          `• Competitive interest rates\n` +
          `• Quick approval process\n\n` +
          `Want to check eligibility or connect with a loan officer?`;
      }
      userMemory.context.loanType = "business";
    }
    
    // Savings account enrichment
    else if (lowerMsg.includes("open") && (lowerMsg.includes("account") || lowerMsg.includes("savings"))) {
      if (!enhancedResponse.toLowerCase().includes("open")) {
        enhancedResponse += `\n\n💰 *Open a LAPO Savings Account*\n\n` +
          `📄 Requirements:\n` +
          `• Valid ID (National ID, Driver's License, or Passport)\n` +
          `• Proof of address\n` +
          `• Passport photograph\n` +
          `• Minimum opening deposit\n\n` +
          `Would you like the nearest branch location or the full application process?`;
      }
      userMemory.context.accountType = "savings";
    }

    // Strip repeated greetings if user has been greeted
    if (userMemory.prefs.hasGreeted && userMemory.displayName) {
      enhancedResponse = stripRepeatedGreeting(enhancedResponse, userMemory.displayName, userMemory.prefs);
    } else if (correctedIntent === "greeting") {
      userMemory.prefs.hasGreeted = true;
    }

    // Add help prompt for low confidence
    if (replyConfidence < 0.45 && overallRelevant && 
        !enhancedResponse.toLowerCase().includes("tell me how") &&
        !enhancedResponse.toLowerCase().includes("officer")) {
      enhancedResponse += `\n\n💡 _Need more details? Reply "Tell me more" or "Connect me to an officer"_`;
    }

    // Truncate if too long (WhatsApp has limits)
    if (enhancedResponse.length > 1600) {
      enhancedResponse = enhancedResponse.slice(0, 1596) + "...";
    }

    // Update memory context
    userMemory.context.lastIntent = correctedIntent;
    userMemory.context.lastConfidence = replyConfidence;
    userMemory.context.lastMessageTime = Date.now();

    // ---------- Send Twilio/WhatsApp response ----------
    twiml.message(enhancedResponse);
    
    const processingTime = Date.now() - requestStartTime;
    console.log(`✅ Response sent to ${userId} in ${processingTime}ms`);
    console.log(`💬 Response: "${enhancedResponse.substring(0, 100)}..."`);
    
    return res.type("text/xml").send(twiml.toString());

  } catch (err) {
    console.error("❌ Error in /intent route:", err);
    console.error("Stack trace:", err.stack);
    
    const twiml = new MessagingResponse();
    twiml.message(
      `Oops! 😅 Something went wrong on my end. This has been logged.\n\n` +
      `Please try again or contact LAPO customer service at:\n` +
      `📞 0700-LAPO-MFB\n` +
      `📧 info@lapo-nigeria.org`
    );
    
    return res.type("text/xml").status(500).send(twiml.toString());
  }
});

// ---------- Health check endpoint ----------
router.get("/health", (req, res) => {
  const activeUsers = Object.keys(conversationMemory).length;
  const totalInteractions = Object.values(conversationMemory)
    .reduce((sum, user) => sum + user.history.length, 0);
  
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    activeUsers,
    totalInteractions,
    memoryRetentionMs: MEMORY_RETENTION_MS
  });
});

// ---------- Debug endpoint (remove in production) ----------
router.get("/debug/memory/:userId", (req, res) => {
  const userId = req.params.userId.replace(/^whatsapp:/, "");
  const memory = conversationMemory[userId];
  
  if (!memory) {
    return res.status(404).json({ error: "User not found" });
  }
  
  res.json({
    userId,
    displayName: memory.displayName,
    context: memory.context,
    historyCount: memory.history.length,
    recentHistory: memory.history.slice(-5),
    lastSeen: new Date(memory.lastSeen).toISOString(),
    sessionAge: Date.now() - memory.createdAt
  });
});

module.exports = router;