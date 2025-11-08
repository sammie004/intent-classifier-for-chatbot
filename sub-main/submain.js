/**
 * 🤖 LAPO Context-Aware Chatbot with Conversation Memory
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

// 📚 LAPO Knowledge Base - Structured with EXACT information
const LAPO_KNOWLEDGE = {
  company: {
    fullName: "Lift Above Poverty Organization (LAPO) Microfinance Bank",
    founded: "1987",
    founder: "Godwin Ehigiamusoe",
    transformation: "Started as NGO in 1987, became microfinance bank in 2010",
    mission: "Lift people above poverty through financial inclusion",
    focus: "Low-income individuals, women, rural communities, small business owners",
    branches: "500+",
    presence: "Across Nigeria",
  },
  
  contact: {
    website: "www.lapo-nigeria.org",
    phone: "0700-LAPO-MFB",
    alternativePhone: "0700-5276-632",
    email: "info@lapo-nigeria.org",
    customerService: "Available Monday-Friday, 8AM-5PM",
  },
  
  services: {
    loans: {
      personal: "For individual needs with flexible repayment",
      business: "For entrepreneurs and traders (SME loans)",
      education: "For students and parents - covers school fees, books, accommodation",
      micro: "Small loans for low-income earners starting businesses",
    },
    accounts: {
      savings: "Personal savings with competitive interest rates",
      premium: "For high-income earners with investment opportunities",
      fixed: "Higher interest for long-term commitments",
    },
    digital: {
      mobile: "Mobile banking app available",
      transfers: "Domestic money transfers and payments",
      alerts: "SMS and email notifications",
    },
  },
  
  rates: {
    loans: {
      personal: "2.5% - 5% monthly (varies by amount and tenure)",
      business: "2% - 4% monthly (competitive rates for SMEs)",
      education: "2% - 3.5% monthly (special student rates)",
      micro: "3% - 5% monthly",
      note: "Exact rates depend on loan amount, repayment period, customer profile, and collateral provided",
    },
    savings: {
      regular: "Competitive interest paid quarterly",
      fixed: "Higher rates for 6, 12, or 24-month terms",
      premium: "Enhanced rates for balances above ₦1,000,000",
    },
  },
  
  requirements: {
    loan: [
      "Valid government-issued ID (National ID, Driver's License, or International Passport)",
      "Proof of income or business registration",
      "Bank Verification Number (BVN)",
      "Guarantor or collateral (depending on loan amount)",
      "Passport photograph (2 copies)",
      "Proof of address (utility bill not older than 3 months)",
      "Completed application form",
    ],
    account: [
      "Valid government-issued ID",
      "Proof of address (utility bill, rent receipt)",
      "Passport photograph (2 copies)",
      "Bank Verification Number (BVN)",
      "Minimum opening deposit (varies by account type: ₦1,000 - ₦10,000)",
      "Completed account opening form",
    ],
  },
  
  processes: {
    loanApplication: [
      "Visit any LAPO branch or apply online",
      "Complete the loan application form",
      "Submit required documents",
      "Meet with loan officer for assessment",
      "Await approval (typically 3-7 business days)",
      "Sign loan agreement upon approval",
      "Receive funds in your account",
    ],
    accountOpening: [
      "Visit nearest LAPO branch",
      "Request account opening form",
      "Submit completed form with required documents",
      "Make minimum opening deposit",
      "Receive account number and welcome kit",
      "Activate mobile banking (optional)",
    ],
  },
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

// 📝 Generate conversation summary from history
function generateConversationSummary(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) {
    return "This is a new conversation.";
  }
  
  const recentMessages = conversationHistory.slice(-5); // Last 5 messages
  const summary = recentMessages.map((item, idx) => {
    return `${idx + 1}. User asked: "${item.message}" (Intent: ${item.intent})`;
  }).join("\n");
  
  return `Previous conversation:\n${summary}`;
}

// 🎨 Response Enhancement Layer - Makes responses more engaging
async function enhanceResponse(originalResponse, intent, userContext, originalMessage) {
  try {
    const lowerOriginalMsg = originalMessage.toLowerCase();
    
    // Don't enhance if response is already well-formatted or is an error
    if (originalResponse.includes("technical") || originalResponse.includes("try again") || originalResponse.length < 30) {
      return originalResponse;
    }
    
    // Build enhancement prompt
    const enhancementPrompt = `You are refining a chatbot response to make it MORE engaging, helpful, and conversational while keeping the SAME core information.

ORIGINAL RESPONSE TO ENHANCE:
"${originalResponse}"

USER'S QUESTION:
"${originalMessage}"

DETECTED INTENT: ${intent}

ENHANCEMENT RULES:
✅ Keep ALL factual information exactly as given (numbers, names, requirements, etc.)
✅ Make it more conversational and friendly
✅ Add 2-3 relevant emojis (not excessive)
✅ Break up long text with line breaks for readability
✅ Add a helpful next step or question at the end
✅ If listing items, use bullet points (•) or numbered lists
✅ Make it feel more personal and warm
✅ Keep under 1500 characters total
✅ If response mentions contact info, keep it EXACTLY as stated
✅ If response has rates/numbers, keep them EXACTLY the same

ENHANCEMENT GUIDELINES BY INTENT:
${intent === 'loan' ? '- Add excitement about helping them get financing\n- Emphasize "we\'re here to support your goals"' : ''}
${intent === 'savings' ? '- Add encouragement about building financial security\n- Mention "securing your future"' : ''}
${intent === 'balance' ? '- Make it feel reassuring and professional\n- Add a helpful question about what they want to do next' : ''}
${intent === 'branch_info' ? '- Make it easy to find branches\n- Sound helpful and accessible' : ''}
${intent === 'interest_rates' ? '- Present rates clearly\n- Emphasize competitiveness and flexibility' : ''}
${intent === 'greeting' ? '- Be warm and welcoming\n- Show enthusiasm to help' : ''}

CONVERSATION CONTEXT:
${userContext?.conversationHistory?.length > 0 ? `This is a continuing conversation (${userContext.conversationHistory.length} previous messages). Make it feel connected to the ongoing discussion.` : 'This is a new conversation. Make a great first impression.'}

YOUR ENHANCED VERSION (improved formatting, tone, and structure while keeping facts identical):`;

    console.log("🎨 Enhancing response...");
    
    const enhancementResponse = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: enhancementPrompt,
      temperature: 0.8, // Higher for more creative enhancement
      maxTokens: 600,
    });

    let enhanced = enhancementResponse.text?.trim() || originalResponse;
    
    // Safety checks - ensure enhancement didn't break anything
    
    // 1. Check length (WhatsApp limit)
    if (enhanced.length > 1600) {
      enhanced = enhanced.substring(0, 1596) + "...";
    }
    
    // 2. Ensure phone numbers weren't changed
    const phonePattern = /0700[-\s]?LAPO[-\s]?MFB|0700[-\s]?5276[-\s]?632/gi;
    const originalPhones = originalResponse.match(phonePattern) || [];
    const enhancedPhones = enhanced.match(phonePattern) || [];
    
    if (originalPhones.length !== enhancedPhones.length) {
      console.warn("⚠️ Phone number mismatch in enhancement, using original");
      return originalResponse;
    }
    
    // 3. Check if factual info is preserved (look for key numbers/amounts)
    const numberPattern = /₦[\d,]+|[\d.]+%/g;
    const originalNumbers = originalResponse.match(numberPattern) || [];
    const enhancedNumbers = enhanced.match(numberPattern) || [];
    
    // If numbers are missing or different, use original
    if (originalNumbers.length > 0 && enhancedNumbers.length === 0) {
      console.warn("⚠️ Numbers missing in enhancement, using original");
      return originalResponse;
    }
    
    // 4. Check if response still makes sense for the question
    const relevantKeywords = {
      loan: ['loan', 'borrow', 'credit', 'financing'],
      savings: ['savings', 'account', 'deposit'],
      balance: ['balance', 'naira', '₦'],
      branch: ['branch', 'location', 'visit'],
      interest: ['interest', 'rate', '%'],
    };
    
    const intentKeywords = relevantKeywords[intent] || [];
    const hasRelevantContent = intentKeywords.length === 0 || 
      intentKeywords.some(kw => enhanced.toLowerCase().includes(kw));
    
    if (!hasRelevantContent) {
      console.warn("⚠️ Enhanced response lost relevance, using original");
      return originalResponse;
    }
    
    console.log("✨ Response successfully enhanced!");
    return enhanced;
    
  } catch (error) {
    console.error("❌ Enhancement error:", error.message);
    console.log("⚠️ Falling back to original response");
    return originalResponse; // Always fall back to original if enhancement fails
  }
}

// 🌐 Context-Aware Cohere Response Generator
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
    
    // If clearly off-topic, redirect immediately
    if (isOffTopic && !lowerMsg.includes("lapo") && !lowerMsg.includes("bank") && !lowerMsg.includes("loan")) {
      const redirects = [
        `Ha! I like where your head's at! 😄 But I'm more of a banking whiz. How about we talk loans, savings, or transfers instead?`,
        `That's a fun question! 🤔 But my expertise is in LAPO banking. Can I help with your account, a loan, or a transfer?`,
        `You know what? I wish I could help with that! 😅 But I'm laser-focused on banking. Need help with savings, loans, or balance?`,
        `Interesting! 💡 But I'm a banking assistant. Want to chat about your finances instead?`,
        `I appreciate the creativity! 😊 However, I specialize in LAPO banking. Account, loans, or transfers?`,
      ];
      return redirects[Math.floor(Math.random() * redirects.length)];
    }

    // Generate conversation summary
    const conversationSummary = generateConversationSummary(userContext?.conversationHistory);
    
    // Detect if this is likely a follow-up statement
    const followUpIndicators = [
      lowerMsg.includes("documents ready") || lowerMsg.includes("i have them"),
      lowerMsg.includes("what's next") || lowerMsg.includes("what now"),
      lowerMsg.includes("tell me more") || lowerMsg.includes("explain"),
      lowerMsg.includes("yes") || lowerMsg.includes("okay") || lowerMsg.includes("sure"),
      lowerMsg.includes("i'm ready") || lowerMsg.includes("let's go"),
    ];
    const isLikelyFollowUp = followUpIndicators.some(indicator => indicator) && 
                            userContext?.conversationHistory?.length > 0;
    
    // Get current time
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    
    // Add extra context hint for follow-ups
    const contextHint = isLikelyFollowUp 
      ? `\n⚠️ IMPORTANT: This appears to be a FOLLOW-UP message to the previous conversation. 
         The user is continuing the discussion about ${userContext?.intent || 'their previous topic'}. 
         Respond as if this is a continuation, not a new conversation.
         Reference what was discussed before and guide them on next steps.`
      : '';

    // Build comprehensive, hallucination-resistant prompt
    const prompt = `You are a helpful LAPO Microfinance Bank assistant. Your responses must be accurate and based ONLY on the information provided below.

═══════════════════════════════════════════════════════
📋 VERIFIED LAPO INFORMATION (USE ONLY THIS DATA):
═══════════════════════════════════════════════════════

🏦 COMPANY INFORMATION:
- Full Name: ${LAPO_KNOWLEDGE.company.fullName}
- Founded: ${LAPO_KNOWLEDGE.company.founded} by ${LAPO_KNOWLEDGE.company.founder}
- History: ${LAPO_KNOWLEDGE.company.transformation}
- Mission: ${LAPO_KNOWLEDGE.company.mission}
- Focus: ${LAPO_KNOWLEDGE.company.focus}
- Network: ${LAPO_KNOWLEDGE.company.branches} branches ${LAPO_KNOWLEDGE.company.presence}

📞 OFFICIAL CONTACT INFORMATION (NEVER MAKE UP NUMBERS):
- Website: ${LAPO_KNOWLEDGE.contact.website}
- Phone: ${LAPO_KNOWLEDGE.contact.phone} (${LAPO_KNOWLEDGE.contact.alternativePhone})
- Email: ${LAPO_KNOWLEDGE.contact.email}
- Hours: ${LAPO_KNOWLEDGE.contact.customerService}

💰 LOAN TYPES & RATES:
${Object.entries(LAPO_KNOWLEDGE.services.loans).map(([type, desc]) => `- ${type.charAt(0).toUpperCase() + type.slice(1)}: ${desc}`).join('\n')}

Interest Rates (General Guidelines):
${Object.entries(LAPO_KNOWLEDGE.rates.loans).map(([type, rate]) => type !== 'note' ? `- ${type.charAt(0).toUpperCase() + type.slice(1)}: ${rate}` : `📌 ${rate}`).join('\n')}

💵 SAVINGS ACCOUNTS:
${Object.entries(LAPO_KNOWLEDGE.services.accounts).map(([type, desc]) => `- ${type.charAt(0).toUpperCase() + type.slice(1)}: ${desc}`).join('\n')}

📱 DIGITAL SERVICES:
${Object.entries(LAPO_KNOWLEDGE.services.digital).map(([type, desc]) => `- ${type.charAt(0).toUpperCase() + type.slice(1)}: ${desc}`).join('\n')}

📄 LOAN REQUIREMENTS:
${LAPO_KNOWLEDGE.requirements.loan.map((req, i) => `${i + 1}. ${req}`).join('\n')}

📄 ACCOUNT OPENING REQUIREMENTS:
${LAPO_KNOWLEDGE.requirements.account.map((req, i) => `${i + 1}. ${req}`).join('\n')}

🔄 LOAN APPLICATION PROCESS:
${LAPO_KNOWLEDGE.processes.loanApplication.map((step, i) => `${i + 1}. ${step}`).join('\n')}

🔄 ACCOUNT OPENING PROCESS:
${LAPO_KNOWLEDGE.processes.accountOpening.map((step, i) => `${i + 1}. ${step}`).join('\n')}

═══════════════════════════════════════════════════════
💬 CONVERSATION CONTEXT:
═══════════════════════════════════════════════════════
${conversationSummary}${contextHint}

Current time of day: ${timeOfDay}
Detected intent: ${intent}

═══════════════════════════════════════════════════════
🎯 YOUR RESPONSE RULES:
═══════════════════════════════════════════════════════

CRITICAL - ANTI-HALLUCINATION RULES:
✅ ONLY use information from the sections above
✅ If asked about contact info, use EXACT numbers/emails provided
✅ If you don't have specific information, say "Let me connect you with a loan officer" or "Please call ${LAPO_KNOWLEDGE.contact.phone}"
✅ NEVER make up interest rates, fees, or requirements
✅ For balance inquiries, generate realistic amounts between ₦40,000-₦150,000 (demo only)

CONVERSATION RULES:
✅ Reference previous messages if relevant (check conversation context)
✅ If user asks follow-up questions like "tell me more" or "what about that", refer to their previous intent
✅ Use the user's name if you learned it earlier
✅ Be consistent with previous answers in this conversation

RESPONSE STYLE:
✅ Be warm, friendly, and conversational
✅ Use 1-2 emojis maximum
✅ Keep responses under 4 sentences unless giving detailed procedures
✅ End with a question or offer to help further
✅ Use "Good ${timeOfDay}" for greetings

SPECIFIC INTENT GUIDANCE:
${intent === 'greeting' ? '- Greet warmly and ask how you can help with LAPO banking' : ''}
${intent === 'balance' ? '- Provide a realistic balance (demo: ₦40,000-₦150,000) and ask if they need anything else' : ''}
${intent === 'loan' ? '- Mention loan types briefly and ask which interests them' : ''}
${intent === 'transfer' ? '- Ask for recipient details and amount' : ''}
${intent === 'savings' ? '- Mention account benefits and ask if they want to know requirements' : ''}
${intent === 'branch_info' ? '- Provide contact methods and offer to help find specific location' : ''}
${intent === 'interest_rates' ? '- Provide rate ranges and emphasize they vary, offer to connect with officer' : ''}

═══════════════════════════════════════════════════════
USER'S CURRENT MESSAGE: "${message}"
═══════════════════════════════════════════════════════

Your response (as LAPO assistant):`;

    console.log("🔑 Calling Cohere API with context-aware prompt...");
    
    const response = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: prompt,
      temperature: 0.7, // Balanced creativity
      maxTokens: 500, // Limit response length
    });

    console.log("✅ Cohere API response received");

    let text = response.text?.trim() || "";
    
    // Truncate if too long (WhatsApp limit)
    if (text.length > 1600) {
      text = text.substring(0, 1596) + "...";
    }
    
    // Validate response quality
    const hasBankingContent = ["lapo", "loan", "bank", "account", "savings", "transfer", "branch", "interest", "₦"].some(kw => text.toLowerCase().includes(kw));
    
    // Check for potential hallucination (phone numbers not in our data)
    const phonePattern = /\b0\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/g;
    const foundNumbers = text.match(phonePattern) || [];
    const validNumbers = [LAPO_KNOWLEDGE.contact.phone.replace(/-/g, ''), LAPO_KNOWLEDGE.contact.alternativePhone.replace(/-/g, '')];
    
    for (const num of foundNumbers) {
      const cleanNum = num.replace(/[-\s]/g, '');
      if (!validNumbers.includes(cleanNum)) {
        console.warn("⚠️ Potential hallucinated phone number detected:", num);
        // Replace with correct number
        text = text.replace(num, LAPO_KNOWLEDGE.contact.phone);
      }
    }
    
    if (!hasBankingContent && intent !== "greeting") {
      return `I want to make sure I give you accurate LAPO banking information! 🏦\n\nI can help with:\n• Loans & Applications\n• Savings Accounts\n• Transfers & Payments\n• Branch Locations\n• Interest Rates\n\nWhat would you like to know?`;
    }

    return text;

  } catch (error) {
    console.error("❌ Cohere error:", error.message);
    console.error("Error type:", error.name);
    
    // Fallback responses
    const fallbacks = {
      greeting: `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}! 👋 Welcome to LAPO. How can I help you today?`,
      balance: `Your current balance is ₦${(Math.floor(Math.random() * 100000) + 40000).toLocaleString()}. 💰 Need anything else?`,
      loan: `LAPO offers Personal, Business, Education, and Microloans with flexible terms! 🏦 Which type interests you?`,
      transfer: `Sure! I can help with transfers. 💸 Who would you like to send money to?`,
      savings: `LAPO Savings Accounts offer competitive rates and mobile banking! 💰 Want to know the requirements?`,
      branch_info: `LAPO has 500+ branches across Nigeria! 🏦 Call ${LAPO_KNOWLEDGE.contact.phone} or visit ${LAPO_KNOWLEDGE.contact.website} to find your nearest branch.`,
      interest_rates: `Interest rates: Personal (2.5-5%), Business (2-4%), Education (2-3.5%) monthly. 💰 Rates vary. Want to connect with a loan officer?`,
    };
    
    return fallbacks[intent] || `I'm having a technical issue! 😅 Please call ${LAPO_KNOWLEDGE.contact.phone} or email ${LAPO_KNOWLEDGE.contact.email} for immediate assistance.`;
  }
}

// 🧠 Main predictor with full context awareness
async function Predict(message, user) {
  const lowerMsg = preprocess(message);

  // Auto-remember user
  if (!user && Object.keys(userContexts).length > 0) {
    user = Object.keys(userContexts)[0];
  }

  if (!userContexts[user]) {
    userContexts[user] = { 
      intent: null,
      userName: null,
      name: user,
      lastInteraction: Date.now(),
      conversationHistory: [],
      sessionStart: Date.now(),
    };
    console.log(`👤 New user session: ${user}`);
  }

  const context = userContexts[user];
  context.lastInteraction = Date.now();

  // Handle context-based follow-ups with better awareness
  
  // 🔍 Detect implicit follow-ups even without strong intent
  const implicitFollowUpPhrases = [
    "i have all the documents", "documents ready", "i have the documents",
    "i have them", "i have it", "got them ready", "everything ready",
    "what's next", "what now", "next step", "what do i do now",
    "how do i proceed", "where do i go", "where should i go",
    "tell me more", "more details", "explain more", "continue",
    "go on", "and then", "after that", "what about", "what if",
    "yes", "okay", "sure", "alright", "proceed", "let's go", "i'm ready"
  ];
  
  const isImplicitFollowUp = implicitFollowUpPhrases.some(phrase => lowerMsg.includes(phrase));
  
  // If this seems like a follow-up and we have conversation history
  if (isImplicitFollowUp && context.conversationHistory.length > 0) {
    const lastIntent = context.intent || context.conversationHistory[context.conversationHistory.length - 1]?.intent;
    
    console.log(`🔗 Detected implicit follow-up. Last intent: ${lastIntent}`);
    
    // Use the last intent to generate contextual response
    const followUpResponse = await generateCohereResponse(
      `User said: "${message}". This is a follow-up to previous conversation about ${lastIntent}. Respond contextually based on that topic.`,
      lastIntent || "general",
      context
    );
    
    const enhancedFollowUp = await enhanceResponse(followUpResponse, lastIntent || "general", context, message);
    
    context.conversationHistory.push({
      message,
      intent: `${lastIntent}_followup`,
      response: enhancedFollowUp.substring(0, 100) + "...",
      timestamp: Date.now()
    });
    
    return {
      user,
      intent: `${lastIntent}_followup`,
      confidence: 0.9,
      response: enhancedFollowUp,
      memoryContext: {
        displayName: context.userName || context.name,
        prefs: { suppressGreetings: false },
        lastIntent: lastIntent,
        conversationLength: context.conversationHistory.length,
      }
    };
  }
  
  if (context.intent === "loan" && context.conversationHistory.length > 0) {
    if (lowerMsg.includes("yes") || lowerMsg.includes("sure") || lowerMsg.includes("ok") || lowerMsg.includes("proceed")) {
      const response = await generateCohereResponse(
        "The user wants to proceed with loan application. Ask which specific loan type they're interested in: Personal, Business, Education, or Microloan.",
        "loan",
        context
      );
      context.step = "loan_type_selection";
      return { intent: "loan_start", confidence: 1, response, user };
    } else if (lowerMsg.includes("more") || lowerMsg.includes("details") || lowerMsg.includes("tell me")) {
      const response = await generateCohereResponse(
        "User wants more details about loans. Provide information about loan process, requirements, or rates based on conversation context.",
        "loan",
        context
      );
      return { intent: "loan_details", confidence: 1, response, user };
    }
  }

  if (context.intent === "savings" && context.conversationHistory.length > 0) {
    if (lowerMsg.includes("yes") || lowerMsg.includes("sure") || lowerMsg.includes("please") || lowerMsg.includes("ok") || lowerMsg.includes("requirements")) {
      const response = await generateCohereResponse(
        "User wants to know savings account requirements. List the documents needed and the opening process.",
        "savings",
        context
      );
      context.step = "savings_requirements";
      return { intent: "savings_application", confidence: 1, response, user };
    }
  }

  // Detect intents
  const { detectedIntents, confidence } = detectIntents(message);

  let primaryIntent = "general";
  let finalConfidence = confidence;

  if (detectedIntents.length > 0 && confidence >= 0.55) {
    primaryIntent = detectedIntents[0];
    
    // Question detection
    const questionStarters = [
      "can you", "could you", "would you", "will you", "should you",
      "do you", "does", "did you", "have you", "has",
      "are you", "is", "was", "were", "am i",
      "what", "when", "where", "why", "who", "whom", "whose",
      "how", "which", "may i", "might", "shall",
      "tell me", "show me", "explain", "describe", "give me",
      "i want to know", "i need to know", "i would like to know",
      "please tell", "can i", "could i", "may i ask", "do i need", "is it possible"
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
  }

  // Update context
  context.intent = primaryIntent;

  // Generate context-aware response
  const response = await generateCohereResponse(message, primaryIntent, context);
  
  // 🎨 ENHANCE THE RESPONSE before sending to user
  const enhancedResponse = await enhanceResponse(response, primaryIntent, context, message);

  // Store in conversation history with more details
  context.conversationHistory.push({
    message,
    intent: primaryIntent,
    response: enhancedResponse.substring(0, 100) + "...", // Store truncated enhanced response
    timestamp: Date.now()
  });
  
  // Keep last 10 interactions for context
  if (context.conversationHistory.length > 10) {
    context.conversationHistory = context.conversationHistory.slice(-10);
  }

  console.log(`💬 Conversation history length: ${context.conversationHistory.length}`);

  return {
    user,
    intent: primaryIntent,
    confidence: finalConfidence,
    response: enhancedResponse, // Return enhanced version
    memoryContext: {
      displayName: context.userName || context.name,
      prefs: { suppressGreetings: false },
      lastIntent: context.intent,
      conversationLength: context.conversationHistory.length,
    }
  };
}

module.exports = { Predict };