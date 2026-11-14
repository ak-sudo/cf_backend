const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const userService = require('../../src/modules/users/user.service');
const { ROLES } = require('../../src/constants/roles');
const { BadRequestError, ForbiddenError } = require('../../src/utils/errors');

describe('User Service RBAC Logic Tests', () => {
  it('updateUserRole should throw BadRequestError when caller tries to modify own role', async () => {
    const caller = { _id: { toString: () => 'user-123' }, role: ROLES.ADMIN, department: 'ROADS' };
    await assert.rejects(
      async () => {
        await userService.updateUserRole(caller, 'user-123', {
          role: ROLES.SUPER_ADMIN,
        });
      },
      (err) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /cannot modify your own/);
        return true;
      }
    );
  });

  it('updateUserStatus should throw BadRequestError when caller tries to deactivate self', async () => {
    const caller = { _id: { toString: () => 'user-456' }, role: ROLES.SUPER_ADMIN };
    await assert.rejects(
      async () => {
        await userService.updateUserStatus(caller, 'user-456', false);
      },
      (err) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /cannot deactivate your own account/);
        return true;
      }
    );
  });
});
