import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const LOCAL_BACKEND_PORTS = [8070, 8071, 8072, 8073, 8074, 8075];

const createBackendUrl = (port, path) => `http://localhost:${port}${path}`;

async function postWithBackendFallback(path, payload) {
  let lastNetworkError = null;

  for (const port of LOCAL_BACKEND_PORTS) {
    try {
      return await axios.post(createBackendUrl(port, path), payload, { timeout: 5000 });
    } catch (err) {
      if (err.response) {
        throw err;
      }
      lastNetworkError = err;
    }
  }

  throw lastNetworkError || new Error('Backend not reachable');
}

const AddSummary = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const trimmedSummary = summary.trim();
  const wordCount = trimmedSummary ? trimmedSummary.split(/\s+/).length : 0;

  const handleGenerate = async () => {
    if (!trimmedSummary) {
      setError('Please enter a summary first.');
      return;
    }

    if (wordCount < 30) {
      setError('Please provide a slightly longer summary (at least 30 words) for better quiz quality.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await postWithBackendFallback('/quiz/from-summary', {
        summary: trimmedSummary,
      });
      navigate(`/quiz/${response.data._id}/quits`);
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.request) {
        setError('Cannot reach backend server. Please start backend and try again.');
      } else {
        setError('Failed to generate quiz from summary.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-soft via-white to-brand-soft px-4 py-8">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-5">
          <h1 className="text-3xl font-bold tracking-tight text-brand-primary">Generate Quizzes from Summary</h1>
          <p className="mt-2 text-sm text-slate-600">Paste your summary and generate 10 quiz questions instantly.</p>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-semibold text-slate-800">Summary</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={12}
            placeholder="Paste the summary text here..."
            className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{wordCount} words</span>
            <span>10 questions will be generated. Pass mark: 60%</span>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || !trimmedSummary}
            className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Generating...' : 'Generate 10 Quiz'}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-brand-primary bg-white px-5 py-2.5 text-sm font-semibold text-brand-primary transition hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSummary;
