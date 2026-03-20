import { PatternStorage } from '../../../../.claude/global/lib/pattern-storage';
import { OptimizationPattern } from '../../../../.claude/global/lib/types';

describe('PatternStorage', () => {
  let storage: PatternStorage;

  beforeEach(() => {
    storage = new PatternStorage('~/.claude/global/patterns');
  });

  it('should store and retrieve patterns', async () => {
    const pattern: OptimizationPattern = {
      id: 'test-pattern',
      type: 'prompt',
      context: {
        tech_stack: ['react', 'typescript'],
        project_type: 'web_app',
        team_size: 3,
        complexity_score: 0.7,
        current_phase: 'development',
        constraints: [
          {
            type: 'performance',
            description: 'Must load under 2 seconds',
            threshold: 2000
          }
        ]
      },
      transformation: {
        type: 'compression',
        rules: [
          {
            condition: 'verbose_prompts',
            action: 'compress_to_essentials',
            parameters: { max_length: 500 }
          }
        ]
      },
      effectiveness_score: 0.85,
      risk_level: 'low',
      success_rate: 0.92,
      created_at: new Date('2026-03-20'),
      updated_at: new Date('2026-03-20'),
      created_by: 'test-user',
      privacy_level: 'private',
      usage_count: 5,
      failure_modes: [
        {
          description: 'May lose important context',
          frequency: 0.1,
          severity: 'medium',
          mitigation: 'Review compressed prompts manually'
        }
      ]
    };

    await storage.storePattern(pattern);
    const retrieved = await storage.getPattern('test-pattern');

    expect(retrieved).toEqual(pattern);
  });

  it('should query patterns by criteria', async () => {
    const patterns = await storage.queryPatterns({
      type: 'prompt',
      risk_level: 'low'
    });

    expect(Array.isArray(patterns)).toBe(true);
  });
});