const { chromium } = require('./server/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function showBanner(page, title, subtitle) {
  await page.evaluate(({ title, subtitle }) => {
    let el = document.getElementById('demo-narrator-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-narrator-banner';
      el.style.position = 'fixed';
      el.style.top = '14px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.zIndex = '999999';
      el.style.backgroundColor = 'rgba(15, 23, 42, 0.94)';
      el.style.color = '#ffffff';
      el.style.padding = '12px 28px';
      el.style.borderRadius = '20px';
      el.style.boxShadow = '0 12px 35px rgba(0,0,0,0.35)';
      el.style.border = '2px solid rgba(58, 134, 255, 0.7)';
      el.style.fontFamily = 'system-ui, sans-serif';
      el.style.textAlign = 'center';
      el.style.maxWidth = '780px';
      el.style.pointerEvents = 'none';
      el.style.transition = 'all 0.3s ease';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div style="font-size: 15px; font-weight: 900; color: #3A86FF; letter-spacing: 0.5px; text-transform: uppercase;">
        ${title}
      </div>
      <div style="font-size: 12px; font-weight: 600; color: #E2E8F0; margin-top: 3px;">
        ${subtitle}
      </div>
    `;
  }, { title, subtitle });
  await sleep(2200);
}

async function run() {
  const outputDir = path.join(__dirname, 'demo_video');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clear previous webm files
  fs.readdirSync(outputDir).forEach((file) => {
    if (file.endsWith('.webm') || file.endsWith('.mp4')) {
      try { fs.unlinkSync(path.join(outputDir, file)); } catch (e) {}
    }
  });

  console.log('🚀 Launching Chrome for complete production walkthrough recording...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();

  try {
    // ----------------------------------------------------
    // SCENE 1: Landing Page & Mission Overview
    // ----------------------------------------------------
    console.log('🎬 SCENE 1: Landing Page & Mission Overview');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await sleep(1500);

    await showBanner(
      page,
      '🌟 Welcome to LearnQuest',
      'AI-Powered Adaptive Learning Platform for Children with Capped Micro-Rewards'
    );

    await showBanner(
      page,
      '🎯 Addressing ASER 2024 Findings',
      'Only 27% of Class 3 read Class 2 text · Adaptive AI targets the 70% sweet spot'
    );
    await sleep(1000);

    // ----------------------------------------------------
    // SCENE 2: Parent Authentication & Dashboard
    // ----------------------------------------------------
    console.log('🎬 SCENE 2: Parent Authentication & Dashboard');
    await showBanner(
      page,
      '🛡️ Parent & Guardian Oversight',
      'Parents hold total authority over child profiles, PIN setup & cash reward approvals'
    );

    await page.click('button:has-text("Parent Login / Setup")');
    await sleep(800);

    await page.fill('input[type="email"]', 'parent@learnquest.org');
    await sleep(400);
    await page.fill('input[type="password"]', 'Parent@1234');
    await sleep(400);
    await page.click('button:has-text("Sign In as Parent")');
    await sleep(2000);

    // ----------------------------------------------------
    // SCENE 3: Creating a Child Profile with DPDP Consent
    // ----------------------------------------------------
    console.log('🎬 SCENE 3: Creating a Child Profile with DPDP Consent');
    await showBanner(
      page,
      '👶 Adding a Child Profile & 4-Digit PIN',
      'Parent configures learning PIN & accepts statutory consent (DPDP/GDPR compliant)'
    );

    await page.click('button:has-text("+ Add Child Profile")');
    await sleep(800);

    await page.fill('input[placeholder="e.g. Aarav"]', 'Priya');
    await sleep(300);
    await page.selectOption('select >> nth=0', '5'); // Class 5
    await sleep(300);
    await page.selectOption('select >> nth=1', 'hi'); // Hindi
    await sleep(300);
    await page.fill('input[placeholder="e.g. 1234"]', '4321');
    await sleep(300);
    await page.check('input[type="checkbox"]');
    await sleep(600);
    await page.click('button:has-text("Register Profile")');
    await sleep(2000);

    // ----------------------------------------------------
    // SCENE 4: Child Mode & PIN Unlock Game
    // ----------------------------------------------------
    console.log('🎬 SCENE 4: Child Mode & PIN Unlock Game');
    await showBanner(
      page,
      '🎮 Child PIN Unlock Gate',
      'Children unlock their profile on shared family devices. 5 fails lock for 10 mins.'
    );

    await page.click('button:has-text("← Back to Game Hub")');
    await sleep(1000);

    await page.click('button:has-text("🎮 Unlock Player PIN")');
    await sleep(800);

    // Click Aarav
    await page.click('button:has-text("Aarav")');
    await sleep(600);
    await page.fill('input[type="password"]', '1234');
    await sleep(600);
    await page.click('button:has-text("Unlock & Play →")');
    await sleep(2000);

    // ----------------------------------------------------
    // SCENE 5: Star Chart Map & XP Progression
    // ----------------------------------------------------
    console.log('🎬 SCENE 5: Star Chart Map & XP Progression');
    await showBanner(
      page,
      '🗺️ Star Chart Map & XP Progression',
      'Duolingo-style game UI: TopBar XP tracker, 3-day active streak (🔥), Rank Level'
    );
    await sleep(1500);

    // Open Subjects Hub
    await page.click('button:has-text("📚 Subjects")');
    await sleep(1500);

    await showBanner(
      page,
      '📚 Cosmic Subject Hubs',
      'Adaptive Mathematics and Science curriculums calibrated to state & NCERT standards'
    );
    await sleep(1500);

    // ----------------------------------------------------
    // SCENE 6: Adaptive Learning Quiz with BKT Machine Learning
    // ----------------------------------------------------
    console.log('🎬 SCENE 6: Adaptive Learning Quiz with BKT Machine Learning');
    // Click Play Quiz in bottom navigation
    await page.click('button:has-text("Play Quiz")');
    await sleep(1500);

    await showBanner(
      page,
      '🔬 Bayesian Knowledge Tracing (BKT) Quiz Engine',
      'AI estimates P(skill known) and picks questions with ~70% success chance'
    );

    // Toggle English/Hindi
    await page.click('button:has-text("🌐")');
    await sleep(1200);
    await showBanner(
      page,
      '🌐 Bilingual English / हिंदी Support',
      'Instant language switch ensures no child is held back by language barriers'
    );
    await page.click('button:has-text("🌐")'); // toggle back
    await sleep(800);

    // Select second option
    const optionBtns = page.locator('div.space-y-3 button');
    await optionBtns.nth(1).click();
    await sleep(1500);

    await showBanner(
      page,
      '🎉 Instant Feedback & Anti-Cheat Validation',
      'Server-measured duration (>1.5s), positive explanations & ⭐ stars awarded'
    );
    await sleep(2000);

    // Click next adaptive question
    const nextQBtn = page.locator('button:has-text("Next Adaptive Question →")');
    if (await nextQBtn.isVisible()) {
      await nextQBtn.click();
      await sleep(1500);
      await optionBtns.nth(0).click();
      await sleep(1500);
    }

    // ----------------------------------------------------
    // SCENE 7: Community Leaderboard & Stars Wallet
    // ----------------------------------------------------
    console.log('🎬 SCENE 7: Community Leaderboard & Stars Wallet');
    await page.click('button:has-text("Leaderboard")');
    await sleep(1500);

    await showBanner(
      page,
      '🏆 Community Leaderboard',
      'Healthy peer motivation without public shaming: Top explorers celebrate effort'
    );
    await sleep(1500);

    // ----------------------------------------------------
    // SCENE 8: Guardian Portal — AI Mastery Radar & Reward Approval
    // ----------------------------------------------------
    console.log('🎬 SCENE 8: Guardian Portal — AI Mastery Radar & Reward Approval');
    await page.click('button:has-text("🛡️ Parent Portal")');
    await sleep(1500);

    await showBanner(
      page,
      '📊 AI Mastery Profile & Radar',
      'Parents inspect real BKT skill mastery percentages, attempts, and earned trophies'
    );

    // Click View AI Mastery on first child
    const viewMasteryBtn = page.locator('button:has-text("View AI Mastery")').first();
    if (await viewMasteryBtn.isVisible()) {
      await viewMasteryBtn.click();
      await sleep(2000);
    }

    // Reward Approvals tab
    await page.click('button:has-text("💰 Reward Approvals")');
    await sleep(1500);

    await showBanner(
      page,
      '💵 Guardian Approval Guarantee',
      '10 points = ₹1 · Payouts require parent approval · Directly credited to guardian UPI'
    );
    await sleep(1500);

    // Encrypted UPI Handle tab
    await page.click('button:has-text("🏦 UPI Payout Handle")');
    await sleep(1500);

    await showBanner(
      page,
      '🔒 AES-256-GCM Encrypted UPI Handle',
      'Financial credentials are AES-256 encrypted at rest & masked (ram***cici)'
    );
    await sleep(1500);

    // ----------------------------------------------------
    // SCENE 9: Curriculum Admin Console
    // ----------------------------------------------------
    console.log('🎬 SCENE 9: Curriculum Admin Console');
    await page.click('button:has-text("⚙️ Admin")');
    await sleep(1500);

    await showBanner(
      page,
      '⚙️ Curriculum Admin & Platform Oversight',
      'Live KPI metrics: Total Learners, Quiz Attempts, Sponsor Pool ₹ Balance'
    );
    await sleep(1500);

    // AI Curriculum Generator
    await page.click('button:has-text("🤖 AI Curriculum Generator")');
    await sleep(1200);

    await showBanner(
      page,
      '🤖 AI Question Generator',
      'Auto-generates bilingual curriculum-aligned questions for teacher verification'
    );

    await page.click('button:has-text("Generate Curriculum Items →")');
    await sleep(2500);

    // Question Review Gate
    await page.click('button:has-text("📝 Question Review Gate")');
    await sleep(1200);

    await showBanner(
      page,
      '✅ Human-in-the-Loop Gate',
      'Only teacher-approved questions ever reach children'
    );

    const approveQBtn = page.locator('button:has-text("✓ Approve")').first();
    if (await approveQBtn.isVisible()) {
      await approveQBtn.click();
      await sleep(1200);
    }

    // IRT ML Calibration
    await page.click('button:has-text("🔬 IRT ML Calibration")');
    await sleep(1200);

    await showBanner(
      page,
      '🔬 2PL Item Response Theory (IRT) Calibration',
      'EM loop detects items deviating from the empirical mastery curve'
    );
    await sleep(1500);

    // Sponsor Pool
    await page.click('button:has-text("💰 Sponsor Pool")');
    await sleep(1200);

    await showBanner(
      page,
      '💵 CSR & Philanthropic Sponsor Pool',
      'Transparent funding pool backing student effort micro-incentives'
    );
    await sleep(1500);

    // Anti-Cheat Queue
    await page.click('button:has-text("🛡️ Safety & Anti-Cheat Queue")');
    await sleep(1200);

    await showBanner(
      page,
      '🛡️ Anti-Cheat Anomaly Engine',
      'Rolling Z-score response timing prevents botting, click-farming & speed cheating'
    );
    await sleep(2000);

    // Return to Landing / Star Map
    await page.click('button:has-text("← Back to Game Hub")');
    await sleep(1000);

    await showBanner(
      page,
      '🚀 LearnQuest — Transforming Foundational Education',
      'Empowering every child with personalized AI learning and proud micro-rewards.'
    );
    await sleep(3000);

    console.log('✅ All 9 walkthrough scenes recorded successfully!');
  } catch (err) {
    console.error('Error during walkthrough:', err);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    console.log('🎉 Recording finalized. Video saved in:', outputDir);
  }
}

run();
