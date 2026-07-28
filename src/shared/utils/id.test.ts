import { describe, expect, it } from 'vitest'
import { isPositiveIntegerId } from '@/shared/utils/id'

describe('isPositiveIntegerId', () => {
  it.each(['1', '42'])('양의 정수 문자열 %s를 허용한다', (value) => {
    expect(isPositiveIntegerId(value)).toBe(true)
  })

  it.each(['', 'text', '0', '-1', '1.5'])('유효하지 않은 ID %s를 거부한다', (value) => {
    expect(isPositiveIntegerId(value)).toBe(false)
  })
})
