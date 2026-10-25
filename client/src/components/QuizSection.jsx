import React, { useState, useEffect } from 'react';
import { api } from '../utils/api.js';

export default function QuizSection({ studentStats, setStudentStats, setScreen }) {
  const [subject, setSubject] = useState('math');
  const [lang, setLang] = useState('en');
  const [currentQ, setCurrentQ] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  // Load wallet stats
  const loadWallet = async () => {
    try {
      const w = await api('/learn/wallet');
      setWallet(w);
      if (setStudentStats) {
        setStudentStats(prev => ({
          ...prev,
          points: w.points,
          rupees: w.rupees,
        }));
      }
    } catch (e) {
      // offline / demo mode
    }
  };

  // Fetch next question from adaptive ML service
  const fetchNextQuestion = async (subj = subject) => {
    setLoading(true);
    setFeedback(null);
    setSelectedOption(null);
    setError('');
    try {
      const res = await api('/learn/next', {
        method: 'POST',
        body: { subject: subj },
      });

      if (res.done) {
        setIsFinished(true);
      } else {
        setCurrentQ(res);
      }
    } catch (err) {
      // Fallback demo question if backend not unlocked with PIN yet
      setCurrentQ({
        token: 'demo-token',
        question: {
          subject: subj,
          skill: subj === 'math' ? 'math.fractions' : 'sci.life',
          difficulty: 3,
          text: subj === 'math'
            ? (lang === 'hi' ? '20 का 3/4 भाग कितना होगा?' : 'What is 3/4 of 20?')
            : (lang === 'hi' ? 'पौधे प्रकाश संश्लेषण के लिए किस गैस का उपयोग करते हैं?' : 'Which gas do plants absorb during photosynthesis?'),
          options: subj === 'math'
            ? ['12', '15', '18', '16']
            : ['Carbon Dioxide', 'Oxygen', 'Nitrogen', 'Helium'],
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
    fetchNextQuestion(subject);
  }, [subject]);

  const handleAnswer = async (index) => {
    if (selectedOption !== null || feedback) return;
    setSelectedOption(index);

    if (!currentQ || currentQ.token === 'demo-token') {
      // Local demo evaluation
      const isCorrect = index === 1 || index === 0;
      setFeedback({
        correct: isCorrect,
        points: isCorrect ? 5 : 1,
        xpGained: isCorrect ? 25 : 10,
        explanation: 'Great effort! Practice leads to mastery.',
      });
      if (setStudentStats) {
        setStudentStats(prev => ({
          ...prev,
          points: prev.points + (isCorrect ? 5 : 1),
        }));
      }
      return;
    }

    try {
      const result = await api('/learn/answer', {
        method: 'POST',
        body: {
          token: currentQ.token,
          chosen: index,
        },
      });

      setFeedback(result);
      if (result.wallet) {
        setWallet(result.wallet);
      }
      if (setStudentStats) {
        setStudentStats(prev => ({
          ...prev,
          points: result.wallet?.points || (prev.points + result.points),
          level: result.newLevel || prev.level,
        }));
      }

      if (result.levelUp) {
        setCelebration(`🎉 LEVEL UP! You reached Level ${result.newLevel}!`);
      } else if (result.correct) {
        setCelebration(`🌟 +${result.points} Stars! (+${result.xpGained} XP)`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-24 text-cosmicText">
      {/* Top Controls: Subject switch + Language switch + Wallet */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => { setSubject('math'); setIsFinished(false); }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
              subject === 'math' ? 'bg-electricBlue text-white shadow-electric-glow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            🔢 Maths
          </button>
          <button
            onClick={() => { setSubject('science'); setIsFinished(false); }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
              subject === 'science' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            🔬 Science
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')}
            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 font-black text-xs rounded-lg text-gray-600"
          >
            🌐 {lang === 'en' ? 'English' : 'हिंदी'}
          </button>

          {wallet && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl text-xs font-black text-amber-800">
              <span>⭐ {wallet.points}</span>
              <span className="text-[10px] text-amber-600 font-bold">(₹{wallet.rupees})</span>
            </div>
          )}
        </div>
      </div>

      {celebration && (
        <div className="bg-gradient-to-r from-solarAmber to-amber-500 text-white p-3 rounded-2xl mb-4 text-center font-black text-xs shadow-md animate-bounce">
          {celebration}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl mb-4 text-xs font-bold">
          {error}
        </div>
      )}

      {!isFinished && currentQ ? (
        <div className="animate-fade-in space-y-4">
          {/* Question Card */}
          <div className="bg-white border-2 border-gray-100 p-6 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <span className="px-3 py-1 bg-blue-50 text-electricBlue rounded-full text-[10px] font-black uppercase tracking-wider">
                {currentQ.question.skill || subject}
              </span>
              <span className="px-2.5 py-0.5 bg-amber-50 text-solarAmber rounded-full text-[10px] font-black">
                Diff: {currentQ.question.difficulty}/5
              </span>
            </div>

            <h3 className="font-black text-lg text-cosmicText leading-relaxed mb-2">
              {currentQ.question.text}
            </h3>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {currentQ.question.options.map((opt, index) => {
              let optStyle = 'border-gray-200 bg-white hover:bg-gray-50 text-cosmicText';
              if (selectedOption === index) {
                optStyle = 'border-electricBlue bg-blue-50 text-electricBlue';
              }
              if (feedback) {
                if (index === feedback.correctIndex) {
                  optStyle = 'border-emerald-500 bg-emerald-50 text-emerald-800 font-black';
                } else if (selectedOption === index && !feedback.correct) {
                  optStyle = 'border-red-500 bg-red-50 text-red-700';
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  disabled={Boolean(feedback) || loading}
                  className={`w-full p-4 rounded-2xl border-2 text-left font-black text-sm transition-all flex items-center justify-between ${optStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{opt}</span>
                  </div>
                  {feedback && index === feedback.correctIndex && <span>✅</span>}
                  {feedback && selectedOption === index && !feedback.correct && <span>❌</span>}
                </button>
              );
            })}
          </div>

          {/* Feedback & Next Button */}
          {feedback && (
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-3 animate-scale-up">
              <div className="flex items-center justify-between">
                <span className={`font-black text-sm ${feedback.correct ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {feedback.correct ? '🎉 Correct Answer!' : '💪 Good Effort! Keep Going!'}
                </span>
                <span className="text-xs font-black text-solarAmber">
                  +{feedback.points || 1} Stars
                </span>
              </div>

              {feedback.explanation && (
                <p className="text-xs text-gray-500 font-bold bg-gray-50 p-3 rounded-xl border border-gray-100">
                  💡 {feedback.explanation}
                </p>
              )}

              <button
                onClick={() => fetchNextQuestion()}
                className="w-full py-3.5 bg-gradient-to-r from-electricBlue to-indigo-600 text-white font-black text-sm rounded-2xl shadow-electric-glow hover:scale-[1.01] active:scale-95 transition-all"
              >
                Next Adaptive Question →
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Finished Screen */
        <div className="text-center py-12 bg-white p-8 rounded-3xl border border-gray-200 shadow-sm animate-scale-up">
          <span className="text-6xl block mb-4 animate-bounce">🌈</span>
          <h2 className="text-2xl font-black text-cosmicText mb-2">You Completed Today's Questions!</h2>
          <p className="text-xs text-gray-400 font-bold max-w-xs mx-auto mb-6">
            Awesome learning! Your mastery estimate and streak are recorded. Ask your guardian to check your progress.
          </p>

          <button
            onClick={() => setScreen('dashboard')}
            className="w-full py-4 bg-gradient-to-r from-auroraMint to-emerald-500 text-white font-black text-sm rounded-2xl shadow-md"
          >
            Back to Star Map
          </button>
        </div>
      )}
    </div>
  );
}
