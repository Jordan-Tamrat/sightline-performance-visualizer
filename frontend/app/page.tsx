'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/api/reports/`, { url });
      router.push(`/results/${response.data.id}`);
    } catch (err: unknown) {
      console.error('Error creating report:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to the server.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8">
        <ThemeToggle />
      </div>
      <div className="max-w-3xl w-full space-y-8 text-center pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
            Sightline
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Fullstack Web Performance Visualizer powered by Lighthouse & AI.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-10"
        >
          <input
            type="url"
            placeholder="Enter website URL (e.g., https://example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="w-full sm:w-96 px-6 py-4 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-lg placeholder:text-zinc-500 dark:placeholder:text-zinc-600 text-foreground"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <>
                Analyze <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </motion.form>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200"
          >
            {error}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="pt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-zinc-600 dark:text-zinc-500 text-sm"
        >
          <div className="space-y-2">
            <div className="font-semibold text-zinc-900 dark:text-zinc-300">Lighthouse Audit</div>
            <p>Comprehensive performance metrics via Google Lighthouse.</p>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-zinc-900 dark:text-zinc-300">AI Insights</div>
            <p>Human-friendly summaries powered by Gemini AI.</p>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-zinc-900 dark:text-zinc-300">Visual Timeline</div>
            <p>Frame-by-frame loading visualization.</p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
