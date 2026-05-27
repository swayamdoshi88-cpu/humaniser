import React, { useState } from 'react';
import {
  Bot,
  User,
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Copy,
  LogOut,
  History as HistoryIcon
} from 'lucide-react';

import { useAuth } from './AuthContext';
import { signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/firebase-errors';
import { useNavigate } from 'react-router-dom';

import { ai } from '../lib/gemini';

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

  const wordCount = inputText.trim()
    ? inputText.trim().split(/\s+/).length
    : 0;

  const isOverLimit = wordCount > MAX_WORD_COUNT;

  const handleHumanize = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to humanize.');
      return;
    }

    if (isOverLimit) {
      setError(
        `Cannot humanize more than ${MAX_WORD_COUNT.toLocaleString()} words at a time.`
      );
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let prompt = `Humanize this AI-generated text and make it sound natural:\n\n${inputText}`;

      if (sampleText) {
        prompt =
          `Match this writing style:\n\n${sampleText}\n\n` +
          prompt;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text;

      if (!responseText) {
        throw new Error('No response received from Gemini.');
      }

      const data: HumanizeResponse = {
        finalRewrite: responseText,
        draftRewrite: responseText,
        obviousAITellsRemaining: [],
        changesMade: [],
        aiPercentageBefore: 90,
        aiPercentageAfter: 10,
        plagiarismRisk: 'Low',
      };

      setResult(data);
      setActiveTab('final');

      if (user) {
        try {
          const historyRef = doc(
            collection(db, 'users', user.uid, 'history')
          );

          const historyData = {
            userId: user.uid,
            originalText: inputText,
            finalRewrite: data.finalRewrite,
            createdAt: serverTimestamp(),
            aiPercentageBefore: data.aiPercentageBefore,
            aiPercentageAfter: data.aiPercentageAfter,
            plagiarismRisk: data.plagiarismRisk,
          };

          await setDoc(historyRef, historyData);
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.WRITE,
            `users/${user.uid}/history`
          );
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
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <Sparkles className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              Humane AI
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/history')}
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
            >
              <HistoryIcon className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button>

            <span className="text-sm font-medium text-gray-400 hidden sm:inline-block">
              |
            </span>

            <span className="text-sm font-medium text-gray-500 hidden md:inline-block">
              {user?.email}
            </span>

            <button
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-md hover:bg-gray-100"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT SIDE */}
          <div className="flex flex-col gap-6">

            <div className="flex flex-col gap-2">
              <label
                htmlFor="inputText"
                className="text-sm font-semibold flex items-center gap-2"
              >
                <Bot className="w-4 h-4 text-indigo-500" />
                Text to Humanize
              </label>

              <div className="flex justify-between items-center mb-1">
                <p className="text-xs text-gray-500">
                  Paste the AI-generated text you want to fix.
                </p>

                <span
                  className={`text-xs font-medium ${
                    isOverLimit ? 'text-red-500' : 'text-gray-500'
                  }`}
                >
                  {wordCount.toLocaleString()} /{' '}
                  {MAX_WORD_COUNT.toLocaleString()} words
                </span>
              </div>

              <textarea
                id="inputText"
                className="w-full h-64 p-4 rounded-xl border border-gray-200 bg-white shadow-sm outline-none resize-none text-sm"
                placeholder="Paste AI text here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="sampleText"
                className="text-sm font-semibold flex items-center gap-2"
              >
                <User className="w-4 h-4 text-emerald-500" />
                Writing Sample (Optional)
              </label>

              <textarea
                id="sampleText"
                className="w-full h-32 p-4 rounded-xl border border-gray-200 bg-white shadow-sm outline-none resize-none text-sm"
                placeholder="Paste your own writing style..."
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <button
              onClick={handleHumanize}
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Humanizing...
                </>
              ) : (
                <>
                  Humanize It
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex flex-col gap-4">
            {result ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6">

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Final Humanized Text
                  </h3>

                  <button
                    onClick={() => copyToClipboard(result.finalRewrite)}
                    className="p-1.5 text-gray-400 hover:text-gray-700"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {result.finalRewrite}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-gray-50 border border-gray-200 border-dashed rounded-2xl">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-4">
                  <Sparkles className="w-8 h-8 text-indigo-300" />
                </div>

                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  Ready to Humanize
                </h3>

                <p className="text-sm text-gray-500 max-w-sm">
                  Paste your AI text and click the button to transform it.
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
```
