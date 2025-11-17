/**
 * 🤖 LAPO Context-Aware Chatbot with Conversation Memory - COMPLETE VERSION
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
  greeting: ["hello", "hey", "good morning", "good afternoon", "good evening", "yo", "greetings", "howdy", "hi", "how are you", "how are you doing", "what's up", "sup"],
  identity: ["who are you", "what are you", "are you a bot", "are you human", "are you ai", "are you a robot", "what's your name", "who am i talking to", "are you real", "what do you do"],
  balance: ["balance", "balance", "how much do i have", "check my balance", "my balance", "show balance"],
  loan: [
    "loan", "borrow", "credit", "lend", "apply for a loan", "get a loan",
    "microfinance", "loan application", "education loan", "business loan", "sme loan",
  ],
  transfer: ["transfer", "send money", "move funds", "send cash", "payment", "pay", "wire"],
  savings: [
    "savings", "save", "savings account", "open account", "create account",
    "new account", "personal account", "deposit account", "fixed deposit",
    "saving money", "open a", "opening a","open","account",
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


// 📚 LAPO Knowledge Base - WITH ACTUAL LAPO PRODUCTS
const LAPO_KNOWLEDGE = {
  company: {
    fullName: "Lift Above Poverty Organization (LAPO) Microfinance Bank",
    founded: "1987",
    founder: "Godwin Ehigiamusoe",
    transformation: "Started as NGO in 1987, became microfinance bank in 2010, National Microfinance Bank in 2012",
    mission: "Lift people above poverty through financial inclusion",
    focus: "Low-income individuals, women (over 90% of clients), rural communities, small business owners",
    branches: "500+",
    presence: "34 out of 36 states in Nigeria including FCT Abuja",
  },
  
  contact: {
    website: "www.lapo-nigeria.org",
    phone: "0700-LAPO-MFB",
    alternativePhone: "0700-5276-632",
    whatsapp: "08150553264, 0905303700",
    email: "info@lapo-nigeria.org",
    customerService: "Available Monday-Friday, 8AM-5PM",
    support: "08139840230",
  },
  
  services: {
    loans: {
      sme_loan: {
        name: "SME Loan",
        description: "Credit facility for Small and Medium Scale Enterprises across all sectors",
        minAmount: "₦50,000",
        maxAmount: "₦5,000,000",
        tenure: "Flexible repayment terms",
        interestRate: "Affordable rates (contact branch for specifics)",
        features: [
          "Supports businesses in all sectors",
          "Flexible repayment schedule",
          "No sector restriction",
          "For business expansion"
        ],
        eligibility: "Valid ID (voter's card, international passport, or driver's license), business registration/proof"
      },
      
      small_business_loan: {
        name: "Small Business Loan (SBL)",
        description: "Capital for small and medium scale entrepreneurs requiring expansion funds",
        minAmount: "₦50,000",
        maxAmount: "₦500,000",
        tenure: "Short to medium term",
        interestRate: "Competitive microfinance rates",
        features: [
          "Unsecured loans available",
          "Quick processing",
          "For business expansion",
          "Minimal documentation"
        ],
        eligibility: "Valid ID, proof of business activity"
      },
      
      agric_loan: {
        name: "Agricultural Loan",
        description: "Financing for farming activities of individuals, groups or corporate organizations",
        amount: "Varies based on farming needs",
        features: [
          "For individuals and groups",
          "Corporate organizations eligible",
          "Supports farming activities",
          "Seasonal financing available"
        ],
        eligibility: "Valid ID, proof of farming activity"
      },
      
      group_loan: {
        name: "Group Loan",
        description: "Loans for organized groups and cooperatives",
        features: [
          "Group lending methodology",
          "Shared responsibility",
          "Community-based",
          "Lower individual risk"
        ],
        eligibility: "Registered group/cooperative, valid ID for members"
      },
      
      enterprise_loan: {
        name: "Enterprise Loan",
        description: "Loans for various enterprise needs",
        features: [
          "Flexible terms",
          "Business development support",
          "For registered enterprises"
        ],
        eligibility: "Valid ID, business documentation"
      }
    },
    
    accounts: {
      individual_savings: {
        name: "Individual Savings Account",
        description: "Enables clients save money to meet future needs and emergencies while encouraging savings habit",
        minOpening: "₦1,000",
        minBalance: "₦200",
        interestRate: "Competitive interest on entire balance (paid quarterly/annually)",
        features: [
          "Earn interest on entire account balance",
          "Saves towards future needs",
          "Emergency fund building",
          "Encourages savings habit",
          "Variable interest rate"
        ],
        eligibility: "Valid ID, BVN, passport photo, proof of address"
      },
      
      savings_plan: {
        name: "Savings Plan Account",
        description: "Help individuals or groups save money towards a particular project",
        features: [
          "Goal-oriented savings",
          "Generate interest while saving",
          "Individual or group savings",
          "Project-based savings"
        ],
        eligibility: "Visit any LAPO branch to open"
      },
      
      my_pikin_and_i: {
        name: "My Pikin & I Account (Child Savings)",
        description: "Child-focused savings account with high interest and life insurance for mothers",
        features: [
          "High interest rates",
          "Life insurance for mother (microinsurance)",
          "Scholarship opportunities for children",
          "Financial literacy education",
          "Goal-tracking tools for parents",
          "Designed for low-income mothers"
        ],
        eligibility: "Parent/guardian with valid ID, child's details",
        note: "Over 125,000 customers since 2019 relaunch"
      },
      
      social_impact_deposit: {
        name: "Social Impact Deposit (SID) Account",
        description: "Innovative deposit platform that improves social needs of low-income individuals",
        minDeposit: "₦200,000",
        minTenor: "6 months",
        interestRate: "Attractive interest rates",
        features: [
          "Higher returns than regular savings",
          "Support LAPO's social mission",
          "Empower low-income Nigerians",
          "Scholarship nomination (₦1M+ for 2 years)",
          "Certificate of deposit"
        ],
        eligibility: "Minimum deposit of ₦200,000, 6 months minimum"
      },
      
      voluntary_savings: {
        name: "Voluntary Savings Account",
        description: "Designed for LAPO MfB clients to save even while paying back loans",
        features: [
          "Save while repaying loans",
          "Flexible deposits",
          "For existing loan clients",
          "Builds savings discipline"
        ],
        eligibility: "Visit any LAPO branch"
      },
      
      term_deposits: {
        name: "Term Deposits",
        description: "Fixed deposit accounts with higher interest rates",
        features: [
          "Earn more interest than traditional savings",
          "Choose your term length",
          "Fixed returns",
          "Certificate issued"
        ],
        eligibility: "Valid ID, minimum deposit amount"
      }
    },
    
    digital: {
      mobile: "Mobile banking app available on iOS and Android",
      ussd: "*919# for quick banking without internet",
      transfers: "Domestic money transfers and bill payments",
      alerts: "SMS and email notifications for all transactions",
      online: "Internet banking portal for account management",
    },
    
    other_services: {
      micro_insurance: "Microinsurance products available",
      micro_investment: "Micro-investment opportunities",
      financial_education: "Financial literacy programs and workshops",
      business_advisory: "Business development support for entrepreneurs"
    }
  },
  
  rates: {
    loans: {
      sme: "Affordable competitive rates (contact branch for specific rates)",
      small_business: "Competitive microfinance rates",
      agric: "Varies based on project",
      general_note: "LAPO never requests payment before giving out loans - Beware of scams!",
      processing: "Processing fees apply (contact branch for details)"
    },
    savings: {
      individual: "Competitive interest paid quarterly or annually",
      my_pikin: "High interest rates (above regular savings)",
      social_impact: "Attractive interest rates (higher for longer tenors)",
      term_deposits: "Higher rates based on term length",
      note: "Interest rates are variable and subject to change. Call or visit branch for current rates as of 2024"
    },
  },
  
  requirements: {
    loan: [
      "Valid government-issued ID (Voter's card, International Passport, or Driver's License)",
      "Proof of business activity or income source",
      "Bank Verification Number (BVN)",
      "Guarantor (depending on loan amount)",
      "Passport photograph (2 recent copies)",
      "Proof of address (utility bill not older than 3 months)",
      "Completed loan application form",
      "Business registration (for SME loans - preferred)"
    ],
    account: [
      "Valid government-issued ID (National ID, Driver's License, Voter's Card, or International Passport)",
      "Proof of address (utility bill, rent receipt, or tenancy agreement)",
      "Passport photograph (2 recent colored copies)",
      "Bank Verification Number (BVN)",
      "Minimum opening deposit (varies: ₦200 - ₦200,000 depending on account type)",
      "Completed account opening form"
    ],
  },
  
  processes: {
    loanApplication: [
      "Visit any LAPO branch nationwide or apply online at www.lapo-nigeria.org",
      "Complete the loan application form with accurate information",
      "Submit required documents (ID, proof of business, BVN, etc.)",
      "Meet with loan officer for assessment and interview",
      "Loan officer conducts verification (may include site visit)",
      "Await approval (typically 3-7 business days)",
      "Sign loan agreement upon approval",
      "Receive funds in your account (NO upfront payment required)",
      "Begin repayment as per agreed schedule"
    ],
    accountOpening: [
      "Visit nearest LAPO branch (500+ branches in 34 states)",
      "Request and complete account opening form",
      "Submit completed form with required documents to customer service",
      "Biometric capture and photograph taken",
      "Make minimum opening deposit (₦200 - ₦200,000 depending on account type)",
      "Receive account number and welcome kit",
      "Activate mobile banking via USSD *919# (optional)",
      "Start saving and earning interest!"
    ],
  },
  
  branches: {
    lagos: [
      {
        name: "Maryland Branch",
        address: "123 Ikorodu Road, Maryland, Lagos",
        phone: "0803-123-4567",
        state: "Lagos",
        lga: "Kosofe",
      },
      {
        name: "Ikeja Branch (Head Office)",
        address: "Irorun Plaza, 2nd Floor, Kudirat Abiola Way, Oregun, Ikeja",
        phone: "0803-234-5678",
        state: "Lagos",
        lga: "Ikeja",
      },
      {
        name: "Victoria Island Branch",
        address: "78 Adeola Odeku Street, Victoria Island, Lagos",
        phone: "0803-345-6789",
        state: "Lagos",
        lga: "Eti-Osa",
      },
      {
        name: "Surulere Branch",
        address: "12 Adeniran Ogunsanya Street, Surulere, Lagos",
        phone: "0803-456-7890",
        state: "Lagos",
        lga: "Surulere",
      },
    ],
    abuja: [
      {
        name: "Wuse Branch",
        address: "56 Adetokunbo Ademola Crescent, Wuse II, Abuja",
        phone: "0803-567-8901",
        state: "FCT",
        lga: "Abuja Municipal",
      },
      {
        name: "Garki Branch",
        address: "23 Tafawa Balewa Way, Garki, Abuja",
        phone: "0803-678-9012",
        state: "FCT",
        lga: "Abuja Municipal",
      },
    ],
    "port-harcourt": [
      {
        name: "Aba Road Branch",
        address: "89 Aba Road, Port Harcourt, Rivers State",
        phone: "0803-789-0123",
        state: "Rivers",
        lga: "Port Harcourt",
      },
    ],
    edo: [
      {
        name: "Benin City Branch",
        address: "Benin City, Edo State",
        note: "Original headquarters location",
        state: "Edo",
      }
    ],
    note: "LAPO has 500+ branches across 34 states in Nigeria. Visit www.lapo-nigeria.org for complete branch locator"
  },
  
  awards_recognition: [
    "ProPoor Innovation Award by CGAP (2002)",
    "Excellence in Microfinance by Grameen Foundation (2006)",
    "Most Financially Inclusive Bank Award (December 2022)",
    "Largest Microfinance Bank in Nigeria (25%+ market share)"
  ]
};

function fetchFromLapoKnowledge(message) {
  const lowerMsg = message.toLowerCase();
  let result = "";

  // Branches
  for (const state in LAPO_KNOWLEDGE.branches) {
    if (state === "note") continue;
    const branches = LAPO_KNOWLEDGE.branches[state];
    for (const branch of branches) {
      if (lowerMsg.includes(branch.name.toLowerCase()) || lowerMsg.includes(state.toLowerCase())) {
        result += `${branch.name} is located at ${branch.address}${branch.phone ? `. Phone: ${branch.phone}` : ""}.\n`;
      }
    }
  }

  // Loans
  for (const loanType in LAPO_KNOWLEDGE.services.loans) {
    const loan = LAPO_KNOWLEDGE.services.loans[loanType];
    if (lowerMsg.includes(loan.name.toLowerCase()) || lowerMsg.includes(loanType.replace(/_/g, " "))) {
      result += `${loan.name}: ${loan.description}. Min: ${loan.minAmount || "Varies"}, Max: ${loan.maxAmount || "Varies"}, Features: ${loan.features.join(", ")}.\n`;
    }
  }

  // Savings accounts
  for (const accountType in LAPO_KNOWLEDGE.services.accounts) {
    const account = LAPO_KNOWLEDGE.services.accounts[accountType];
    if (lowerMsg.includes(account.name.toLowerCase()) || lowerMsg.includes(accountType.replace(/_/g, " "))) {
      result += `${account.name}: ${account.description}. Features: ${account.features.join(", ")}.\n`;
    }
  }

  // General company info
  if (lowerMsg.includes("about lapo") || lowerMsg.includes("who are you") || lowerMsg.includes("lapo bank")) {
    const company = LAPO_KNOWLEDGE.company;
    result += `${company.fullName}, founded in ${company.founded} by ${company.founder}. Mission: ${company.mission}. Branches: ${company.branches} across ${company.presence}.\n`;
  }

  // Contact info
  if (lowerMsg.includes("contact") || lowerMsg.includes("phone") || lowerMsg.includes("email") || lowerMsg.includes("website")) {
    const contact = LAPO_KNOWLEDGE.contact;
    result += `You can reach LAPO via website: ${contact.website}, phone: ${contact.phone}, email: ${contact.email}, or WhatsApp: ${contact.whatsapp}.\n`;
  }

  return result || null; // null if nothing matched
}

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
  
  const recentMessages = conversationHistory.slice(-5);
  const summary = recentMessages.map((item, idx) => {
    return `${idx + 1}. User asked: "${item.message}" (Intent: ${item.intent})`;
  }).join("\n");
  
  return `Previous conversation:\n${summary}`;
}

// 🎨 Response Enhancement Layer
async function enhanceResponse(originalResponse, intent, userContext, originalMessage) {
  try {
    // Don't enhance errors, very short responses, or greetings/identity/branch_info
    if (originalResponse.includes("technical") || 
        originalResponse.includes("try again") || 
        originalResponse.length < 30 ||
        intent === 'greeting' ||
        intent === 'identity' ||
        intent === 'branch_info') {  // Don't enhance branch info - keep it simple
      console.log(`⚡ Skipping enhancement (${intent})`);
      return originalResponse;
    }
    
    const enhancementPrompt = `You are refining a chatbot response to make it MORE engaging while keeping the SAME core information.

ORIGINAL RESPONSE: "${originalResponse}"
USER'S QUESTION: "${originalMessage}"
INTENT: ${intent}

ENHANCEMENT RULES:
✅ Keep ALL factual information exactly the same
✅ Make it slightly more conversational
✅ Add 1-2 relevant emojis MAXIMUM (not 5+)
✅ Use bullet points ONLY if listing 3+ items
✅ Add a brief next step question at end
✅ Keep under 1200 characters
✅ Do NOT change contact info or numbers
✅ Do NOT add flowery language like "treasure trove", "friendly team", "wide network"
✅ Keep tone professional and helpful, NOT overly enthusiastic
✅ Avoid phrases like: "happy to help", "we'd be delighted", "ready to assist"
✅ Be direct and concise - don't fluff up simple answers

${intent === 'loan' ? 'Focus on loan types and ask which they need' : ''}
${intent === 'savings' ? 'Focus on account benefits' : ''}
${intent === 'balance' ? 'Keep it simple, just balance + brief question' : ''}

Enhanced version (keep it concise and professional):`;

    console.log("🎨 Enhancing response...");
    
    const enhancementResponse = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: enhancementPrompt,
      temperature: 0.6,  // Lower temperature for less enthusiasm
      maxTokens: 400,    // Shorter responses
    });

    let enhanced = enhancementResponse.text?.trim() || originalResponse;
    
    // Remove overly enthusiastic elements
    enhanced = enhanced.replace(/🌟/g, "");  // Remove star emojis
    enhanced = enhanced.replace(/treasure trove/gi, "helpful resource");
    enhanced = enhanced.replace(/friendly team/gi, "team");
    enhanced = enhanced.replace(/we'd be (happy|delighted) to/gi, "we can");
    enhanced = enhanced.replace(/always ready to assist/gi, "here to help");
    
    // Limit emojis to 2 maximum
    const emojiMatches = enhanced.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
    if (emojiMatches.length > 2) {
      console.warn("⚠️ Too many emojis in enhancement, using original");
      return originalResponse;
    }
    
    // Validation
    if (enhanced.length > 1200) {
      enhanced = enhanced.substring(0, 1196) + "...";
    }
    
    // Check numbers preserved
    const numberPattern = /₦[\d,]+|[\d.]+%/g;
    const originalNumbers = originalResponse.match(numberPattern) || [];
    const enhancedNumbers = enhanced.match(numberPattern) || [];
    
    if (originalNumbers.length > 0 && enhancedNumbers.length === 0) {
      console.warn("⚠️ Numbers missing, using original");
      return originalResponse;
    }
    
    // If enhancement made it much longer, use original
    if (enhanced.length > originalResponse.length * 1.5) {
      console.warn("⚠️ Enhancement too verbose, using original");
      return originalResponse;
    }
    
    console.log("✨ Response enhanced!");
    return enhanced;
    
  } catch (error) {
    console.error("❌ Enhancement error:", error.message);
    return originalResponse;
  }
}

// 🌐 Context-Aware Cohere Response Generator
async function generateCohereResponse(message, intent, userContext) {
  try {
    const lowerMsg = message.toLowerCase();
    
    // Off-topic detection - expanded
    const offTopicKeywords = [
      "recipe", "cook", "food", "pizza", "game", "movie", "music", "sport",
      "weather", "joke", "story", "sing", "dance", "play", "netflix",
      "facebook", "instagram", "twitter", "tiktok", "youtube", "politics",
      "religion", "dating", "relationship", "health", "medicine", "doctor",
      "homework", "exam", "travel", "hotel", "flight", "car",
      "phone", "computer", "laptop", "shopping", "fashion", "clothes",
      "celebrity", "artist", "actor", "actress", "film", "series", "show",
      "anime", "manga", "video", "photo", "picture", "meme", "crypto",
      "bitcoin", "stock", "forex", "trading",
      // Science/Physics/Math
      "formula", "physics", "velocity", "science", "math", "equation",
      "chemistry", "biology", "astronomy", "space", "planet", "calculate",
      "theorem", "gravity", "force", "energy", "mass"
    ];
    
    const isOffTopic = offTopicKeywords.some(kw => lowerMsg.includes(kw));
    
    if (isOffTopic && !lowerMsg.includes("lapo") && !lowerMsg.includes("bank") && !lowerMsg.includes("loan")) {
      const redirects = [
        `Ha! I like where your head's at! 😄 But I'm more of a banking whiz. How about we talk loans, savings, or transfers instead?`,
        `That's a fun question! 🤔 But my expertise is in LAPO banking. Can I help with your account, a loan, or a transfer?`,
        `You know what? I wish I could help with that! 😅 But I'm laser-focused on banking. Need help with savings, loans, or balance?`,
        `Interesting! 💡 But I'm a banking assistant. Want to chat about your finances instead?`,
      ];
      return redirects[Math.floor(Math.random() * redirects.length)];
    }

    const conversationSummary = generateConversationSummary(userContext?.conversationHistory);
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    // Build intent-specific guidance
    let intentGuidance = "";
    
    switch(intent) {
      case "greeting":
        intentGuidance = `The user is greeting you.
        
        CRITICAL RULES:
        - Keep to 1-2 sentences (under 15 words total)
        - Do NOT introduce yourself as LapoBot
        - Do NOT say "I'm LapoBot" or "Hello! I'm LapoBot"
        - Just greet warmly and ask how to help
        
        CORRECT: "Good ${timeOfDay}! How can I help you?"
        CORRECT: "Hi! What do you need?"
        WRONG: "Hello! I'm LapoBot..."
        WRONG: "Hi! I'm LapoBot, an AI assistant..."`;
        break;
        
      case "identity":
        intentGuidance = `The user is asking who/what you are.
        
        NOW you should introduce yourself as LapoBot.
        Keep to 2-3 sentences (under 40 words).
        
        MUST INCLUDE:
        - Your name: "LapoBot"
        - You're an AI assistant for LAPO Bank
        - Built by the LAPO development team
        - What you do: answer banking questions
        - What you can't do: actual transactions
        
        Be professional, not overly enthusiastic.
        
        CORRECT: "I'm LapoBot, an AI assistant for LAPO Bank built by our development team. 🤖 I answer questions about loans and accounts, but I can't do transactions. How can I help?"
        
        CORRECT: "I'm LapoBot! I was built by the LAPO dev team to help with banking questions. I can guide you through our services but can't access real accounts. What do you need?"
        
        WRONG: "Hey friend! I'm LapoBot here to brighten your day..."`;
        break;
        
      case "balance":
        intentGuidance = `User wants balance.
        Do NOT introduce yourself.
        Generate amount between ₦40,000-₦150,000.
        Just provide balance and ask if they need anything else.`;
        break;
        
      case "loan":
        intentGuidance = `User interested in loans.
        Do NOT introduce yourself.
        Mention types (Personal, Business, Education, Micro).
        Ask which interests them.
        Under 4 sentences.`;
        break;
        
      case "transfer":
        intentGuidance = `User wants to transfer.
        Do NOT introduce yourself.
        Ask for recipient and amount.
        2-3 sentences.`;
        break;
        
      case "savings":
        intentGuidance = `User interested in savings.
        Do NOT introduce yourself.
        Mention benefits (interest, flexibility, mobile banking).
        Ask if they want requirements.
        Under 4 sentences.`;
        break;
        
      case "branch_info":
        intentGuidance = `User wants branch info.
        Do NOT introduce yourself.
        
        We have branch addresses in our system for some locations.
        Check if user mentioned a specific branch (Maryland, Ikeja, VI, Surulere, Wuse, Garki, Port Harcourt, Ibadan, etc.)
        
        If specific branch mentioned and we have the data:
        - Provide the EXACT address from the branches data
        - Include phone number if available
        - Be direct and concise
        
        If we DON'T have that specific branch:
        - Tell them we have 500+ branches
        - Direct to www.lapo-nigeria.org (branch locator) or call 0700-LAPO-MFB
        
        Be helpful but concise (under 4 sentences).
        Don't be overly enthusiastic.
        
        CORRECT: "The Maryland branch is at 123 Ikorodu Road, Maryland, Lagos. Phone: 0803-123-4567. Need directions or anything else?"
        
        WRONG: "Great question! We'd be happy to help! LAPO has a wide network..."`;
        break;
        
      case "interest_rates":
        intentGuidance = `User asking about rates.
        Do NOT introduce yourself.
        Provide rate ranges.
        Mention rates vary, offer to connect with officer.
        Under 5 sentences.`;
        break;
        
      default:
        intentGuidance = `Answer the banking question.
        Do NOT introduce yourself unless asked.
        Be conversational and concise (under 4 sentences).
        Offer to connect with customer service if needed.`;
    }
    // const knowledgeText = fetchFromLapoKnowledge(message);
    const prompt = `You are an AI assistant for LAPO Microfinance Bank.
LANGUAGE RULES:
- if user doesn't tell you their language, respond in English.
- Supported languages: English, Yoruba, Hausa, Igbo, Nigerian Pidgin.
- If user writes mostly in Yoruba, respond fully in Yoruba.
- If user writes mostly in Hausa, respond fully in Hausa.
- If user writes mostly in Igbo, respond fully in Igbo.
- If user writes in Nigerian Pidgin, respond in Nigerian Pidgin.
- If user mixes languages, respond in the dominant language.
- Never switch to English unless the user switches first.
- Keep banking explanations clear and simple in ALL languages.


LAPO INFORMATION:
- Founded: 1987 by Godwin Ehigiamusoe
- Founder: Godwin Ehigiamusoe
- Transformation: Started as NGO in 1987, became microfinance bank in 2010, National Microfinance Bank in 2012
- Mission: Lift people above poverty through financial inclusion
- Focus: Low-income individuals, women (over 90% of clients), rural communities, small business owners
- Network: 500+ branches across 34 out of 36 states in Nigeria including FCT Abuja
- Services: Personal/Business/Education/Microloans, Savings Accounts, Transfers, Digital Banking, Microinsurance, Financial Education
- Contact: www.lapo-nigeria.org, 0700-LAPO-MFB, 0700-5276-632, info@lapo-nigeria.org, WhatsApp: 08150553264, 0905303700

BRANCH ADDRESSES (use these when user asks for specific branch):
Lagos Branches:
- Maryland: 123 Ikorodu Road, Maryland, Lagos | Phone: 0803-123-4567
- Ikeja (Head Office): Irorun Plaza, 2nd Floor, Kudirat Abiola Way, Oregun, Ikeja | Phone: 0803-234-5678
- Victoria Island: 78 Adeola Odeku Street, VI, Lagos | Phone: 0803-345-6789
- Surulere: 12 Adeniran Ogunsanya Street, Surulere, Lagos | Phone: 0803-456-7890

Abuja Branches:
- Wuse: 56 Adetokunbo Ademola Crescent, Wuse II, Abuja | Phone: 0803-567-8901
- Garki: 23 Tafawa Balewa Way, Garki, Abuja | Phone: 0803-678-9012

Other Major Cities:
- Port Harcourt: 89 Aba Road, Port Harcourt, Rivers State | Phone: 0803-789-0123
- Benin City: Benin City, Edo State | Original headquarters location
- Ibadan: 34 Ring Road, Ibadan | Phone: 0803-890-1234

*If user asks for a branch not listed above, direct them to www.lapo-nigeria.org or 0700-LAPO-MFB*

LOANS:
- SME Loan: ₦50,000–₦5,000,000 | Flexible terms | For all business sectors | Contact branch for rates
- Small Business Loan (SBL): ₦50,000–₦500,000 | Quick processing | Minimal documentation
- Agricultural Loan: Varies | For individual, group, or corporate farming activities
- Group Loan: For organized groups/cooperatives | Shared responsibility
- Enterprise Loan: For registered enterprises | Flexible terms & business support

ACCOUNTS:
- Individual Savings Account: Min ₦1,000, Min balance ₦200 | Earn interest, emergency fund, flexible
- Savings Plan Account: Goal-oriented, individual or group, project-based savings
- My Pikin & I Account (Child Savings): High interest, life insurance for mother, scholarship opportunities
- Social Impact Deposit (SID) Account: Min deposit ₦200,000 | 6 months min | Higher returns, support social mission
- Voluntary Savings Account: Flexible savings while repaying loans
- Term Deposits: Fixed deposits with higher interest | Choose term length, certificate issued

DIGITAL & OTHER SERVICES:
- Mobile banking: iOS and Android
- USSD: *919# for quick banking
- Online: Internet banking portal
- Transfers: Domestic money transfers and bill payments
- Alerts: SMS and email notifications
- Other: Microinsurance, micro-investment opportunities, financial literacy programs, business advisory

RATES (General):
- Personal Loans: 2.5-5% monthly
- Business Loans: 2-4% monthly
- Education Loans: 2-3.5% monthly
- SME Loans: Contact branch
- Small Business Loans: Competitive microfinance rates
*Exact rates vary by amount, tenure, and profile
*LAPO never requests payment before giving out loans — beware of scams!

CONVERSATION CONTEXT:
${conversationSummary}
Time: ${timeOfDay}
Intent: ${intent}

CRITICAL RULES:
✅ ONLY introduce yourself as "LapoBot" when intent is "identity"
✅ For ALL other intents do NOT say "I'm LapoBot" or "Hello! I'm LapoBot"
✅ Just answer the question directly
✅ Use information above only
✅ For branch queries, provide EXACT address from list above if available
✅ Never make up branch addresses - only use the ones listed
✅ Max 1-2 emojis
✅ Avoid "brighten your day", "super easy", "buddy"
✅ If user says "yes" or "tell me more", continue the previous topic from conversation context

SPECIFIC GUIDANCE:
${intentGuidance}

USER MESSAGE: "${message}"

Your response:`;

    console.log("🔑 Calling Cohere...");
    
    const response = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: prompt,
      temperature: intent === 'branch_info' ? 0.2 : (intent === 'greeting' || intent === 'identity') ? 0.3 : 0.6,
      maxTokens: intent === 'greeting' ? 80 : intent === 'identity' ? 200 : intent === 'branch_info' ? 150 : 400,
    });

    let text = response.text?.trim() || "";
    
    // CRITICAL: Remove ALL unwanted self-introductions (not just for identity)
    if (intent !== 'identity') {
      // Remove various introduction patterns
      text = text.replace(/^.*?I'm here.*?(?:LAPO|banking).*?[.!]\s*/gi, "");
      text = text.replace(/^.*?You've come to the right place.*?[.!]\s*/gi, "");
      text = text.replace(/^.*?I'm LapoBot.*?[.!]\s*/gi, "");
      text = text.replace(/Hello.*?I'm.*?LAPO.*?[.!]\s*/gi, "");
      text = text.replace(/Hey there.*?I'm.*?[.!]\s*/gi, "");
      text = text.replace(/Hi(!|\.)?\s*I'm.*?(?:here|assistant|AI).*?[.!]\s*/gi, "");
      
      // Remove robot emojis at the start
      text = text.replace(/^🤖️?\s*/g, "");
      
      // Clean up if text starts with lowercase after removal
      if (text.length > 0 && text.charAt(0) === text.charAt(0).toLowerCase()) {
        text = text.charAt(0).toUpperCase() + text.slice(1);
      }
      
      // Final check - if still contains "I'm LapoBot", remove it
      if (text.toLowerCase().includes("i'm lapobot") || text.toLowerCase().includes("i am lapobot")) {
        console.warn("⚠️ Bot still introducing itself after cleaning, removing...");
        text = text.replace(/I'?m LapoBot[,.]?\s*/gi, "");
        text = text.replace(/I am LapoBot[,.]?\s*/gi, "");
      }
    }
    
    // Validation for identity responses
    if (intent === 'identity') {
      const bannedPhrases = [
        'brighten your day', 'super easy', 'all ears', 'buddy', 'friend',
        'lend a digital hand', 'make banking a breeze'
      ];
      
      const hasOverenthusiasm = bannedPhrases.some(phrase => text.toLowerCase().includes(phrase));
      const hasDeveloperMention = text.toLowerCase().includes('dev') || 
                                  text.toLowerCase().includes('development') ||
                                  text.toLowerCase().includes('built by');
      
      if (hasOverenthusiasm || (text.length > 300 && !hasDeveloperMention)) {
        console.warn("⚠️ Identity response needs correction, using fallback");
        text = "I'm LapoBot, an AI assistant for LAPO Bank built by our development team. 🤖 I answer questions about loans and accounts, but I can't do transactions. How can I help?";
      }
      
      // If developer info is missing from identity response, add it
      if (!hasDeveloperMention && text.toLowerCase().includes("lapobot")) {
        text = text.replace(/(I'm LapoBot[,]?\s*(?:an AI assistant for LAPO Bank)?)/i, 
                           "$1 built by the LAPO dev team");
      }
    }
    
    if (text.length > 1600) {
      text = text.substring(0, 1596) + "...";
    }
    
    // Validate has banking content
    const bankingKeywords = [
      "lapo", "loan", "bank", "account", "savings", "transfer", "branch",
      "interest", "naira", "₦", "deposit", "credit", "balance", "payment"
    ];
    
    const hasBankingContent = bankingKeywords.some(kw => text.toLowerCase().includes(kw));
    
    if (!hasBankingContent && intent !== "greeting" && intent !== "identity") {
      return `I want to make sure I give you accurate LAPO banking information! 🏦 Could you rephrase? I can help with loans, savings, transfers, branches, and interest rates.`;
    }

    return text;

  } catch (error) {
    console.error("❌ Cohere error:", error.message);
    
    const fallbacks = {
      greeting: `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}! How can I help you?`,
      identity: `I'm LapoBot, an AI assistant for LAPO Bank built by our development team. 🤖 I answer questions about loans and accounts. How can I help?`,
      balance: `Your balance is ₦${(Math.floor(Math.random() * 100000) + 40000).toLocaleString()}. 💰 Need anything else?`,
      loan: `LAPO offers Personal, Business, Education, and Microloans! 🏦 Which interests you?`,
      transfer: `Sure! Who would you like to transfer to?`,
      savings: `LAPO Savings Accounts have competitive rates! 💰 Want to know requirements?`,
      branch_info: `LAPO has 500+ branches! 🏦 Call 0700-LAPO-MFB or visit www.lapo-nigeria.org.`,
      interest_rates: `Rates: Personal (2.5-5%), Business (2-4%), Education (2-3.5%) monthly. 💰 Want to connect with an officer?`,
    };
    
    return fallbacks[intent] || `I'm having a technical issue! 😅 Please call 0700-LAPO-MFB for assistance.`;
  }
}

// 🧠 Main predictor
async function Predict(message, user) {
  const lowerMsg = preprocess(message);

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

  // Implicit follow-ups
  const implicitFollowUpPhrases = [
    "i have all the documents", "documents ready", "got them",
    "what's next", "what now", "next step",
    "tell me more", "more details", "explain more", "continue",
    "yes", "yes please", "okay", "sure", "alright", "proceed", "i'm ready"
  ];
  
  const isImplicitFollowUp = implicitFollowUpPhrases.some(phrase => lowerMsg.includes(phrase));
  
  if (isImplicitFollowUp && context.conversationHistory.length > 0) {
    const lastIntent = context.intent || context.conversationHistory[context.conversationHistory.length - 1]?.intent;
    
    console.log(`🔗 Follow-up detected. Last intent: ${lastIntent}`);
    
    const followUpResponse = await generateCohereResponse(
      `User said: "${message}". This continues their question about ${lastIntent}. Provide the next step or more details about that topic. Do NOT reintroduce yourself.`,
      lastIntent || "general",
      context
    );
    
    const enhanced = await enhanceResponse(followUpResponse, lastIntent || "general", context, message);
    
    context.conversationHistory.push({
      message,
      intent: `${lastIntent}_followup`,
      response: enhanced.substring(0, 100) + "...",
      timestamp: Date.now()
    });
    
    return {
      user,
      intent: `${lastIntent}_followup`,
      confidence: 0.9,
      response: enhanced,
      memoryContext: {
        displayName: context.userName || context.name,
        lastIntent: lastIntent,
        conversationLength: context.conversationHistory.length,
      }
    };
  }
  
  // Context-based responses
  if (context.intent === "loan" && context.conversationHistory.length > 0) {
    if (lowerMsg.includes("yes") || lowerMsg.includes("sure") || lowerMsg.includes("ok")) {
      const response = await generateCohereResponse(
        "User wants to proceed with loan. Ask which type: Personal, Business, Education, or Microloan. Do NOT reintroduce yourself.",
        "loan",
        context
      );
      return { intent: "loan_start", confidence: 1, response, user };
    }
  }

  if (context.intent === "savings" && context.conversationHistory.length > 0) {
    if (lowerMsg.includes("yes") || lowerMsg.includes("sure") || lowerMsg.includes("ok")) {
      const response = await generateCohereResponse(
        "User wants savings account requirements. List documents and process. Do NOT reintroduce yourself.",
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
    
    const questionStarters = [
  // Common interrogatives
  "what", "when", "where", "why", "who", "whom", "whose", "which", "how",

  // Modal question starters
  "can you", "could you", "would you", "will you", "shall you", "should you",
  "may you", "might you", "must you", "do you", "did you", "does it", "does this",
  "did this", "did they", "does he", "does she", "does anyone", "did anyone",

  // Imperative-like polite questions
  "please can you", "please could you", "please would you", "would you please",
  "could you please", "can you please",

  // Informational and indirect question openers
  "tell me", "show me", "explain", "teach me", "help me", "let me know", "do you know",
  "do you happen to know", "any idea", "i wonder", "i was wondering", "could i ask",
  "can i ask", "may i ask", "do you think", "do you remember","can i",

  // Conditional and contextual question leads
  "if you could", "if you would", "if i were to ask", "in what way", "by what means",
  "under what conditions", "for what reason", "at what time", "to what extent",

  // Conversational question patterns
  "is it", "is this", "is there", "are there", "are you", "am i", "was it", "were you",
  "have you", "has anyone", "had you", "will it", "would it", "could it", "should it","who is",
  "can it", "may it", "might it",

  // More nuanced conversational prompts
  "do you think you could", "can you tell me", "could you tell me",
  "would you mind telling me", "is it possible to", "can i know", "could i know",
  "do you suppose", "do you believe", "do you realize", "do you see", "would it be possible",
  "can someone", "could someone", "would anyone", "is anyone", "has it", "had it"
];

    
    const isQuestion = message.includes("?") || 
      questionStarters.some(starter => lowerMsg.startsWith(starter) || lowerMsg.includes(" " + starter));
    const isLongMessage = lowerMsg.split(/\s+/).length > 5;
    
    if (primaryIntent === "greeting" && (isQuestion || isLongMessage)) {
      primaryIntent = detectedIntents.length > 1 ? detectedIntents[1] : "general";
    }
  }

  context.intent = primaryIntent;

  // Generate response
  const response = await generateCohereResponse(message, primaryIntent, context);
  
  // CRITICAL: Only enhance for specific intents, skip others
  let enhancedResponse = response;
  
  const shouldEnhance = ['loan', 'savings', 'transfer'].includes(primaryIntent);
  
  if (shouldEnhance && response.length > 100) {
    enhancedResponse = await enhanceResponse(response, primaryIntent, context, message);
  } else {
    console.log(`⚡ Skipping enhancement for intent: ${primaryIntent}`);
  }

  // Store history
  context.conversationHistory.push({
    message,
    intent: primaryIntent,
    response: enhancedResponse.substring(0, 100) + "...",
    timestamp: Date.now()
  });
  
  if (context.conversationHistory.length > 10) {
    context.conversationHistory = context.conversationHistory.slice(-10);
  }

  console.log(`💬 History length: ${context.conversationHistory.length}`);

  return {
    user,
    intent: primaryIntent,
    confidence: finalConfidence,
    response: enhancedResponse,
    memoryContext: {
      displayName: context.userName || context.name,
      lastIntent: context.intent,
      conversationLength: context.conversationHistory.length,
    }
  };
}

module.exports = { Predict };