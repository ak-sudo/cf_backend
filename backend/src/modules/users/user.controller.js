const userService = require('./user.service');
const { successResponse } = require('../../utils/api-response');

class UserController {
  /**
   * Sync Firebase user with MongoDB and return profile
   */
  async syncUser(req, res, next) {
    try {
      const user = await userService.syncUser(req.user);
      return successResponse(res, {
        message: 'User session synchronized successfully',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current authenticated user's profile
   */
  async getMe(req, res, next) {
    try {
      // req.user is the MongoDB user attached by the authenticate middleware
      // for the verified token's UID — never a user selected by the client.
      return successResponse(res, {
        message: 'Profile retrieved successfully',
        data: { user: req.user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current authenticated user's profile
   */
  async updateMe(req, res, next) {
    try {
      const updatedUser = await userService.updateProfile(req.user._id, req.body);
      return successResponse(res, {
        message: 'Profile updated successfully',
        data: { user: updatedUser },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List users with RBAC scope and pagination
   */
  async listUsers(req, res, next) {
    try {
      const { users, pagination } = await userService.listUsers(req.user, req.query);
      return successResponse(res, {
        message: 'Users retrieved successfully',
        data: { users },
        meta: pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single user details by ID
   */
  async getUserById(req, res, next) {
    try {
      const user = await userService.getUserById(req.user, req.params.id);
      return successResponse(res, {
        message: 'User details retrieved successfully',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user role and department (Super Admin / Admin)
   */
  async updateUserRole(req, res, next) {
    try {
      const updatedUser = await userService.updateUserRole(req.user, req.params.id, req.body);
      return successResponse(res, {
        message: 'User role updated successfully',
        data: { user: updatedUser },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user active/inactive status
   */
  async updateUserStatus(req, res, next) {
    try {
      const updatedUser = await userService.updateUserStatus(req.user, req.params.id, req.body.isActive);
      return successResponse(res, {
        message: `User account ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`,
        data: { user: updatedUser },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
