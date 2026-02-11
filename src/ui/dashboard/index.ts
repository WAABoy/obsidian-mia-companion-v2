/**
 * Mia Companion - Dashboard Module
 * Export all dashboard components
 */

// Standard components
export { DashboardView, type DashboardData, type TabType } from './DashboardView';
export { StatsCard, StatsGrid, type StatsCardConfig } from './StatsCard';
export { 
  ProgressBar, 
  CircularProgressBar, 
  type ProgressBarConfig 
} from './ProgressBar';

// Optimized components (recommended for better performance)
export { OptimizedDashboardView } from './OptimizedDashboardView';
export type { OptimizedDashboardData } from './OptimizedDashboardView';
