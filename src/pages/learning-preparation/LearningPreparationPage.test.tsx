// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
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

function componentTree(contentId = '101') {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/contents/${contentId}/preparing`]}>
        <Routes>
          <Route path="/contents/:contentId/preparing" element={<LearningPreparationPage />} />
          <Route path="/quizzes/:quizId" element={<div>Quiz Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function renderComponent(contentId = '101') {
  return render(componentTree(contentId))
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
        <MemoryRouter initialEntries={['/contents/101/preparing']}>
          <Routes>
            <Route path="/contents/:contentId/preparing" element={<LearningPreparationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(html).toContain('READLE KNOWLEDGE COMPILER')
    expect(html).toContain('퀴즈를 만들고 있습니다')
    expect(html).toContain('콘텐츠 본문 확인')
    expect(html).toContain('학습 콘텐츠 검증')
    expect(html).toContain('지식 구조 연결')
    expect(html).toContain('맞춤형 퀴즈 생성')
    expect(html).not.toContain('KNOWLEDGE MAP')
    expect(html).toContain('2 / 4 단계')
    expect(html).toContain('서버의 검증 및 퀴즈 생성 상태를 자동으로 확인하고 있습니다.')
    expect(html).not.toContain('#architecture')
    expect(html).not.toContain('#backend')
    expect(html).not.toContain('#transaction')
    expect(html).not.toContain('실제 API 연동 후')
    expect(html).toContain('입력 화면으로 돌아가기')
  })

  it('생성 중 입력 화면으로 이동하면 이탈 경고를 표시하고 취소할 수 있다', () => {
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

    renderComponent()
    fireEvent.click(screen.getByRole('link', { name: '입력 화면으로 돌아가기' }))

    expect(screen.getByRole('dialog', { name: '퀴즈를 생성하고 있습니다' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '계속 기다리기' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('퀴즈를 만들고 있습니다')).toBeInTheDocument()
  })

  it('이탈 모달이 열린 동안 배경이 다시 렌더링되어도 현재 포커스를 유지한다', () => {
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

    const view = renderComponent()
    fireEvent.click(screen.getByRole('link', { name: '입력 화면으로 돌아가기' }))
    const leaveButton = screen.getByRole('button', { name: '페이지 나가기' })
    leaveButton.focus()

    view.rerender(componentTree())

    expect(leaveButton).toHaveFocus()
  })

  it('이탈 모달의 처음과 마지막 버튼 사이에서 Tab 포커스를 순환한다', () => {
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

    renderComponent()
    fireEvent.click(screen.getByRole('link', { name: '입력 화면으로 돌아가기' }))
    const waitButton = screen.getByRole('button', { name: '계속 기다리기' })
    const leaveButton = screen.getByRole('button', { name: '페이지 나가기' })

    leaveButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(waitButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(leaveButton).toHaveFocus()
  })

  it('잘못된 콘텐츠 ID로 접근하면 생성 중 화면 대신 복구 안내를 표시한다', () => {
    vi.mocked(useValidationPolling).mockReturnValue(mockValidationPollingResult())
    vi.mocked(useCreateQuiz).mockReturnValue(mockCreateQuizResult())

    renderComponent('invalid')

    expect(screen.getByText('잘못된 접근입니다')).toBeInTheDocument()
    expect(screen.getByText(/콘텐츠 정보를 확인할 수 없습니다/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '입력 화면으로 이동' })).toBeInTheDocument()
    expect(screen.getByText('0 / 4 단계')).toBeInTheDocument()
    expect(screen.getByText('STEP 00 / 04')).toBeInTheDocument()
    expect(screen.queryByText('ERROR')).not.toBeInTheDocument()
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
    expect(screen.getByText('학습 콘텐츠로 사용하기 어렵습니다')).toBeInTheDocument()
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

    expect(screen.getByText('콘텐츠 검증에 실패했습니다')).toBeInTheDocument()
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

    expect(screen.getByText('검증 상태를 확인하지 못했습니다')).toBeInTheDocument()
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

    expect(screen.getByText('퀴즈 생성에 실패했습니다')).toBeInTheDocument()
    expect(screen.getByText('본문 내용이 유효하지 않아 퀴즈를 생성할 수 없습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '입력 화면으로 돌아가기' })).toBeInTheDocument()
  })

  it('맞춤형 퀴즈 생성 단계(GENERATE)에서는 2초 간격으로 3단계 순환 안내문이 순차적으로 노출된다', () => {
    vi.useFakeTimers()
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
        isPending: true,
      }),
    )

    renderComponent()

    // 1초 진행하여 activeStage가 CONNECT(2) -> GENERATE(3) 단계로 전환되도록 함
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // 1단계 안내문 확인
    expect(screen.getAllByText('퀴즈와 선택지를 만들고 있어요').length).toBeGreaterThan(0)

    // 2초 진행 -> 2단계 안내문 확인
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getAllByText('정답이 질문에 드러나지 않았는지 확인하고 있어요').length).toBeGreaterThan(0)

    // 2초 진행 -> 3단계 안내문 확인
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getAllByText('퀴즈 세트를 정리하고 있어요').length).toBeGreaterThan(0)

    // 2초 진행 -> 1단계로 순환
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getAllByText('퀴즈와 선택지를 만들고 있어요').length).toBeGreaterThan(0)

    vi.useRealTimers()
  })

  it('새로고침 시 이미 생성 완료된 퀴즈 ID가 sessionStorage에 저장되어 있으면 POST 요청 없이 풀이 화면으로 바로 이동한다', () => {
    sessionStorage.setItem('created_quiz_101', '505')

    const mutateMock = vi.fn()
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
        mutate: mutateMock,
      }),
    )

    renderComponent('101')

    expect(mutateMock).not.toHaveBeenCalled()

    sessionStorage.removeItem('created_quiz_101')
  })

  it('생성 대기 중 새로고침 시 quiz_triggered 키가 존재하면 POST 요청을 재발송하지 않는다', () => {
    sessionStorage.setItem('quiz_triggered_101', 'true')

    const mutateMock = vi.fn()
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
        mutate: mutateMock,
      }),
    )

    renderComponent('101')

    expect(mutateMock).not.toHaveBeenCalled()

    sessionStorage.removeItem('quiz_triggered_101')
  })
})
