/**
 * 🤖 LAPO Smart Intent Classifier — Cohere-Powered Dynamic Responses
 */

const { CohereClient } = require("cohere-ai");
const natural = require("natural");
require("dotenv").config();

const cohere = new CohereClient({
  token: process.env.SECRET_KEY,
});

// 🧠 In-memory user context store
const userContexts = {};

// 💬 Intent dictionary (for routing only)
const intents = {
  greeting: ["hello", "hey", "good morning", "good afternoon", "good evening", "yo", "greetings", "howdy", "hi"],
  balance: ["balance", "account balance", "how much do i have", "check my balance", "my balance", "show balance"],
  loan: [
    "loan", "borrow", "credit", "lend", "apply for a loan", "get a loan",
    "microfinance", "loan application", "education loan", "business loan", "sme loan",
  ],
  transfer: ["transfer", "send money", "move funds", "send cash", "payment", "pay", "wire"],
  savings: [
    "savings", "save", "savings account", "open account", "create account",
    "new account", "personal account", "deposit account", "fixed deposit",
    "saving money", "open a", "opening a",
  ],
  branch_info: [
    "branch", "branches", "location", "locations", "office", "offices",
    "where is", "how many", "nearest branch", "find branch", "branch address",
  ],
  interest_rates: [
    "interest rate", "interest rates", "rate", "rates", "how much interest",
    "what rate", "what rates", "charges", "fee", "fees", "cost", "pricing",
  ],
};

// 📚 LAPO Knowledge Base (for Cohere context)
const LAPO_CONTEXT = `
ABOUT LAPO MICROFINANCE BANK:
- Full Name: Lift Above Poverty Organization (LAPO) Microfinance Bank
- Founded: 1987 by Godwin Ehigiamusoe
- Transformation: Started as NGO, became microfinance bank in 2010
- Mission: Lift people above poverty through financial inclusion
- Focus: Low-income individuals, women, rural communities, small business owners
- Network: 500+ branches across Nigeria
- Customer Base: Millions of customers nationwide

SERVICES:
- Personal Loans: For individual needs
- Business/SME Loans: For entrepreneurs and traders
- Education Loans: For students and parents (school fees, books, accommodation)
- Microloans: Small loans for low-income earners
- Savings Accounts: Personal and Premium savings options
- Fixed Deposits: Higher interest for long-term savings
- Mobile Banking: Digital banking services
- Transfers & Payments: Domestic money transfers

INTEREST RATES (General Guidelines):
- Personal Loans: 2.5-5% monthly (varies by amount and tenure)
- Business/SME Loans: 2-4% monthly (competitive rates)
- Education Loans: 2-3.5% monthly (special student rates)
- Savings Accounts: Competitive interest on deposits
- Fixed Deposits: Higher rates for longer commitments
*Exact rates depend on loan amount, repayment period, customer profile, and collateral*

LOAN REQUIREMENTS (Typical):
- Valid ID (National ID, Driver's License, Passport)
- Proof of income/business
- Guarantor or collateral (depending on amount)
- BVN (Bank Verification Number)
- Passport photograph
- Proof of address

ACCOUNT OPENING REQUIREMENTS:
- Valid government-issued ID
- Proof of address (utility bill, etc.)
- Passport photograph
- Minimum opening deposit (varies by account type)
- BVN

CONTACT INFORMATION:
- Website: www.lapo-nigeria.org
- Phone: 0700-LAPO-MFB
- Email: info@lapo-nigeria.org
`;

// 🧹 Clean the message
function preprocess(text) {
  return text.toLowerCase().replace(/[^\w\s]/gi, "").trim();
}

