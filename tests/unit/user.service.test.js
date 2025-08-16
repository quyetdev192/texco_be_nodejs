const UserService = require('../../src/modules/user/user.service');
const User = require('../../src/modules/user/user.model');

jest.mock('../../src/modules/user/user.model');
jest.mock('../../src/config/logger.config', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));
jest.mock('../../src/config/security.config', () => ({
    getJwtConfig: jest.fn(() => ({
        secret: 'test-secret',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        issuer: 'test',
        audience: 'test-users'
    }))
}));
jest.mock('../../src/utils/helpers', () => ({
    validatePassword: jest.fn(() => ({ isValid: true, errors: [] }))
}));

describe('UserService', () => {
    let userService;

    beforeEach(() => {
        userService = new UserService();
        jest.clearAllMocks();
    });

    describe('createUser', () => {
        it('should create a user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Password123!',
                firstName: 'John',
                lastName: 'Doe'
            };

            const mockUser = {
                _id: 'user123',
                ...userData,
                save: jest.fn().mockResolvedValue(true)
            };

            User.findByEmail.mockResolvedValue(null);
            User.mockImplementation(() => mockUser);

            const result = await userService.createUser(userData);

            expect(result).toEqual(mockUser);
            expect(User.findByEmail).toHaveBeenCalledWith(userData.email);
            expect(User).toHaveBeenCalledWith(userData);
            expect(mockUser.save).toHaveBeenCalled();
        });

        it('should throw error if user already exists', async () => {
            const userData = {
                email: 'existing@example.com',
                password: 'Password123!',
                firstName: 'John',
                lastName: 'Doe'
            };

            User.findByEmail.mockResolvedValue({ _id: 'existing123' });

            await expect(userService.createUser(userData)).rejects.toThrow(
                'User with this email already exists'
            );
        });
    });

    describe('getUserById', () => {
        it('should return user if found', async () => {
            const userId = 'user123';
            const mockUser = { _id: userId, email: 'test@example.com' };

            User.findById.mockResolvedValue(mockUser);

            const result = await userService.getUserById(userId);

            expect(result).toEqual(mockUser);
            expect(User.findById).toHaveBeenCalledWith(userId);
        });

        it('should throw error if user not found', async () => {
            const userId = 'nonexistent';

            User.findById.mockResolvedValue(null);

            await expect(userService.getUserById(userId)).rejects.toThrow(
                'User not found'
            );
        });
    });

    describe('getUserByEmail', () => {
        it('should return user if found', async () => {
            const email = 'test@example.com';
            const mockUser = { _id: 'user123', email };

            User.findByEmail.mockResolvedValue(mockUser);

            const result = await userService.getUserByEmail(email);

            expect(result).toEqual(mockUser);
            expect(User.findByEmail).toHaveBeenCalledWith(email);
        });

        it('should throw error if user not found', async () => {
            const email = 'nonexistent@example.com';

            User.findByEmail.mockResolvedValue(null);

            await expect(userService.getUserByEmail(email)).rejects.toThrow(
                'User not found'
            );
        });
    });

    describe('authenticateUser', () => {
        it('should authenticate user successfully', async () => {
            const email = 'test@example.com';
            const password = 'Password123!';

            const mockUser = {
                _id: 'user123',
                email,
                password: 'hashedPassword',
                isActive: true,
                isLocked: false,
                comparePassword: jest.fn().mockResolvedValue(true),
                incLoginAttempts: jest.fn(),
                resetLoginAttempts: jest.fn(),
                save: jest.fn().mockResolvedValue(true)
            };

            User.findByEmail.mockResolvedValue(mockUser);

            userService.generateTokens = jest.fn().mockResolvedValue({
                accessToken: 'access123',
                refreshToken: 'refresh123'
            });

            const result = await userService.authenticateUser(email, password);

            expect(result.user).toEqual(mockUser);
            expect(result.tokens).toBeDefined();
            expect(mockUser.comparePassword).toHaveBeenCalledWith(password);
            expect(mockUser.save).toHaveBeenCalled();
        });

        it('should throw error if user not found', async () => {
            const email = 'nonexistent@example.com';
            const password = 'Password123!';

            User.findByEmail.mockResolvedValue(null);

            await expect(userService.authenticateUser(email, password)).rejects.toThrow(
                'Invalid credentials'
            );
        });

        it('should throw error if account is locked', async () => {
            const email = 'test@example.com';
            const password = 'Password123!';

            const mockUser = {
                _id: 'user123',
                email,
                isLocked: true
            };

            User.findByEmail.mockResolvedValue(mockUser);

            await expect(userService.authenticateUser(email, password)).rejects.toThrow(
                'Account is locked due to multiple failed attempts'
            );
        });

        it('should throw error if account is deactivated', async () => {
            const email = 'test@example.com';
            const password = 'Password123!';

            const mockUser = {
                _id: 'user123',
                email,
                isActive: false
            };

            User.findByEmail.mockResolvedValue(mockUser);

            await expect(userService.authenticateUser(email, password)).rejects.toThrow(
                'Account is deactivated'
            );
        });

        it('should throw error if password is incorrect', async () => {
            const email = 'test@example.com';
            const password = 'WrongPassword123!';

            const mockUser = {
                _id: 'user123',
                email,
                password: 'hashedPassword',
                isActive: true,
                isLocked: false,
                comparePassword: jest.fn().mockResolvedValue(false),
                incLoginAttempts: jest.fn().mockResolvedValue(true)
            };

            User.findByEmail.mockResolvedValue(mockUser);

            await expect(userService.authenticateUser(email, password)).rejects.toThrow(
                'Invalid credentials'
            );
            expect(mockUser.incLoginAttempts).toHaveBeenCalled();
        });
    });

    describe('updateUser', () => {
        it('should update user successfully', async () => {
            const userId = 'user123';
            const updateData = {
                firstName: 'Jane',
                lastName: 'Smith'
            };

            const mockUser = {
                _id: userId,
                ...updateData
            };

            User.findByIdAndUpdate.mockResolvedValue(mockUser);

            const result = await userService.updateUser(userId, updateData);

            expect(result).toEqual(mockUser);
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                userId,
                { $set: updateData },
                { new: true, runValidators: true }
            );
        });

        it('should throw error if user not found', async () => {
            const userId = 'nonexistent';
            const updateData = { firstName: 'Jane' };

            User.findByIdAndUpdate.mockResolvedValue(null);

            await expect(userService.updateUser(userId, updateData)).rejects.toThrow(
                'User not found'
            );
        });
    });

    describe('deleteUser', () => {
        it('should delete user successfully', async () => {
            const userId = 'user123';
            const mockUser = { _id: userId, email: 'test@example.com' };

            User.findByIdAndDelete.mockResolvedValue(mockUser);

            const result = await userService.deleteUser(userId);

            expect(result).toBe(true);
            expect(User.findByIdAndDelete).toHaveBeenCalledWith(userId);
        });

        it('should throw error if user not found', async () => {
            const userId = 'nonexistent';

            User.findByIdAndDelete.mockResolvedValue(null);

            await expect(userService.deleteUser(userId)).rejects.toThrow(
                'User not found'
            );
        });
    });

    describe('getUserStatistics', () => {
        it('should return user statistics', async () => {
            const mockStats = {
                total: 100,
                active: 90,
                verified: 85,
                admins: 5,
                newToday: 3
            };

            User.countDocuments
                .mockResolvedValueOnce(mockStats.total)
                .mockResolvedValueOnce(mockStats.active)
                .mockResolvedValueOnce(mockStats.verified)
                .mockResolvedValueOnce(mockStats.admins)
                .mockResolvedValueOnce(mockStats.newToday);

            const result = await userService.getUserStatistics();

            expect(result).toEqual(mockStats);
            expect(User.countDocuments).toHaveBeenCalledTimes(5);
        });
    });
}); 