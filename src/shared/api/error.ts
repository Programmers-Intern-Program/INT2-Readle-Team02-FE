import type { ApiErrorBody, ApiErrorDetail } from '@/shared/api/types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorDetail[]

  constructor({
    status,
    code,
    message,
    details = [],
  }: {
    status: number
    code: string
    message: string
    details?: ApiErrorDetail[]
  }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function isSessionExpired(error: unknown) {
  return error instanceof ApiError && error.status === 401 && error.code === 'INVALID_REFRESH_TOKEN'
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object' || !('error' in value)) {
    return false
  }

  const error = value.error

  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string' &&
    'details' in error &&
    Array.isArray(error.details)
  )
}

/**
 * 사용자 화면에 백엔드 상세 메시지를 직접 표시해도 안전한 비즈니스 에러 코드 화이트리스트
 */
const ALLOWED_USER_FACING_ERROR_CODES = new Set([
  // 콘텐츠 및 검증 비즈니스 에러 코드
  'BAD_WORD',
  'NOT_DEVELOPMENT_RELATED',
  'PROMPT_INJECTION_DETECTED',
  'TOO_SHORT',
  'NO_TECH_CONTENT',
  'CONTENT_TOO_LARGE',
  'INVALID_URL_FORMAT',
  'URL_REQUIRED',
  'TEXT_REQUIRED',
  'CONTENT_NOT_FOUND',
  'CONTENT_ACCESS_DENIED',
  'VALIDATION_ALREADY_RUNNING',
  'NOT_RETRYABLE',
  'QUIZ_GENERATION_FAILED',
  'AI_SERVICE_ERROR',

  // 퀴즈 풀기 및 제출 비즈니스 에러 코드
  'QUIZ_NOT_FOUND',
  'ATTEMPT_NOT_FOUND',
  'ATTEMPT_ALREADY_SUBMITTED',
  'INVALID_ANSWER_COUNT',
  'INVALID_ANSWER_FORMAT',
  'QUIZ_NOT_COMPLETED',
  'FORBIDDEN_ACCESS',
  'RESULT_REPORT_NOT_FOUND',
  'FORBIDDEN',
])

/**
 * 백엔드 에러 계약(Contract) 기반 정적 화이트리스트 검증 함수.
 * 허용된 비즈니스 에러 코드(code)에 해당하는 경우에만 error.message를 노출하고,
 * 그 외의 시스템/내부 예외, 미정의 에러 코드는 모두 안전한 Fallback 메시지로 전환합니다.
 */
export function sanitizeErrorMessage(message?: string | null, code?: string | null): string | null {
  if (!message) return null
  const trimmed = message.trim()
  if (!trimmed) return null

  // code가 주어졌고, 명시된 사용자 안내용 비즈니스 에러 코드 화이트리스트에 포함된 경우에만 허용
  if (code && ALLOWED_USER_FACING_ERROR_CODES.has(code)) {
    return trimmed
  }

  // code가 없거나 비어있는 경우, 기술적 아티팩트(스택트레이스, JSON, 영문 변수명 등)가 없는 일반 유저 문구만 한정 허용
  if (!code) {
    const hasTechnicalArtifacts = /[{}<>[\]\\/]|Exception|NullPointer|SQL|database|Jackson|validationScore/i.test(trimmed)
    if (!hasTechnicalArtifacts) {
      return trimmed
    }
  }

  // 시스템 에러 코드이거나 안전하지 않은 내부 문구인 경우 null 반환 (Fallback 안내로 전환)
  return null
}
