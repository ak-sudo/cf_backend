const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveTaskSchema, listTasksQuerySchema } = require('../../src/modules/worker/worker.validation');
const { REPORT_STATUSES } = require('../../src/constants/reports');

describe('Worker Task Validation Schema Unit Tests', () => {
  it('should accept valid resolution proof payload with HTTPS images and notes', () => {
    const valid = {
      resolutionImages: ['https://res.cloudinary.com/civicflow/proof1.jpg'],
      notes: 'Pothole completely filled with asphalt and steamrolled.',
      workerCoordinates: [77.209, 28.6139],
    };

    const parsed = resolveTaskSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.notes, valid.notes);
  });

  it('should reject resolution without any photos (proof is mandatory)', () => {
    const noPhotos = {
      resolutionImages: [],
      notes: 'Issue resolved successfully.',
    };

    const parsed = resolveTaskSchema.safeParse(noPhotos);
    assert.equal(parsed.success, false);
    assert.match(parsed.error.errors[0].message, /At least one resolution proof photo is required/);
  });

  it('should reject non-HTTPS resolution image URLs', () => {
    const insecurePhotos = {
      resolutionImages: ['http://insecure-cdn.com/proof.jpg'],
      notes: 'Cleaned up street waste.',
    };

    const parsed = resolveTaskSchema.safeParse(insecurePhotos);
    assert.equal(parsed.success, false);
    assert.match(parsed.error.errors[0].message, /secure HTTPS/);
  });

  it('should reject notes shorter than 5 characters', () => {
    const shortNotes = {
      resolutionImages: ['https://res.cloudinary.com/civicflow/proof.jpg'],
      notes: 'Done',
    };

    const parsed = resolveTaskSchema.safeParse(shortNotes);
    assert.equal(parsed.success, false);
    assert.match(parsed.error.errors[0].message, /at least 5 characters/);
  });

  it('should accept allowed query statuses for worker task lists', () => {
    const validQuery = {
      status: REPORT_STATUSES.ASSIGNED,
      page: '1',
      limit: '10',
    };

    const parsed = listTasksQuerySchema.safeParse(validQuery);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.status, REPORT_STATUSES.ASSIGNED);
  });
});
