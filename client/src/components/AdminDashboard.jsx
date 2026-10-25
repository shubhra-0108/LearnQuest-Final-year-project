import React, { useState, useEffect } from 'react';
import { api } from '../utils/api.js';

export default function AdminDashboard({ onBackToGame }) {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('questions');
  const [questions, setQuestions] = useState([]);
  const [calibration, setCalibration] = useState([]);
  const [flaggedPayouts, setFlaggedPayouts] = useState([]);
  const [fundAmount, setFundAmount] = useState('10000');
  const [aiDraftPrompt, setAiDraftPrompt] = useState({
    subject: 'math',
    skill: 'math.fractions',
    grade: 5,
    difficulty: 3,
    count: 3,
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, q, c, p] = await Promise.all([
        api('/admin/stats').catch(() => null),
        api('/admin/questions?status=draft').catch(() => ({ questions: [] })),
        api('/admin/calibration').catch(() => ({ suggestions: [] })),
        api('/admin/payouts?status=review').catch(() => ({ payouts: [] })),
      ]);
      setStats(s);
      setQuestions(q.questions || []);
      setCalibration(c.suggestions || []);
      setFlaggedPayouts(p.payouts || []);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleApproveQuestion = async (id) => {
    try {
      await api(`/admin/questions/${id}`, {
        method: 'PATCH',
        body: { status: 'reviewed' },
      });
      setMsg({ text: 'Question approved and added to live learning pool! 🎯', type: 'success' });
      loadAll();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleRetireQuestion = async (id) => {
    try {
      await api(`/admin/questions/${id}`, {
        method: 'PATCH',
        body: { status: 'retired' },
      });
      setMsg({ text: 'Question retired from circulation.', type: 'info' });
      loadAll();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleGenerateAi = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api('/admin/questions/ai-draft', {
        method: 'POST',
        body: aiDraftPrompt,
      });
      setMsg({ text: `✨ Generated ${res.created} draft questions ready for review!`, type: 'success' });
      loadAll();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFundPool = async (e) => {
    e.preventDefault();
    try {
      const res = await api('/admin/pool/fund', {
        method: 'POST',
        body: { amountRs: Number(fundAmount) },
      });
      setMsg({ text: `💵 Added ₹${fundAmount} to sponsor reward pool! (${res.retriedPayouts} waiting payouts processed)`, type: 'success' });
      loadAll();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleReleaseRisk = async (id) => {
    try {
      await api(`/admin/payouts/${id}/release`, { method: 'POST' });
      setMsg({ text: 'Safety check cleared. Reward released to guardian.', type: 'success' });
      loadAll();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleRejectRisk = async (id) => {
    try {
      await api(`/admin/payouts/${id}/reject`, { method: 'POST' });
      setMsg({ text: 'Flagged reward rejected. Points refunded to child profile.', type: 'info' });
      loadAll();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in text-cosmicText">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-500 to-amber-500 flex items-center justify-center text-white text-2xl shadow-md">
            ⚙️
          </div>
          <div>
            <h1 className="text-2xl font-black text-cosmicText">Admin & Curriculum Console</h1>
            <p className="text-xs text-gray-500 font-bold">Platform Safety, AI Content Review & Sponsor Pool Oversight</p>
          </div>
        </div>

        <button
          onClick={onBackToGame}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-cosmicText font-black text-xs rounded-xl transition-all"
        >
          ← Back to Game Hub
        </button>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-2xl mb-6 font-bold text-xs flex justify-between items-center ${
          msg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg({ text: '', type: '' })} className="font-black ml-4">✕</button>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs font-black text-gray-400 uppercase">Learners</span>
            <p className="text-2xl font-black text-electricBlue mt-1">{stats.children}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs font-black text-gray-400 uppercase">Quiz Attempts</span>
            <p className="text-2xl font-black text-purple-600 mt-1">{stats.attempts}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs font-black text-gray-400 uppercase">Sponsor Balance</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">₹{stats.pool?.balanceRs || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs font-black text-gray-400 uppercase">Draft Questions</span>
            <p className="text-2xl font-black text-solarAmber mt-1">{stats.draftQuestions}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs font-black text-gray-400 uppercase">Safety Flags</span>
            <p className="text-2xl font-black text-red-500 mt-1">{stats.reviewPayouts}</p>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-3 flex-wrap">
        {[
          { id: 'questions', label: '📝 Question Review Gate', badge: questions.length },
          { id: 'ai-gen', label: '🤖 AI Curriculum Generator' },
          { id: 'calibration', label: '🔬 IRT ML Calibration' },
          { id: 'pool', label: '💰 Sponsor Pool' },
          { id: 'risk', label: '🛡️ Safety & Anti-Cheat Queue', badge: flaggedPayouts.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-electricBlue text-white shadow-electric-glow'
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-white text-electricBlue' : 'bg-red-500 text-white'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: QUESTION REVIEW */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-black">Draft Question Review Queue</h2>
            <span className="text-xs text-gray-400 font-bold">Only reviewed questions are served to children</span>
          </div>

          {questions.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-3xl border border-gray-200">
              <span className="text-4xl block mb-2">✅</span>
              <p className="text-xs text-gray-400 font-bold">No draft questions waiting. Use the AI Curriculum Generator to draft new ones!</p>
            </div>
          ) : (
            questions.map((q) => (
              <div key={q._id} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="px-2.5 py-0.5 bg-blue-50 text-electricBlue rounded-full text-[10px] font-black uppercase mr-2">
                      {q.subject} · {q.skill}
                    </span>
                    <span className="px-2.5 py-0.5 bg-purple-50 text-purple-600 rounded-full text-[10px] font-black uppercase mr-2">
                      Class {q.grade}
                    </span>
                    <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black">
                      Diff: {q.difficulty}/5
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold ml-2">Source: {q.source}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveQuestion(q._id)}
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-sm"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleRetireQuestion(q._id)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 font-black text-xs rounded-xl"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-black text-sm text-cosmicText">EN: {q.text?.en}</p>
                  {q.text?.hi && <p className="font-bold text-xs text-gray-500">HI: {q.text?.hi}</p>}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                  {q.options?.map((opt, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border text-xs font-bold ${
                        i === q.answerIndex ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <span className="font-black mr-1">{String.fromCharCode(65 + i)}.</span>
                      {opt.en} {opt.hi && `(${opt.hi})`}
                    </div>
                  ))}
                </div>

                {q.explanation?.en && (
                  <p className="text-[11px] text-gray-400 font-bold italic pt-1">
                    💡 Explanation: {q.explanation.en}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: AI GENERATOR */}
      {activeTab === 'ai-gen' && (
        <div className="max-w-xl bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-2xl mb-4">
            🤖
          </div>
          <h2 className="text-lg font-black mb-1">Curriculum Question Generator</h2>
          <p className="text-xs text-gray-400 font-bold mb-6">
            Generate culturally aligned bilingual quiz questions for low-income Indian elementary students. All generated items are placed in Draft status for human review.
          </p>

          <form onSubmit={handleGenerateAi} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Subject</label>
                <select
                  value={aiDraftPrompt.subject}
                  onChange={(e) => setAiDraftPrompt({ ...aiDraftPrompt, subject: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm"
                >
                  <option value="math">Mathematics</option>
                  <option value="science">Science</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Class / Grade</label>
                <select
                  value={aiDraftPrompt.grade}
                  onChange={(e) => setAiDraftPrompt({ ...aiDraftPrompt, grade: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm"
                >
                  {[3, 4, 5, 6, 7, 8].map(g => (
                    <option key={g} value={g}>Class {g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-1">Curriculum Skill Tag</label>
              <input
                type="text"
                value={aiDraftPrompt.skill}
                onChange={(e) => setAiDraftPrompt({ ...aiDraftPrompt, skill: e.target.value })}
                placeholder="e.g. math.fractions, sci.life, math.muldiv"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Target Difficulty (1-5)</label>
                <select
                  value={aiDraftPrompt.difficulty}
                  onChange={(e) => setAiDraftPrompt({ ...aiDraftPrompt, difficulty: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm"
                >
                  {[1, 2, 3, 4, 5].map(d => (
                    <option key={d} value={d}>Level {d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Quantity</label>
                <select
                  value={aiDraftPrompt.count}
                  onChange={(e) => setAiDraftPrompt({ ...aiDraftPrompt, count: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm"
                >
                  {[1, 2, 3, 5].map(c => (
                    <option key={c} value={c}>{c} Questions</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all"
            >
              {loading ? 'Generating with AI...' : 'Generate Curriculum Items →'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: CALIBRATION */}
      {activeTab === 'calibration' && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-200 text-xs font-bold text-blue-900 mb-6">
            <h3 className="font-black text-sm mb-1">Item Response Theory (2PL IRT) Calibration</h3>
            <p className="opacity-90 leading-relaxed">
              The Python ML service continuously computes actual vs. expected student accuracy. If a question labelled difficulty 4 has a 95% pass rate, our calibration algorithm flags it as an anomaly that should be adjusted downward.
            </p>
          </div>

          {calibration.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-3xl border border-gray-200">
              <span className="text-4xl block mb-2">🎯</span>
              <p className="text-xs text-gray-400 font-bold">All live questions match their expected Item Response Theory difficulty curve!</p>
            </div>
          ) : (
            calibration.map((s) => (
              <div key={s.id} className="bg-white p-5 rounded-2xl border border-gray-200 flex justify-between items-center">
                <div>
                  <p className="font-black text-sm">Question ID: {s.id}</p>
                  <p className="text-xs text-gray-500 font-bold">
                    Current: Diff {s.current_difficulty} → Suggested: Diff {s.suggested_difficulty} · {s.reason}
                  </p>
                </div>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 font-black text-xs rounded-full">
                  Confidence: {Math.round(s.confidence * 100)}%
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: SPONSOR POOL */}
      {activeTab === 'pool' && (
        <div className="max-w-md bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mb-4">
            💵
          </div>
          <h2 className="text-lg font-black mb-1">Fund Reward Pool</h2>
          <p className="text-xs text-gray-400 font-bold mb-6">
            LearnQuest is backed by CSR sponsors and donors. Injecting funds clears any waiting payouts automatically.
          </p>

          <form onSubmit={handleFundPool} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-1">Deposit Amount (₹ INR)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 font-black text-lg focus:outline-none focus:border-electricBlue"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all"
            >
              Deposit Funds to Sponsor Pool →
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: RISK & SAFETY */}
      {activeTab === 'risk' && (
        <div className="space-y-4">
          <div className="bg-red-50 p-6 rounded-3xl border border-red-200 text-xs font-bold text-red-900 mb-6">
            <h3 className="font-black text-sm mb-1">Anti-Cheat Anomaly Engine</h3>
            <p className="opacity-90 leading-relaxed">
              Attempts submitted under 1.5 seconds or exhibiting extreme bot-like Z-score response times accumulate an anti-cheat risk score. If an account's risk score exceeds 3.0, payouts pause for manual administrator inspection.
            </p>
          </div>

          {flaggedPayouts.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-3xl border border-gray-200">
              <span className="text-4xl block mb-2">🛡️</span>
              <p className="text-xs text-gray-400 font-bold">No accounts flagged for speed risk. All learner sessions appear authentic!</p>
            </div>
          ) : (
            flaggedPayouts.map((fp) => (
              <div key={fp.id} className="bg-white p-6 rounded-3xl border border-red-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-base">{fp.child}</span>
                    <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-black">
                      Risk Score: {fp.risk}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-bold">
                    Guardian: {fp.guardian} · Reward: ₹{fp.rupees}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReleaseRisk(fp.id)}
                    className="px-4 py-2 bg-emerald-500 text-white font-black text-xs rounded-xl shadow-sm"
                  >
                    Clear Safety Check & Pay
                  </button>
                  <button
                    onClick={() => handleRejectRisk(fp.id)}
                    className="px-4 py-2 bg-red-500 text-white font-black text-xs rounded-xl shadow-sm"
                  >
                    Reject & Refund Stars
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
