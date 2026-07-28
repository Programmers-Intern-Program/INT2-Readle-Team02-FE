// @vitest-environment jsdom
import { StrictMode } from 'react'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GradingPage } from '@/pages/grading/GradingPage'
import { fetchQuizAttemptResult, submitQuizAttempt } from '@/pages/quiz/api/quiz'
import { ApiError } from '@/shared/api/error'

vi.mock('@/pages/quiz/api/quiz')

describe('GradingPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('잘못된 attemptId에서는 복구 CTA를 제공하고 API를 호출하지 않는다', () => {
    render(
      <MemoryRouter initialEntries={['/quizzes/attempts/invalid/grading']}>
        <Routes>
          <Route path="/quizzes/attempts/:attemptId/grading" element={<GradingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('잘못된 접근입니다')
    expect(screen.getByRole('link', { name: '새 퀴즈 만들기' })).toHaveAttribute('href', '/learn')
    expect(submitQuizAttempt).not.toHaveBeenCalled()
    expect(fetchQuizAttemptResult).not.toHaveBeenCalled()
  })

  it('정수가 아닌 attemptId에서는 API를 호출하지 않는다', () => {
    render(
      <MemoryRouter initialEntries={['/quizzes/attempts/1.5/grading']}>
        <Routes>
          <Route path="/quizzes/attempts/:attemptId/grading" element={<GradingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('잘못된 접근입니다')
    expect(submitQuizAttempt).not.toHaveBeenCalled()
    expect(fetchQuizAttemptResult).not.toHaveBeenCalled()
  })

  it('채점 진행 상태와 처리 단계를 렌더링한다', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[{ pathname: '/quizzes/attempts/99/grading', state: { submitRequest: { answers: [] } } }]}>
        <Routes>
          <Route path="/quizzes/attempts/:attemptId/grading" element={<GradingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(html).toContain('답안을 채점하고 있습니다')
    expect(html).toContain('채점 진행률')
    expect(html).toContain('객관식 채점')
    expect(html).toContain('주관식 AI 평가')
    expect(html).toContain('코드 답안 평가')
    expect(html).toContain('결과 리포트 준비')
    expect(html).not.toContain('/api/')
  })

  it('준비가 끝나면 결과 확인 버튼이 노출된다', async () => {
    vi.useFakeTimers()
    
    vi.mocked(submitQuizAttempt).mockResolvedValueOnce({
      reportId: 701,
      attemptId: 99,
      gradingStatus: 'completed',
      accuracyRate: 100,
      correctCount: 2,
      totalCount: 2,
      solveDurationSeconds: 120,
      completedAt: new Date().toISOString(),
      results: []
    })

    render(
      <MemoryRouter initialEntries={[{ pathname: '/quizzes/attempts/99/grading', state: { submitRequest: { answers: [] } } }]}>
        <Routes>
          <Route path="/quizzes/attempts/:attemptId/grading" element={<GradingPage />} />
          <Route path="/result-reports/:reportId" element={<p>실제 결과 리포트</p>} />
        </Routes>
      </MemoryRouter>,
    )

    // API 응답을 기다리고 비동기 작업을 처리하기 위해 flushPromises 역할을 수행
    await act(async () => {
      // 10초를 진행시켜서 모든 타이머 애니메이션을 완료
      vi.advanceTimersByTime(10000)
    })

    expect(screen.getByRole('link', { name: /결과 리포트 보기/ })).toHaveAttribute(
      'href',
      '/result-reports/701',
    )
  })

  it('새로고침 시 sessionStorage에서 답안을 한 번만 복구하고 중복 제출을 방지한다', async () => {
    vi.useFakeTimers()
    vi.mocked(submitQuizAttempt).mockClear()
    const originalSessionStorage = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    const sessionStorageSpy = vi.fn().mockReturnValue(JSON.stringify({ answers: [] }))
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { getItem: sessionStorageSpy },
    })
    
    vi.mocked(submitQuizAttempt).mockResolvedValueOnce({
      reportId: 701,
      attemptId: 99,
      gradingStatus: 'completed',
      accuracyRate: 100,
      correctCount: 2,
      totalCount: 2,
      solveDurationSeconds: 120,
      completedAt: new Date().toISOString(),
      results: []
    })

    render(
      <MemoryRouter initialEntries={[{ pathname: '/quizzes/attempts/99/grading' }]}>
        <Routes>
          <Route path="/quizzes/attempts/:attemptId/grading" element={<GradingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    // lazy state initialization 덕분에 getItem은 최초 1회만 호출됨
    expect(sessionStorageSpy).toHaveBeenCalledTimes(1)
    // 제출 로직 역시 Effect가 한 번만 실행되므로 1회만 호출됨
    expect(submitQuizAttempt).toHaveBeenCalledTimes(1)
    
    if (originalSessionStorage) {
      Object.defineProperty(window, 'sessionStorage', originalSessionStorage)
    }
  })

  it('StrictMode 환경의 effect 재실행 시에도 제출은 1회만 발생하고 최종 완료 상태에 도달한다', async () => {
    vi.useFakeTimers()
    vi.mocked(submitQuizAttempt).mockClear()
    
    vi.mocked(submitQuizAttempt).mockResolvedValueOnce({
      reportId: 701,
      attemptId: 99,
      gradingStatus: 'completed',
      accuracyRate: 100,
      correctCount: 2,
      totalCount: 2,
      solveDurationSeconds: 120,
      completedAt: new Date().toISOString(),
      results: []
    })

    render(
      <StrictMode>
        <MemoryRouter initialEntries={[{ pathname: '/quizzes/attempts/99/grading', state: { submitRequest: { answers: [] } } }]}>
          <Routes>
            <Route path="/quizzes/attempts/:attemptId/grading" element={<GradingPage />} />
            <Route path="/result-reports/:reportId" element={<p>실제 결과 리포트</p>} />
          </Routes>
        </MemoryRouter>
      </StrictMode>
    )

    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    // React 18 StrictMode에서는 mount -> unmount -> mount 순으로 effect가 재실행되지만, API 호출은 1번만 일어남을 검증
    expect(submitQuizAttempt).toHaveBeenCalledTimes(1)
    
    // 타이머와 effect 재실행 흐름이 정상적으로 이어져서 최종 성공 화면(결과 리포트 보기 링크)까지 도달함을 단언
    expect(screen.getByRole('link', { name: /결과 리포트 보기/ })).toHaveAttribute(
      'href',
      '/result-reports/701',
    )
  })

  it('재시도 시 완료된 결과를 먼저 조회하고 중복 제출하지 않는다', async () => {
    vi.useFakeTimers()
    vi.mocked(submitQuizAttempt).mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'AI_GRADING_FAILED', message: '채점에 실패했습니다.' }),
    )
    vi.mocked(fetchQuizAttemptResult).mockResolvedValueOnce({
      reportId: 701,
      attemptId: 99,
      gradingStatus: 'completed',
      accuracyRate: 100,
      correctCount: 2,
      totalCount: 2,
      solveDurationSeconds: 120,
      completedAt: new Date().toISOString(),
      results: [],
    })

    render(
      <MemoryRouter initialEntries={[{ pathname: '/quizzes/attempts/99/grading', state: { submitRequest: { answers: [] } } }]}>
        <Routes>
          <Route path="/quizzes/attempts/:attemptId/grading" element={<GradingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    fireEvent.click(screen.getByRole('button', { name: '다시 시도하기' }))
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(fetchQuizAttemptResult).toHaveBeenCalledTimes(1)
    expect(submitQuizAttempt).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: /결과 리포트 보기/ })).toHaveAttribute(
      'href',
      '/result-reports/701',
    )
  })

  it('?mock=failed 진입 시 에러가 발생하면 타이머가 중단되어 진행 단계가 더 이상 증가하지 않는다', async () => {
    vi.useFakeTimers()
    vi.mocked(submitQuizAttempt).mockClear()

    render(
        <MemoryRouter
            initialEntries={[
              {
                pathname: '/quizzes/attempts/99/grading',
                search: '?mock=failed', // 강제 실패 트리거
                state: { submitRequest: { answers: [] } }
              }
            ]}
        >
          <Routes>
            <Route path="/quizzes/attempts/:attemptId/grading" element={<GradingPage />} />
          </Routes>
        </MemoryRouter>,
    )

    // 1. 1000ms 진행: 800ms 타이머 1개 실행됨 -> 단계는 '2 / 5'가 되어야 함
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('2 / 5')).toBeInTheDocument()

    // 2. 5000ms 추가 진행: 2400ms에서 에러가 발생하여 타이머가 클리어 됨
    // 즉, 1600ms(3단계)까지만 실행되고 3200ms(4단계), 4000ms(5단계)는 실행되지 않아야 함
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    // 3. 에러 상태로 변경되었는지 확인
    expect(screen.getByText('채점 중 문제가 발생했습니다')).toBeInTheDocument()

    // 4. 타이머 클린업이 정상 작동했다면 4/5나 5/5로 넘어가지 않고 3/5에서 정지해 있어야 함
    expect(screen.getByText('3 / 5')).toBeInTheDocument()
    expect(screen.queryByText('4 / 5')).not.toBeInTheDocument()
    expect(screen.queryByText('5 / 5')).not.toBeInTheDocument()
  })
})
