const reportService = require('./report.service');
const { successResponse } = require('../../utils/api-response');

class ReportController {
  /**
   * Get signed Cloudinary upload params
   */
  async getUploadSignature(req, res, next) {
    try {
      const signatureData = reportService.generateUploadSignature(req.user);
      return successResponse(res, {
        message: 'Upload signature generated successfully',
        data: signatureData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit civic issue report
   */
  async createReport(req, res, next) {
    try {
      const report = await reportService.createReport(req.user, req.body);
      return successResponse(res, {
        statusCode: 201,
        message: 'Civic issue report submitted successfully. AI analysis scheduled.',
        data: { report },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List reports with filtering and pagination
   */
  async listReports(req, res, next) {
    try {
      const { reports, pagination } = await reportService.listReports(req.user, req.query);
      return successResponse(res, {
        message: 'Reports retrieved successfully',
        data: { reports },
        meta: pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single report details
   */
  async getReportById(req, res, next) {
    try {
      const report = await reportService.getReportById(req.user, req.params.id);
      return successResponse(res, {
        message: 'Report details retrieved successfully',
        data: { report },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign report to field worker (Admin / Super Admin)
   */
  async assignWorker(req, res, next) {
    try {
      const report = await reportService.assignWorker(req.user, req.params.id, req.body.workerId);
      return successResponse(res, {
        message: 'Report successfully assigned to field worker',
        data: { report },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update report status (Worker / Admin / Super Admin)
   */
  async updateStatus(req, res, next) {
    try {
      const report = await reportService.updateStatus(req.user, req.params.id, req.body);
      return successResponse(res, {
        message: 'Report status updated successfully',
        data: { report },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportController();
