import { promises as fs } from 'fs';
import path from 'path';
import { OptimizationPattern, PatternCriteria, StorageConfig } from './types';

export class PatternStorage {
  private basePath: string;
  private config: StorageConfig;

  constructor(basePath: string, config: Partial<StorageConfig> = {}) {
    this.basePath = basePath;
    this.config = {
      base_path: basePath,
      max_patterns_per_file: 100,
      compression_enabled: false,
      backup_enabled: true,
      ...config
    };
  }

  async storePattern(pattern: OptimizationPattern): Promise<void> {
    await this.ensureDirectoryExists();
    const filePath = this.getPatternFilePath(pattern);
    const content = JSON.stringify(pattern, null, 2);
    await fs.writeFile(filePath, content, 'utf8');
  }

  async getPattern(patternId: string): Promise<OptimizationPattern | null> {
    try {
      const filePath = await this.findPatternFile(patternId);
      if (!filePath) return null;

      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content);
      return this.deserializePattern(parsed);
    } catch {
      return null;
    }
  }

  async queryPatterns(criteria: PatternCriteria): Promise<OptimizationPattern[]> {
    const patterns = await this.loadAllPatterns();
    return patterns.filter(pattern => this.matchesCriteria(pattern, criteria));
  }

  private async ensureDirectoryExists(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  private getPatternFilePath(pattern: OptimizationPattern): string {
    return path.join(this.basePath, `${pattern.id}.json`);
  }

  private async findPatternFile(patternId: string): Promise<string | null> {
    const filePath = path.join(this.basePath, `${patternId}.json`);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  private async loadAllPatterns(): Promise<OptimizationPattern[]> {
    try {
      const files = await fs.readdir(this.basePath);
      const patterns: OptimizationPattern[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.basePath, file), 'utf8');
          const parsed = JSON.parse(content);
          patterns.push(this.deserializePattern(parsed));
        }
      }

      return patterns;
    } catch {
      return [];
    }
  }

  private matchesCriteria(pattern: OptimizationPattern, criteria: PatternCriteria): boolean {
    if (criteria.type && pattern.type !== criteria.type) return false;
    if (criteria.risk_level && pattern.risk_level !== criteria.risk_level) return false;
    if (criteria.privacy_level && pattern.privacy_level !== criteria.privacy_level) return false;
    if (criteria.min_effectiveness && pattern.effectiveness_score < criteria.min_effectiveness) return false;
    if (criteria.created_after && pattern.created_at < criteria.created_after) return false;

    // Add project_context matching logic
    if (criteria.project_context) {
      if (criteria.project_context.tech_stack) {
        const hasAllTech = criteria.project_context.tech_stack.every(tech =>
          pattern.context.tech_stack.includes(tech)
        );
        if (!hasAllTech) return false;
      }
      if (criteria.project_context.project_type && pattern.context.project_type !== criteria.project_context.project_type) return false;
      if (criteria.project_context.team_size && pattern.context.team_size !== criteria.project_context.team_size) return false;
      if (criteria.project_context.current_phase && pattern.context.current_phase !== criteria.project_context.current_phase) return false;
    }

    return true;
  }

  private deserializePattern(parsed: Record<string, unknown>): OptimizationPattern {
    return {
      ...parsed,
      created_at: new Date(parsed.created_at),
      updated_at: new Date(parsed.updated_at)
    };
  }
}