// 🔍 Detect intents with improved scoring
function detectIntents(message) {
  const lowerMsg = preprocess(message);
  const scores = {};

  for (const [intent, keywords] of Object.entries(intents)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerMsg.includes(keyword)) {
        score += 1;
        if (lowerMsg === keyword) score += 0.5;
      }
      const distance = natural.JaroWinklerDistance(lowerMsg, keyword);
      if (distance > 0.85) score += distance * 0.7;
    }
    scores[intent] = score;
  }

  const wordCount = lowerMsg.split(/\s+/).length;
  if (wordCount > 10 && scores.greeting > 0) {
    scores.greeting = scores.greeting * 0.3;
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

// 🌐 Unified Cohere Response Generator
async function generateCohereResponse(message, intent, userContext) {
  try {
    const lowerMsg = message.toLowerCase();
    
    // Off-topic detection
    const offTopicKeywords = [
      "recipe", "cook", "food", "pizza", "game", "movie", "music", "sport",
      "weather", "joke", "story", "sing", "dance", "play", "netflix",
      "facebook", "instagram", "twitter", "tiktok", "youtube", "politics",
      "religion", "dating", "relationship", "health", "medicine", "doctor",
      "homework", "exam", "travel", "hotel", "flight", "car",
      "phone", "computer", "laptop", "shopping", "fashion", "clothes",
      "celebrity", "artist", "actor", "actress", "film", "series", "show",
      "anime", "manga", "video", "photo", "picture", "meme", "crypto",
      "bitcoin", "stock", "forex", "trading"
    ];
    
    const isOffTopic = offTopicKeywords.some(kw => lowerMsg.includes(kw));
    
    // If clearly off-topic, redirect
    if (isOffTopic && !lowerMsg.includes("lapo") && !lowerMsg.includes("bank") && !lowerMsg.includes("loan")) {
      const redirects = [
        `Ha! I like where your head's at! 😄 But I'm more of a banking whiz. How about we talk loans, savings, or transfers instead?`,
        `That's a fun question! 🤔 But my expertise is in LAPO banking. Can I help with your account, a loan, or a transfer?`,
        `You know what? I wish I could help with that! 😅 But I'm laser-focused on banking. Need help with savings, loans, or balance?`,
        `Interesting! 💡 But I'm a banking assistant. Want to chat about your finances instead?`,
        `I appreciate the creativity! 😊 However, I specialize in LAPO banking. Account, loans, or transfers?`,
        `That's outside my wheelhouse! 🏦 I'm all about banking. Can I help with savings, loans, or balance inquiries?`,
      ];
      return redirects[Math.floor(Math.random() * redirects.length)];
    }

    // Get current time for greetings
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    // Build context-aware prompt based on intent
    let intentGuidance = "";
    
    switch(intent) {
      case "greeting":
        intentGuidance = `The user is greeting you. Respond warmly and ask how you can help with LAPO banking services today. Keep it brief (1-2 sentences). Use "Good ${timeOfDay}" appropriately.`;
        break;
        
      case "balance":
        intentGuidance = `The user wants to check their account balance. Since this is a demo/test, generate a realistic Nigerian Naira balance between ₦40,000 - ₦150,000. Format with commas. Add a friendly emoji and ask if they need anything else.`;
        break;
        
      case "loan":
        intentGuidance = `The user is interested in loans. Briefly mention the types available (Personal, Business/SME, Education, Microloans) with key benefits like flexible repayment and competitive rates. Ask if they'd like to start an application. Keep under 4 sentences.`;
        break;
        
      case "transfer":
        intentGuidance = `The user wants to transfer money. Acknowledge helpfully and ask for the recipient's details and amount. Keep it conversational and brief (2-3 sentences).`;
        break;
        
      case "savings":
        intentGuidance = `The user is interested in savings accounts. Mention benefits like competitive interest rates, flexible withdrawals, secure deposits, and mobile banking. Ask if they want to know the requirements. If they mention high income, suggest Premium Savings Account. Keep under 4 sentences.`;
        break;
        
      case "branch_info":
        intentGuidance = `The user wants branch information. Mention 500+ branches across Nigeria. Provide contact methods: website (www.lapo-nigeria.org), phone (0700-LAPO-MFB), email (info@lapo-nigeria.org). Ask if they need a specific location. Keep under 4 sentences.`;
        break;
        
      case "interest_rates":
        intentGuidance = `The user is asking about interest rates. Provide the general rate ranges from the context, but always mention rates vary based on amount, tenure, and customer profile. Offer to connect with a loan officer for exact rates. Use bullet points if listing multiple rates. Keep under 5 sentences.`;
        break;
        
      default:
        intentGuidance = `Answer the user's banking question helpfully using the LAPO context provided. Be conversational, accurate, and concise (under 4 sentences unless detailed info is needed). If you don't have specific info, offer to connect them with customer service or a loan officer.`;
    }

    // Context from conversation history
    let conversationContext = "";
    if (userContext && userContext.intent) {
      conversationContext = `\n\nCONVERSATION CONTEXT: The user previously asked about ${userContext.intent}. Keep this in mind for continuity.`;
    }

    const prompt = `You are a friendly, knowledgeable LAPO Microfinance Bank assistant.

${LAPO_CONTEXT}

RESPONSE GUIDELINES:
${intentGuidance}

GENERAL RULES:
- Be warm, conversational, and helpful
- Use emojis sparingly (1-2 per response)
- Keep responses concise unless detailed info is needed
- Always offer next steps or ask if they need more help
- If asked about procedures, give clear step-by-step guidance
- For specific rates/requirements, mention they should confirm with an officer
- Never make up information not in the context
- Stay focused on LAPO banking topics
${conversationContext}

USER MESSAGE: "${message}"

Your response (as LAPO assistant):`;

    const response = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: prompt,
      temperature: 0.7,
    });

    let text = response.text?.trim() || "";
    
    // Truncate if too long
    if (text.length > 1600) {
      text = text.substring(0, 1596) + "...";
    }
    
    // Validate response contains banking content
    const bankingKeywords = [
      "lapo", "loan", "bank", "account", "savings", "transfer", "branch",
      "interest", "naira", "₦", "deposit", "credit", "balance", "payment"
    ];
    
    const hasBankingContent = bankingKeywords.some(kw => text.toLowerCase().includes(kw));
    
    if (!hasBankingContent && intent !== "greeting") {
      // Fallback to clarification
      return `I want to make sure I give you accurate LAPO banking information! 🏦 Could you rephrase your question? I can help with:\n• Loans & Credit\n• Savings Accounts\n• Transfers\n• Branch Locations\n• Interest Rates\n• Account Opening`;
    }

    return text;

  } catch (error) {
    console.error("❌ Cohere error:", error.message);
    console.error("Error details:", error);
    
    const errorResponses = [
      `Oops! 😅 I had a technical hiccup. Could you try asking that again?`,
      `Hmm, something went wrong on my end! 🤖 Mind repeating your question?`,
      `Technical glitch! 🔧 I'm still here though — please ask again?`,
      `My connection stumbled a bit! 😳 Can you ask me that once more?`,
    ];
    
    return errorResponses[Math.floor(Math.random() * errorResponses.length)];
  }
}

