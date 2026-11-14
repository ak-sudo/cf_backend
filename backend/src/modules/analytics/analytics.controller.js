const analyticsService = require('./analytics.service');
const { successResponse } = require('../../utils/api-response');

class AnalyticsController {
  /**
   * Operational overview metrics
   */
  async getOverview(req, res, next) {
    try {
      const overview = await analyticsService.getOverview(req.user, req.query);
      return successResponse(res, {
        message: 'Operational analytics overview retrieved successfully',
        data: overview,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Category breakdown metrics
   */
  async getCategoryBreakdown(req, res, next) {
    try {
      const breakdown = await analyticsService.getCategoryBreakdown(req.user, req.query);
      return successResponse(res, {
        message: 'Category analytics breakdown retrieved successfully',
        data: breakdown,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Geospatial heatmap points
   */
  async getHeatmap(req, res, next) {
    try {
      const heatmap = await analyticsService.getHeatmapPoints(req.user, req.query);
      return successResponse(res, {
        message: 'Geospatial heatmap points retrieved successfully',
        data: heatmap,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Worker performance leaderboard
   */
  async getWorkerLeaderboard(req, res, next) {
    try {
      const leaderboard = await analyticsService.getWorkerLeaderboard(req.user);
      return successResponse(res, {
        message: 'Worker performance metrics retrieved successfully',
        data: leaderboard,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnalyticsController();
