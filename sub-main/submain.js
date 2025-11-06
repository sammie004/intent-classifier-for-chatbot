/**
 * 🤖 LAPO Smart Intent Classifier — Webhook + Smart AI fallback + Memory
 */

const { CohereClient } = require("cohere-ai");
const natural = require("natural");
require("dotenv").config();

const cohere = new CohereClient({
  token: process.env.SECRET_KEY || "YOUR_COHERE_API_KEY",
});

// 🧠 In-memory user context store
const userContexts = {};

// 💬 Enhanced Intent dictionary
const intents = {
  greeting: ["hello", "hey", "good morning", "good afternoon", "good evening", "yo", "greetings", "howdy"],
  balance: ["balance", "account balance", "how much do i have", "check my balance", "my balance"],
  loan: [
    "loan",
    "borrow",
    "credit",
    "lend",
    "apply for a loan",
    "get a loan",
    "microfinance",
    "loan application",
    "education loan",
    "business loan",
    "sme loan",
  ],
  transfer: ["transfer", "send money", "move funds", "send cash", "payment", "pay"],
  savings: [
    "savings",
    "save",
    "savings account",
    "open account",
    "create account",
    "new account",
    "personal account",
    "deposit account",
    "fixed deposit",
    "saving money",
    "open a",
    "opening a",
  ],
  branch_info: [
    "branch",
    "branches",
    "location",
    "locations",
    "office",
    "offices",
    "where is",
    "how many",
    "nearest branch",
    "find branch",
    "branch address",
  ],
};

// 🧹 Clean the message
function preprocess(text) {
  return text.toLowerCase().replace(/[^\w\s]/gi, "").trim();
}

// 🔍 Detect intents
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

  // 🎯 Prioritize non-greeting intents if message is longer than 10 words
  const wordCount = lowerMsg.split(/\s+/).length;
  if (wordCount > 10 && scores.greeting > 0) {
    scores.greeting = scores.greeting * 0.3; // Reduce greeting score for long messages
  }

  const sorted = Object.entries(scores)
    .filter(([_, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = total > 0 ? Math.min(1, 0.6 + total * 0.15) : Math.random() * 0.3;

  return {
    detectedIntents: sorted.map(([intent]) => intent),
    confidence: parseFloat(confidence.toFixed(2)),
  };
}

// 🌐 Cohere fallback
async function fallbackAIResponse(message, user) {
  try {
    const response = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: `You are a friendly LAPO banking assistant. Respond conversationally and informatively to this: "${message}". Keep it natural and don't always use the user's name.`,
      temperature: 0.7,
    });

    let text = response.text?.trim() || "";
    const bankingKeywords = [
      "account", "balance", "loan", "transfer", "deposit", "withdraw",
      "credit", "debit", "microfinance", "funds", "payment", "bank", "lapo",
      "branch", "interest", "eligibility", "officer", "savings", "repayment"
    ];

    const isRelevant = bankingKeywords.some(kw => text.toLowerCase().includes(kw));

    if (!isRelevant) {
      const reframed = await cohere.chat({
        model: "command-r-plus-08-2024",
        message: `You are a LAPO Microfinance Bank assistant. Rewrite this response so it relates to banking: "${text}". 
If unrelated, politely redirect the user to banking topics. Be casual and conversational.`,
      });

      text = reframed.text?.trim() || "";
      const stillRelevant = bankingKeywords.some(kw => text.toLowerCase().includes(kw));

      if (!stillRelevant) {
        // 🎲 Witty off-topic responses
        const wittyOffTopicResponses = [
          `Ha! I like where your head's at! 😄 But I'm more of a banking whiz than anything else. How about we talk loans, savings, or transfers instead?`,
          `That's a fun question! 🤔 But my expertise is really in LAPO banking services. Can I help you with your account, a loan, or maybe a transfer?`,
          `You know what? I wish I could help with that! 😅 But I'm laser-focused on banking stuff. Need help with savings, loans, or checking your balance?`,
          `Interesting question! 💡 But here's the thing — I'm a banking assistant through and through. Want to chat about your finances instead?`,
          `I appreciate the creativity! 😊 However, I specialize in LAPO banking. How about we discuss your account, loans, or transfers?`,
          `That's outside my wheelhouse! 🏦 I'm all about helping with banking needs. Can I assist with savings, loans, or balance inquiries?`,
          `Love the question, but that's not really my forte! 😄 I'm here for all things banking — loans, accounts, transfers. What do you need?`,
          `Hmm, not quite my area of expertise! 🤷 But I'm a pro at LAPO banking services. Want to talk savings or loans?`,
        ];
        
        return wittyOffTopicResponses[Math.floor(Math.random() * wittyOffTopicResponses.length)];
      }
    }

    return text;
  } catch (error) {
    console.error("❌ Cohere error:", error.message);
    
    // 🎲 Witty error responses
    const wittyErrorResponses = [
      `Oops! 😅 Something went a bit wonky on my end. Mind trying that again?`,
      `Hmm, my brain had a little hiccup there! 🤖 Could you repeat that?`,
      `Well, that didn't go as planned! 😬 Let's give it another shot?`,
      `Technical difficulties! 🔧 But I'm still here — try asking again?`,
      `Uh oh, hit a snag there! 😳 Can you ask me that one more time?`,
      `My circuits got a bit confused! 🤯 Mind rephrasing that?`,
    ];
    
    return wittyErrorResponses[Math.floor(Math.random() * wittyErrorResponses.length)];
  }
}

