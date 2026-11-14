const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateAIInference } = require('../../src/workers/report-analysis.worker');
const { ISSUE_CATEGORIES, SEVERITY_LEVELS } = require('../../src/constants/reports');

describe('AI Inference Guardrails & Validation Unit Tests (Directive Section 7)', () => {
  it('should accept valid AI prediction output within approved enums and numerical bounds', () => {
    const rawAi = {
      predictedCategory: ISSUE_CATEGORIES.POTHOLE,
      confidence: 0.94,
      estimatedSeverity: SEVERITY_LEVELS.HIGH,
      fraudScore: 0.05,
      tags: ['road_damage', 'pothole'],
      modelVersion: 'v2.1.0-civic',
    };

    const validated = validateAIInference(rawAi);
    assert.equal(validated.predictedCategory, ISSUE_CATEGORIES.POTHOLE);
    assert.equal(validated.confidence, 0.94);
    assert.equal(validated.estimatedSeverity, SEVERITY_LEVELS.HIGH);
    assert.equal(validated.fraudScore, 0.05);
  });

  it('should sanitize unapproved predicted categories and fallback to OTHER', () => {
    const maliciousAiOutput = {
      predictedCategory: 'UNAUTHORIZED_NEW_TAX_CATEGORY',
      confidence: 0.85,
      estimatedSeverity: SEVERITY_LEVELS.MEDIUM,
    };

    const validated = validateAIInference(maliciousAiOutput);
    assert.equal(validated.predictedCategory, ISSUE_CATEGORIES.OTHER);
  });

  it('should sanitize unapproved severity levels and fallback to LOW', () => {
    const corruptedAiOutput = {
      predictedCategory: ISSUE_CATEGORIES.GARBAGE,
      confidence: 0.80,
      estimatedSeverity: 'SUPER_EXTREME_DOOMSDAY',
    };

    const validated = validateAIInference(corruptedAiOutput);
    assert.equal(validated.estimatedSeverity, SEVERITY_LEVELS.LOW);
  });

  it('should clamp out-of-range confidence values strictly to [0, 1]', () => {
    const outOfBoundsConfidence = {
      predictedCategory: ISSUE_CATEGORIES.POTHOLE,
      confidence: 1.5, // Exceeds 1.0
      estimatedSeverity: SEVERITY_LEVELS.HIGH,
      fraudScore: -0.2, // Below 0.0
    };

    const validated = validateAIInference(outOfBoundsConfidence);
    assert.equal(validated.confidence, 1.0);
    assert.equal(validated.fraudScore, 0.0);
  });
});
