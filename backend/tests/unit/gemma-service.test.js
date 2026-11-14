const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const gemmaService = require('../../src/services/gemma.service');
const { ISSUE_CATEGORIES, SEVERITY_LEVELS } = require('../../src/constants/reports');

describe('Gemma 4 AI Classification & Department Routing Service Unit Tests', () => {
  it('should classify pothole reports and route to ROADS department with detailed AI report', async () => {
    const result = await gemmaService.classifyAndGenerateReport({
      title: 'Dangerous road crater near bus stand',
      description: 'Deep pothole causing vehicular damage and traffic slowdown on asphalt street.',
      images: ['https://res.cloudinary.com/civicflow/pothole.jpg'],
    });

    assert.equal(result.predictedCategory, ISSUE_CATEGORIES.POTHOLE);
    assert.equal(result.recommendedDepartment, 'ROADS');
    // Keyword fallback must stay below the 0.70 auto-routing threshold => human review
    assert.ok(result.confidence < 0.70);
    assert.equal(result.modelVersion, 'keyword-fallback');
    assert.ok(result.aiReport);
    assert.ok(result.aiReport.summary.includes('pothole'));
    assert.ok(result.aiReport.recommendedAction.includes('ROADS'));
    assert.ok(Array.isArray(result.aiReport.keyObservations));
    assert.ok(Array.isArray(result.aiReport.immediateHazards));
  });

  it('should classify garbage overflow reports and route to SANITATION department', async () => {
    const result = await gemmaService.classifyAndGenerateReport({
      title: 'Rotting garbage pile on corner',
      description: 'Solid waste and plastic litter overflowing from municipal bins.',
      images: ['https://res.cloudinary.com/civicflow/garbage.jpg'],
    });

    assert.equal(result.predictedCategory, ISSUE_CATEGORIES.GARBAGE);
    assert.equal(result.recommendedDepartment, 'SANITATION');
    assert.ok(result.aiReport.summary.includes('SANITATION'));
  });

  it('should classify electrical wire hazards and route to ELECTRICITY department', async () => {
    const result = await gemmaService.classifyAndGenerateReport({
      title: 'Hanging live wires from broken pole',
      description: 'High voltage electrical wire sparked and fell onto the pedestrian walkway.',
      images: ['https://res.cloudinary.com/civicflow/wire.jpg'],
    });

    assert.equal(result.predictedCategory, ISSUE_CATEGORIES.BROKEN_INFRASTRUCTURE);
    assert.equal(result.recommendedDepartment, 'ELECTRICITY');
    assert.equal(result.severity, SEVERITY_LEVELS.HIGH);
    assert.ok(result.aiReport.immediateHazards.some((h) => h.includes('electrical')));
  });

  it('should classify dead animals as CRITICAL severity with EMERGENCY urgency and route to SANITATION', async () => {
    const result = await gemmaService.classifyAndGenerateReport({
      title: 'Dead animal on highway median',
      description: 'Animal carcass decaying on roadway causing severe health hazard.',
      images: ['https://res.cloudinary.com/civicflow/carcass.jpg'],
    });

    assert.equal(result.predictedCategory, ISSUE_CATEGORIES.ANIMAL_CARCASS);
    assert.equal(result.recommendedDepartment, 'SANITATION');
    assert.equal(result.severity, SEVERITY_LEVELS.CRITICAL);
    assert.equal(result.aiReport.estimatedRepairUrgency, 'EMERGENCY');
  });

  it('should classify water pipe bursts and route to WATER_SUPPLY', async () => {
    const result = await gemmaService.classifyAndGenerateReport({
      title: 'Drinking water pipeline burst',
      description: 'Clean water gushing from cracked underground supply pipe into the road.',
      images: ['https://res.cloudinary.com/civicflow/leak.jpg'],
    });

    assert.equal(result.predictedCategory, ISSUE_CATEGORIES.WATER_LEAKAGE);
    assert.equal(result.recommendedDepartment, 'WATER_SUPPLY');
  });
});
