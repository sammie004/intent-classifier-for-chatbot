const { CohereClient } = require("cohere-ai");
require("dotenv").config();

const cohere = new CohereClient({
  token: process.env.CO_API_KEY,
});

async function testCohere() {
  try {
    console.log("🔑 API Key:", process.env.SECRET_KEY ? "Found" : "Missing");
    console.log("🧪 Testing Cohere connection...");
    
    const response = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: "Hello, just testing the connection",
      temperature: 0.7,
    });
    
    console.log("✅ Success! Cohere is working.");
    console.log("📝 Response:", response.text);
  } catch (error) {
    console.error("❌ Cohere test failed:", error.message);
    console.error("Full error:", error);
  }
}

testCohere();