// 🧠 Main predictor with memory
async function Predict(message, user) {
  const lowerMsg = preprocess(message);

  // 🧩 Remember user automatically
  if (!user && Object.keys(userContexts).length > 0) {
    // Reuse last user if not explicitly provided
    user = Object.keys(userContexts)[0];
  }

  if (!userContexts[user]) {
    userContexts[user] = { intent: null, name: user };
  }

  const context = userContexts[user];
  let responseParts = [];

  // 🪄 Handle follow-ups (context memory)
  if (context.intent === "loan") {
    if (lowerMsg.includes("yes")) {
      context.step = "loan_type";
      return {
        intent: "loan_start",
        confidence: 1,
        response: "Let's begin your loan application. Which type would you like — Personal, Business, or Microloan?",
      };
    } else if (lowerMsg.includes("no")) {
      context.intent = null;
      return {
        intent: "loan_decline",
        confidence: 1,
        response: "No worries! I'll be here if you decide to apply later.",
      };
    } else if (lowerMsg.includes("education")) {
      return {
        intent: "education_loan",
        confidence: 1,
        response: `🎓 LAPO's Education Loan helps students and parents cover school fees and other expenses. Would you like me to guide you through the application steps?`,
      };
    }
  }

  // Handle savings account follow-ups
  if (context.intent === "savings") {
    if (lowerMsg.includes("yes") || lowerMsg.includes("sure") || lowerMsg.includes("please")) {
      return {
        intent: "savings_application",
        confidence: 1,
        response: `Great! To open a Personal Savings Account with LAPO, you'll need:\n\n✅ Valid ID (National ID, Driver's License, or International Passport)\n✅ Proof of Address\n✅ Passport photograph\n✅ Minimum opening deposit (varies by account type)\n\nYou can visit any LAPO branch or I can connect you with a customer service officer. Which would you prefer?`,
      };
    }
  }

  // 🎯 Detect new intents
  const { detectedIntents, confidence } = detectIntents(message);

  if (detectedIntents.length > 0 && confidence >= 0.55) {
    let primaryIntent = detectedIntents[0];
    
    // 🔍 Comprehensive question detection patterns
    const questionStarters = [
      "can you", "could you", "would you", "will you", "should you",
      "do you", "does", "did you", "have you", "has",
      "are you", "is", "was", "were", "am i",
      "what", "when", "where", "why", "who", "whom", "whose",
      "how", "which", "may i", "might", "shall",
      "tell me", "show me", "explain", "describe",
      "i want to know", "i need to know", "i would like to know",
      "please tell", "can i", "could i", "may i ask"
    ];
    
    const isQuestion = message.includes("?") || questionStarters.some(starter => lowerMsg.startsWith(starter) || lowerMsg.includes(" " + starter));
    const isLongMessage = lowerMsg.split(/\s+/).length > 5;
    
    if (primaryIntent === "greeting" && (isQuestion || isLongMessage)) {
      // Try the next intent if available
      if (detectedIntents.length > 1) {
        primaryIntent = detectedIntents[1];
      } else {
        // Fall back to AI
        const aiReply = await fallbackAIResponse(message, user);
        responseParts.push(aiReply);
        const finalResponse = responseParts.join(" ");
        return {
          user,
          intent: "fallback",
          confidence,
          response: finalResponse,
        };
      }
    }
    
    context.intent = primaryIntent;

    let reply;
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    // 🎲 Random witty responses for variety
    const wittyGreetings = [
      `${greet}! 👋 What can I do for you today?`,
      `Hey there! 😊 How can I assist you?`,
      `${greet}, ${user}! Nice to see you again! 💼`,
      `Hello! Ready to help with your banking needs! 🏦`,
      `Hi! What brings you here today? 🌟`,
      `${greet}! How can I help? 💡`,
      `Hey! 👋 What's on your mind?`,
      `Welcome back! How can I assist you today? 😊`,
    ];

    const wittyFallbacks = [
      `Hmm, that's an interesting question! 🤔 Let me think about that...`,
      `I love your curiosity! 😄 However...`,
      `Great question! 💡 But here's the thing...`,
      `You know what? That's a bit outside my wheelhouse, but...`,
      `Interesting! 🧐 I'm more of a banking expert, so...`,
    ];

    const randomGreeting = () => wittyGreetings[Math.floor(Math.random() * wittyGreetings.length)];
    const randomFallback = () => wittyFallbacks[Math.floor(Math.random() * wittyFallbacks.length)];

    switch (primaryIntent) {
      case "greeting":
        reply = randomGreeting();
        break;
      case "balance":
        reply = `Your current balance is ₦${(45000 + Math.floor(Math.random() * 5000)).toLocaleString()}. 💰`;
        break;
      case "loan":
        reply = `LAPO offers Personal and Business loans with flexible repayment options. Would you like to begin your loan application? 🏦`;
        break;
      case "transfer":
        reply = `Sure thing! Who would you like to transfer funds to? 💸`;
        break;
      case "savings":
        // Handle savings with income context
        if (lowerMsg.includes("income") || lowerMsg.includes("earn") || lowerMsg.includes("million")) {
          reply = `Wow, that's impressive! 🎉 With a monthly income like that, I'd recommend our *Premium Savings Account* which offers:\n\n💰 Higher interest rates on large deposits\n📈 Investment opportunities\n🏆 Priority customer service\n💳 Premium debit card benefits\n\nWould you like to learn more about the requirements?`;
        } else {
          reply = `I'd be happy to help you open a Personal Savings Account with LAPO! 💰 We offer accounts with competitive interest rates and flexible withdrawal options. Want me to walk you through the requirements?`;
        }
        break;
      case "branch_info":
        reply = `LAPO Microfinance Bank has over 500 branches across Nigeria, serving millions of customers nationwide! 🏦\n\nTo find your nearest branch:\n📍 Visit our website at www.lapo-nigeria.org\n📞 Call our customer service: 0700-LAPO-MFB\n📧 Email: info@lapo-nigeria.org\n\nNeed help with anything else?`;
        break;
      default:
        reply = "";
    }

    responseParts.push(reply);
  } else {
    // 🧠 Fallback AI + memory
    const aiReply = await fallbackAIResponse(message, user);
    responseParts.push(aiReply);
  }

  const finalResponse = responseParts.join(" ");
  return {
    user,
    intent: context.intent || "fallback",
    confidence,
    response: finalResponse,
  };
}

module.exports = { Predict };