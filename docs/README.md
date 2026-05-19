# Documentation

This directory contains all project documentation organized by purpose and audience.

## Directory Structure

### 📁 `/architecture`
System architecture diagrams, database schemas, and technical architecture decisions.
- Database design documents
- System architecture overviews
- API design specifications
- Infrastructure diagrams

### 📁 `/guides`
Development and operational guides for team members.
- [Development Guidelines](./guides/DEVELOPMENT_GUIDELINES.md) - Coding standards and best practices
- Setup guides
- Deployment procedures
- Troubleshooting guides

### 📁 `/specifications`
Detailed feature specifications and system design documents.
- [Business Operations Platform Plan](./specifications/BUSINESS_OPERATIONS_PLATFORM_PLAN.md) - High-level product vision
- [Design System](./specifications/DESIGN_SYSTEM.md) - UI/UX design specifications
- Feature requirements documents
- Technical specifications

### 📁 `/tutorials`
Step-by-step learning materials for developers at all levels.
- Getting started guides
- Technology-specific tutorials
- Best practices tutorials
- Power user guides

## Documentation Standards

### File Naming
- Use descriptive, kebab-case names: `feature-specification.md`
- Include version dates for major updates: `api-v2-migration-2024.md`
- Use consistent prefixes for document types:
  - `SPEC_` for specifications
  - `GUIDE_` for guides
  - `TUTORIAL_` for tutorials
  - `ARCH_` for architecture docs

### Content Guidelines
- Start with a clear purpose statement
- Include a table of contents for long documents
- Use consistent heading structures (H1 for title, H2 for main sections)
- Include diagrams and examples where helpful
- Keep documents focused and atomic
- Link between related documents
- Include last updated date

### Maintenance
- Review quarterly for accuracy
- Archive outdated documents to `/archive`
- Update links when moving documents
- Maintain this README when structure changes