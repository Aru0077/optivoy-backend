import { UsersService } from './users.service';
import { UserStatus } from './entities/user.entity';

type UserUpdatePayload = {
  hashedRefreshToken?: string | null;
  hashedAppRefreshToken?: string | null;
  status?: UserStatus;
  statusReason?: string | null;
};

const makeUpdateMock = () =>
  jest
    .fn<Promise<void>, [string, UserUpdatePayload]>()
    .mockResolvedValue(undefined);

describe('UsersService', () => {
  it('should omit sensitive fields in listUsers response', async () => {
    const usersRepository = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'user-1',
            account: 'user@example.com',
            name: 'User',
            avatar: null,
            passwordHash: 'secret-hash',
            hashedRefreshToken: 'refresh-hash',
            hashedAppRefreshToken: 'app-refresh-hash',
            status: UserStatus.Active,
            statusReason: null,
            email: null,
            emailVerifiedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        1,
      ]),
    };

    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.listUsers({});

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'user-1',
        account: 'user@example.com',
        status: UserStatus.Active,
      }),
    );
    expect(result.items[0]).not.toHaveProperty('passwordHash');
    expect(result.items[0]).not.toHaveProperty('hashedRefreshToken');
  });

  it('should return null for findByAccount when not found', async () => {
    const usersRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.findByAccount('nonexistent');
    expect(result).toBeNull();
  });

  it('should hash refresh token on setRefreshToken', async () => {
    const updateFn = makeUpdateMock();
    const usersRepository = { update: updateFn };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.setRefreshToken('user-1', 'plain-token');
    const payload = updateFn.mock.calls[0]?.[1];
    expect(typeof payload?.hashedRefreshToken).toBe('string');
    expect(payload?.hashedRefreshToken).not.toBe('plain-token');
  });

  it('should set hashedRefreshToken to null on logout', async () => {
    const updateFn = makeUpdateMock();
    const usersRepository = { update: updateFn };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.setRefreshToken('user-1', null);
    expect(updateFn).toHaveBeenCalledWith('user-1', {
      hashedRefreshToken: null,
    });
  });

  it('should hash app refresh token separately', async () => {
    const updateFn = makeUpdateMock();
    const usersRepository = { update: updateFn };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.setRefreshToken('user-1', 'plain-app-token', 'app');
    const payload = updateFn.mock.calls[0]?.[1];
    expect(typeof payload?.hashedAppRefreshToken).toBe('string');
    expect(payload?.hashedAppRefreshToken).not.toBe('plain-app-token');
  });

  it('should clear hashedRefreshToken when suspending user', async () => {
    const updateFn = makeUpdateMock();
    const usersRepository = { update: updateFn };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.updateUserStatus('user-1', UserStatus.Suspended, 'Violation');
    expect(updateFn).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        hashedRefreshToken: null,
        hashedAppRefreshToken: null,
      }),
    );
  });

  it('should NOT clear hashedRefreshToken when re-activating user', async () => {
    const updateFn = makeUpdateMock();
    const usersRepository = { update: updateFn };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.updateUserStatus('user-1', UserStatus.Active);
    expect(updateFn.mock.calls[0]?.[1]).not.toHaveProperty(
      'hashedRefreshToken',
    );
  });
});
