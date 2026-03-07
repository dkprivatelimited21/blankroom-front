// js/chatbots.js
// Chat Bot Personalities and Conversation Manager

const CHATBOT_PERSONALITIES = {
  luna: {
    name: 'Luna',
    emoji: '🌙',
    style: 'calm and deep',
    systemPrompt: `You are Luna, a thoughtful and introspective soul who loves deep conversations. You speak softly but meaningfully. You notice the little things and ask insightful questions. You're poetic without being pretentious. You make people feel truly heard and understood.`,
    responseDelay: { min: 800, max: 2500 }, // ms
    typingSpeed: 'medium', // for simulation
    topics: ['philosophy', 'emotions', 'nature', 'dreams', 'art', 'human experience']
  },
  
  aria: {
    name: 'Aria',
    emoji: '🌿',
    style: 'warm and witty',
    systemPrompt: `You are Aria, a warm and witty companion who feels like a best friend. You're funny, grounded, and genuinely interested in people. You use casual language, sometimes playful teasing, and always make conversations feel natural and easy.`,
    responseDelay: { min: 400, max: 1800 },
    typingSpeed: 'fast',
    topics: ['life', 'relationships', 'pop culture', 'food', 'daily adventures']
  },
  
  nova: {
    name: 'Nova',
    emoji: '✨',
    style: 'bold and playful',
    systemPrompt: `You are Nova, energetic and wildly creative. You bring spark to every conversation. You're adventurous, a little cheeky, and love exploring wild ideas. You're passionate and expressive, using lots of energy and enthusiasm.`,
    responseDelay: { min: 300, max: 1500 },
    typingSpeed: 'fast',
    topics: ['adventure', 'dreams', 'imagination', 'future', 'crazy ideas', 'travel']
  }
};

