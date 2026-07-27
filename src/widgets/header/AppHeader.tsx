import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/app/providers/AuthContext'
import readleSymbolUrl from '@/shared/assets/readle-symbol.png'
import readleWordmarkUrl from '@/shared/assets/readle-wordmark.png'
import { ROUTES } from '@/shared/config/routes'
import { PageContainer, ProfileAvatar } from '@/shared/ui'
import { PrimaryNavigation } from '@/widgets/navigation/PrimaryNavigation'

interface AppHeaderProps {
  showNavigation?: boolean
}

export function AppHeader({ showNavigation = true }: AppHeaderProps) {
  const { member, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const profileLabel = member ? `${member.nickname} 프로필` : '프로필'

  async function handleLogout() {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    setLogoutError('')

    try {
      await logout()
    } catch {
      setLogoutError('로그아웃에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border-default bg-surface-canvas/95 backdrop-blur-md">
      <PageContainer className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[auto_1fr_auto] sm:gap-x-6 sm:py-0">
        <Link
          className="flex w-fit items-center gap-2 rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400"
          to={ROUTES.home}
        >
          <img
            alt=""
            aria-hidden="true"
            className="size-8 rounded-sm"
            height="172"
            src={readleSymbolUrl}
            width="172"
          />
          <img
            alt="Readle"
            className="h-6.5 w-auto sm:h-7"
            height="108"
            src={readleWordmarkUrl}
            width="420"
          />
        </Link>
        {showNavigation && (
          <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
            <PrimaryNavigation />
          </div>
        )}
        {showNavigation && (
          <div className="relative flex items-center gap-1 sm:gap-2">
            {member ? (
              <>
                <ProfileAvatar
                  imageUrl={member.profileImageUrl}
                  label={profileLabel}
                  nickname={member.nickname}
                />
                <button
                  aria-describedby={logoutError ? 'logout-error' : undefined}
                  aria-busy={isLoggingOut}
                  className="min-h-9 rounded-control px-2 text-caption font-semibold text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoggingOut}
                  onClick={() => void handleLogout()}
                  type="button"
                >
                  {isLoggingOut ? '로그아웃 중' : '로그아웃'}
                </button>
              </>
            ) : (
              <Link
                className="flex min-h-9 items-center rounded-control px-2 text-caption font-semibold text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                to={ROUTES.login}
              >
                로그인
              </Link>
            )}
            {logoutError && (
              <p
                className="absolute right-0 top-full mt-2 w-max max-w-[min(18rem,80vw)] rounded-control border border-status-error/30 bg-surface-panel px-3 py-2 text-caption text-status-error shadow-card"
                id="logout-error"
                role="alert"
              >
                {logoutError}
              </p>
            )}
          </div>
        )}
      </PageContainer>
    </header>
  )
}
