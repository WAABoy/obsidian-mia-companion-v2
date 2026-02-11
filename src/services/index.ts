/**
 * Services Module - Core business logic services
 */

// Authentication Service
export {
  AuthService,
} from './AuthService';

// Optimized Authentication Service
export {
  OptimizedAuthService,
} from './OptimizedAuthService';

// Re-export types from types module
export type {
  GoogleCredentials,
  AuthToken,
  AuthState,
} from '../types';

// Default export
export { AuthService as default } from './AuthService';
