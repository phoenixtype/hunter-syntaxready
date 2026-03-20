import { OptimizationPattern, ProjectContext, EffectivenessMetrics } from '../../../../.claude/global/lib/types';

describe('Core Types', () => {
  it('should create valid OptimizationPattern', () => {
    const pattern: OptimizationPattern = {
      id: 'test-pattern-1',
      type: 'prompt',
      context: {
        tech_stack: ['typescript', 'react'],
        project_type: 'web_app',
        team_size: 3,
        complexity_score: 0.7,
        current_phase: 'development',
        constraints: []
      },
      transformation: { type: 'compression', rules: [] },
      effectiveness_score: 0.85,
      risk_level: 'low',
      success_rate: 0.9,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'test-user',
      privacy_level: 'private',
      usage_count: 0,
      failure_modes: []
    };

    expect(pattern.id).toBe('test-pattern-1');
    expect(pattern.type).toBe('prompt');
    expect(pattern.risk_level).toBe('low');
  });
});