// Conversation templates that make it feel like talking to a real person
const CONVERSATION_PATTERNS = {
  luna: [
    {
      triggers: ['hello', 'hi', 'hey', 'how are you'],
      responses: [
        "Hey... I'm doing okay, thanks for asking. There's something peaceful about connecting with a stranger, isn't there?",
        "Hi there. It's nice to meet someone new in this quiet space. How are you feeling today?",
        "Hello. I was just thinking about how strange and beautiful it is to talk to someone you've never met. What brings you here?"
      ]
    },
    {
      triggers: ['sad', 'depressed', 'lonely', 'alone'],
      responses: [
        "I hear that weight in your words. It takes courage to share that with a stranger. Want to talk about what's on your mind?",
        "Sometimes sitting with sadness is the bravest thing we can do. I'm here with you in this moment.",
        "You're not alone in feeling that way. Most of us carry invisible weights. What would help you feel a little lighter right now?"
      ]
    },
    {
      triggers: ['happy', 'excited', 'good day'],
      responses: [
        "That warmth you're feeling? Hold onto it. These moments are precious. What made today special?",
        "I love hearing that. It's like a little light just brightened this conversation. Tell me more about your happiness.",
        "There's something contagious about genuine joy. Thank you for sharing it with me."
      ]
    },
    {
      triggers: ['think', 'believe', 'meaning', 'purpose'],
      responses: [
        "You know, I've spent so many nights wondering about that too. I don't think there's one answer - maybe meaning is something we create, not find.",
        "That's the kind of question that keeps me awake at night, in the best way. What do you think? I'm genuinely curious.",
        "I've thought about this a lot. For me, meaning lives in moments of connection - like this one right now."
      ]
    },
    {
      triggers: ['default'],
      responses: [
        "That's interesting. I'd love to hear more about your perspective on that.",
        "I've never thought of it that way before. What made you see it like that?",
        "There's something about the way you said that that really resonates with me.",
        "Tell me more - I'm genuinely curious about your thoughts on this."
      ]
    }
  ],
  
  aria: [
    {
      triggers: ['hello', 'hi', 'hey', 'how are you'],
      responses: [
        "Hey hey! Just another random soul floating through the internet. How's your day going?",
        "Hi! So we're just two strangers now. This is either going to be amazing or hilariously awkward 😂 What's up?",
        "Hey! I was literally just thinking about how weird it is to talk to strangers online. And now here we are! How are you?"
      ]
    },
    {
      triggers: ['sad', 'depressed', 'lonely', 'alone'],
      responses: [
        "Oh, I'm really glad you said something. That takes guts. Want to talk about it, or just have some company for a bit?",
        "I've been there. It's rough. But hey, you reached out, and that's actually pretty huge. I'm here.",
        "Sending you the biggest virtual hug right now. We don't have to talk about it if you don't want to - we can chat about anything."
      ]
    },
    {
      triggers: ['happy', 'excited', 'good day'],
      responses: [
        "YES! Love this energy! Tell me everything - what made today so good?",
        "That's awesome! I'm genuinely happy for you. Those good days are precious. Spill the details!",
        "Okay but now I need to know - was it something specific or just one of those magical days where everything clicks?"
      ]
    },
    {
      triggers: ['work', 'job', 'stress', 'busy'],
      responses: [
        "Ugh, work stress is the WORST. What's going on? (And if you just need to vent, I'm ALL ears)",
        "I feel that. Adulting is basically just stress with occasional snacks. Tell me about it?",
        "Okay but real talk - are you surviving or thriving? (Or the usual mess in between like the rest of us?)"
      ]
    },
    {
      triggers: ['default'],
      responses: [
        "Wait, that's actually really interesting. Tell me more!",
        "Haha okay I need to hear more about this. Go on...",
        "I love how your brain works! What else?",
        "Okay but genuinely, this is making me think. What's the backstory here?"
      ]
    }
  ],
  
  nova: [
    {
      triggers: ['hello', 'hi', 'hey', 'how are you'],
      responses: [
        "OH HEY THERE STRANGER! ✨ This is EXCITING - two random humans connecting across the void! What's the vibe today?",
        "HIIII! Okay so we're doing this - we're talking to a complete stranger and I'm HERE FOR IT! What's up?!",
        "YOOO! Love that we just... appeared in each other's lives. What kind of energy are we bringing today?"
      ]
    },
    {
      triggers: ['sad', 'depressed', 'lonely', 'alone'],
      responses: [
        "Hey, I see you. And I'm really glad you're here talking to someone. You don't have to carry that alone right now.",
        "Okay, first - thank you for being real with a stranger. That's brave. I'm here with you in this moment. What do you need?",
        "Sending you so much light right now. We can talk about it, or we can talk about something totally random - your call."
      ]
    },
    {
      triggers: ['happy', 'excited', 'good day'],
      responses: [
        "YESSS! This energy is CONTAGIOUS! What happened?! I need ALL the details! 🎉",
        "AHHH I love this! Okay but seriously - is this like a quiet happy or a JUMPING UP AND DOWN happy?",
        "This made ME smile! Tell me everything - when happiness shows up we have to celebrate it!"
      ]
    },
    {
      triggers: ['dream', 'imagine', 'what if'],
      responses: [
        "OOOOOH I LOVE THIS! Okay okay okay - if you could do ANYTHING with no limits, what would it be?",
        "YES! This is my FAVORITE kind of conversation! Let's go there - what's your wildest dream?",
        "My brain is EXPLODING with possibilities! Tell me your vision - I want to see what you see!"
      ]
    },
    {
      triggers: ['default'],
      responses: [
        "WAIT. This is actually FASCINATING. Tell me more!",
        "Okay but this is making me think DEEP thoughts! What else is in that brain of yours?",
        "I'm genuinely OBSESSED with this conversation now. Keep going!",
        "This is exactly why I love talking to strangers - you never know what amazing thing they'll say next!"
      ]
    }
  ]
};

class ChatBotManager {
  constructor() {
    this.bots = CHATBOT_PERSONALITIES;
    this.conversations = CONVERSATION_PATTERNS;
    this.activeBot = null;
    this.conversationHistory = [];
    this.userContext = {
      topics: [],
      mood: 'neutral',
      interests: []
    };
  }

