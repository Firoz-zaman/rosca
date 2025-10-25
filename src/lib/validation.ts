// Modular validation functions
export interface ValidationResult {
  isValid: boolean
  error?: string
}

export const validateEmail = (email: string): ValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!email) {
    return { isValid: false, error: 'Email is required' }
  }
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' }
  }
  
  return { isValid: true }
}

export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, error: 'Password is required' }
  }
  
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' }
  }
  
  // Check for at least one uppercase, one lowercase, one number
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  
  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    return {
      isValid: false,
      error: 'Password must contain uppercase, lowercase, and number'
    }
  }
  
  return { isValid: true }
}

export const validateName = (name: string): ValidationResult => {
  if (!name || name.trim().length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters' }
  }
  
  if (name.length > 50) {
    return { isValid: false, error: 'Name is too long' }
  }
  
  return { isValid: true }
}

export const validatePasswordMatch = (
  password: string,
  confirmPassword: string
): ValidationResult => {
  if (password !== confirmPassword) {
    return { isValid: false, error: 'Passwords do not match' }
  }
  
  return { isValid: true }
}
