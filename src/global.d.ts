// Global type declarations for Pine Script extension

interface GlobalThis {
  __pineCheckInterval?: NodeJS.Timeout
}

declare var globalThis: GlobalThis & typeof globalThis
