import { useEffect, useRef, useState } from 'react'
import { Link, generatePath, useNavigate, useParams } from 'react-router'
import { useCreateQuiz } from '@/pages/learning-preparation/api/useCreateQuiz'
import { useRetryValidation } from '@/pages/learning-preparation/api/useRetryValidation'
import { useValidationPolling } from '@/pages/learning-preparation/api/useValidationPolling'
import { ROUTES } from '@/shared/config/routes'
import { sanitizeErrorMessage } from '@/shared/api/error'
import { Button } from '@/shared/ui/Button'
import '@/pages/learning-preparation/LearningPreparationPage.css'

const preparationSteps = [
  { code: 'EXTRACT', description: '제목과 본문 구조를 읽고 있습니다.', label: '콘텐츠 본문 확인' },
  { code: 'VALIDATE', description: '개발 학습에 적합한 콘텐츠인지 확인합니다.', label: '학습 콘텐츠 검증' },
  { code: 'CONNECT', description: '핵심 개념과 연관 태그를 연결합니다.', label: '지식 구조 연결' },
  { code: 'GENERATE', description: '학습 목표에 맞는 문제를 구성합니다.', label: '맞춤형 퀴즈 생성' },
] as const

function LeavePreparationDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement
    const focusableElements = dialog?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    const firstFocusable = focusableElements?.[0]
    const lastFocusable = focusableElements?.[focusableElements.length - 1]

    firstFocusable?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancelRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialog || !firstFocusable || !lastFocusable) {
        return
      }

      if (!dialog.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? lastFocusable : firstFocusable).focus()
      } else if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault()
        lastFocusable.focus()
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault()
        firstFocusable.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [])

  return (
    <div className="preparation-dialog-backdrop" role="presentation">
      <section
        aria-describedby="preparation-leave-description"
        aria-labelledby="preparation-leave-title"
        aria-modal="true"
        className="preparation-leave-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <span aria-hidden="true" className="preparation-leave-icon">!</span>
        <p className="preparation-leave-eyebrow">PROCESS IN PROGRESS</p>
        <h2 id="preparation-leave-title">퀴즈를 생성하고 있습니다</h2>
        <p id="preparation-leave-description">
          지금 이동하면 생성 진행 상황을 바로 확인하기 어려울 수 있습니다. 잠시만 기다려 주세요.
        </p>
        <div className="preparation-leave-actions">
          <Button onClick={onCancel}>계속 기다리기</Button>
          <Button onClick={onConfirm} variant="secondary">페이지 나가기</Button>
        </div>
      </section>
    </div>
  )
}

