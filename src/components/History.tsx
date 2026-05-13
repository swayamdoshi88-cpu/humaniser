import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from './AuthContext';
import { handleFirestoreError, OperationType } from '@/src/lib/firebase-errors';
import { Loader2, ArrowLeft, History as HistoryIcon, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

type HistoryEntry = {
  id: string;
  originalText: string;
  finalRewrite: string;
  aiPercentageBefore?: number;
  aiPercentageAfter?: number;
  createdAt: any;
};

export default function History() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      try {
        const historyRef = collection(db, 'users', user.uid, 'history');
        const q = query(historyRef); // We can't use orderBy if we haven't indexed it or we can just fetch and sort locally if few
        // Let's try to sort locally to avoid needing compound indexes unless we already have them.
        const snapshot = await getDocs(q);
        const entries: HistoryEntry[] = [];
        snapshot.forEach((doc) => {
          entries.push({ id: doc.id, ...doc.data() } as HistoryEntry);
        });
        
        // sort descending
        entries.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setHistory(entries);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/history`);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex text-gray-900 bg-gray-50 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-gray-900 transition-colors p-2 rounded-md hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 text-indigo-600">
              <HistoryIcon className="w-6 h-6" />
              <h1 className="text-xl font-bold tracking-tight text-gray-900">Your History</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12">
        {history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No history yet</h2>
            <p className="text-sm text-gray-500 max-w-sm">
              Any text you humanize will automatically appear here for your records.
            </p>
            <Link 
              to="/"
              className="mt-6 inline-flex items-center justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
            >
              Humanize something new
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {history.map((entry) => (
              <div key={entry.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col sm:flex-row">
                <div className="flex-1 p-6 border-b sm:border-b-0 sm:border-r border-gray-100 bg-gray-50/50">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Original AI Text</h3>
                  <div className="text-sm text-gray-600 line-clamp-6 opacity-75">
                    {entry.originalText}
                  </div>
                </div>
                <div className="flex-1 p-6 relative">
                  <div className="absolute top-6 right-6 flex gap-3">
                    {entry.aiPercentageBefore !== undefined && (
                      <div className="text-xs font-medium text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                        {entry.aiPercentageBefore}% AI
                      </div>
                    )}
                    {entry.aiPercentageAfter !== undefined && (
                      <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                        {entry.aiPercentageAfter}% AI
                      </div>
                    )}
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-3">Humanized Version</h3>
                  <div className="text-sm text-gray-900 line-clamp-6 mt-8 sm:mt-0">
                    {entry.finalRewrite}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
