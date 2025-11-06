const express = require("express");
const router = express.Router();
const { Predict } = require("../sub-main/submain");

// 🏦 Banking & LAPO keywords for relevance scoring
const BANKING_KEYWORDS = [
  "loan", "bank", "account", "balance", "transfer", "savings", "deposit",
  "withdrawal", "credit", "debit", "branch", "funds", "interest",
  "microfinance", "payment", "repayment", "finance", "eligibility"
];

const LAPO_KEYWORDS = [
  "lapo", "lift above poverty", "microfinance organization", "godwin",
  "ehigiamusoe", "founder", "lapo bank", "microfinance bank",
  "education loan", "business loan", "sme loan"
];

// ✅ Smart keyword relevance check
function checkRelevance(text = "") {
  const lower = text.toLowerCase();
  const mentionsLapo = LAPO_KEYWORDS.some((kw) => lower.includes(kw));
  const mentionsBanking = BANKING_KEYWORDS.some((kw) => lower.includes(kw));

  if (mentionsBanking && mentionsLapo)
    return { relevant: true, level: "very-high" };
  if (mentionsBanking) return { relevant: true, level: "high" };
  if (mentionsLapo) return { relevant: true, level: "medium" };
  return { relevant: false, level: "none" };
}

// 🧠 Memory store for per-user conversation states
const conversationMemory = {};

// 🚀 Main Intent Endpoint
router.post("/intent", async (req, res) => {
  try {
    const { message, user } = req.body;

    if (!message || !user)
      return res
        .status(400)
        .json({ error: "Both 'message' and 'user' are required" });

    // 🔄 Recall previous user conversation
    if (!conversationMemory[user]) {
      conversationMemory[user] = {
        lastMessage: null,
        context: {},
        history: [],
      };
    }

    const userMemory = conversationMemory[user];

    // 🧩 Get AI Prediction
    const reply = await Predict(message, user);
    console.log("💬 AI Reply:", reply);

    // 📚 Update conversation memory
    userMemory.lastMessage = message;
    userMemory.history.push({ userMessage: message, aiReply: reply.response });

    // ✅ Check message & AI response relevance
    const msgRel = checkRelevance(message);
    const resRel = checkRelevance(reply?.response);
    const relevant = msgRel.relevant || resRel.relevant;

    // 🟡 Fallback if completely irrelevant
    if (!relevant && (reply.confidence ?? 0) < 0.4) {
      return res.json({
        intent: "webhook_fallback",
        confidence: reply.confidence || 0.5,
        response: `Hello ${user}, I specialize in LAPO banking services such as loans, savings, and transfers. Could you please rephrase your question to something banking-related?`,
      });
    }

    // ✨ Smart intent correction
    let correctedIntent = reply.intent;
    if (
      (reply.intent === "greeting" || reply.confidence < 0.3) &&
      msgRel.relevant
    ) {
      correctedIntent = "banking_inquiry";
      console.log(`🔁 Intent corrected to '${correctedIntent}' due to context`);
    }

    // ✨ Enriched response logic
    let enhancedResponse = reply.response || "";
    const lowerMsg = message.toLowerCase();

    // 🎓 Education Loan — auto-insert guidance (only if not already handled by submain)
    if (lowerMsg.includes("education loan") && !enhancedResponse.includes("Education Loan")) {
      enhancedResponse += `\n\n🎓 LAPO's *Education Loan* helps students and parents cover school fees, books, and other educational expenses with flexible repayment plans. To apply, simply visit any LAPO branch or start your request through customer support. Would you like me to guide you through the application steps, ${user}?`;
    }

    // 💼 Business / SME Loans (only if not already handled)
    else if ((lowerMsg.includes("business loan") || lowerMsg.includes("sme loan")) && !enhancedResponse.includes("Business")) {
      enhancedResponse += `\n\n💼 LAPO's *Business and SME Loans* are designed for entrepreneurs and traders aiming to expand or restock their businesses. You can start by visiting your nearest branch or contacting a loan officer for eligibility info.`;
    }

    // 💰 Personal Savings / Account Opening (only if not already handled by submain)
    else if (
      (lowerMsg.includes("savings account") || lowerMsg.includes("open account")) &&
      msgRel.level === "very-high" &&
      !enhancedResponse.includes("Savings Account")
    ) {
      enhancedResponse += `\n\n💰 It sounds like you're interested in opening a *Personal Savings Account* with LAPO. That's great! LAPO offers savings accounts designed to help individuals grow their funds securely while enjoying flexible withdrawal options. Would you like me to walk you through the process or requirements, ${user}?`;
    }

    // 🧾 Generic Loan Queries (only if not already detailed)
    else if (lowerMsg.includes("loan") && msgRel.level === "high" && !enhancedResponse.includes("Personal") && !enhancedResponse.includes("Business")) {
      enhancedResponse += `\n\nLAPO offers a range of loans — *Personal, Business, and Education* — all with flexible repayment plans.`;
    }

    // 🏦 LAPO Background Info (only if response is too generic)
    else if (msgRel.level === "medium" && enhancedResponse.length < 100) {
      enhancedResponse += `\n\n🏦 LAPO (Lift Above Poverty Organization) was founded by Dr. Godwin Ehigiamusoe in 1987 to empower individuals through microfinance and social development programs.`;
    }

    // 🧠 Recall-based personalization (if user asked similar question)
    const lastInteraction = userMemory.history[userMemory.history.length - 2];
    if (
      lastInteraction &&
      lastInteraction.userMessage.toLowerCase().includes("loan") &&
      lowerMsg.includes("apply")
    ) {
      enhancedResponse += `\n\nI remember you asked about a loan earlier, ${user}. Would you like to continue from where we stopped?`;
    }

    // 💰 Add savings follow-up context if user previously asked about savings
    if (
      lastInteraction &&
      (lastInteraction.userMessage.toLowerCase().includes("savings") || 
       lastInteraction.userMessage.toLowerCase().includes("account")) &&
      (lowerMsg.includes("yes") || lowerMsg.includes("sure") || lowerMsg.includes("how"))
    ) {
      enhancedResponse += `\n\n📝 Based on our previous conversation about savings, I'm here to help you through the process!`;
    }

    // 🔁 Trim memory to avoid overgrowth
    if (userMemory.history.length > 15) {
      userMemory.history = userMemory.history.slice(-10);
    }

    // ✅ Return improved and context-aware response
    return res.json({
      ...reply,
      intent: correctedIntent,
      response: enhancedResponse,
      memoryContext: userMemory.context,
    });

  } catch (err) {
    console.error("❌ Error in /intent route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;