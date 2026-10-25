import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { User, Child, Question, Pool, Achievement } from '../models/index.js';
import { ACHIEVEMENT_CODES } from '../policy.js';

const n = (...v) => v.map((x) => ({ en: x, hi: x }));
const o = (en, hi) => en.map((x, i) => ({ en: x, hi: hi[i] }));
const t = (en, hi = en) => ({ en, hi });

const QUESTIONS = [
  // Math Addition & Subtraction (Grade 3-4)
  ['math', 'math.addsub', 3, 1, t('7 + 8 = ?'), n('13', '14', '15', '16'), 2, 'Count on 8 from 7 gives 15.'],
  ['math', 'math.addsub', 3, 1, t('12 − 5 = ?'), n('6', '7', '8', '9'), 1, 'Take 5 away from 12 gives 7.'],
  ['math', 'math.addsub', 3, 2, t('25 + 36 = ?'), n('51', '61', '71', '59'), 1, '20 + 30 = 50, and 5 + 6 = 11. 50 + 11 = 61.'],
  ['math', 'math.addsub', 4, 3, t('125 + 378 = ?'), n('493', '503', '513', '523'), 1, 'Add ones (5+8=13), tens (2+7+1=10), then hundreds (1+3+1=5): 503.'],
  ['math', 'math.addsub', 4, 3, t('500 − 247 = ?'), n('243', '253', '263', '353'), 1, '500 - 200 = 300, 300 - 47 = 253.'],

  // Math Multiplication & Division (Grade 3-5)
  ['math', 'math.muldiv', 3, 2, t('6 × 4 = ?'), n('20', '24', '28', '30'), 1, '6 groups of 4 make 24.'],
  ['math', 'math.muldiv', 3, 2, t('45 ÷ 9 = ?'), n('4', '5', '6', '7'), 1, '9 × 5 = 45, so 45 ÷ 9 = 5.'],
  ['math', 'math.muldiv', 4, 3, t('14 × 6 = ?'), n('74', '84', '94', '64'), 1, '10 × 6 = 60 and 4 × 6 = 24. 60 + 24 = 84.'],
  ['math', 'math.muldiv', 5, 3, t('144 ÷ 12 = ?'), n('10', '11', '12', '13'), 2, '12 × 12 = 144.'],
  ['math', 'math.muldiv', 5, 4, t('25 × 16 = ?'), n('350', '400', '450', '500'), 1, '25 × 4 = 100. 100 × 4 = 400.'],

  // Math Fractions & Decimals (Grade 5-6)
  ['math', 'math.fractions', 5, 3, t('What is 3/4 of 20?', '20 का 3/4 कितना होता है?'), n('10', '12', '15', '16'), 2, '20 ÷ 4 = 5, and 5 × 3 = 15.'],
  ['math', 'math.fractions', 5, 4, t('0.5 + 0.25 = ?'), n('0.75', '0.65', '0.7', '0.8'), 0, 'Half plus a quarter is three quarters: 0.75.'],
  ['math', 'math.fractions', 6, 4, t('Simplify the fraction 18/24', '18/24 भिन्न को सरलतम रूप में लिखें'), n('2/3', '3/4', '4/5', '5/6'), 1, 'Divide numerator and denominator by 6: 18÷6=3, 24÷6=4.'],
  ['math', 'math.percentages', 6, 4, t('What is 15% of 200?', '200 का 15% कितना है?'), n('20', '25', '30', '35'), 2, '10% of 200 is 20, 5% is 10, so 20 + 10 = 30.'],

  // Math Geometry (Grade 4-6)
  ['math', 'math.geometry', 4, 2, t('How many sides does a hexagon have?', 'षट्भुज की कितनी भुजाएँ होती हैं?'), n('5', '6', '7', '8'), 1, 'Hexa means six.'],
  ['math', 'math.geometry', 5, 3, t('Perimeter of a rectangle 8 cm by 5 cm?', '8 सेमी और 5 सेमी भुजाओं वाले आयत का परिमाप कितना है?'), o(['13 cm', '26 cm', '40 cm', '18 cm'], ['13 सेमी', '26 सेमी', '40 सेमी', '18 सेमी']), 1, 'Perimeter = 2 × (8 + 5) = 26 cm.'],
  ['math', 'math.geometry', 6, 4, t('Area of a triangle with base 10 cm and height 6 cm?', 'आधार 10 सेमी और ऊँचाई 6 सेमी वाले त्रिभुज का क्षेत्रफल कितना है?'), o(['30 cm²', '60 cm²', '16 cm²', '36 cm²'], ['30 सेमी²', '60 सेमी²', '16 सेमी²', '36 सेमी²']), 0, 'Area = 1/2 × base × height = 0.5 × 10 × 6 = 30 cm².'],

  // Science Life (Grade 3-6)
  ['science', 'sci.life', 3, 1, t('Which gas do we breathe in to stay alive?', 'जीवित रहने के लिए हम कौन-सी गैस साँस में लेते हैं?'), o(['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Helium'], ['ऑक्सीजन', 'कार्बन डाइऑक्साइड', 'नाइट्रोजन', 'हीलियम']), 0, 'Our body uses oxygen from the air.'],
  ['science', 'sci.life', 3, 1, t('Which organ pumps blood around the body?', 'कौन-सा अंग पूरे शरीर में रक्त पंप करता है?'), o(['Lungs', 'Liver', 'Heart', 'Kidney'], ['फेफड़े', 'यकृत', 'हृदय', 'गुर्दा']), 2, 'The heart is a muscular pump.'],
  ['science', 'sci.life', 3, 2, t('Which part of a plant absorbs water from the soil?', 'पौधे का कौन-सा भाग मिट्टी से पानी सोखता है?'), o(['Leaf', 'Stem', 'Root', 'Flower'], ['पत्ती', 'तना', 'जड़', 'फूल']), 2, 'Roots take in water and minerals.'],
  ['science', 'sci.life', 4, 2, t('Plants make their food by…', 'पौधे अपना भोजन किस प्रक्रिया द्वारा बनाते हैं?'), o(['Digestion', 'Photosynthesis', 'Respiration', 'Evaporation'], ['पाचन', 'प्रकाश संश्लेषण', 'श्वसन', 'वाष्पीकरण']), 1, 'Leaves use sunlight, water, and CO2 in photosynthesis.'],
  ['science', 'sci.life', 5, 3, t('Which vitamin does our skin make in sunlight?', 'धूप में हमारी त्वचा कौन-सा विटामिन बनाती है?'), o(['Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin K'], ['विटामिन A', 'विटामिन C', 'विटामिन D', 'विटामिन K']), 2, 'Sunlight stimulates production of vitamin D.'],
  ['science', 'sci.life', 6, 4, t('Loss of water vapour through leaves is called…', 'पत्तियों से जलवाष्प निकलने की प्रक्रिया क्या कहलाती है?'), o(['Transpiration', 'Germination', 'Pollination', 'Fertilisation'], ['वाष्पोत्सर्जन', 'अंकुरण', 'परागण', 'निषेचन']), 0, 'Transpiration occurs through stomata.'],

  // Science Matter & Materials (Grade 4-6)
  ['science', 'sci.matter', 4, 2, t('At sea level, water boils at…', 'समुद्र तल पर पानी किस तापमान पर उबलता है?'), o(['50 °C', '100 °C', '150 °C', '200 °C'], ['50 °C', '100 °C', '150 °C', '200 °C']), 1, 'Water boils at 100 °C.'],
  ['science', 'sci.matter', 5, 3, t('A liquid changing into gas is called…', 'द्रव का गैस में बदलना क्या कहलाता है?'), o(['Melting', 'Freezing', 'Evaporation', 'Condensation'], ['पिघलना', 'जमना', 'वाष्पीकरण', 'संघनन']), 2, 'Liquid turning to gas is evaporation.'],
  ['science', 'sci.matter', 6, 4, t('What is the chemical formula of water?', 'पानी का रासायनिक सूत्र क्या है?'), o(['CO2', 'NaCl', 'H2O', 'O2'], ['CO2', 'NaCl', 'H2O', 'O2']), 2, 'Water consists of two Hydrogen atoms and one Oxygen atom: H2O.'],

  // Science Force & Energy (Grade 4-6)
  ['science', 'sci.energy', 4, 2, t('The force that pulls objects towards Earth is…', 'वस्तुओं को पृथ्वी की ओर खींचने वाला बल क्या है?'), o(['Friction', 'Magnetism', 'Gravity', 'Tension'], ['घर्षण', 'चुंबकत्व', 'गुरुत्वाकर्षण', 'तनाव']), 2, 'Gravity pulls masses together.'],
  ['science', 'sci.energy', 5, 3, t('Which of these is a good conductor of electricity?', 'इनमें से कौन-सा बिजली का अच्छा सुचालक है?'), o(['Rubber', 'Copper', 'Plastic', 'Wood'], ['रबर', 'ताँबा', 'प्लास्टिक', 'लकड़ी']), 1, 'Metals like copper have free electrons allowing electric current.'],
  ['science', 'sci.energy', 6, 4, t('The SI unit of force is…', 'बल का SI मात्रक क्या है?'), o(['Joule', 'Newton', 'Watt', 'Pascal'], ['जूल', 'न्यूटन', 'वाट', 'पास्कल']), 1, 'Force is measured in newtons (N).'],
];

