type ValidationRule = (value: any) => true | string

export const required: ValidationRule = (v) => !!v || 'This field is required'

export const email: ValidationRule = (v) =>
  !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email address'

export const minLength = (min: number): ValidationRule => (v) =>
  !v || v.length >= min || `Must be at least ${min} characters`

export const maxLength = (max: number): ValidationRule => (v) =>
  !v || v.length <= max || `Must be at most ${max} characters`

export const positiveNumber: ValidationRule = (v) =>
  v === '' || v === null || v === undefined || Number(v) > 0 || 'Must be a positive number'

export const nonNegative: ValidationRule = (v) =>
  v === '' || v === null || v === undefined || Number(v) >= 0 || 'Must be zero or positive'

export const passwordRules = [required, minLength(8)]

export const emailRules = [required, email]
