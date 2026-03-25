import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const LOCAL_BACKEND_PORTS = [8070, 8071, 8072, 8073, 8074, 8075];

const createBackendUrl = (port, path) => `http://localhost:${port}${path}`;

async function getWithBackendFallback(path) {
  let lastNetworkError = null;

  for (const port of LOCAL_BACKEND_PORTS) {
    try {
      return await axios.get(createBackendUrl(port, path), { timeout: 5000 });
    } catch (err) {
      if (err.response) {
        throw err;
      }
      lastNetworkError = err;
    }
  }

  throw lastNetworkError || new Error('Backend not reachable');
}

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

const Quits = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quizName, setQuizName] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [evaluation, setEvaluation] = useState({});
  const [certificateMeta, setCertificateMeta] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        setLoading(true);
        setError('');
        const res = await getWithBackendFallback(`/quiz/${id}/questions`);
        setQuizName(res.data.name || 'Quiz');
        setQuestions((res.data.questions || []).slice(0, 10));
      } catch (err) {
        setError('Failed to load quiz questions.');
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();
  }, [id]);

  const selectOption = (qId, optionText) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: optionText }));
  };

  const handleSubmit = async () => {
    if (!questions.length) return;

    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      alert('Please answer all 10 quizzes before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = {
        answers: questions.map((_, index) => ({
          questionNumber: index + 1,
          selectedAnswer: answers[index + 1] || '',
        })),
      };

      const response = await postWithBackendFallback(`/quiz/${id}/attempt`, payload);
      const attempt = response.data?.attempt;
      const evaluationRows = Array.isArray(response.data?.evaluation) ? response.data.evaluation : [];

      const evaluationMap = {};
      evaluationRows.forEach((row) => {
        evaluationMap[row.questionNumber] = row;
      });

      setEvaluation(evaluationMap);
      setScore({
        correct: attempt?.correctAnswers ?? 0,
        total: attempt?.totalQuestions ?? questions.length,
        percent: attempt?.scorePercentage ?? 0,
      });
      setCertificateMeta(response.data?.certificate || null);
      setSubmitted(true);
      setShowResult(false);
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.request) {
        setError('Cannot reach backend server. Please start backend and try again.');
      } else {
        setError('Failed to submit quiz attempt.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setShowResult(false);
    setEvaluation({});
    setCertificateMeta(null);
    setError('');
  };

  const downloadCertificate = () => {
    if (!score || score.percent < 60) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1800;
    canvas.height = 1270;
    const ctx = canvas.getContext('2d');
    const today = new Date();
    const formattedDate = today.toLocaleDateString();
    const certId = certificateMeta?.certificateId || `CERT-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(id || '').slice(-6).toUpperCase() || '000001'}`;

    const w = canvas.width;
    const h = canvas.height;

    const bgGradient = ctx.createLinearGradient(0, 0, w, h);
    bgGradient.addColorStop(0, '#fffdf5');
    bgGradient.addColorStop(1, '#f8fbff');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#053668';
    ctx.lineWidth = 14;
    ctx.strokeRect(38, 38, w - 76, h - 76);

    ctx.strokeStyle = '#FF7100';
    ctx.lineWidth = 4;
    ctx.strokeRect(64, 64, w - 128, h - 128);

    ctx.strokeStyle = '#F7ECB5';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(88, 88, w - 176, h - 176);
    ctx.setLineDash([]);

    ctx.fillStyle = '#053668';
    ctx.textAlign = 'center';
    ctx.font = '600 32px Georgia, serif';
    ctx.fillText('Certificate ID: ' + certId, w / 2, 170);

    ctx.fillStyle = '#053668';
    ctx.font = '700 88px Georgia, serif';
    ctx.fillText('Certificate of Achievement', w / 2, 300);

    ctx.fillStyle = '#FF7100';
    ctx.font = '600 40px Georgia, serif';
    ctx.fillText('This certifies successful completion of the quiz', w / 2, 380);

    ctx.fillStyle = '#1f2937';
    ctx.font = '500 34px Georgia, serif';
    ctx.fillText('Course / Topic', w / 2, 485);

    ctx.fillStyle = '#053668';
    ctx.font = '700 58px Georgia, serif';
    ctx.fillText(quizName || 'Summary Quiz', w / 2, 570);

    ctx.fillStyle = '#1f2937';
    ctx.font = '500 34px Georgia, serif';
    ctx.fillText('Final Score', w / 2, 675);

    ctx.fillStyle = '#053668';
    ctx.font = '700 62px Georgia, serif';
    ctx.fillText(`${score.correct}/${score.total} (${score.percent}%)`, w / 2, 755);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(240, 980);
    ctx.lineTo(760, 980);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(1040, 980);
    ctx.lineTo(1560, 980);
    ctx.stroke();

    ctx.fillStyle = '#374151';
    ctx.font = '500 30px Georgia, serif';
    ctx.fillText('Authorized Signature', 500, 1030);
    ctx.fillText('Date Issued', 1300, 1030);

    ctx.fillStyle = '#111827';
    ctx.font = '600 34px Georgia, serif';
    ctx.fillText(formattedDate, 1300, 940);

    ctx.fillStyle = '#6b7280';
    ctx.font = '500 24px Georgia, serif';
    ctx.fillText('Generated by Quiz Learning Platform', w / 2, 1145);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${(quizName || 'summary-quiz').replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-soft via-white to-brand-soft px-4 py-8">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-brand-primary">Quizzes</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">{quizName}</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-brand-primary bg-white px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        {loading && <p className="text-sm font-medium text-slate-600">Loading quizzes...</p>}
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}
        {!loading && !error && questions.length === 0 && <p className="text-sm text-slate-600">No quizzes available.</p>}

        {questions.length > 0 && (
          <div className="grid gap-4">
            <div className="text-sm font-semibold text-slate-600">Showing {questions.length}/10 quizzes</div>

            {showResult && score && (
              <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center shadow-sm">
                <h2 className="mb-4 text-3xl font-bold text-brand-primary">My Result</h2>
                <div className="mb-6">
                  <div className="mb-2 text-lg font-semibold text-slate-900">
                    Correct answers: {score.correct} / {score.total}
                  </div>
                  <div className={`text-4xl font-bold ${score.percent >= 60 ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {score.percent}%
                  </div>
                </div>

                {score.percent >= 60 ? (
                  <button
                    onClick={downloadCertificate}
                    className="mr-2 rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-accent/90"
                  >
                    Download Certificate
                  </button>
                ) : (
                  <p className="mb-3 text-sm text-slate-600">Get at least 60% to download certificate.</p>
                )}

                <button
                  onClick={() => setShowResult(false)}
                  className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary/90"
                >
                  Close
                </button>
              </div>
            )}

            {questions.map((q, index) => {
              const questionId = index + 1;
              return (
                <div
                  key={questionId}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 font-semibold leading-relaxed text-brand-primary">
                    Q{questionId}. {q.questionText}
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {q.options.map((opt, idx) => {
                      const selected = answers[questionId] || '';
                      const isChosen = selected === opt.text;
                      const questionEvaluation = evaluation[questionId];
                      let optionClass = 'border-slate-200 bg-white text-slate-900';

                      if (isChosen) {
                        optionClass = 'border-blue-300 bg-blue-50 text-blue-900';
                      }

                      if (submitted) {
                        if (questionEvaluation?.correctAnswer === opt.text) {
                          optionClass = 'border-emerald-600 bg-emerald-50 text-emerald-800';
                        } else if (isChosen && !questionEvaluation?.isCorrect) {
                          optionClass = 'border-rose-600 bg-rose-50 text-rose-800';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => selectOption(questionId, opt.text)}
                          disabled={submitted}
                          className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${optionClass} ${submitted ? 'cursor-default' : 'hover:border-brand-primary/60 hover:bg-slate-50'}`}
                        >
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>

                  {submitted && evaluation[questionId] && (
                    <div className="mt-2 space-y-1">
                      <p className={`text-sm font-semibold ${evaluation[questionId].isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {evaluation[questionId].isCorrect ? 'Correct answer' : 'Incorrect answer'}
                      </p>
                      {!evaluation[questionId].isCorrect && (
                        <p className="text-sm text-slate-700">Correct option: {evaluation[questionId].correctAnswer}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="mt-1 flex justify-end gap-2">
              <button
                onClick={resetAll}
                className="rounded-lg border border-brand-primary bg-white px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-slate-50"
              >
                Reset
              </button>
              {!submitted ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              ) : (
                <button
                  onClick={() => setShowResult(true)}
                  className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary/90"
                >
                  View my result
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quits;
