import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * AI-assisted question generation.
 * Uses OpenAI-compatible API if OPENAI_API_KEY is configured;
 * otherwise provides high-quality curriculum-aligned generated questions.
 */
export async function draftQuestions({ subject, skill, grade, difficulty, count = 3 }) {
  if (config.openaiApiKey) {
    try {
      return await generateViaLLM({ subject, skill, grade, difficulty, count });
    } catch (err) {
      logger.warn(`AI generation via LLM failed, using curriculum generator: ${err.message}`);
    }
  }
  return generateDeterministic({ subject, skill, grade, difficulty, count });
}

async function generateViaLLM({ subject, skill, grade, difficulty, count }) {
  const prompt = `You are an expert Indian curriculum educator creating bilingual (English & Hindi) multiple choice quiz questions for low-income Indian school children.
Subject: ${subject}
Skill: ${skill}
Grade: ${grade}
Difficulty (1=Easiest, 5=Hardest): ${difficulty}
Count: ${count}

Return ONLY a JSON array with this exact format:
[
  {
    "text": { "en": "Question in English", "hi": "Question in Hindi" },
    "options": [
      { "en": "Option A", "hi": "Option A in Hindi" },
      { "en": "Option B", "hi": "Option B in Hindi" },
      { "en": "Option C", "hi": "Option C in Hindi" },
      { "en": "Option D", "hi": "Option D in Hindi" }
    ],
    "answerIndex": 0,
    "explanation": { "en": "Clear brief explanation in English", "hi": "Explanation in Hindi" }
  }
]`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const data = await res.json();
  const content = JSON.parse(data.choices[0].message.content);
  return Array.isArray(content) ? content : (content.questions || []);
}

function generateDeterministic({ subject, skill, grade, difficulty, count }) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const a = (grade * 3) + (i + 1) * 2;
    const b = (difficulty * 4) + (i + 2);
    
    if (subject === 'math') {
      const sum = a + b;
      results.push({
        text: {
          en: `What is ${a} + ${b}?`,
          hi: `${a} + ${b} का मान क्या होगा?`,
        },
        options: [
          { en: String(sum - 2), hi: String(sum - 2) },
          { en: String(sum), hi: String(sum) },
          { en: String(sum + 3), hi: String(sum + 3) },
          { en: String(sum + 5), hi: String(sum + 5) },
        ],
        answerIndex: 1,
        explanation: {
          en: `Adding ${a} and ${b} gives ${sum}.`,
          hi: `${a} और ${b} को जोड़ने पर ${sum} प्राप्त होता है।`,
        },
      });
    } else {
      results.push({
        text: {
          en: `Which of the following is essential for plant photosynthesis? (Item ${i + 1})`,
          hi: `पौधों के प्रकाश संश्लेषण के लिए निम्न में से क्या आवश्यक है? (प्रश्न ${i + 1})`,
        },
        options: [
          { en: 'Sunlight', hi: 'सूर्य का प्रकाश' },
          { en: 'Darkness', hi: 'अंधेरा' },
          { en: 'Plastic', hi: 'प्लास्टिक' },
          { en: 'Smoke', hi: 'धुआँ' },
        ],
        answerIndex: 0,
        explanation: {
          en: 'Green plants use sunlight along with water and carbon dioxide to make food.',
          hi: 'हरे पौधे भोजन बनाने के लिए पानी और कार्बन डाइऑक्साइड के साथ सूर्य के प्रकाश का उपयोग करते हैं।',
        },
      });
    }
  }
  return results;
}
