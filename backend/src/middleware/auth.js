const { AppError, UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { verifyFirebaseIdToken } = require('../config/firebase');
const User = require('../modules/users/user.model');
const { ROLES } = require('../constants/roles');
const logger = require('../utils/logger');

/**
 * Verifies Firebase JWT Bearer token and attaches user record to request
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token missing or invalid format (Bearer token expected)');
    }

    const token = authHeader.split('Bearer ')[1].trim();

    if (!token) {
      throw new UnauthorizedError('Authentication token missing');
    }

    // Verify the Bearer token from the Authorization header with Firebase Admin
    // (signature, expiry, issuer and audience are checked by verifyIdToken).
    // The request body is never used as a source of credentials.
    let decodedToken;
    try {
      decodedToken = await verifyFirebaseIdToken(token);
    } catch (err) {
      if (err && err.isFirebaseConfigError) {
        // Server-side misconfiguration: don't blame the client's token
        logger.error({ err: err.message }, 'Cannot verify Firebase tokens - server misconfigured');
        throw new AppError('Authentication service is not configured on the server', 500);
      }
      logger.warn({ code: err && err.code, err: err && err.message }, 'Failed to verify Firebase authentication token');
      if (err && err.code === 'auth/id-token-expired') {
        throw new UnauthorizedError('Authentication token expired');
      }
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    const { uid, email, name, picture } = decodedToken;

    if (!uid) {
      throw new UnauthorizedError('Invalid token payload: missing UID');
    }

    // Find or provision user in MongoDB
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      // First-time authentication - provision standard CITIZEN record
      try {
        user = await User.create({
          firebaseUid: uid,
          email: email || `${uid}@civicflow.local`,
          displayName: name || '',
          photoURL: picture || '',
          role: ROLES.CITIZEN,
          isActive: true,
        });

        logger.info({ userId: user._id, uid, role: user.role }, 'New user provisioned from Firebase authentication');
      } catch (createErr) {
        // Two concurrent first requests for the same new user can race on the
        // unique firebaseUid index. Re-read the record the other request created.
        if (createErr && createErr.code === 11000) {
          user = await User.findOne({ firebaseUid: uid });
        }
        if (!user) {
          throw createErr;
        }
      }
    }

    // Enforce active account check
    if (!user.isActive) {
      throw new ForbiddenError('Account is deactivated. Please contact CivicFlow administration.');
    }

    // Attach to request
    req.user = user;
    req.firebaseUser = decodedToken;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-Based Access Control (RBAC) middleware
 * Ensures user has at least one of the specified roles
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        { userId: req.user._id, userRole: req.user.role, requiredRoles: allowedRoles },
        'Access denied: insufficient role privileges'
      );
      return next(
        new ForbiddenError(
          `Access denied. Requires one of [${allowedRoles.join(', ')}], but your role is ${req.user.role}.`
        )
      );
    }

    next();
  };
}

/**
 * Enforces department isolation for department administrators and workers.
 * SUPER_ADMIN has platform-wide authority and bypasses department check.
 * 
 * @param {Function} departmentResolver - Function to extract department string from (req)
 */
function requireDepartmentScope(departmentResolver) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // SUPER_ADMIN has platform-wide jurisdiction
    if (req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    const targetDepartment = typeof departmentResolver === 'function' ? departmentResolver(req) : req.params.department;

    if (!targetDepartment) {
      return next(new ForbiddenError('Target department context could not be determined.'));
    }

    if (req.user.department !== targetDepartment) {
      logger.warn(
        { userId: req.user._id, userDept: req.user.department, targetDept: targetDepartment },
        'Department boundary violation attempt'
      );
      return next(
        new ForbiddenError(
          `Unauthorized: You can only manage resources for department '${req.user.department}'.`
        )
      );
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRoles,
  requireDepartmentScope,
};
