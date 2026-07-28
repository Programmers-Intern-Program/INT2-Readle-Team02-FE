import { useState } from 'react'
import { isAnswered, questionTypeLabel, type QuizAnswers, type QuizQuestion } from '@/pages/quiz/model/quiz'

export interface QuizNavigatorProps {
  questions: QuizQuestion[]
  answers: QuizAnswers
  currentIndex: number
  answeredCount: number
  moveToQuestion: (index: number) => void
}

export function QuizNavigator({
  questions,
  answers,
  currentIndex,
  answeredCount,
  moveToQuestion,
}: QuizNavigatorProps) {
  const [isNoticeVisible, setIsNoticeVisible] = useState(true)

  return (
    <aside className="quiz-navigator" aria-label="문제 바로가기">
      <div className="quiz-navigator-heading">
        <span>문제 목록</span>
        <strong>
          {answeredCount}/{questions.length} 완료
        </strong>
      </div>
      <ol className="quiz-question-list">
        {questions.map((item, index) => {
          const active = index === currentIndex
          const answered = isAnswered(answers[item.questionId])

          return (
            <li key={item.questionId}>
              <button
                aria-current={active ? 'step' : undefined}
                aria-label={`${item.orderNo}번 문제${active ? ', 현재 문제' : ''}${answered ? ', 답변 완료' : ', 미응답'}`}
                className={`quiz-question-link ${active ? 'quiz-question-link-active' : ''} ${
                  answered ? 'quiz-question-link-answered' : ''
                }`}
                onClick={() => moveToQuestion(index)}
                type="button"
              >
                <span>{String(item.orderNo).padStart(2, '0')}</span>
                <span>{questionTypeLabel[item.type]}</span>
                <span aria-hidden="true" className="quiz-question-link-state">
                  {answered ? '✓' : active ? '●' : '○'}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className={`quiz-record-notice ${isNoticeVisible ? '' : 'quiz-record-notice-collapsed'}`}>
        {isNoticeVisible && (
          <p>답안은 임시 저장될 수 있지만, 제출하지 않은 퀴즈는 학습 기록에 표시되지 않습니다.</p>
        )}
        <button
          aria-expanded={isNoticeVisible}
          aria-label={isNoticeVisible ? '학습 기록 안내 접기' : '학습 기록 안내 펼치기'}
          className="quiz-record-notice-toggle"
          onClick={() => setIsNoticeVisible((visible) => !visible)}
          type="button"
        >
          {!isNoticeVisible && <span className="quiz-record-notice-label">안내 보기</span>}
          <span aria-hidden="true">{isNoticeVisible ? '›' : '‹'}</span>
        </button>
      </div>
    </aside>
  )
}