function ErrorFeedbackPanel({
  code,
  title,
  message,
  primaryAction,
  dangerAction,
}: {
  code: string
  title: string
  message: string
  primaryAction?: {
    text: string
    onClick: () => void
    loading?: boolean
  }
  dangerAction?: {
    text: string
    onClick: () => void
    loading?: boolean
  }
}) {
  return (
    <div
      aria-live="assertive"
      className="preparation-error-panel"
      role="alert"
    >
      <span className="preparation-error-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 7.25v6.5M12 17.25h.01" />
        </svg>
      </span>
      <span className="preparation-error-code">{code}</span>
      <h2>{title}</h2>
      <p>{message}</p>
      {(primaryAction || dangerAction) && (
        <div className="preparation-feedback-actions">
          {primaryAction && (
            <Button
              className="preparation-feedback-button"
              loading={primaryAction.loading}
              onClick={primaryAction.onClick}
              variant={dangerAction ? 'secondary' : 'primary'}
            >
              {primaryAction.text}
            </Button>
          )}
          {dangerAction && (
            <Button
              className="preparation-feedback-button"
              loading={dangerAction.loading}
              onClick={dangerAction.onClick}
              variant="danger"
            >
              {dangerAction.text}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function LearningPreparationPage() {
  const navigate = useNavigate()
  const { contentId: contentIdParam } = useParams<{ contentId: string }>()
  const contentId = Number(contentIdParam)
  const isInvalidContentId = !Number.isInteger(contentId) || contentId <= 0
  const [hasAdvancedToGenerate, setHasAdvancedToGenerate] = useState(false)
  const [pendingDestination, setPendingDestination] = useState<string | null>(null)
  const [isBypassActive, setIsBypassActive] = useState(false)
  const isRoutingRef = useRef(false)
  const hasTriggeredCreateRef = useRef(false)

  const { data: validationResponse, isError: isValidationError, error: useValidationPollingError, refetch: retryValidation } = useValidationPolling(contentId)
  const validationStatus = validationResponse?.status

  const createQuizMutation = useCreateQuiz()
  const retryValidationMutation = useRetryValidation(contentId)

  // API 상태에 따라 렌더링 시점에 바로 activeStage 도출 (You might not need an effect)
  let activeStage = 1 // 1: VALIDATE(시작/진행 중)
  if (validationStatus === 'PASSED' || isBypassActive) {
    if (createQuizMutation.isSuccess) {
      activeStage = 4 // 모든 단계 완료
    } else {
      activeStage = hasAdvancedToGenerate ? 3 : 2 // CONNECT -> GENERATE 전환
    }
  }

  // PASSED 시 자동 퀴즈 생성 트리거 (Strict Mode 중복 호출 방지 ref 가드)
  useEffect(() => {
    if (
      validationStatus === 'PASSED' &&
      !hasTriggeredCreateRef.current &&
      !createQuizMutation.isPending &&
      !createQuizMutation.isSuccess &&
      !createQuizMutation.isError
    ) {
      hasTriggeredCreateRef.current = true
      createQuizMutation.mutate({ sourceValidationId: contentId })
    }
  }, [validationStatus, createQuizMutation, contentId])

  // 퀴즈 생성이 진행 중일 때, CONNECT(2) -> GENERATE(3)로 자연스럽게 넘어가는 시각적 지연(Fake Progress) 추가
  useEffect(() => {
    if (activeStage === 2 && createQuizMutation.isPending) {
      const timer = window.setTimeout(() => {
        setHasAdvancedToGenerate(true)
      }, 1000) // 1초 후 GENERATE 단계로 전환
      return () => window.clearTimeout(timer)
    }
  }, [activeStage, createQuizMutation.isPending])

  // 퀴즈 생성 성공 시 4단계 완료 처리 및 라우팅
  useEffect(() => {
    if (createQuizMutation.isSuccess && createQuizMutation.data && !isRoutingRef.current) {
      isRoutingRef.current = true
      const quizId = createQuizMutation.data.quizId

      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('learningContentFormState')
        }
      } catch (e) {
        console.error('임시 저장된 입력 데이터를 지우는데 실패했습니다:', e)
      }

      const timer = window.setTimeout(() => {
        void navigate(generatePath(ROUTES.quiz, { quizId: String(quizId) }), { replace: true })
      }, 1000)

      return () => window.clearTimeout(timer)
    }
  }, [createQuizMutation.isSuccess, createQuizMutation.data, navigate])

  const complete = activeStage >= preparationSteps.length
  const currentStep = isInvalidContentId
    ? 0
    : complete
      ? preparationSteps.length
      : Math.min(activeStage + 1, preparationSteps.length)
  const progress = Math.round((currentStep / preparationSteps.length) * 100)

  const pollingAttemptRef = useRef(0)
  const [isPollingTimeout, setIsPollingTimeout] = useState(false)

  const isRejected = validationStatus === 'REJECTED'
  const isFailed = validationStatus === 'FAILED'
  const isGenerationInProgressError = createQuizMutation.error?.code === 'QUIZ_GENERATION_IN_PROGRESS'
  const isQuizCreateError = createQuizMutation.isError && (!isGenerationInProgressError || isPollingTimeout)
  const bypassAvailable = validationResponse?.bypassAvailable ?? false

  const hasPipelineError = isInvalidContentId || (isRejected && !isBypassActive) || isFailed || isValidationError || isQuizCreateError
  const shouldWarnBeforeLeaving = !complete && !hasPipelineError && !isInvalidContentId

  useEffect(() => {
    if (!shouldWarnBeforeLeaving) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (isRoutingRef.current) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    function handleDocumentClick(event: MouseEvent) {
      if (isRoutingRef.current || event.defaultPrevented || event.button !== 0) {
        return
      }

      const target = event.target
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null

      if (
        !link ||
        link.target === '_blank' ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const destination = new URL(link.href, window.location.href)
      const current = new URL(window.location.href)

      if (
        destination.origin !== current.origin ||
        `${destination.pathname}${destination.search}${destination.hash}` ===
          `${current.pathname}${current.search}${current.hash}`
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setPendingDestination(`${destination.pathname}${destination.search}${destination.hash}`)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [shouldWarnBeforeLeaving])

  function confirmLeave() {
    if (!pendingDestination) {
      return
    }

    isRoutingRef.current = true
    const destination = pendingDestination
    setPendingDestination(null)
    void navigate(destination)
  }

  // 퀴즈 생성이 진행 중이라는 에러(409)를 받으면 3초 간격으로 폴링 자동 재시도 (최대 20회)
  useEffect(() => {
    if (createQuizMutation.isError && isGenerationInProgressError && !isPollingTimeout) {
      const timer = window.setTimeout(() => {
        const next = pollingAttemptRef.current + 1
        pollingAttemptRef.current = next
        if (next >= 20) {
          setIsPollingTimeout(true)
          return
        }
        createQuizMutation.reset()
        createQuizMutation.mutate({ sourceValidationId: contentId })
      }, 3000)
      return () => window.clearTimeout(timer)
    }
  }, [createQuizMutation.isError, isGenerationInProgressError, isPollingTimeout, createQuizMutation, contentId])

  const errorTitle = isInvalidContentId
    ? '잘못된 접근입니다'
    : isQuizCreateError
      ? '퀴즈 생성에 실패했습니다'
      : isValidationError
        ? '검증 상태를 확인하지 못했습니다'
        : isFailed
          ? '콘텐츠 검증에 실패했습니다'
          : '학습 콘텐츠로 사용하기 어렵습니다'

  const errorMessage = isInvalidContentId
    ? '콘텐츠 정보를 확인할 수 없습니다. 입력 화면에서 학습할 콘텐츠를 다시 등록해 주세요.'
    : isQuizCreateError
    ? (isPollingTimeout
        ? '서버 응답이 지연되어 퀴즈 생성을 중단했습니다. 입력 화면으로 돌아가 내용을 확인한 뒤 다시 시도해 주세요.'
        : (sanitizeErrorMessage(createQuizMutation.error?.message, createQuizMutation.error?.code) || '퀴즈를 생성하지 못했습니다. 입력 화면으로 돌아가 내용을 확인한 뒤 다시 시도해 주세요.'))
    : isValidationError
      ? (sanitizeErrorMessage(useValidationPollingError?.message, useValidationPollingError?.code) || '네트워크 연결이 불안정하여 콘텐츠 검증 상태를 확인하지 못했습니다.')
      : (sanitizeErrorMessage(validationResponse?.message, validationResponse?.errorCode) || (isFailed ? '콘텐츠 검증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' : '개발 및 학습에 적합하지 않은 콘텐츠로 판정되었습니다.'))

  const handleBypass = () => {
    if (!createQuizMutation.isPending) {
      setIsBypassActive(true)
      createQuizMutation.mutate({ sourceValidationId: contentId })
    }
  }

  return (
    <main className="preparation-page">
      <section className="mx-auto max-w-content py-10 sm:py-14 lg:py-16" aria-labelledby="preparation-title">
        <div className="preparation-heading">
          <div className="preparation-heading-copy">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="preparation-live-dot" />
              <p className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-brand-400">
                READLE KNOWLEDGE COMPILER
              </p>
            </div>
            <h1 className="preparation-title mt-3" id="preparation-title">
              {complete
                ? '퀴즈 생성 준비가 완료됐습니다'
                : hasPipelineError
                  ? '퀴즈 생성이 중단되었습니다'
                  : '퀴즈를 만들고 있습니다'}
            </h1>
            <p className="preparation-subtitle mt-3 max-w-2xl">
              콘텐츠를 분석하고 핵심 개념을 연결해 맞춤형 문제를 구성합니다.
            </p>
          </div>
          <span className="preparation-mock-badge">LIVE PROCESS</span>
        </div>

        <div className="preparation-progress mt-8">
          <div className="flex items-center justify-between gap-4">
            <p aria-live="polite" className="text-caption font-semibold text-text-secondary">
              {complete
                ? '모든 준비가 완료되었습니다.'
                : hasPipelineError
                  ? '문제가 발생했습니다.'
                  : preparationSteps[activeStage].description}
            </p>
            <strong className="font-mono text-label text-brand-400">
              {currentStep} / {preparationSteps.length} 단계
            </strong>
          </div>
          <div
            aria-label="퀴즈 생성 진행률"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="preparation-progress-track mt-3"
            role="progressbar"
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="preparation-workspace mt-5">
          <section className="preparation-stage-panel" aria-label="퀴즈 생성 단계">
            <div className="preparation-panel-header">
              <span>PROCESS PIPELINE</span>
              <span>
                STEP {String(currentStep).padStart(2, '0')} / {String(preparationSteps.length).padStart(2, '0')}
              </span>
            </div>
            <ol className="preparation-stage-list">
              {preparationSteps.map((step, index) => {
                const isPassed = !isInvalidContentId && (complete || index < activeStage)
                const isCurrent = !complete && index === activeStage
                const isErrorStage = !isInvalidContentId && isCurrent && hasPipelineError

                return (
                  <li
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`preparation-stage ${
                      isErrorStage
                        ? 'preparation-stage-error'
                        : isCurrent
                          ? 'preparation-stage-active'
                          : isPassed
                            ? 'preparation-stage-complete'
                            : ''
                    }`}
                    key={step.code}
                  >
                    <span className="preparation-stage-number">{isPassed ? '✓' : String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0">
                      <span className="preparation-stage-code">{step.code}</span>
                      <strong className="preparation-stage-label">{step.label}</strong>
                      <span className="preparation-stage-description">{step.description}</span>
                    </span>
                    <span aria-hidden="true" className="preparation-stage-state">
                      {isErrorStage ? 'ERROR' : isPassed ? 'DONE' : isCurrent ? 'RUNNING' : 'WAITING'}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          {hasPipelineError && (
            <section className="preparation-feedback-panel" aria-label="처리 오류 안내">
              {isInvalidContentId ? (
              <ErrorFeedbackPanel
                code="INVALID_CONTENT"
                title={errorTitle}
                message={errorMessage}
                primaryAction={{
                  text: '입력 화면으로 이동',
                  onClick: () => void navigate(ROUTES.home),
                }}
              />
              ) : isQuizCreateError ? (
              <ErrorFeedbackPanel
                code="QUIZ_GENERATION_ERROR"
                title={errorTitle}
                message={errorMessage}
                primaryAction={{
                  text: '입력 화면으로 돌아가기',
                  onClick: () => void navigate(ROUTES.home),
                }}
              />
              ) : isValidationError ? (
              <ErrorFeedbackPanel
                code="VALIDATION_NETWORK_ERROR"
                title={errorTitle}
                message={errorMessage}
                primaryAction={{
                  text: '다시 시도',
                  onClick: () => void retryValidation(),
                }}
              />
              ) : isFailed ? (
              <ErrorFeedbackPanel
                code="CONTENT_VALIDATION_FAILED"
                title={errorTitle}
                message={errorMessage}
                primaryAction={{
                  text: '다시 시도',
                  onClick: () => retryValidationMutation.mutate(),
                  loading: retryValidationMutation.isPending,
                }}
              />
              ) : (
              <ErrorFeedbackPanel
                code="CONTENT_REJECTED"
                title={errorTitle}
                message={errorMessage}
                primaryAction={{
                  text: '콘텐츠 수정하기',
                  onClick: () => void navigate(ROUTES.home),
                }}
                dangerAction={
                  bypassAvailable
                    ? {
                      text: '무시하고 퀴즈 만들기',
                      onClick: handleBypass,
                      loading: createQuizMutation.isPending,
                    }
                    : undefined
                }
              />
              )}
            </section>
          )}
        </div>

        <footer className="preparation-footer">
          <div>
            <p className="text-caption font-semibold text-text-secondary">
              {complete
                ? '생성 결과를 확인할 준비가 됐습니다.'
                : hasPipelineError
                  ? '진행이 중단되었습니다.'
                  : '잠시만 기다려 주세요.'}
            </p>
            <p className="mt-1 text-[0.6875rem] leading-5 text-text-muted">
              서버의 검증 및 퀴즈 생성 상태를 자동으로 확인하고 있습니다.
            </p>
          </div>
          {!hasPipelineError && (
            <Link className="preparation-back-link" to={ROUTES.home}>
              입력 화면으로 돌아가기
            </Link>
          )}
        </footer>
      </section>
      {pendingDestination && (
        <LeavePreparationDialog
          onCancel={() => setPendingDestination(null)}
          onConfirm={confirmLeave}
        />
      )}
    </main>
  )
}
