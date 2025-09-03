import { beforeAll } from 'vitest'
import { randomFillSync } from 'crypto'
import '@testing-library/jest-dom'

// Mock WebCrypto for jsdom
beforeAll(() => {
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (buffer: any) => {
        return randomFillSync(buffer)
      },
    },
  })
})
