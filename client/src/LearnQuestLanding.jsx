import React, { useState } from 'react';
import { api } from './utils/api.js';

export default function LearnQuestLanding({
  onLoginSuccess,
  onOpenGuardian,
  onOpenAdmin,
  onSelectKidForPin,
}) {
  const [authMode, setAuthMode] = useState(null); // 'guardian_login' | 'guardian_register' | 'guest'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGuardianAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (authMode === 'guardian_register') {
        await api('/auth/register', {
          method: 'POST',
          body: { name: guardianName, email, password },
        });
      } else {
        await api('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
      }
      onOpenGuardian();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FC] text-cosmicText relative overflow-hidden p-6">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-electricBlue/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-solarAmber/10 rounded-full blur-[140px] pointer-events-none"></div>

      {/* NAVBAR */}
      <header className="max-w-6xl mx-auto py-4 flex justify-between items-center relative z-20 border-b border-gray-200/60 mb-12">
        <div className="flex items-center gap-2">
          <span className="text-3xl filter drop-shadow-sm">🔮</span>
          <span className="text-2xl font-black tracking-wider text-cosmicText">
            Learn<span className="text-electricBlue">Quest</span>
          </span>
          <span className="text-[10px] bg-blue-100 text-electricBlue font-black px-2 py-0.5 rounded-full uppercase ml-1">
            v2.0 AIML Production
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenGuardian}
            className="text-xs font-black text-gray-600 hover:text-electricBlue px-3 py-2 rounded-xl"
          >
            🛡️ Parent Portal
          </button>
          <button
            onClick={onOpenAdmin}
            className="text-xs font-black text-gray-600 hover:text-red-500 px-3 py-2 rounded-xl"
          >
            ⚙️ Admin
          </button>
          <button
            onClick={onSelectKidForPin}
            className="bg-electricBlue hover:bg-opacity-90 text-white font-black px-5 py-2.5 text-xs rounded-xl shadow-electric-glow transition-all"
          >
            🎮 Unlock Player PIN
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="max-w-6xl mx-auto relative z-10 grid grid-cols-1 md:grid-cols-12 gap-12 items-center pb-16">
        <div className="md:col-span-7 space-y-6 text-left animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-electricBlue/10 border border-electricBlue/20 px-4 py-1.5 rounded-full text-xs font-black text-electricBlue">
            🚀 AI-Powered Adaptive Learning & Micro-Incentives
          </div>

          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-cosmicText leading-tight">
            Learn <span className="text-electricBlue">Smarter.</span><br />
            Sparkle Together.
          </h1>

          <p className="text-gray-500 text-sm md:text-base max-w-lg font-bold leading-relaxed">
            Bridging India's foundational learning gap. Bayesian Knowledge Tracing (BKT) adjusts each question to your child's exact 70% sweet spot, while steady effort earns guardian-controlled educational cash rewards.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={onSelectKidForPin}
              className="bg-gradient-to-r from-electricBlue to-indigo-600 text-white font-black text-base px-8 py-4 rounded-2xl shadow-electric-glow hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
            >
              <span>🎮 Play as Child (Enter PIN)</span>
              <span>→</span>
            </button>

            <button
              onClick={() => setAuthMode('guardian_login')}
              className="bg-white border-2 border-gray-200 text-cosmicText font-black text-base px-6 py-4 rounded-2xl hover:bg-gray-50 active:scale-95 transition-all"
            >
              🛡️ Parent Login / Setup
            </button>
          </div>

          {/* ASER & IMPACT METRICS */}
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-200 max-w-lg">
            <div>
              <p className="text-3xl font-black text-cosmicText">27%</p>
              <p className="text-[11px] text-gray-400 font-black uppercase tracking-wider">Class 3 Reading Gap</p>
            </div>
            <div>
              <p className="text-3xl font-black text-electricBlue">70%</p>
              <p className="text-[11px] text-gray-400 font-black uppercase tracking-wider">AI Target Accuracy</p>
            </div>
            <div>
              <p className="text-3xl font-black text-auroraMint">₹50</p>
              <p className="text-[11px] text-gray-400 font-black uppercase tracking-wider">Min Payout Threshold</p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Interactive Feature Showcase / Login Card */}
        <div className="md:col-span-5 relative">
          {authMode ? (
            /* Guardian Auth Form */
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl animate-scale-up">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl text-cosmicText">
                  {authMode === 'guardian_register' ? 'Guardian Registration' : 'Guardian Login'}
                </h3>
                <button onClick={() => setAuthMode(null)} className="text-xs font-bold text-gray-400">✕ Close</button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold mb-4 border border-red-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleGuardianAuth} className="space-y-4">
                {authMode === 'guardian_register' && (
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-electricBlue"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="parent@learnquest.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-electricBlue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm focus:outline-none focus:border-electricBlue"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-electricBlue text-white font-black text-sm rounded-xl shadow-electric-glow hover:scale-[1.01] active:scale-95 transition-all"
                >
                  {loading ? 'Authenticating...' : authMode === 'guardian_register' ? 'Register Account' : 'Sign In as Parent'}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <button
                  onClick={() => setAuthMode(authMode === 'guardian_login' ? 'guardian_register' : 'guardian_login')}
                  className="text-xs font-bold text-electricBlue hover:underline"
                >
                  {authMode === 'guardian_login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
                </button>
              </div>
            </div>
          ) : (
            /* Interactive Showcase Card */
            <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-white/60 shadow-xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 text-solarAmber rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                  ⭐
                </div>
                <div>
                  <h4 className="font-black text-base text-cosmicText">Demo Account Ready</h4>
                  <p className="text-xs text-gray-400 font-bold">Child: Aarav (Class 4) · PIN: 1234</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-500">Adaptive ML Engine:</span>
                  <span className="text-emerald-600 font-black">Bayesian Knowledge Tracing</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-500">Reward Pool:</span>
                  <span className="text-electricBlue font-black">₹5,000 CSR Funded</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-500">Safety System:</span>
                  <span className="text-purple-600 font-black">Server-Timed & Anti-Bot</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={onSelectKidForPin}
                  className="w-full py-3 bg-gradient-to-r from-auroraMint to-emerald-500 text-white font-black text-xs rounded-xl shadow-md hover:scale-[1.01] active:scale-95 transition-all"
                >
                  🚀 Launch Player Session (PIN: 1234)
                </button>
                <button
                  onClick={() => {
                    setEmail('parent@learnquest.org');
                    setPassword('Parent@1234');
                    setAuthMode('guardian_login');
                  }}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs rounded-xl transition-all"
                >
                  Autofill Demo Parent Credentials
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
