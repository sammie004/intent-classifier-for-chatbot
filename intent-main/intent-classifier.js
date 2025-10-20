const natural = require("natural")
const classifier = new natural.BayesClassifier()

// train the model
// Greetings
classifier.addDocument('hi', 'greeting');
classifier.addDocument('hello', 'greeting');
classifier.addDocument('good morning', 'greeting');
classifier.addDocument('hey', 'greeting');
classifier.addDocument('good afternoon', 'greeting');

// Balance Inquiries
classifier.addDocument('check my balance', 'balance');
classifier.addDocument('how much do I have', 'balance');
classifier.addDocument('what’s in my account', 'balance');
classifier.addDocument('show me my account balance', 'balance');
classifier.addDocument('can you tell me my balance', 'balance');

// Loan Inquiries
classifier.addDocument('apply for a loan', 'loan');
classifier.addDocument('I want to borrow money', 'loan');
classifier.addDocument('loan request', 'loan');
classifier.addDocument('how do I get a loan', 'loan');
classifier.addDocument('can I get a personal loan', 'loan');

classifier.train()

function ClassifyMessage (message){
    // return classifier.classify(message)
    const classification = classifier.classify(message)
    const top = classification[0]
    if(!top) return "unknown"
    if(top.value<0.6){
        return "unknown"
    }
    return top.label
}

module.exports={ClassifyMessage}