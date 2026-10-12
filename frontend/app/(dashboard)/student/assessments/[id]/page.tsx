'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { senseBand } from '@/lib/senseband';
import { useVoiceCommands } from '@/lib/voicevision/commands/registry';

const QUIZ_QUESTIONS = [
  { id: 1, question: 'What is the smallest particle of an element that retains its chemical properties?', options: ['Molecule', 'Atom', 'Electron', 'Proton'], correct: 1 },
  { id: 2, question: 'Where are protons and neutrons located in an atom?', options: ['Electron cloud', 'Outer shell', 'Nucleus', 'Orbit'], correct: 2 },
  { id: 3, question: 'What is the charge of an electron?', options: ['Positive', 'Negative', 'Neutral', 'Variable'], correct: 1 },
  { id: 4, question: 'The atomic number of an element is equal to the number of:', options: ['Neutrons', 'Electrons only', 'Protons', 'Protons + Neutrons'], correct: 2 },
  { id: 5, question: 'Which subatomic particle was discovered by J.J. Thomson?', options: ['Proton', 'Neutron', 'Electron', 'Positron'], correct: 2 },
  { id: 6, question: 'What model of the atom is known as the "plum pudding" model?', options: ['Rutherford model', 'Thomson model', 'Bohr model', 'Dalton model'], correct: 1 },
  { id: 7, question: 'In Bohr\'s model, electrons revolve around the nucleus in:', options: ['Random paths', 'Fixed circular orbits', 'Elliptical orbits', 'Spiral paths'], correct: 1 },
  { id: 8, question: 'What is the mass number of an atom?', options: ['Number of protons', 'Number of electrons', 'Sum of protons and neutrons', 'Number of neutrons'], correct: 2 },
];

