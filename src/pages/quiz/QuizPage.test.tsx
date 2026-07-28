// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuizPage } from '@/pages/quiz/QuizPage'
import { fetchQuizAttemptDetail, startQuizAttempt } from '@/pages/quiz/api/quiz'
import {
  getAnsweredCount,
  getFirstUnansweredIndex,
  isAnswered,
} from '@/pages/quiz/model/quiz'
import { mockQuiz } from '@/pages/quiz/model/quiz'
import { QuizSubmitConfirm } from '@/pages/quiz/ui/QuizSubmitConfirm'

vi.mock('@/pages/quiz/api/quiz')

function renderQuizPage(quizId = '1', strict = false) {
  const routeTree = (
    <MemoryRouter initialEntries={[`/quizzes/${quizId}`]}>
      <Routes>
        <Route path="/quizzes/:quizId" element={<QuizPage />} />
        <Route path="/quizzes/attempts/:attemptId/grading" element={<p>채점 중...</p>} />
      </Routes>
    </MemoryRouter>
  )

  return render(
    strict ? <StrictMode>{routeTree}</StrictMode> : routeTree,
  )
}

describe('QuizPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
    cleanup()
    sessionStorage.clear()
  })

  it('API 로딩 중에는 스켈레톤 로딩 화면을 렌더링한다', () => {
    // API 프로미스를 pending 상태로 두어 로딩 렌더링 검증
    vi.mocked(startQuizAttempt).mockReturnValue(new Promise(() => {}))
    renderQuizPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('퀴즈를 불러오는 중입니다…')).toBeInTheDocument()
  })

  it('유효하지 않은 quizId(문자열)면 에러 화면을 즉시 렌더링한다', () => {
    renderQuizPage('abc')

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('잘못된 퀴즈 접근입니다')).toBeInTheDocument()
    expect(startQuizAttempt).not.toHaveBeenCalled()
    expect(fetchQuizAttemptDetail).not.toHaveBeenCalled()
  })

  it('Strict Mode에서 동일한 퀴즈 attempt를 한 번만 생성한다', async () => {
    vi.mocked(startQuizAttempt).mockResolvedValue({
      attemptId: 99,
      quizId: 1,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    })
    vi.mocked(fetchQuizAttemptDetail).mockResolvedValue({
      attemptId: 99,
      quizSetId: 1,
      status: 'in_progress',
      questions: [
        {
          questionId: 301,
          type: 'multiple_choice',
          orderNo: 1,
          questionText: 'Test MCQ',
          codeSnippet: null,
          choices: [
            { choiceId: 401, orderNo: 1, choiceText: 'Choice 1' },
            { choiceId: 402, orderNo: 2, choiceText: 'Choice 2' },
          ],
        },
      ],
    })

    renderQuizPage('1', true)

    expect(await screen.findByText('Test MCQ')).toBeInTheDocument()
    expect(
      screen.getByText('답안은 임시 저장될 수 있지만, 제출하지 않은 퀴즈는 학습 기록에 표시되지 않습니다.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '학습 기록 안내 접기' }))
    expect(
      screen.queryByText('답안은 임시 저장될 수 있지만, 제출하지 않은 퀴즈는 학습 기록에 표시되지 않습니다.'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '학습 기록 안내 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByText('문제 목록')).toBeInTheDocument()
    expect(startQuizAttempt).toHaveBeenCalledTimes(1)
  })

  it('퀴즈 문제를 모두 풀고 제출하면 결과 준비(Grading) 화면으로 라우팅된다', async () => {
    const user = userEvent.setup()
    vi.mocked(startQuizAttempt).mockResolvedValue({
      attemptId: 99,
      quizId: 1,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    })
    
    // 객관식 1개, 단답형 1개로만 간소화된 응답 모킹
    vi.mocked(fetchQuizAttemptDetail).mockResolvedValue({
      attemptId: 99,
      quizSetId: 1,
      status: 'in_progress',
      questions: [
        {
          questionId: 301,
          type: 'multiple_choice',
          orderNo: 1,
          questionText: 'Test MCQ',
          codeSnippet: null,
          choices: [
            { choiceId: 401, orderNo: 1, choiceText: 'Choice 1' },
            { choiceId: 402, orderNo: 2, choiceText: 'Choice 2' }
          ]
        },
        {
          questionId: 302,
          type: 'short_answer',
          orderNo: 2,
          questionText: 'Test Short Answer',
          codeSnippet: null,
          choices: null
        }
      ]
    })


    renderQuizPage()

    // 1번 문제 (객관식) 풀이
    const choice = await screen.findByText('Choice 1')
    const progressSegments = document.querySelector<HTMLElement>('.quiz-progress-segments')
    expect(progressSegments?.style.getPropertyValue('--quiz-question-count')).toBe('2')
    await user.click(choice)
    await user.click(screen.getByRole('button', { name: /다음 문제/ }))

    // 2번 문제 (주관식) 풀이
    const input = await screen.findByPlaceholderText(/답변해 주세요/)
    await user.type(input, 'Test Answer')
    
    // 제출
    await user.click(screen.getByRole('button', { name: /제출하기/ }))
    
    // 모달 확인
    const confirmButton = await screen.findByRole('button', { name: '제출하기' })
    await user.click(confirmButton)

    // attemptId 99에 해당하는 채점 화면(grading)으로 이동했는지 검증
    expect(await screen.findByText('채점 중...')).toBeInTheDocument()
  })
})

describe('QuizSubmitConfirm', () => {
  it('부모가 다시 렌더링되어도 현재 포커스를 유지하고 Tab 포커스를 순환한다', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const view = render(<QuizSubmitConfirm onCancel={onCancel} onConfirm={onConfirm} />)
    const continueButton = screen.getByRole('button', { name: '계속 풀기' })
    const submitButton = screen.getByRole('button', { name: '제출하기' })

    submitButton.focus()
    view.rerender(
      <QuizSubmitConfirm
        onCancel={() => onCancel()}
        onConfirm={() => onConfirm()}
      />,
    )
    expect(submitButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(continueButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(submitButton).toHaveFocus()
  })
})


describe('quiz model', () => {
  it('공백 답안은 완료로 처리하지 않는다', () => {
    expect(isAnswered(undefined)).toBe(false)
    expect(isAnswered('   ')).toBe(false)
    expect(isAnswered('트랜잭션 프록시')).toBe(true)
    expect(isAnswered(401)).toBe(true)
  })

  it('완료한 문제 수와 첫 번째 미응답 문제를 계산한다', () => {
    const answers = {
      301: 402,
      302: '프록시를 거치지 않기 때문입니다.',
      303: ' ',
    }

    expect(getAnsweredCount(mockQuiz.questions, answers)).toBe(2)
    expect(getFirstUnansweredIndex(mockQuiz.questions, answers)).toBe(2)
  })
})
