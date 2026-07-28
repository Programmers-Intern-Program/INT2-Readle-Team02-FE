import { useRef, useLayoutEffect } from 'react'
import { Button, ErrorMessage } from '@/shared/ui'
import { useContentForm } from '@/pages/home/model/useContentForm'
import '@/pages/home/HomePage.css'

export function HomePage() {
  const {
    mode,
    values,
    touched,
    errors,
    isValid,
    isExtracted,
    isExtractPending,
    isCreatePending,
    extractErrorMsg,
    createErrorMsg,
    rejectionMessage,
    changeMode,
    resetExtractState,
    updateValue,
    handleBlur,
    handleSubmit,
  } = useContentForm()

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (textareaRef.current) {
      const scrollPos = window.scrollY
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      window.scrollTo(0, scrollPos)
    }
  }, [values.content, mode, isExtracted])

  const trimmedContentLength = values.content.trim().length

  const renderContentInputs = () => (
    <>
      <label className="sr-only" htmlFor="learning-title">콘텐츠 제목</label>
      <input
        aria-describedby={touched.title && errors.title ? 'learning-title-error' : undefined}
        aria-invalid={touched.title && errors.title ? true : undefined}
        className="learn-composer-title"
        id="learning-title"
        onBlur={() => handleBlur('title')}
        onChange={(event) => updateValue('title', event.target.value)}
        placeholder="콘텐츠 제목"
        value={values.title}
      />
      <ErrorMessage className="mt-1 px-2" id="learning-title-error">
        {touched.title ? errors.title : undefined}
      </ErrorMessage>
      <label className="sr-only" htmlFor="learning-content">학습할 본문</label>
      <textarea
        aria-describedby={`content-character-count${touched.content && errors.content ? ' learning-content-error' : ''}`}
        aria-invalid={touched.content && errors.content ? true : undefined}
        className={`learn-composer-textarea ${mode === 'URL' ? 'mt-3' : ''}`}
        id="learning-content"
        onBlur={() => handleBlur('content')}
        onChange={(event) => updateValue('content', event.target.value)}
        placeholder="학습하고 싶은 기술 콘텐츠를 붙여넣어 주세요"
        ref={textareaRef}
        value={values.content}
      />
      <ErrorMessage className="mt-1 px-2" id="learning-content-error">
        {touched.content ? errors.content : undefined}
      </ErrorMessage>
    </>
  )

  return (
    <div className="learn-page py-6 sm:py-8 lg:py-10">
      <section className="mx-auto max-w-content" aria-labelledby="learn-page-title">
        <div className="mx-auto max-w-4xl py-8 sm:py-12">
          <p className="font-mono text-[0.625rem] font-bold tracking-[0.16em] text-brand-400">
            NEW LEARNING
          </p>
          <h1 className="mt-2 text-title font-bold text-text-primary sm:text-[2.25rem]" id="learn-page-title">
            새 학습 만들기
          </h1>
          <p className="mt-2 text-label text-text-muted">학습할 기술 콘텐츠의 입력 방식을 선택해 주세요.</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-caption font-semibold text-text-secondary">입력 방식</p>
              <div aria-label="콘텐츠 입력 방식" className="learn-method-tabs" role="tablist">
                <button
                  aria-controls="url-input-panel"
                  aria-selected={mode === 'URL'}
                  className={`learn-method-tab ${mode === 'URL' ? 'learn-method-tab-active' : ''}`}
                  id="url-input-tab"
                  onClick={() => changeMode('URL')}
                  role="tab"
                  type="button"
                >
                  <span aria-hidden="true">↗</span> URL 가져오기
                </button>
                <button
                  aria-controls="text-input-panel"
                  aria-selected={mode === 'TEXT'}
                  className={`learn-method-tab ${mode === 'TEXT' ? 'learn-method-tab-active' : ''}`}
                  id="text-input-tab"
                  onClick={() => changeMode('TEXT')}
                  role="tab"
                  type="button"
                >
                  <span aria-hidden="true">⌨</span> 텍스트 직접 입력
                </button>
              </div>
            </div>
            <p className="text-caption text-text-muted">
              {mode === 'URL' ? '페이지 제목과 본문을 자동으로 가져옵니다.' : '제목과 본문을 직접 입력합니다.'}
            </p>
          </div>

          <form className="learn-composer mt-3" noValidate onSubmit={handleSubmit}>
            {mode === 'URL' ? (
              <div aria-labelledby="url-input-tab" id="url-input-panel" role="tabpanel">
                {isExtracted && (
                  trimmedContentLength >= 300 && trimmedContentLength <= 15000 ? (
                    <p
                      className="learn-status-message learn-status-success"
                      role="status"
                    >
                      <span aria-hidden="true">✓</span>
                      <span>첨부한 URL의 제목과 본문을 성공적으로 불러왔습니다.</span>
                    </p>
                  ) : trimmedContentLength < 300 ? (
                    <p
                      className="learn-status-message learn-status-error"
                      role="alert"
                    >
                      <span aria-hidden="true">!</span>
                      <span>
                        본문을 충분히 불러오지 못했습니다. 아래 본문을 300자 이상으로 직접 보완하거나 텍스트 직접
                        입력을 이용해 주세요.
                      </span>
                    </p>
                  ) : (
                    <p
                      className="learn-status-message learn-status-error"
                      role="alert"
                    >
                      <span aria-hidden="true">!</span>
                      <span>불러온 본문이 15,000자를 초과했습니다. 아래 본문을 최대 글자 수에 맞게 줄여 주세요.</span>
                    </p>
                  )
                )}
                
                <div className="learn-url-row">
                  <div className="flex-1">
                    <label className="sr-only" htmlFor="learning-url">기술 아티클 URL</label>
                    <input
                      aria-describedby={(touched.url && errors.url) || extractErrorMsg ? 'learning-url-error' : undefined}
                      aria-invalid={(touched.url && errors.url) || extractErrorMsg ? true : undefined}
                      autoComplete="url"
                      className="learn-composer-input disabled:opacity-50"
                      disabled={isExtracted || isExtractPending}
                      id="learning-url"
                      onBlur={() => handleBlur('url')}
                      onChange={(event) => updateValue('url', event.target.value)}
                      placeholder="예: https://toss.tech/article/..."
                      type="url"
                      value={values.url}
                    />
                  </div>
                  {isExtracted && (
                    <Button 
                      className="shrink-0"
                      onClick={resetExtractState}
                      type="button"
                      variant="secondary"
                    >
                      다시 입력
                    </Button>
                  )}
                </div>
                
                <ErrorMessage className="mt-2 px-2" id="learning-url-error">
                  {(touched.url ? errors.url : null) || (!errors.url ? extractErrorMsg : null)}
                </ErrorMessage>

                {isExtracted && (
                  <div className="mt-4 border-t border-border-glass pt-4">
                    {renderContentInputs()}
                  </div>
                )}
              </div>
            ) : (
              <div aria-labelledby="text-input-tab" id="text-input-panel" role="tabpanel">
                {renderContentInputs()}
              </div>
            )}

            <div className="mt-3 flex flex-col gap-3 border-t border-border-glass pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-[0.6875rem] leading-5 text-text-muted">
                  {mode === 'TEXT' || isExtracted ? (
                    <>
                      <span className={`font-mono ${errors.content && touched.content ? 'text-status-error' : ''}`} id="content-character-count">
                        {trimmedContentLength.toLocaleString('ko-KR')}자
                      </span> 입력됨
                      {trimmedContentLength < 300 && ' (최소 300자 이상)'}
                      {trimmedContentLength > 15000 && ' (최대 글자 수 초과)'}
                    </>
                  ) : (
                    '공개된 기술 문서와 블로그 URL을 사용할 수 있습니다.'
                  )}
                </p>
                {(createErrorMsg || rejectionMessage) && (
                  <p className="learn-inline-error" role="alert">
                    <span aria-hidden="true">!</span>
                    <span>{createErrorMsg || rejectionMessage}</span>
                  </p>
                )}
              </div>
              <Button 
                className="learn-submit-button" 
                disabled={!isValid || isExtractPending || isCreatePending} 
                loading={isExtractPending || isCreatePending}
                loadingLabel={isExtractPending ? '불러오는 중' : '등록하는 중'}
                type="submit"
              >
                {mode === 'URL' && !isExtracted ? '본문 불러오기' : '분석하고 퀴즈 만들기'}
                <span aria-hidden="true">→</span>
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
