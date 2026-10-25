import React, { useState, useEffect } from 'react';
import { api } from '../utils/api.js';

export default function GuardianDashboard({ onBackToGame }) {
  const [activeTab, setActiveTab] = useState('children');
  const [children, setChildren] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [guardian, setGuardian] = useState(null);
  const [upiInput, setUpiInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Add child form modal state
  const [showAddChild, setShowAddChild] = useState(false);
  const [childForm, setChildForm] = useState({
    name: '',
    grade: 4,
    language: 'en',
    pin: '',
    consentGiven: false,
  });

  // Selected child progress view
  const [selectedChildProgress, setSelectedChildProgress] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uData, cData, pData] = await Promise.all([
        api('/auth/me').catch(() => ({ user: null })),
        api('/children').catch(() => ({ children: [] })),
        api('/payouts').catch(() => ({ payouts: [] })),
      ]);
      setGuardian(uData.user);
      if (uData.user?.upi) setUpiInput(uData.user.upi);
      setChildren(cData.children || []);
      setPayouts(pData.payouts || []);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveUpi = async (e) => {
    e.preventDefault();
    try {
      const res = await api('/auth/payout-destination', {
        method: 'PUT',
        body: { upi: upiInput },
      });
      setMsg({ text: `✅ Payout UPI ID saved: ${res.upi}`, type: 'success' });
      loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleAddChild = async (e) => {
    e.preventDefault();
    if (!childForm.consentGiven) {
      setMsg({ text: 'Please review and accept the parental consent agreement.', type: 'error' });
      return;
    }
    try {
      await api('/children', {
        method: 'POST',
        body: {
          name: childForm.name,
          grade: Number(childForm.grade),
          language: childForm.language,
          pin: childForm.pin,
          consentGiven: true,
        },
      });
      setShowAddChild(false);
      setChildForm({ name: '', grade: 4, language: 'en', pin: '', consentGiven: false });
      setMsg({ text: `🎉 Child profile added successfully!`, type: 'success' });
      loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleApprovePayout = async (payoutId) => {
    try {
      await api(`/payouts/${payoutId}/approve`, { method: 'POST' });
      setMsg({ text: '🌟 Payout approved and sent to disbursement!', type: 'success' });
      loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleDeclinePayout = async (payoutId) => {
    try {
      await api(`/payouts/${payoutId}/decline`, { method: 'POST' });
      setMsg({ text: 'Payout declined. Points returned to child profile.', type: 'info' });
      loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const viewChildProgress = async (childId) => {
    try {
      const progress = await api(`/children/${childId}/progress`);
      setSelectedChildProgress(progress);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleDeleteChild = async (childId, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}'s data? Under data protection rules, all quiz attempts and mastery records will be permanently erased.`)) return;
    try {
      await api(`/children/${childId}`, { method: 'DELETE' });
      setMsg({ text: `${name}'s profile and learning history deleted.`, type: 'info' });
      setSelectedChildProgress(null);
      loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in text-cosmicText">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white p-6 rounded-3xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-md">
            🛡️
          </div>
          <div>
            <h1 className="text-2xl font-black text-cosmicText">Guardian Control Portal</h1>
            <p className="text-xs text-gray-500 font-bold">
              {guardian ? `${guardian.name} (${guardian.email})` : 'Parent & Sponsor Supervision'}
            </p>
          </div>
        </div>

        <button
          onClick={onBackToGame}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-cosmicText font-black text-xs rounded-xl transition-all"
        >
          ← Back to Game Hub
        </button>
      </div>

      {/* Alert Banner */}
      {msg.text && (
        <div className={`p-4 rounded-2xl mb-6 font-bold text-xs flex justify-between items-center ${
          msg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg({ text: '', type: '' })} className="font-black ml-4">✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { id: 'children', label: '👶 My Children', count: children.length },
          { id: 'rewards', label: '💰 Reward Approvals', count: payouts.filter(p => p.status === 'requested').length },
          { id: 'upi', label: '🏦 UPI Payout Handle' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedChildProgress(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-electricBlue text-white shadow-electric-glow'
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-white text-electricBlue' : 'bg-solarAmber text-white'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: CHILDREN PROFILES */}
      {activeTab === 'children' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-cosmicText">Registered Children</h2>
            <button
              onClick={() => setShowAddChild(true)}
              className="px-4 py-2 bg-gradient-to-r from-auroraMint to-emerald-500 text-white font-black text-xs rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              + Add Child Profile
            </button>
          </div>

          {children.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-gray-200 shadow-sm">
              <span className="text-5xl block mb-3">👶</span>
              <h3 className="font-black text-base mb-1">No child profiles linked yet</h3>
              <p className="text-xs text-gray-400 font-bold mb-4">Add your child to set their 4-digit learning PIN and track rewards.</p>
              <button
                onClick={() => setShowAddChild(true)}
                className="px-6 py-2.5 bg-electricBlue text-white font-black text-xs rounded-xl shadow-electric-glow"
              >
                Add Your Child Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {children.map((k) => (
                <div key={k.id} className="bg-white p-6 rounded-3xl border border-gray-200/90 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-black text-lg text-cosmicText">{k.name}</h3>
                      <span className="text-xs font-bold text-gray-400">Class {k.grade} · {k.language.toUpperCase()}</span>
                    </div>
                    <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full font-black text-xs">
                      Lvl {k.level}
                    </span>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-2xl mb-4 space-y-1.5 text-xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Stars Earned:</span>
                      <span className="text-solarAmber font-black">⭐ {k.points} (₹{Math.floor(k.points / 10)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Daily Streak:</span>
                      <span className="text-orange-500 font-black">🔥 {k.streakDays} Days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Security Status:</span>
                      <span className={k.isLocked ? 'text-red-500 font-black' : 'text-emerald-500 font-black'}>
                        {k.isLocked ? '🔒 PIN Locked (10 min)' : '🟢 Active'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => viewChildProgress(k.id)}
                      className="flex-1 py-2 bg-blue-50 text-electricBlue hover:bg-blue-100 font-black text-xs rounded-xl transition-all"
                    >
                      View AI Mastery
                    </button>
                    <button
                      onClick={() => handleDeleteChild(k.id, k.name)}
                      className="px-3 py-2 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-600 font-black text-xs rounded-xl transition-all"
                      title="Erase Child Learning Data"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Child Progress Detail Modal/Section */}
          {selectedChildProgress && (
            <div className="bg-white p-6 rounded-3xl border-2 border-electricBlue/40 shadow-lg animate-scale-up mb-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-black text-xl text-cosmicText">
                    📊 AI Mastery Profile: {selectedChildProgress.child.name}
                  </h3>
                  <p className="text-xs text-gray-400 font-bold">
                    Bayesian Knowledge Tracing (BKT) Skill Matrix & Learning Analytics
                  </p>
                </div>
                <button
                  onClick={() => setSelectedChildProgress(null)}
                  className="px-3 py-1 bg-gray-100 font-black text-xs rounded-lg"
                >
                  ✕ Close
                </button>
              </div>

              {/* Mastery Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {selectedChildProgress.mastery.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold p-4">No quizzes taken yet. As the child practices, BKT will estimate knowledge probability.</p>
                ) : (
                  selectedChildProgress.mastery.map((m) => (
                    <div key={m.skill} className="bg-gray-50 p-4 rounded-2xl border border-gray-200/60">
                      <div className="flex justify-between text-xs font-black mb-1.5">
                        <span className="uppercase text-gray-500">{m.skill}</span>
                        <span className={m.percent >= 70 ? 'text-emerald-600' : 'text-solarAmber'}>
                          {m.percent}% Mastered
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            m.percent >= 70 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'
                          }`}
                          style={{ width: `${m.percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 font-bold mt-2">
                        <span>Attempts: {m.attempts}</span>
                        <span>Correct: {m.correct}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Achievements Showcase */}
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Trophy Case & Badges</h4>
              <div className="flex flex-wrap gap-3">
                {selectedChildProgress.achievements.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bold">Badges unlock automatically for daily streaks and skill milestones!</p>
                ) : (
                  selectedChildProgress.achievements.map((ach) => (
                    <div key={ach._id || ach.code} className="flex items-center gap-2 bg-amber-50 border border-amber-200/80 px-3 py-2 rounded-2xl">
                      <span className="text-2xl">{ach.icon || '🏆'}</span>
                      <div>
                        <p className="font-black text-xs text-amber-900">{ach.name?.en || ach.name}</p>
                        <p className="text-[10px] text-amber-700/80 font-bold">{ach.description?.en || ach.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REWARDS / PAYOUT APPROVALS */}
      {activeTab === 'rewards' && (
        <div>
          <div className="bg-gradient-to-r from-amber-500 to-solarAmber p-6 rounded-3xl text-white shadow-md mb-8">
            <h2 className="text-xl font-black mb-1">Parental Approval Guarantee 🛡️</h2>
            <p className="text-xs font-bold opacity-90 max-w-2xl leading-relaxed">
              Children can request rewards with their earned stars, but money NEVER moves without your explicit approval.
              Approved funds are disbursed to your encrypted UPI handle directly from sponsor-backed pools.
            </p>
          </div>

          <h3 className="font-black text-base mb-4">Pending & Past Reward Requests</h3>
          {payouts.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-3xl border border-gray-200">
              <span className="text-4xl block mb-2">🎁</span>
              <p className="text-xs text-gray-400 font-bold">No reward requests yet. Children need at least 500 stars (₹50) to make a withdrawal request.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payouts.map((p) => (
                <div key={p.id} className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-base">{p.childName || 'Child'}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        p.status === 'requested' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                        p.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-bold">
                      Requested on {new Date(p.createdAt).toLocaleDateString()} · {p.points} Stars = ₹{p.rupees}
                    </p>
                  </div>

                  {p.status === 'requested' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovePayout(p.id)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-sm transition-all"
                      >
                        ✓ Approve Payout (₹{p.rupees})
                      </button>
                      <button
                        onClick={() => handleDeclinePayout(p.id)}
                        className="px-4 py-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 font-black text-xs rounded-xl transition-all"
                      >
                        Decline & Return Stars
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-gray-400">
                      {p.status === 'paid' ? '✅ Credited to UPI' : 'Resolved'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: UPI HANDLE */}
      {activeTab === 'upi' && (
        <div className="max-w-md bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 text-electricBlue rounded-2xl flex items-center justify-center text-2xl mb-4">
            🏦
          </div>
          <h2 className="text-lg font-black mb-1">Encrypted Payout Destination</h2>
          <p className="text-xs text-gray-400 font-bold mb-6">
            All learning cash rewards are disbursed to this UPI address. We encrypt this data using AES-256-GCM.
          </p>

          <form onSubmit={handleSaveUpi} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                Guardian UPI ID
              </label>
              <input
                type="text"
                placeholder="e.g. yourname@okhdfcbank"
                value={upiInput}
                onChange={(e) => setUpiInput(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-electricBlue"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-electricBlue text-white font-black text-xs rounded-xl shadow-electric-glow hover:scale-[1.02] active:scale-95 transition-all"
            >
              Save Encrypted UPI Handle
            </button>
          </form>
        </div>
      )}

      {/* MODAL: ADD CHILD */}
      {showAddChild && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-scale-up">
            <h3 className="text-xl font-black mb-1">Add Child Learner</h3>
            <p className="text-xs text-gray-400 font-bold mb-6">
              Create a personalized learning account with a safe 4-digit PIN.
            </p>

            <form onSubmit={handleAddChild} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Child's Name</label>
                <input
                  type="text"
                  placeholder="e.g. Aarav"
                  value={childForm.name}
                  onChange={(e) => setChildForm({ ...childForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-electricBlue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Class / Grade</label>
                  <select
                    value={childForm.grade}
                    onChange={(e) => setChildForm({ ...childForm, grade: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-electricBlue"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(g => (
                      <option key={g} value={g}>Class {g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Language</label>
                  <select
                    value={childForm.language}
                    onChange={(e) => setChildForm({ ...childForm, language: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-electricBlue"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिंदी (Hindi)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">4-Digit PIN (Child locks/unlocks with this)</label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="e.g. 1234"
                  value={childForm.pin}
                  onChange={(e) => setChildForm({ ...childForm, pin: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm text-center tracking-widest focus:outline-none focus:border-electricBlue"
                />
              </div>

              {/* Legal Consent Statement */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-[11px] font-bold text-gray-600 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={childForm.consentGiven}
                    onChange={(e) => setChildForm({ ...childForm, consentGiven: e.target.checked })}
                    className="mt-0.5"
                    required
                  />
                  <span>
                    I confirm that I am the parent/legal guardian. I consent to LearnQuest processing my child's quiz answers to adapt learning difficulty and compute effort incentives. I understand quiz attempts auto-delete after 180 days.
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddChild(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-black text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-electricBlue text-white font-black text-xs rounded-xl shadow-electric-glow hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Register Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
