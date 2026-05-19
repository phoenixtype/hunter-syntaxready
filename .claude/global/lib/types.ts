export interface OptimizationPattern {
  id: string;
  type: 'prompt' | 'tool_selection' | 'architecture' | 'context_management';
  context: ProjectContext;
  transformation: PatternTransformation;
  effectiveness_score: number; // 0-1
  risk_level: 'low' | 'medium' | 'high';
  success_rate: number; // 0-1
  created_at: Date;
  updated_at: Date;
  created_by: string;
  privacy_level: 'private' | 'team' | 'public';
  usage_count: number;
  failure_modes: FailureMode[];
}

export interface ProjectContext {
  tech_stack: string[];
  project_type: 'web_app' | 'api' | 'mobile' | 'library' | 'other';
  team_size: number;
  complexity_score: number; // 0-1
  current_phase: 'planning' | 'development' | 'testing' | 'maintenance';
  constraints: ProjectConstraint[];
}

export interface EffectivenessMetrics {
  token_reduction_pct: number;
  velocity_improvement_pct: number;
  quality_score_change: number;
  user_satisfaction: number; // 1-5
  time_to_completion_ms: number;
  error_reduction_pct: number;
}

export interface PatternTransformation {
  type: 'compression' | 'expansion' | 'replacement' | 'reordering';
  rules: TransformationRule[];
}

export interface TransformationRule {
  condition: string;
  action: string;
  parameters: Record<string, unknown>;
}

export interface FailureMode {
  description: string;
  frequency: number; // 0-1
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface ProjectConstraint {
  type: 'performance' | 'security' | 'compliance' | 'budget';
  description: string;
  threshold: number;
}

export type PatternType = OptimizationPattern['type'];

export interface PatternCriteria {
  type?: PatternType;
  risk_level?: 'low' | 'medium' | 'high';
  privacy_level?: 'private' | 'team' | 'public';
  min_effectiveness?: number;
  created_after?: Date;
  project_context?: Partial<ProjectContext>;
}

export interface StorageConfig {
  base_path: string;
  max_patterns_per_file: number;
  compression_enabled: boolean;
  backup_enabled: boolean;
}