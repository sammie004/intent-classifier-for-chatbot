/**
 * 🤖 LAPO Smart Intent Classifier — Webhook + Smart AI fallback
 */

const { CohereClient } = require("cohere-ai");
const natural = require("natural");
require("dotenv").config();

const cohere = new CohereClient({
  token: process.env.SECRET_KEY || "YOUR_COHERE_API_KEY",
});

// 💬 Intent dictionary
const intents = {
  greeting: ["hi", "hello", "hey", "good morning", "good evening", "yo"],
  balance: ["balance", "account balance", "how much do i have", "check my balance"],
  loan: [
    "loan",
    "borrow",
    "credit",
    "lend",
    "apply for a loan",
    "get a loan",
    "microfinance",
    "loan application",
  ],
  transfer: ["transfer", "send money", "move funds", "send cash", "payment"],
};

// 🧹 Clean the message
function preprocess(text) {
  return text.toLowerCase().replace(/[^\w\s]/gi, "").trim();
}

// 🔎 Detect multiple intents intelligently
function detectIntents(message) {
  const lowerMsg = preprocess(message);
  const scores = {};

  for (const [intent, keywords] of Object.entries(intents)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerMsg.includes(keyword)) score += 1;

      const distance = natural.JaroWinklerDistance(lowerMsg, keyword);
      if (distance > 0.85) score += distance * 0.7;
    }
    scores[intent] = score;
  }

  const sorted = Object.entries(scores)
    .filter(([_, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence =
    total > 0 ? Math.min(1, 0.6 + total * 0.15) : Math.random() * 0.3;

  return {
    detectedIntents: sorted.map(([intent]) => intent),
    confidence: parseFloat(confidence.toFixed(2)),
  };
}

// 🛰️ Robust Webhook trigger
async function callWebhook(intent, user, message) {
  try {
    const res = await fetch("http://localhost:3000/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent, user, message }),
    });

    console.log(`✅ Webhook triggered for "${intent}" — status: ${res.status}`);

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      return data;
    } else {
      const text = await res.text();
      console.warn("⚠️ Webhook returned non-JSON:", text);
      return {
        response: `🟢 Your LAPO request has been forwarded! Someone will assist you shortly, ${user}.`,
      };
    }
  } catch (err) {
    console.error(`❌ Webhook failed for "${intent}":`, err.message);
    return {
      response: `🟢 Your LAPO request has been forwarded! Someone will assist you shortly, ${user}.`,
    };
  }
}

// 🌐 Cohere AI fallback
async function fallbackAIResponse(message, user) {
  try {
    console.log("🛰️ Calling Cohere AI fallback...");

    const response = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: `You are a friendly LAPO banking assistant chatting with ${user}. Respond conversationally and informatively to this: "${message}"`,
      temperature: 0.7,
    });

    return response.text?.trim() || "I'm not quite sure how to respond to that, but I'm here to help! 😊";
  } catch (error) {
    console.error("❌ Cohere webhook error:", error.message);
    return "Sorry, something went wrong while processing that. 😞";
  }
}

// 💬 Intent-specific replies
function getResponseForIntent(intent, user) {
  const hour = new Date().getHours();
  const greetingTime =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  switch (intent) {
    case "greeting":
      return `${greetingTime}, ${user}! 👋`;
    case "balance":
      return `Your current account balance is ₦${(
        45000 + Math.floor(Math.random() * 5000)
      ).toLocaleString()}. 💰`;
    case "loan":
      return `LAPO offers personal and business loans with flexible repayment options. Would you like to begin your loan application, ${user}? 🏦`;
    case "transfer":
      return `Sure ${user}, who would you like to transfer funds to? 💸`;
    default:
      return "";
  }
}

// 🧠 Main Prediction function
async function Predict(message, user) {
  const lowerMsg = preprocess(message);

  // 1️⃣ Banking relevance check
  let isBankingRelated = true;
  try {
    const checkResponse = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: `You are a LAPO banking assistant. Determine if the following message is related to banking or LAPO services. Respond only with "true" or "false": "${message}"`,
      temperature: 0,
    });

    isBankingRelated = checkResponse.text.trim().toLowerCase() === "true";
  } catch (err) {
    console.error("❌ Error checking banking relevance:", err.message);
  }

  // 2️⃣ Off-topic → humorous response
  if (!isBankingRelated) {
    return {
      intent: "off_topic",
      confidence: 1,
      response: `😅 Haha, I'm a LAPO banking assistant, not a sports, music, or trivia expert! But I *can* help you with your account, loans, transfers, or balances, ${user}.`,
    };
  }

  // 3️⃣ LAPO-first handling
  if (lowerMsg.includes("lapo")) {
    const webhookData = await callWebhook("lapo_query", user, message);
    const genericWebhook =
      webhookData?.response?.includes("forwarded") ||
      webhookData?.response?.includes("received your LAPO request");

    if (genericWebhook) {
      const aiReply = await fallbackAIResponse(message, user);
      return {
        intent: "lapo_query",
        confidence: 1,
        response: aiReply,
      };
    }

    return {
      intent: "lapo_query",
      confidence: 1,
      response: webhookData.response,
    };
  }

  // 4️⃣ Detect other intents
  const { detectedIntents, confidence } = detectIntents(message);
  let responseParts = [];

  if (detectedIntents.length > 0 && confidence >= 0.55) {
    for (const intent of detectedIntents) {
      await callWebhook(intent, user, message);
      const resp = getResponseForIntent(intent, user);
      if (resp) responseParts.push(resp);
    }
  }

  // 5️⃣ Unknown content → fallback AI
  if (responseParts.length === 0) {
    const aiReply = await fallbackAIResponse(message, user);
    responseParts.push(aiReply);
  }

  return {
    intent:
      detectedIntents.length > 0
        ? detectedIntents.join("_and_")
        : "webhook_fallback",
    confidence: detectedIntents.length > 0 ? confidence : 0.9,
    response: responseParts.join(" "),
  };
}

module.exports = { Predict };
