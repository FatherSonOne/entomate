// Environment Configuration & Validation
// Validates all required environment variables at startup

interface EnvConfig {
  GEMINI_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  PULSE_SUPABASE_URL?: string
  PULSE_SUPABASE_KEY?: string
  NODE_ENV: 'development' | 'production' | 'test'
}

interface EnvValidationError {
  variable: string
  message: string
}

export function getEnvVar(key: string, required = true): string | undefined {
  // Check multiple possible locations for env vars
  const value =
    (typeof process !== 'undefined' && process.env?.[key]) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) ||
    undefined

  if (required && !value) {
    return undefined
  }
  return value
}

export function validateEnv(): { valid: boolean; errors: EnvValidationError[]; config: Partial<EnvConfig> } {
  const errors: EnvValidationError[] = []

  const requiredVars = [
    { key: 'GEMINI_API_KEY', altKey: 'API_KEY', description: 'Gemini AI API Key' },
    { key: 'VITE_SUPABASE_URL', description: 'Supabase Project URL' },
    { key: 'VITE_SUPABASE_ANON_KEY', description: 'Supabase Anonymous Key' },
  ]

  const config: Partial<EnvConfig> = {}

  for (const { key, altKey, description } of requiredVars) {
    let value = getEnvVar(key, false)
    if (!value && altKey) {
      value = getEnvVar(altKey, false)
    }

    if (!value) {
      errors.push({
        variable: key,
        message: `Missing required environment variable: ${key} (${description})`
      })
    } else {
      // Map to config
      if (key === 'GEMINI_API_KEY' || key === 'API_KEY') {
        config.GEMINI_API_KEY = value
      } else if (key === 'VITE_SUPABASE_URL') {
        config.SUPABASE_URL = value
      } else if (key === 'VITE_SUPABASE_ANON_KEY') {
        config.SUPABASE_ANON_KEY = value
      }
    }
  }

  // Optional vars
  config.PULSE_SUPABASE_URL = getEnvVar('PULSE_SUPABASE_URL', false)
  config.PULSE_SUPABASE_KEY = getEnvVar('PULSE_SUPABASE_KEY', false)
  config.NODE_ENV = (getEnvVar('NODE_ENV', false) as EnvConfig['NODE_ENV']) || 'development'

  return {
    valid: errors.length === 0,
    errors,
    config
  }
}

export function getEnvConfig(): EnvConfig {
  const { valid, errors, config } = validateEnv()

  if (!valid) {
    console.error('Environment validation failed:')
    errors.forEach(err => console.error(`  - ${err.message}`))

    // In development, show a helpful message
    if (config.NODE_ENV !== 'production') {
      console.info('\nPlease create a .env file with the required variables.')
      console.info('See .env.example for reference.\n')
    }
  }

  return config as EnvConfig
}

export function isDevelopment(): boolean {
  return getEnvConfig().NODE_ENV === 'development'
}

export function isProduction(): boolean {
  return getEnvConfig().NODE_ENV === 'production'
}

// Export singleton config
export const env = getEnvConfig()
