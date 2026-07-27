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
 * 내부 개발자용 기술문구(영문 변수명, JSON, 스택트레이스, 내부 로직 설명 등)가
 * 사용자 화면에 노출되지 않도록 필터링하는 안전 가드레일 함수
 */
export function sanitizeErrorMessage(message?: string | null): string | null {
  if (!message) return null
  const trimmed = message.trim()
  if (!trimmed) return null

  // 개발자 디버깅 전용 문구가 유저 화면에 튀어나오지 않도록 차단하는 기술 키워드
  const internalKeywords = [
    'validationScore',
    'PASSED',
    'REJECTED',
    'PENDING',
    'status는',
    'status가',
    'JSON',
    'Jackson',
    'Exception',
    'NullPointer',
    'SQL',
    'database',
    'http://',
    'https://',
    'undefined',
    'schema',
    '{',
    '}',
  ]

  const hasInternalKeyword = internalKeywords.some((keyword) => trimmed.includes(keyword))
  if (hasInternalKeyword) {
    return null
  }

  return trimmed
}