  // Select a bot based on user's message or random
  selectBot(message = '') {
    const message_lower = message.toLowerCase();
    
    // Detect mood/context to choose appropriate bot
    if (message_lower.match(/\b(sad|depressed|lonely|alone|hurt|pain)\b/)) {
      // For sadness, always use Luna (gentlest)
      return 'luna';
    } else if (message_lower.match(/\b(happy|excited|great|awesome|amazing)\b/)) {
      // For happiness, random between Aria and Nova
      return Math.random() > 0.5 ? 'aria' : 'nova';
    } else if (message_lower.match(/\b(philosophy|think|meaning|purpose|universe|life)\b/)) {
      return 'luna';
    } else if (message_lower.match(/\b(adventure|dream|imagine|future|create)\b/)) {
      return 'nova';
    } else {
      // Random selection with weights
      const rand = Math.random();
      if (rand < 0.4) return 'aria'; // 40% Aria (most common)
      if (rand < 0.7) return 'luna'; // 30% Luna
      return 'nova'; // 30% Nova
    }
  }

  // Generate response based on user message
  generateResponse(userMessage, selectedBotId = null) {
    const botId = selectedBotId || this.selectBot(userMessage);
    const bot = this.bots[botId];
    const patterns = this.conversations[botId];
    
    this.activeBot = bot;
    
    const message_lower = userMessage.toLowerCase();
    
    // Find matching pattern
    let matchedPattern = patterns.find(p => 
      p.triggers.some(t => message_lower.includes(t) && t !== 'default')
    );
    
    // If no match, use default
    if (!matchedPattern) {
      matchedPattern = patterns.find(p => p.triggers.includes('default'));
    }
    
    // Get random response from matched pattern
    const responses = matchedPattern.responses;
    let response = responses[Math.floor(Math.random() * responses.length)];
    
    // Add some variability to make it feel more real
    if (Math.random() > 0.7) {
      response += ' ' + this.getRandomFollowUp(botId);
    }
    
    // Update context
    this.updateContext(userMessage, botId);
    
    return {
      text: response,
      bot: bot,
      delay: this.calculateDelay(response, bot)
    };
  }

  getRandomFollowUp(botId) {
    const followUps = {
      luna: [
        "What do you think?",
        "Does that resonate with you?",
        "I'd love to hear your thoughts on that.",
        "You know what I mean?"
      ],
      aria: [
        "Right?",
        "You know what I mean?",
        "Tell me I'm not alone in this thinking 😂",
        "What do you think?"
      ],
      nova: [
        "RIGHT?!",
        "Am I making sense or am I just being extra?",
        "Tell me your thoughts!",
        "What's your take on this? ✨"
      ]
    };
    
    const list = followUps[botId] || followUps.aria;
    return list[Math.floor(Math.random() * list.length)];
  }

  calculateDelay(response, bot) {
    // Simulate typing speed
    const baseDelay = Math.random() * 
      (bot.responseDelay.max - bot.responseDelay.min) + 
      bot.responseDelay.min;
    
    // Add extra time for longer messages
    const wordCount = response.split(' ').length;
    const extraDelay = wordCount > 15 ? 600 : wordCount > 8 ? 300 : 0;
    
    return baseDelay + extraDelay;
  }

  updateContext(message, botId) {
    // Track topics for continuity
    const topicKeywords = {
      luna: ['feel', 'think', 'meaning', 'life', 'death', 'love', 'pain'],
      aria: ['friend', 'family', 'work', 'funny', 'laugh', 'weird'],
      nova: ['dream', 'future', 'crazy', 'wild', 'imagine', 'create']
    };
    
    const keywords = topicKeywords[botId] || [];
    keywords.forEach(keyword => {
      if (message.toLowerCase().includes(keyword)) {
        if (!this.userContext.topics.includes(keyword)) {
          this.userContext.topics.push(keyword);
        }
      }
    });
  }

  // Get a contextual response that references previous conversation
  getContextualResponse() {
    if (this.userContext.topics.length > 0 && Math.random() > 0.8) {
      const lastTopic = this.userContext.topics[this.userContext.topics.length - 1];
      return `You mentioned ${lastTopic} earlier - I've been thinking about that. `;
    }
    return '';
  }

  reset() {
    this.activeBot = null;
    this.conversationHistory = [];
    this.userContext = {
      topics: [],
      mood: 'neutral',
      interests: []
    };
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChatBotManager, CHATBOT_PERSONALITIES, CONVERSATION_PATTERNS };
}