const ACHIEVEMENTS = [
  {
    code: ACHIEVEMENT_CODES.FIRST_CORRECT,
    name: { en: 'First Spark', hi: 'पहला सितारा' },
    description: { en: 'Answered your first question correctly!', hi: 'पहला सवाल सही जवाब दिया!' },
    icon: '✨',
    category: 'milestone',
    xpReward: 50,
  },
  {
    code: ACHIEVEMENT_CODES.TEN_CORRECT,
    name: { en: 'Curious Explorer', hi: 'जिज्ञासु खोजकर्ता' },
    description: { en: 'Answered 10 questions correctly.', hi: '10 सवाल सही हल किए।' },
    icon: '🧭',
    category: 'milestone',
    xpReward: 100,
  },
  {
    code: ACHIEVEMENT_CODES.FIFTY_CORRECT,
    name: { en: 'Knowledge Seeker', hi: 'ज्ञान साधक' },
    description: { en: 'Answered 50 questions correctly!', hi: '50 सवाल सही हल किए!' },
    icon: '📚',
    category: 'milestone',
    xpReward: 250,
  },
  {
    code: ACHIEVEMENT_CODES.HUNDRED_CORRECT,
    name: { en: 'Quiz Champion', hi: 'क्विज़ चैंपियन' },
    description: { en: 'Completed 100 correct answers!', hi: '100 सवाल सही हल किए!' },
    icon: '👑',
    category: 'milestone',
    xpReward: 500,
  },
  {
    code: ACHIEVEMENT_CODES.STREAK_3,
    name: { en: '3-Day Blaze', hi: '3 दिन की लपट' },
    description: { en: 'Learned 3 days in a row!', hi: 'लगातार 3 दिन पढ़ाई की!' },
    icon: '🔥',
    category: 'streak',
    xpReward: 150,
  },
  {
    code: ACHIEVEMENT_CODES.STREAK_7,
    name: { en: 'Weekly Wonder', hi: 'साप्ताहिक विजेता' },
    description: { en: 'A whole week of steady learning!', hi: 'पूरा एक हफ्ता रोज़ पढ़ाई की!' },
    icon: '⚡',
    category: 'streak',
    xpReward: 350,
  },
  {
    code: ACHIEVEMENT_CODES.SKILL_MASTERY_80,
    name: { en: 'Master Mind', hi: 'कुशल मस्तिष्‍क' },
    description: { en: 'Achieved 80% mastery in a skill!', hi: 'किसी विषय में 80% महारत हासिल की!' },
    icon: '🧠',
    category: 'mastery',
    xpReward: 200,
  },
  {
    code: ACHIEVEMENT_CODES.LEVEL_10,
    name: { en: 'Level 10 Hero', hi: 'स्तर 10 का नायक' },
    description: { en: 'Reached Level 10 in your learning adventure!', hi: 'स्तर 10 तक पहुँचे!' },
    icon: '🎖️',
    category: 'milestone',
    xpReward: 400,
  },
];

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.mongoUri);

  // 1. Seed Questions
  let questionsUpserted = 0;
  for (const [subject, skill, grade, difficulty, text, options, answerIndex, exp] of QUESTIONS) {
    const res = await Question.updateOne(
      { 'text.en': text.en, subject },
      {
        $setOnInsert: {
          subject,
          skill,
          grade,
          difficulty,
          discrimination: 1.0,
          text,
          options,
          answerIndex,
          explanation: typeof exp === 'string' ? { en: exp, hi: '' } : exp,
          status: 'reviewed',
          source: 'seed',
        },
      },
      { upsert: true }
    );
    questionsUpserted += res.upsertedCount;
  }
  console.log(`Questions checked. New upserted: ${questionsUpserted}`);

  // 2. Seed Achievements
  for (const a of ACHIEVEMENTS) {
    await Achievement.updateOne(
      { code: a.code },
      { $set: a },
      { upsert: true }
    );
  }
  console.log(`Achievements configured (${ACHIEVEMENTS.length} definitions).`);

  // 3. Seed Admin
  const adminExists = await User.exists({ email: config.adminEmail.toLowerCase() });
  if (!adminExists) {
    await User.create({
      name: 'System Admin',
      email: config.adminEmail.toLowerCase(),
      role: 'admin',
      passwordHash: await bcrypt.hash(config.adminPassword, 12),
    });
    console.log(`Admin user created: ${config.adminEmail}`);
  }

  // 4. Seed Demo Guardian & Child for instant testing
  const demoEmail = 'parent@learnquest.org';
  let demoUser = await User.findOne({ email: demoEmail });
  if (!demoUser) {
    demoUser = await User.create({
      name: 'Demo Parent',
      email: demoEmail,
      role: 'guardian',
      passwordHash: await bcrypt.hash('Parent@1234', 12),
    });
    console.log(`Demo guardian created: ${demoEmail} / Parent@1234`);
  }

  let demoChild = await Child.findOne({ guardian: demoUser._id, name: 'Aarav' });
  if (!demoChild) {
    demoChild = await Child.create({
      guardian: demoUser._id,
      name: 'Aarav',
      grade: 4,
      language: 'en',
      pinHash: await bcrypt.hash('1234', 10),
      points: 120,
      xp: 240,
      level: 2,
      streakDays: 3,
      consent: { version: '2024-v2', givenAt: new Date() },
    });
    console.log(`Demo child created: Aarav (PIN: 1234)`);
  }

  // 5. Seed Sponsor Pool with initial funds
  await Pool.updateOne(
    { _id: 'main' },
    {
      $setOnInsert: {
        balancePaise: 500000, // ₹5,000 sponsor pool
        totalFundedPaise: 500000,
        totalPaidPaise: 0,
      },
    },
    { upsert: true }
  );
  console.log('Sponsor reward pool initialized with ₹5,000 initial CSR balance.');

  console.log('✅ LearnQuest Database Seed complete!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
