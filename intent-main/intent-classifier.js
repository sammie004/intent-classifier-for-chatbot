// intent-classifier.js
const { CohereClient } = require("cohere-ai");
require("dotenv").config();

const cohere = new CohereClient({
  token: process.env.SECRET_KEY,
});

// === Example training data for different intents ===
const trainingData = {
  greeting: ["hello", "hi", "good morning", "hey there", "what’s up"],
  balance: [
    "what is my balance",
    "show my account balance",
    "how much money do I have",
    "check my funds",
  ],
  loan: [
    "I need a loan",
    "can I apply for a loan",
    "how do I get a loan",
    "loan details please",
  ],
};

// === Cosine similarity helper ===
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}

// === Cohere Embedding Classifier ===
async function classifyWithCohere(message) {
  try {
    const msgEmbResponse = await cohere.embed({
      model: "embed-english-v3.0",
      texts: [message],
      input_type: "classification", // ✅ Required for v3.0
    });

    const msgEmb = msgEmbResponse.embeddings[0];

    // Cache training embeddings
    if (!classifyWithCohere.trainingEmbeddings) {
      classifyWithCohere.trainingEmbeddings = {};

      for (const [intent, samples] of Object.entries(trainingData)) {
        classifyWithCohere.trainingEmbeddings[intent] = [];

        for (const sample of samples) {
          const embResp = await cohere.embed({
            model: "embed-english-v3.0",
            texts: [sample],
            input_type: "classification", // ✅ Add this too
          });

          classifyWithCohere.trainingEmbeddings[intent].push(
            embResp.embeddings[0]
          );
        }
      }
    }

    // Compare message embedding to training embeddings
    let bestIntent = "unknown";
    let bestScore = 0;

    for (const [intent, embeddings] of Object.entries(
      classifyWithCohere.trainingEmbeddings
    )) {
      for (const emb of embeddings) {
        const score = cosineSimilarity(msgEmb, emb);
        if (score > bestScore) {
          bestScore = score;
          bestIntent = intent;
        }
      }
    }

    return {
      intent: bestIntent,
      confidence: bestScore,
    };
  } catch (err) {
    console.error("Cohere error:", err);
    return { intent: "unknown", confidence: 0 };
  }
}

// === Unified Classifier Entry Point ===
async function ClassifyMessage(message) {
  if (!message || message.trim().length === 0) {
    return { intent: "unknown", confidence: 0 };
  }

  // Future: You can add more layers (offline model, fuzzy matching, etc.)
  return await classifyWithCohere(message);
}

module.exports = { ClassifyMessage };
