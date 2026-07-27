import { useEffect, useRef } from 'react'
import { SocialLoginButton } from '@/pages/login/ui/SocialLoginButton'
import readleSymbolUrl from '@/shared/assets/readle-symbol.png'
import { ROUTES } from '@/shared/config/routes'
import { sanitizeReturnTo } from '@/pages/landing/model/sanitizeReturnTo'
import '@/pages/landing/ui/LoginModal.css'

interface LoginModalProps {
  authError: string | null
  onClose: () => void
  open: boolean
}

const authErrorMessages: Record<string, string> = {
  oauth_cancelled: '로그인이 취소되었습니다. 다시 시도해 주세요.',
  oauth_failed: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  session_expired: '로그인 상태가 만료되었습니다. 다시 로그인해 주세요.',
}

export function LoginModal({ authError, onClose, open }: LoginModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )

      if (!focusableElements?.length) {
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  const returnTo =
    typeof window === 'undefined'
      ? ROUTES.home
      : sanitizeReturnTo(
          new URLSearchParams(window.location.search).get('returnTo') ??
            (window.location.pathname === ROUTES.landing || window.location.pathname === ROUTES.login
              ? ROUTES.home
              : window.location.pathname + window.location.search),
        )
  const authErrorMessage = authError
    ? (authErrorMessages[authError] ?? authErrorMessages.oauth_failed)
    : undefined

  return (
    <div
      className="login-modal-backdrop fixed inset-0 z-100 grid place-items-center overflow-y-auto px-4 py-8 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        aria-describedby="login-description"
        aria-labelledby="login-title"
        aria-modal="true"
        className="login-modal-card relative w-full max-w-sm overflow-hidden rounded-[1.5rem] border p-6 sm:p-8"
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label="로그인 창 닫기"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-xl text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="mb-7 text-center">
          <div aria-hidden="true" className="login-modal-brand">
            <img alt="" className="login-modal-brand-symbol" src={readleSymbolUrl} />
            <span className="login-modal-brand-name">
              Read<span>le</span>
            </span>
          </div>
          <h2 className="mt-6 text-heading font-bold tracking-tight text-text-primary" id="login-title">
            Readle에서 학습을 시작하세요
          </h2>
          <p className="mt-2 text-label text-text-secondary" id="login-description">
            읽어둔 기술 글을 이해한 지식으로 바꿔보세요.
          </p>
        </div>

        {authErrorMessage && (
          <p className="login-modal-error mb-4 text-caption" role="alert">
            <span aria-hidden="true">!</span>
            {authErrorMessage}
          </p>
        )}

        <div className="grid gap-3">
          <SocialLoginButton
            href={`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`}
            provider="google"
          />
          <SocialLoginButton
            href={`/api/auth/kakao/start?returnTo=${encodeURIComponent(returnTo)}`}
            provider="kakao"
          />
        </div>

        <p className="login-modal-assurance mt-5 flex items-center justify-center gap-2 text-center text-caption text-text-muted">
          <span aria-hidden="true">✓</span>
          소셜 로그인으로 안전하게 시작할 수 있어요.
        </p>
      </section>
    </div>
  )
}
