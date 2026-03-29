import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
  it('should throw when updating missing user status', async () => {
    const usersService = {
      findById: jest.fn().mockResolvedValue(null),
      updateUserStatus: jest.fn(),
      listUsers: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    const auditService = {
      create: jest.fn(),
      findMany: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    const controller = new AdminController(usersService, auditService);

    await expect(
      controller.updateUserStatus(
        'missing',
        { status: UserStatus.Banned, reason: 'abuse' },
        { user: { sub: 'admin-1', email: 'a@a.com', role: 'admin' } } as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should force logout existing user', async () => {
    const clearAllRefreshTokensMock = jest.fn();
    const createAuditMock = jest.fn();
    const usersService = {
      findById: jest.fn().mockResolvedValue({ id: 'user-1' }),
      clearAllRefreshTokens: clearAllRefreshTokensMock,
      updateUserStatus: jest.fn(),
      listUsers: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    const auditService = {
      create: createAuditMock,
      findMany: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    const controller = new AdminController(usersService, auditService);

    await controller.forceLogoutUser('user-1', {
      user: { sub: 'admin-1', email: 'a@a.com', role: 'admin' },
    } as never);

    expect(clearAllRefreshTokensMock).toHaveBeenCalledWith('user-1');
    expect(createAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.user.force_logout',
        targetId: 'user-1',
      }),
    );
  });
});