export default function AssessmentTakePage() {
  const router = useRouter();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(QUIZ_QUESTIONS.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft] = useState(900); // 15 minutes in seconds

  const handleAnswer = (optionIndex: number) => {
    if (submitted) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = optionIndex;
    setAnswers(newAnswers);
    // Haptic feedback: correct/wrong immediately
    const isCorrect = optionIndex === QUIZ_QUESTIONS[currentQ].correct;
    senseBand.send(isCorrect ? 'CORRECT' : 'WRONG');
  };

  const score = submitted ? Math.round((answers.filter((a, i) => a === QUIZ_QUESTIONS[i].correct).length / QUIZ_QUESTIONS.length) * 100) : 0;
  const correctCount = answers.filter((a, i) => a === QUIZ_QUESTIONS[i].correct).length;

  const handleSubmit = () => {
    setSubmitted(true);
    // Notify student that quiz is done via SenseBand
    senseBand.send('LESSON_COMPLETE');
  };

  const quizCommands = useMemo(() => [
    {
      id: 'quiz-read-question',
      phrases: ['read the question', 'read question', 'what is the question', 'repeat question'],
      description: 'Reads the active quiz question',
      scope: (path: string) => path.includes('/student/assessments/'),
      handler: async (ctx: any) => {
        const q = QUIZ_QUESTIONS[currentQ];
        ctx.speak(`Question ${currentQ + 1} of ${QUIZ_QUESTIONS.length}: ${q.question}`);
      },
    },
    {
      id: 'quiz-read-options',
      phrases: ['read options', 'read the choices', 'what are the options', 'list options'],
      description: 'Reads the multiple-choice options for the current question',
      scope: (path: string) => path.includes('/student/assessments/'),
      handler: async (ctx: any) => {
        const q = QUIZ_QUESTIONS[currentQ];
        const text = q.options.map((opt, i) => `Option ${i + 1}: ${opt}`).join('. ');
        ctx.speak(text);
      },
    },
    {
      id: 'quiz-select-option',
      phrases: ['select option 1', 'select option 2', 'select option 3', 'select option 4', 'choose option', 'option 1', 'option 2', 'option 3', 'option 4'],
      description: 'Selects a multiple-choice option by number or name',
      scope: (path: string) => path.includes('/student/assessments/'),
      handler: async (ctx: any) => {
        const q = QUIZ_QUESTIONS[currentQ];
        let chosen = ctx.params.number ? ctx.params.number - 1 : -1;
        if (chosen < 0 || chosen >= q.options.length) {
          const lower = ctx.rawTranscript.toLowerCase();
          chosen = q.options.findIndex(opt => lower.includes(opt.toLowerCase()));
        }

        if (chosen >= 0 && chosen < q.options.length) {
          handleAnswer(chosen);
          ctx.speak(`Selected option ${chosen + 1}: ${q.options[chosen]}.`);
        } else {
          ctx.speak('Please specify option 1, 2, 3, or 4.');
        }
      },
    },
    {
      id: 'quiz-next-question',
      phrases: ['next question', 'go to next question', 'advance question'],
      description: 'Moves forward to the next quiz question',
      scope: (path: string) => path.includes('/student/assessments/'),
      handler: async (ctx: any) => {
        if (currentQ < QUIZ_QUESTIONS.length - 1) {
          const next = currentQ + 1;
          setCurrentQ(next);
          ctx.speak(`Moved to question ${next + 1}. ${QUIZ_QUESTIONS[next].question}`);
        } else {
          ctx.speak('You are on the last question. Say submit quiz to finish.');
        }
      },
    },
    {
      id: 'quiz-prev-question',
      phrases: ['previous question', 'go back a question', 'back question'],
      description: 'Moves backward to the previous quiz question',
      scope: (path: string) => path.includes('/student/assessments/'),
      handler: async (ctx: any) => {
        if (currentQ > 0) {
          const prev = currentQ - 1;
          setCurrentQ(prev);
          ctx.speak(`Moved back to question ${prev + 1}. ${QUIZ_QUESTIONS[prev].question}`);
        } else {
          ctx.speak('You are on the first question.');
        }
      },
    },
    {
      id: 'quiz-submit',
      phrases: ['submit quiz', 'finish quiz', 'submit assessment', 'complete quiz'],
      description: 'Submits your quiz after verbal confirmation',
      scope: (path: string) => path.includes('/student/assessments/'),
      requiresConfirmation: true,
      confirmationPrompt: () => {
        const answered = answers.filter(a => a !== null).length;
        return `You have answered ${answered} of ${QUIZ_QUESTIONS.length} questions. Are you sure you want to submit your quiz?`;
      },
      handler: async (ctx: any) => {
        handleSubmit();
        const calculatedScore = Math.round((answers.filter((a, i) => a === QUIZ_QUESTIONS[i].correct).length / QUIZ_QUESTIONS.length) * 100);
        ctx.speak(`Quiz submitted! Your score is ${calculatedScore} percent. ${calculatedScore >= 60 ? 'Congratulations, you passed!' : 'Review your answers below.'}`);
      },
    },
  ], [currentQ, answers]);

  useVoiceCommands('student-quiz-take', quizCommands);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="glass-card p-8 text-center">
          <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center text-4xl mb-4 ${score >= 60 ? 'bg-[#00C9A7]/20' : 'bg-red-500/20'}`}>
            {score >= 60 ? '🎉' : '📚'}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{score >= 60 ? 'Congratulations!' : 'Keep Learning!'}</h1>
          <p className={`text-4xl font-bold mt-4 ${score >= 60 ? 'text-[#00C9A7]' : 'text-red-400'}`}>{score}%</p>
          <p className="text-white/60 mt-2">{correctCount} out of {QUIZ_QUESTIONS.length} correct</p>
          <p className={`mt-2 text-sm font-medium ${score >= 60 ? 'text-[#00C9A7]' : 'text-red-400'}`}>
            {score >= 60 ? 'PASSED' : 'FAILED — Passing score is 60%'}
          </p>
        </div>

        {/* Review Answers */}
        <h2 className="text-white font-semibold text-lg">Review Answers</h2>
        <div className="space-y-3">
          {QUIZ_QUESTIONS.map((q, i) => {
            const isCorrect = answers[i] === q.correct;
            return (
              <div key={q.id} className={`glass-card p-4 border-l-4 ${isCorrect ? 'border-l-[#00C9A7]' : 'border-l-red-500'}`}>
                <p className="text-white font-medium text-sm">Q{i + 1}. {q.question}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {q.options.map((opt, j) => (
                    <div key={j} className={`px-3 py-2 rounded-lg text-sm ${j === q.correct ? 'bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/30' : j === answers[i] && !isCorrect ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-white/60'}`}>
                      {opt} {j === q.correct && '✓'} {j === answers[i] && !isCorrect && '✗'}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4">
          <button onClick={() => router.push('/student/assessments')} className="flex-1 py-3 bg-white/10 border border-white/10 rounded-xl text-white font-medium hover:bg-white/20 transition">
            Back to Assessments
          </button>
          <button onClick={() => { setSubmitted(false); setCurrentQ(0); setAnswers(new Array(QUIZ_QUESTIONS.length).fill(null)); }}
            className="flex-1 py-3 bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] rounded-xl text-white font-semibold hover:opacity-90 transition">
            Retry Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Structure of Atom Quiz</h1>
          <p className="text-white/60 text-sm">Science • Grade 8 • 8 questions</p>
        </div>
        <div className="glass-card px-4 py-2 text-center">
          <p className="text-[#6C63FF] text-lg font-bold font-mono">{formatTime(timeLeft)}</p>
          <p className="text-white/40 text-[10px]">TIME LEFT</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5">
        {QUIZ_QUESTIONS.map((_, i) => (
          <button key={i} onClick={() => setCurrentQ(i)}
            className={`h-2 flex-1 rounded-full transition-all ${i === currentQ ? 'bg-[#6C63FF]' : answers[i] !== null ? 'bg-[#00C9A7]' : 'bg-white/10'}`} />
        ))}
      </div>

      {/* Question */}
      <div className="glass-card p-8">
        <p className="text-white/40 text-sm mb-2">Question {currentQ + 1} of {QUIZ_QUESTIONS.length}</p>
        <h2 className="text-xl font-semibold text-white mb-6">{QUIZ_QUESTIONS[currentQ].question}</h2>
        <div className="space-y-3">
          {QUIZ_QUESTIONS[currentQ].options.map((option, i) => (
            <button key={i} onClick={() => handleAnswer(i)}
              className={`w-full text-left p-4 rounded-xl transition-all border ${answers[currentQ] === i ? 'bg-[#6C63FF]/20 border-[#6C63FF] text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'}`}>
              <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-sm mr-3 ${answers[currentQ] === i ? 'bg-[#6C63FF] text-white' : 'bg-white/10 text-white/50'}`}>
                {String.fromCharCode(65 + i)}
              </span>
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
          className="px-5 py-2.5 bg-white/10 border border-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition disabled:opacity-30">
          ← Previous
        </button>
        <p className="text-white/40 text-sm">{answers.filter(a => a !== null).length} of {QUIZ_QUESTIONS.length} answered</p>
        {currentQ === QUIZ_QUESTIONS.length - 1 ? (
          <button onClick={handleSubmit} className="px-6 py-2.5 bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-semibold rounded-xl hover:opacity-90 transition">
            Submit Quiz
          </button>
        ) : (
          <button onClick={() => setCurrentQ(Math.min(QUIZ_QUESTIONS.length - 1, currentQ + 1))}
            className="px-5 py-2.5 bg-[#6C63FF] text-white font-medium rounded-xl hover:bg-[#5b54e6] transition">
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