// 🧠 Main predictor
async function Predict(message, user) {
  const lowerMsg = preprocess(message);

  // Auto-remember user
  if (!user && Object.keys(userContexts).length > 0) {
    user = Object.keys(userContexts)[0];
  }

  if (!userContexts[user]) {
    userContexts[user] = { 
      intent: null, 
      name: user,
      lastInteraction: Date.now(),
      conversationHistory: []
    };
  }

  const context = userContexts[user];
  context.lastInteraction = Date.now();

  // Handle context-based follow-ups
  if (context.intent === "loan") {
    if (lowerMsg.includes("yes") || lowerMsg.includes("sure") || lowerMsg.includes("ok")) {
      const response = await generateCohereResponse(
        "User wants to start loan application. Ask which type: Personal, Business, Education, or Microloan",
        "loan",
        context
      );
      context.step = "loan_type";
      return { intent: "loan_start", confidence: 1, response, user };
    } else if (lowerMsg.includes("no") || lowerMsg.includes("not now")) {
      context.intent = null;
      const response = await generateCohereResponse(
        "User declined loan application. Acknowledge politely and offer to help with other banking services",
        "loan",
        context
      );
      return { intent: "loan_decline", confidence: 1, response, user };
    }
  }

  if (context.intent === "savings") {
    if (lowerMsg.includes("yes") || lowerMsg.includes("sure") || lowerMsg.includes("please") || lowerMsg.includes("ok")) {
      const response = await generateCohereResponse(
        "User wants to know savings account requirements. List the documents needed and next steps",
        "savings",
        context
      );
      return { intent: "savings_application", confidence: 1, response, user };
    }
  }

  // Detect intents
  const { detectedIntents, confidence } = detectIntents(message);

  let primaryIntent = "general";
  let finalConfidence = confidence;

  if (detectedIntents.length > 0 && confidence >= 0.55) {
    primaryIntent = detectedIntents[0];
    
    // Question detection for greeting override
    const questionStarters = [
      "can you", "could you", "would you", "will you", "should you",
      "do you", "does", "did you", "have you", "has",
      "are you", "is", "was", "were", "am i",
      "what", "when", "where", "why", "who", "whom", "whose",
      "how", "which", "may i", "might", "shall",
      "tell me", "show me", "explain", "describe", "give me",
      "i want to know", "i need to know", "i would like to know",
      "please tell", "can i", "could i", "may i ask", "do i need", "is it possible","who is", "what is", "where is" 
    ];
    
    const isQuestion = message.includes("?") || 
      questionStarters.some(starter => lowerMsg.startsWith(starter) || lowerMsg.includes(" " + starter));
    const isLongMessage = lowerMsg.split(/\s+/).length > 5;
    
    if (primaryIntent === "greeting" && (isQuestion || isLongMessage)) {
      if (detectedIntents.length > 1) {
        primaryIntent = detectedIntents[1];
      } else {
        primaryIntent = "general";
      }
    }
  } else {
    finalConfidence = confidence;
  }

  // Update context
  context.intent = primaryIntent;

  // Generate response using Cohere
  const response = await generateCohereResponse(message, primaryIntent, context);

  // Store in conversation history
  context.conversationHistory.push({
    message,
    intent: primaryIntent,
    timestamp: Date.now()
  });
  
  // Keep last 10 interactions
  if (context.conversationHistory.length > 10) {
    context.conversationHistory = context.conversationHistory.slice(-10);
  }

  return {
    user,
    intent: primaryIntent,
    confidence: finalConfidence,
    response,
    memoryContext: {
      displayName: context.name,
      prefs: { suppressGreetings: false },
      lastIntent: context.intent,
    }
  };
}

module.exports = { Predict };