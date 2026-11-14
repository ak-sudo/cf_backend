const auditService = require('./audit.service');
const { successResponse } = require('../../utils/api-response');

class AuditController {
  /**
   * List system audit logs (Super Admin exclusive)
   */
  async listLogs(req, res, next) {
    try {
      const { logs, pagination } = await auditService.listLogs(req.query);
      return successResponse(res, {
        message: 'System audit logs retrieved successfully',
        data: { logs },
        meta: pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuditController();
