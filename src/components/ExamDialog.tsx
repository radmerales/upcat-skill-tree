import { useEffect, useMemo, useState } from 'react'
import type { SkillNode, Subject } from '../types'
import { Check, Close, Exam } from './Icons'

interface ExamDialogProps {
  subject: Subject
  node: SkillNode
  bestScore?: number
  onClose: () => void
  onResult: (score: number, passed: boolean) => void
}

export default function ExamDialog({
  subject,
  node,
  bestScore,
  onClose,
  onResult,
}: ExamDialogProps) {
  const exam = node.exam
  const questions = exam?.questions ?? []
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [score, setScore] = useState(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const answeredCount = useMemo(
    () => questions.filter((_, questionIndex) => answers[questionIndex] !== undefined).length,
    [answers, questions],
  )

  if (!exam || questions.length === 0) return null

  const question = questions[index]
  const selected = answers[index]
  const passed = score >= exam.passScore
  const alreadyPassed = bestScore !== undefined && bestScore >= exam.passScore
  const allAnswered = answeredCount === questions.length

  const submit = () => {
    const correct = questions.reduce(
      (total, entry, questionIndex) => total + (answers[questionIndex] === entry.answer ? 1 : 0),
      0,
    )
    const percentage = Math.round((correct / questions.length) * 100)
    setCorrectCount(correct)
    setScore(percentage)
    setSubmitted(true)
    onResult(percentage, percentage >= exam.passScore)
  }

  const retry = () => {
    setIndex(0)
    setAnswers({})
    setSubmitted(false)
    setCorrectCount(0)
    setScore(0)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="exam-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="modal__kicker">
          <Exam size={13} />
          {subject.name} · checkpoint exam
        </span>

        <div className="exam-modal__intro">
          <div>
            <h2 id="exam-title">{node.title}</h2>
            <p>
              {questions.length} questions · Best score{' '}
              <strong>{bestScore === undefined ? '—' : `${bestScore}%`}</strong>
            </p>
          </div>
          <div className="exam-threshold">
            <strong>{exam.passScore}%</strong>
            <span>to pass</span>
          </div>
        </div>

        <div className="exam-modal__body">
          {!submitted ? (
            <>
              <div className="exam-progress" aria-hidden="true">
                {questions.map((_, questionIndex) => (
                  <span
                    key={questionIndex}
                    className={`exam-progress__pip${
                      questionIndex === index
                        ? ' is-current'
                        : answers[questionIndex] !== undefined
                          ? ' is-answered'
                          : ''
                    }`}
                  />
                ))}
              </div>

              <div className="exam-question">
                <div className="exam-question__meta">
                  <span>
                    Question {index + 1} of {questions.length}
                  </span>
                  <span>{answeredCount} answered</span>
                </div>
                <p className="exam-question__prompt">{question.prompt}</p>
                <div className="exam-choices">
                  {question.choices.map((choice, choiceIndex) => (
                    <button
                      key={choiceIndex}
                      type="button"
                      className={`exam-choice${selected === choiceIndex ? ' is-selected' : ''}`}
                      aria-pressed={selected === choiceIndex}
                      onClick={() =>
                        setAnswers((current) => ({ ...current, [index]: choiceIndex }))
                      }
                    >
                      <span className="exam-choice__key">
                        {String.fromCharCode(65 + choiceIndex)}
                      </span>
                      <span>{choice}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="exam-nav">
                <button
                  type="button"
                  className="action action--ghost"
                  onClick={() => setIndex((current) => Math.max(0, current - 1))}
                  disabled={index === 0}
                >
                  Previous
                </button>
                {index < questions.length - 1 ? (
                  <button
                    type="button"
                    className="action action--primary"
                    onClick={() => setIndex((current) => Math.min(questions.length - 1, current + 1))}
                    disabled={selected === undefined}
                  >
                    Next question
                  </button>
                ) : (
                  <button
                    type="button"
                    className="action action--primary"
                    onClick={submit}
                    disabled={!allAnswered}
                  >
                    Submit exam
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={`exam-result${passed ? ' is-passed' : ' is-failed'}`}>
                <div className="exam-result__score">
                  <strong>{score}%</strong>
                  <span>
                    {correctCount} of {questions.length} correct
                  </span>
                </div>
                <div className="exam-result__copy">
                  <h3>{passed ? 'Checkpoint passed' : 'Not quite yet'}</h3>
                  <p>
                    {passed
                      ? `${node.title} is mastered and the next nodes are unlocked.`
                      : alreadyPassed
                        ? `This attempt scored ${score}%, below the ${exam.passScore}% pass mark. Your recorded best of ${bestScore}% still counts.`
                        : `You need ${exam.passScore}% to master this node. Review the explanations and try again.`}
                  </p>
                </div>
              </div>

              <ol className="exam-review">
                {questions.map((entry, questionIndex) => {
                  const isCorrect = answers[questionIndex] === entry.answer
                  return (
                    <li
                      key={questionIndex}
                      className={isCorrect ? 'exam-review__item is-correct' : 'exam-review__item is-wrong'}
                    >
                      <span className="exam-review__mark">
                        {isCorrect ? <Check size={11} /> : <Close size={11} />}
                      </span>
                      <div className="exam-review__copy">
                        <p className="exam-review__prompt">{entry.prompt}</p>
                        <p className="exam-review__answer">
                          Correct answer: <strong>{entry.choices[entry.answer]}</strong>
                        </p>
                        <p className="exam-review__why">{entry.explanation}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </div>

        {submitted && (
          <div className="modal__actions exam-modal__actions">
            {!passed && (
              <button type="button" className="action action--ghost" onClick={retry}>
                Try again
              </button>
            )}
            <button type="button" className="action action--primary" onClick={onClose}>
              {passed ? 'Continue' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
