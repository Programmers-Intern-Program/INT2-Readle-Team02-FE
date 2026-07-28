/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, afterEach, vi } from 'vitest'
import { ResultReportPage } from '@/pages/result-report/ResultReportPage'
import {
  formatDuration,
  getSafeSourceUrl,
  mockResultReport,
} from '@/pages/result-report/model/resultReport'
import { getResultReportDetail } from '@/shared/api/report'
import { ApiError } from '@/shared/api/error'

vi.mock('@/shared/api/report')

afterEach(() => {
  vi.resetAllMocks()
  cleanup()
})

function renderPage(reportId = '401') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/result-reports/${reportId}`]}>
        <Routes>
          <Route path="/result-reports/:reportId" element={<ResultReportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ResultReportPage', () => {
  it('잘못된 reportId에서는 API를 호출하지 않고 복구 화면을 표시한다', () => {
    renderPage('invalid')

    expect(screen.getByText('잘못된 접근입니다')).toBeInTheDocument()
    expect(getResultReportDetail).not.toHaveBeenCalled()
  })

  it('학습 결과 요약과 문제별 오답 피드백을 렌더링한다', async () => {
    vi.mocked(getResultReportDetail).mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve(mockResultReport), 100))
    )
    renderPage()

    // 로딩 상태 검증
    expect(screen.getByText('결과 리포트를 불러오고 있습니다')).toBeInTheDocument()

    // 로딩이 끝나고 리포트 제목이 나타날 때까지 대기
    expect(await screen.findByText('Spring @Transactional 심층 이해')).toBeInTheDocument()
    const scoreRing = screen.getByLabelText('정답률 40%')
    expect(scoreRing).toBeInTheDocument()
    expect(scoreRing).toHaveTextContent('40%')
    expect(screen.getByText('문제별 풀이 결과')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '원본 아티클 보기, 새 탭에서 열림' })).toHaveAttribute(
      'href',
      'https://example.com/spring-transactional',
    )
  })

  it('원본 URL이 없는 직접 입력 결과에는 원본 링크를 표시하지 않는다', async () => {
    vi.mocked(getResultReportDetail).mockResolvedValueOnce({
      ...mockResultReport,
      sourceUrl: null,
    })
    renderPage()

    expect(await screen.findByText('Spring @Transactional 심층 이해')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: '원본 아티클 보기, 새 탭에서 열림' }),
    ).not.toBeInTheDocument()
  })

  it('404 에러 상태를 렌더링한다', async () => {
    vi.mocked(getResultReportDetail).mockRejectedValueOnce(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not Found' }),
    )
    renderPage('404')
    expect(await screen.findByText('결과 리포트를 찾을 수 없습니다')).toBeInTheDocument()
  })

  it('403 에러 상태를 렌더링한다', async () => {
    vi.mocked(getResultReportDetail).mockRejectedValueOnce(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Forbidden' }),
    )
    renderPage('403')
    expect(await screen.findByText('결과 리포트에 접근할 수 없습니다')).toBeInTheDocument()
  })

  it('unknown-error 에러 상태를 렌더링한다', async () => {
    vi.mocked(getResultReportDetail).mockRejectedValueOnce(new Error('Unknown Error'))
    renderPage('500')
    expect(await screen.findByText('일시적인 오류가 발생했습니다')).toBeInTheDocument()
  })

  it('일시적인 오류는 사용자가 다시 시도할 수 있다', async () => {
    const user = userEvent.setup()
    vi.mocked(getResultReportDetail)
      .mockRejectedValueOnce(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }))
      .mockResolvedValueOnce(mockResultReport)
    renderPage('501')

    await user.click(await screen.findByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('Spring @Transactional 심층 이해')).toBeInTheDocument()
    expect(getResultReportDetail).toHaveBeenCalledTimes(2)
  })

  it('객관식 문항 오답 시 정답 선택지(번호 및 내용)를 렌더링한다', async () => {
    const user = userEvent.setup()
    vi.mocked(getResultReportDetail).mockResolvedValueOnce(mockResultReport)
    renderPage()

    expect(await screen.findByText('Spring @Transactional 심층 이해')).toBeInTheDocument()

    const questionText = screen.getByText(
      '기존 트랜잭션의 존재 여부와 관계없이 항상 새로운 트랜잭션을 시작하는 전파 속성은 무엇인가요?',
    )
    const detailsElement = questionText.closest('details')
    expect(detailsElement).toBeInTheDocument()

    await user.click(questionText)
    expect(detailsElement).toHaveAttribute('open')

    expect(screen.getByText('정답 선택지')).toBeInTheDocument()
    expect(screen.getByText(/3번\. REQUIRES_NEW/)).toBeInTheDocument()
  })

  it('주관식 답안과 AI 피드백의 원문 줄바꿈을 보존한다', async () => {
    const user = userEvent.setup()
    const multilineAnswer = '  첫 번째 답변입니다.\n두 번째 답변입니다.  '
    const multilineFeedback = '첫 번째 피드백입니다.\n두 번째 피드백입니다.'
    vi.mocked(getResultReportDetail).mockResolvedValueOnce({
      ...mockResultReport,
      results: [
        {
          ...mockResultReport.results[1],
          submittedAnswer: multilineAnswer,
          aiFeedback: multilineFeedback,
        },
      ],
    })
    renderPage('402')

    const question = await screen.findByText(mockResultReport.results[1].questionText)
    await user.click(question)

    expect(document.querySelector('.result-answer-panel p')?.textContent).toBe(multilineAnswer)
    expect(document.querySelector('.result-feedback-panel p')?.textContent).toBe(multilineFeedback)
  })
})

describe('result report model', () => {
  it('API 계약에 맞게 객관식 오답 문항에만 정답 선택지가 제공된다', () => {
    const mcIncorrect = mockResultReport.results.find(
      (r) => r.questionType === 'multiple_choice' && !r.isCorrect,
    )
    expect(mcIncorrect?.correctChoiceNo).toBe(3)
    expect(mcIncorrect?.correctChoiceText).toBe('REQUIRES_NEW')

    const mcCorrect = mockResultReport.results.find(
      (r) => r.questionType === 'multiple_choice' && r.isCorrect,
    )
    expect(mcCorrect?.correctChoiceNo).toBeNull()
    expect(mcCorrect?.correctChoiceText).toBeNull()

    const codeBlankIncorrect = mockResultReport.results.find(
      (r) => r.questionType === 'code_blank' && !r.isCorrect,
    )
    expect(codeBlankIncorrect?.correctChoiceNo).toBeNull()
    expect(codeBlankIncorrect?.correctChoiceText).toBeNull()

    const shortAnswerIncorrect = mockResultReport.results.find(
      (r) => r.questionType === 'short_answer' && !r.isCorrect,
    )
    expect(shortAnswerIncorrect?.correctChoiceNo).toBeNull()
    expect(shortAnswerIncorrect?.correctChoiceText).toBeNull()
  })

  it('풀이 시간을 분과 초로 표시한다', () => {
    expect(formatDuration(428)).toBe('7분 08초')
  })

  it('HTTP(S) 원본 URL만 외부 링크로 허용한다', () => {
    expect(getSafeSourceUrl('https://example.com/article')).toBe('https://example.com/article')
    expect(getSafeSourceUrl('http://example.com/article')).toBe('http://example.com/article')
    expect(getSafeSourceUrl('javascript:alert(1)')).toBeNull()
    expect(getSafeSourceUrl('not-a-url')).toBeNull()
    expect(getSafeSourceUrl(null)).toBeNull()
  })
})
