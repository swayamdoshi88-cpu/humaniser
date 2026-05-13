import React, { useState } from 'react';
import { Bot, User, Sparkles, ArrowRight, Loader2, CheckCircle2, Copy, LogOut, History as HistoryIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
import { signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firebase-errors';
import { useNavigate } from 'react-router-dom';

type HumanizeResponse = {
  draftRewrite: string;
  obviousAITellsRemaining: string[];
  finalRewrite: string;
  changesMade: string[];
  aiPercentageBefore: number;
  aiPercentageAfter: number;
  plagiarismRisk: string;
};

export default function HumanizerTool() {
  const [inputText, setInputText] = useState('');
  const [sampleText, setSampleText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<HumanizeResponse | null>(null);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'final' | 'process'>('final');

  const MAX_WORD_COUNT = 1000;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const isOverLimit = wordCount > MAX_WORD_COUNT;

  const handleHumanize = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to humanize.');
      return;
    }
    if (isOverLimit) {
      setError(`Cannot humanize more than ${MAX_WORD_COUNT.toLocaleString()} words at a time.`);
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/humanize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          sample: sampleText || undefined,
        }),
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to humanize text.');
        }
      } else {
        const textError = await response.text();
        throw new Error('Server returned an invalid response. Please try again.');
      }

      setResult(data);
      setActiveTab('final');

      if (user) {
        try {
          const historyRef = doc(collection(db, 'users', user.uid, 'history'));
          const historyData: any = {
            userId: user.uid,
            originalText: inputText,
            finalRewrite: data.finalRewrite,
            createdAt: serverTimestamp()
          };
          
          if (typeof data.aiPercentageBefore === 'number') historyData.aiPercentageBefore = data.aiPercentageBefore;
          if (typeof data.aiPercentageAfter === 'number') historyData.aiPercentageAfter = data.aiPercentageAfter;
          if (typeof data.plagiarismRisk === 'string') historyData.plagiarismRisk = data.plagiarismRisk;

          await setDoc(historyRef, historyData);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/history`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <Sparkles className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Humane AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/history')}
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
              title="View History"
            >
              <HistoryIcon className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button>
            <span className="text-sm font-medium text-gray-400 hidden sm:inline-block">|</span>
            <span className="text-sm font-medium text-gray-500 hidden md:inline-block">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-md hover:bg-gray-100"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="inputText" className="text-sm font-semibold flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-500" />
                Text to Humanize
              </label>
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs text-gray-500">Paste the AI-generated text you want to fix.</p>
                <span className={`text-xs font-medium ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                  {wordCount.toLocaleString()} / {MAX_WORD_COUNT.toLocaleString()} words
                </span>
              </div>
              <textarea
                id="inputText"
                className={`w-full h-64 p-4 rounded-xl border bg-white shadow-sm outline-none transition-all resize-none text-sm leading-relaxed ${isOverLimit ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'}`}
                placeholder="E.g., It's a testament to the fact that..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="sampleText" className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-500" />
                Writing Sample (Optional)
              </label>
              <p className="text-xs text-gray-500 mb-1">Paste a sample of your own writing for voice calibration.</p>
              <textarea
                id="sampleText"
                className="w-full h-32 p-4 rounded-xl border border-gray-200 bg-white shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all resize-none text-sm leading-relaxed"
                placeholder="Paste 1-2 paragraphs of your natural writing here to match your tone..."
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleHumanize}
              disabled={isLoading || !inputText.trim() || isOverLimit}
              className="group relative w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  De-robotifying...
                </>
              ) : (
                <>
                  Humanize It
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="flex flex-col gap-4">
            {result ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-[240px])] sm:h-auto sm:min-h-[500px]">
                <div className="flex items-center border-b border-gray-100 p-1.5 bg-gray-50">
                  <button
                    onClick={() => setActiveTab('final')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'final'
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                    }`}
                  >
                    Final Result
                  </button>
                  <button
                    onClick={() => setActiveTab('process')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'process'
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                    }`}
                  >
                    Behind the Scenes
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                  {activeTab === 'final' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Final Humanized Text
                        </h3>
                        <button
                          onClick={() => copyToClipboard(result.finalRewrite)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                          title="Copy to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">AI Match (Before)</div>
                          <div className="text-xl font-bold text-rose-500">{result.aiPercentageBefore}%</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">AI Match (After)</div>
                          <div className="text-xl font-bold text-emerald-600">{result.aiPercentageAfter}%</div>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Plagiarism Risk</div>
                          <div className="text-sm font-bold text-gray-700">{result.plagiarismRisk}</div>
                        </div>
                      </div>
                      <div className="prose prose-sm prose-indigo max-w-none bg-gray-50 p-5 rounded-xl border border-gray-100">
                        {result.finalRewrite.split('\n').map((paragraph, i) => (
                          <p key={i} className="mb-4 last:mb-0 text-gray-800 leading-relaxed">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'process' && (
                     <div className="space-y-8">
                      {/* Draft */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">1. Draft Rewrite</h4>
                        <div className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100">
                          {result.draftRewrite}
                        </div>
                      </div>

                      {/* Tells */}
                      {result.obviousAITellsRemaining.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-500 mb-3">2. AI Tells Caught in Audit</h4>
                          <ul className="space-y-2">
                            {result.obviousAITellsRemaining.map((tell, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                                <span>{tell}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Changes */}
                      {result.changesMade.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-3">3. Changes Made</h4>
                          <ul className="space-y-2">
                            {result.changesMade.map((change, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-indigo-400 font-bold shrink-0">→</span>
                                <span>{change}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
               <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-gray-50 border border-gray-200 border-dashed rounded-2xl">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-4">
                  <Sparkles className="w-8 h-8 text-indigo-300" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Ready to Humanize</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  Paste your AI text on the left, add an optional writing sample to capture your unique voice, and click the button to transform your content.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 flex justify-center items-center">
          <p className="text-sm text-gray-500 flex items-center gap-1.5">
            Made by <span className="font-semibold text-gray-900">Swayam Doshi</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
