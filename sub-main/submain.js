const { ClassifyMessage } = require('../intent-main/intent-classifier');
const user = `semilore`;

// ===== Intent Handlers =====
function handleGreeting(user) {
  return `Hi there ${user}, how may I help you? 👋`;
}

function handleBalance(user) {
  // Normally this would query your database
  return `Dear ${user}, your current account balance is ₦45,000. 💰`;
}

function handleLoan(user) {
  return `We offer personal and business loans with flexible repayment plans. Would you like to begin your loan application, ${user}? 🏦`;
}

function handleUnknown(user) {
  return `Sorry ${user}, I didn’t quite understand that. Could you rephrase? 🤔`;
}

// ===== Main Logic =====
function Predict(message, user) {
  const intent = ClassifyMessage(message);
  console.log(`Detected intent: ${intent}`);

  switch (intent) {
    case 'greeting':
      return handleGreeting(user);
    case 'balance':
      return handleBalance(user);
    case 'loan':
      return handleLoan(user);
    default:
      return handleUnknown(user);
  }
}

// ===== Test Messages =====
const messages = [
  'hey there',
  'I want to borrow some money',
  'can you show my balance?',
  'hello',
  'do you know what time it is?'
];

// Run test
messages.forEach(msg => {
  console.log(`\n👤 ${user}: ${msg}`);
  console.log(`🤖 Bot: ${Predict(msg, user)}`);
});

// ===== Export for external use =====
module.exports = { Predict };
