const User = require('./user.model');
const { ROLES } = require('../../constants/roles');
const {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} = require('../../utils/errors');
const auditService = require('../audit/audit.service');
const logger = require('../../utils/logger');

class UserService {
  /**
   * Syncs and returns the currently authenticated user
   */
  async syncUser(currentUser) {
    currentUser.lastLoginAt = new Date();
    await currentUser.save();
    return currentUser;
  }

  /**
   * Updates profile fields for the authenticated user
   */
  async updateProfile(userId, updateData) {
    const allowedUpdates = {};
    if (updateData.displayName !== undefined) allowedUpdates.displayName = updateData.displayName;
    if (updateData.phoneNumber !== undefined) allowedUpdates.phoneNumber = updateData.phoneNumber;
    if (updateData.photoURL !== undefined) allowedUpdates.photoURL = updateData.photoURL;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    return user;
  }

  /**
   * Paginated listing of users with RBAC department isolation
   */
  async listUsers(caller, query) {
    const { page, limit, role, department, isActive, search } = query;
    const filter = {};

    // Department Admin is strictly locked to their own department
    if (caller.role === ROLES.ADMIN) {
      filter.department = caller.department;
    } else if (department) {
      filter.department = department;
    }

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return {
      users: users.map((u) => {
        const userObj = { ...u, id: u._id.toString() };
        delete userObj._id;
        delete userObj.__v;
        return userObj;
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieve single user details by ID
   */
  async getUserById(caller, targetUserId) {
    const user = await User.findById(targetUserId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Department Admin check
    if (caller.role === ROLES.ADMIN && user.department !== caller.department) {
      throw new ForbiddenError('You can only view users assigned to your department');
    }

    return user;
  }

  /**
   * Update user role and department assignment
   */
  async updateUserRole(caller, targetUserId, { role, department }) {
    if (caller._id.toString() === targetUserId) {
      throw new BadRequestError('You cannot modify your own administrative role or department');
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    // RBAC: Department ADMIN rules
    if (caller.role === ROLES.ADMIN) {
      // Department ADMIN can ONLY manage WORKER roles within their own department
      if (role !== ROLES.WORKER && role !== ROLES.CITIZEN) {
        throw new ForbiddenError('Department Administrators can only assign WORKER or CITIZEN roles');
      }

      if (role === ROLES.WORKER && department !== caller.department) {
        throw new ForbiddenError(`You can only assign workers to your own department (${caller.department})`);
      }

      if (targetUser.role === ROLES.ADMIN || targetUser.role === ROLES.SUPER_ADMIN) {
        throw new ForbiddenError('Department Administrators cannot modify other Administrators or Super Administrators');
      }
    }

    // Target cannot be demoted if it is the only remaining SUPER_ADMIN
    if (targetUser.role === ROLES.SUPER_ADMIN && role !== ROLES.SUPER_ADMIN) {
      const superAdminCount = await User.countDocuments({ role: ROLES.SUPER_ADMIN, isActive: true });
      if (superAdminCount <= 1) {
        throw new ForbiddenError('Cannot demote the sole active Super Administrator');
      }
    }

    targetUser.role = role;
    targetUser.department = (role === ROLES.ADMIN || role === ROLES.WORKER) ? department : null;

    await targetUser.save();

    // Audit privileged role assignment
    auditService.recordAction({
      actorId: caller._id,
      actorEmail: caller.email,
      actorRole: caller.role,
      action: 'USER_ROLE_UPDATED',
      targetResource: 'User',
      targetId: targetUser._id.toString(),
      changes: {
        newRole: role,
        department: targetUser.department,
      },
    });

    logger.info(
      {
        actionBy: caller._id,
        targetUser: targetUser._id,
        newRole: role,
        department: targetUser.department,
      },
      'User role and department assignment updated'
    );

    return targetUser;
  }

  /**
   * Deactivate or activate a user account
   */
  async updateUserStatus(caller, targetUserId, isActive) {
    if (caller._id.toString() === targetUserId) {
      throw new BadRequestError('You cannot deactivate your own account');
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    if (caller.role === ROLES.ADMIN) {
      if (targetUser.department !== caller.department || targetUser.role !== ROLES.WORKER) {
        throw new ForbiddenError('Department Administrators can only change status of workers in their department');
      }
    }

    if (targetUser.role === ROLES.SUPER_ADMIN && !isActive) {
      throw new ForbiddenError('Super Administrator accounts cannot be deactivated');
    }

    targetUser.isActive = isActive;
    await targetUser.save();

    // Audit privileged status change
    auditService.recordAction({
      actorId: caller._id,
      actorEmail: caller.email,
      actorRole: caller.role,
      action: 'USER_STATUS_UPDATED',
      targetResource: 'User',
      targetId: targetUser._id.toString(),
      changes: {
        isActive,
        role: targetUser.role,
        department: targetUser.department,
      },
    });

    logger.info(
      {
        actionBy: caller._id,
        targetUser: targetUser._id,
        isActive,
      },
      'User status updated'
    );

    return targetUser;
  }
}

module.exports = new UserService();
