// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LearningPreparationPage } from '@/pages/learning-preparation/LearningPreparationPage'
import { useValidationPolling } from '@/pages/learning-preparation/api/useValidationPolling'
import { useCreateQuiz } from '@/pages/learning-preparation/api/useCreateQuiz'
import { QueryClient, QueryClientProvider, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/error'
import type { ContentValidationResponse } from '@/shared/api/types'
import type { QuizCreateRequest, QuizCreateResponse } from '@/pages/quiz/api/types'

vi.mock('@/pages/learning-preparation/api/useValidationPolling')
vi.mock('@/pages/learning-preparation/api/useCreateQuiz')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

function mockValidationPollingResult(
  overrides?: Partial<UseQueryResult<ContentValidationResponse, ApiError>>,
): UseQueryResult<ContentValidationResponse, ApiError> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: false,
    isLoading: false,
    isSuccess: true,
    status: 'success',
    fetchStatus: 'idle',
    refetch: vi.fn(),
    ...overrides,
  } as unknown as UseQueryResult<ContentValidationResponse, ApiError>
}

function mockCreateQuizResult(
  overrides?: Partial<UseMutationResult<QuizCreateResponse, ApiError, QuizCreateRequest>>,
): UseMutationResult<QuizCreateResponse, ApiError, QuizCreateRequest> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  } as unknown as UseMutationResult<QuizCreateResponse, ApiError, QuizCreateRequest>
}

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
    vi.mocked(useValidationPolling).mockReturnValue(
      mockValidationPollingResult({
        data: {
          contentId: 101,
          status: 'PENDING',
          requestedAt: '2026-07-14T10:00:00+09:00',
          validatedAt: null,
        },
      }),
    )
    vi.mocked(useCreateQuiz).mockReturnValue(mockCreateQuizResult())

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
    vi.mocked(useValidationPolling).mockReturnValue(
      mockValidationPollingResult({
        data: {
          contentId: 101,
          status: 'REJECTED',
          errorCode: 'NOT_DEVELOPMENT_RELATED',
          message: '개발/기술 학습 콘텐츠로 인식되지 않았습니다. 관련된 콘텐츠를 등록해 주세요.',
          bypassAvailable: false,
          requestedAt: '2026-07-14T10:00:00+09:00',
          validatedAt: '2026-07-14T10:00:03+09:00',
        },
      }),
    )
    vi.mocked(useCreateQuiz).mockReturnValue(mockCreateQuizResult())

    renderComponent()

    expect(screen.getByText('퀴즈 생성이 중단되었습니다')).toBeInTheDocument()
    expect(screen.getByText('개발/기술 학습 콘텐츠로 인식되지 않았습니다. 관련된 콘텐츠를 등록해 주세요.')).toBeInTheDocument()
  })

  it('콘텐츠 검증 실패(FAILED) 시 상세 에러 메시지를 렌더링한다', () => {
    vi.mocked(useValidationPolling).mockReturnValue(
      mockValidationPollingResult({
        data: {
          contentId: 101,
          status: 'FAILED',
          errorCode: 'AI_SERVICE_ERROR',
          message: 'AI 검증 서비스 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
          bypassAvailable: false,
          requestedAt: '2026-07-14T10:00:00+09:00',
          validatedAt: '2026-07-14T10:00:03+09:00',
        },
      }),
    )
    vi.mocked(useCreateQuiz).mockReturnValue(mockCreateQuizResult())

    renderComponent()

    expect(screen.getByText('AI 검증 서비스 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument()
  })

  it('콘텐츠 검증 폴링 네트워크 실패(isValidationError) 시 폴링 에러 메시지를 렌더링한다', () => {
    vi.mocked(useValidationPolling).mockReturnValue(
      mockValidationPollingResult({
        isError: true,
        error: new ApiError({
          status: 500,
          code: 'NETWORK_ERROR',
          message: '네트워크 연결이 불안정하여 콘텐츠 검증 상태를 확인하지 못했습니다.',
        }),
      }),
    )
    vi.mocked(useCreateQuiz).mockReturnValue(mockCreateQuizResult())

    renderComponent()

    expect(screen.getByText('네트워크 연결이 불안정하여 콘텐츠 검증 상태를 확인하지 못했습니다.')).toBeInTheDocument()
  })

  it('퀴즈 생성 API 에러 발생 시 ApiError의 상세 메시지를 렌더링한다', () => {
    vi.mocked(useValidationPolling).mockReturnValue(
      mockValidationPollingResult({
        data: {
          contentId: 101,
          status: 'PASSED',
          requestedAt: '2026-07-14T10:00:00+09:00',
          validatedAt: '2026-07-14T10:00:03+09:00',
        },
      }),
    )
    vi.mocked(useCreateQuiz).mockReturnValue(
      mockCreateQuizResult({
        isError: true,
        error: new ApiError({
          status: 400,
          code: 'QUIZ_GENERATION_FAILED',
          message: '본문 내용이 유효하지 않아 퀴즈를 생성할 수 없습니다.',
        }),
      }),
    )

    renderComponent()

    expect(screen.getByText('본문 내용이 유효하지 않아 퀴즈를 생성할 수 없습니다.')).toBeInTheDocument()
    expect(screen.getByText('퀴즈 생성 재시도')).toBeInTheDocument()
  })
})
