// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LearningPreparationPage } from '@/pages/learning-preparation/LearningPreparationPage'
import { useValidationPolling } from '@/pages/learning-preparation/api/useValidationPolling'
import { useCreateQuiz } from '@/pages/learning-preparation/api/useCreateQuiz'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/error'

vi.mock('@/pages/learning-preparation/api/useValidationPolling')
vi.mock('@/pages/learning-preparation/api/useCreateQuiz')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

function renderComponent(contentId = '101') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/contents/${contentId}/preparing`]}>
        <Routes>
          <Route path="/contents/:contentId/preparing" element={<LearningPreparationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LearningPreparationPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('긴 생성 과정을 확인할 수 있는 전용 페이지를 렌더링한다', () => {
    vi.mocked(useValidationPolling).mockReturnValue({
      data: { status: 'PENDING' },
      isError: false,
      refetch: vi.fn(),
    } as any)
    vi.mocked(useCreateQuiz).mockReturnValue({
      isPending: false,
      isSuccess: false,
      isError: false,
      mutate: vi.fn(),
    } as any)

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LearningPreparationPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(html).toContain('READLE KNOWLEDGE COMPILER')
    expect(html).toContain('퀴즈를 만들고 있습니다')
    expect(html).toContain('콘텐츠 본문 확인')
    expect(html).toContain('학습 콘텐츠 검증')
    expect(html).toContain('지식 구조 연결')
    expect(html).toContain('맞춤형 퀴즈 생성')
    expect(html).toContain('KNOWLEDGE MAP')
    expect(html).toContain('입력 화면으로 돌아가기')
  })

  it('콘텐츠 검증 거절(REJECTED) 시 백엔드 상세 사유 메시지를 렌더링한다', () => {
    vi.mocked(useValidationPolling).mockReturnValue({
      data: {
        status: 'REJECTED',
        errorCode: 'NOT_DEVELOPMENT_RELATED',
        message: '개발/기술 학습 콘텐츠로 인식되지 않았습니다. 관련된 콘텐츠를 등록해 주세요.',
        bypassAvailable: false,
      },
      isError: false,
      refetch: vi.fn(),
    } as any)
    vi.mocked(useCreateQuiz).mockReturnValue({
      isPending: false,
      isSuccess: false,
      isError: false,
      mutate: vi.fn(),
    } as any)

    renderComponent()

    expect(screen.getByText('퀴즈 생성이 중단되었습니다')).toBeInTheDocument()
    expect(screen.getByText('개발/기술 학습 콘텐츠로 인식되지 않았습니다. 관련된 콘텐츠를 등록해 주세요.')).toBeInTheDocument()
  })

  it('콘텐츠 검증 실패(FAILED) 시 상세 에러 메시지를 렌더링한다', () => {
    vi.mocked(useValidationPolling).mockReturnValue({
      data: {
        status: 'FAILED',
        errorCode: 'AI_SERVICE_ERROR',
        message: 'AI 검증 서비스 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        bypassAvailable: false,
      },
      isError: false,
      refetch: vi.fn(),
    } as any)
    vi.mocked(useCreateQuiz).mockReturnValue({
      isPending: false,
      isSuccess: false,
      isError: false,
      mutate: vi.fn(),
    } as any)

    renderComponent()

    expect(screen.getByText('AI 검증 서비스 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument()
  })

  it('퀴즈 생성 API 에러 발생 시 ApiError의 상세 메시지를 렌더링한다', () => {
    vi.mocked(useValidationPolling).mockReturnValue({
      data: { status: 'PASSED' },
      isError: false,
      refetch: vi.fn(),
    } as any)
    vi.mocked(useCreateQuiz).mockReturnValue({
      isPending: false,
      isSuccess: false,
      isError: true,
      error: new ApiError({
        status: 400,
        code: 'QUIZ_GENERATION_FAILED',
        message: '본문 내용이 유효하지 않아 퀴즈를 생성할 수 없습니다.',
      }),
      mutate: vi.fn(),
      reset: vi.fn(),
    } as any)

    renderComponent()

    expect(screen.getByText('본문 내용이 유효하지 않아 퀴즈를 생성할 수 없습니다.')).toBeInTheDocument()
    expect(screen.getByText('퀴즈 생성 재시도')).toBeInTheDocument()
  })
})
