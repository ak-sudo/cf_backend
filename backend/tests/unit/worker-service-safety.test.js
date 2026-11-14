const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const workerService = require('../../src/modules/worker/worker.service');
const Report = require('../../src/modules/reports/report.model');
const { REPORT_STATUSES } = require('../../src/constants/reports');
const { ForbiddenError, BadRequestError } = require('../../src/utils/errors');

describe('Worker Service Authorization & Lifecycle Safety Unit Tests', () => {
  it('getTaskDetails should throw ForbiddenError when worker accesses task assigned to another worker', async () => {
    const originalFindById = Report.findById;
    Report.findById = () => ({
      populate: () => ({
        lean: async () => ({
          _id: 'report-123',
          assignedWorkerId: { toString: () => 'worker-999' },
        }),
      }),
    });

    try {
      const mockWorker = { _id: { toString: () => 'worker-111' } };
      await assert.rejects(
        async () => {
          await workerService.getTaskDetails(mockWorker, 'report-123');
        },
        (err) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match(err.message, /only authorized to access tasks assigned directly to you/);
          return true;
        }
      );
    } finally {
      Report.findById = originalFindById;
    }
  });

  it('startTask should throw ForbiddenError when worker attempts to start task assigned to another worker', async () => {
    const originalFindById = Report.findById;
    Report.findById = async () => ({
      _id: 'report-123',
      assignedWorkerId: { toString: () => 'worker-999' },
      status: REPORT_STATUSES.ASSIGNED,
    });

    try {
      const mockWorker = { _id: { toString: () => 'worker-111' } };
      await assert.rejects(
        async () => {
          await workerService.startTask(mockWorker, 'report-123');
        },
        (err) => {
          assert.ok(err instanceof ForbiddenError);
          return true;
        }
      );
    } finally {
      Report.findById = originalFindById;
    }
  });

  it('startTask should throw BadRequestError when attempting to start an already RESOLVED task', async () => {
    const originalFindById = Report.findById;
    Report.findById = async () => ({
      _id: 'report-123',
      assignedWorkerId: { toString: () => 'worker-111' },
      status: REPORT_STATUSES.RESOLVED,
    });

    try {
      const mockWorker = { _id: { toString: () => 'worker-111' } };
      await assert.rejects(
        async () => {
          await workerService.startTask(mockWorker, 'report-123');
        },
        (err) => {
          assert.ok(err instanceof BadRequestError);
          assert.match(err.message, /Cannot start task in current state/);
          return true;
        }
      );
    } finally {
      Report.findById = originalFindById;
    }
  });

  it('resolveTask should throw BadRequestError when attempting to resolve an already RESOLVED task', async () => {
    const originalFindById = Report.findById;
    Report.findById = async () => ({
      _id: 'report-123',
      assignedWorkerId: { toString: () => 'worker-111' },
      status: REPORT_STATUSES.RESOLVED,
    });

    try {
      const mockWorker = { _id: { toString: () => 'worker-111' } };
      await assert.rejects(
        async () => {
          await workerService.resolveTask(mockWorker, 'report-123', {
            resolutionImages: ['https://res.cloudinary.com/civicflow/proof.jpg'],
            notes: 'Already fixed yesterday.',
          });
        },
        (err) => {
          assert.ok(err instanceof BadRequestError);
          assert.match(err.message, /already been resolved/);
          return true;
        }
      );
    } finally {
      Report.findById = originalFindById;
    }
  });
});
