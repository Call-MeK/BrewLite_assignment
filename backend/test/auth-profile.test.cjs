const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const { Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { RequestMethod } = require('@nestjs/common');
const { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } = require('@nestjs/common/constants');
const { AuthController } = require('../src/modules/auth/auth.controller');
const { AuthService } = require('../src/modules/auth/auth.service');
const { UpdateProfileDto } = require('../src/modules/auth/dto/update-profile.dto');

test('profile update is authenticated and rejects empty name or invalid email', async () => {
  const route = AuthController.prototype.updateProfile;
  assert.equal(Reflect.getMetadata(PATH_METADATA, route), 'me');
  assert.equal(Reflect.getMetadata(METHOD_METADATA, route), RequestMethod.PUT);
  assert.equal(Reflect.getMetadata(GUARDS_METADATA, route).length, 1);
  const errors = await validate(plainToInstance(UpdateProfileDto, { email: 'bad-email', fullName: '   ' }));
  assert.deepEqual(errors.map((error) => error.property).sort(), ['email', 'fullName']);
});

test('updating profile normalizes fields and returns a token for the new email', async () => {
  const passwordHash = await bcrypt.hash('current-password', 4);
  const findUnique = mock.fn(async () => ({ email: 'old@example.com', passwordHash }));
  const update = mock.fn(async () => ({
    id: 'user-1', email: 'new@example.com', fullName: 'New Name', loyaltyPoints: 8, tokenVersion: 2,
  }));
  const signAsync = mock.fn(async () => 'new-token');
  const service = new AuthService({ user: { findUnique, update } }, { signAsync });

  const result = await service.updateProfile('user-1', { email: ' NEW@Example.com ', fullName: ' New Name ', currentPassword: 'current-password' });

  assert.equal(findUnique.mock.callCount(), 1);
  assert.deepEqual(update.mock.calls[0].arguments[0], {
    where: { id: 'user-1', email: 'old@example.com', passwordHash },
    data: { email: 'new@example.com', fullName: 'New Name' },
    select: { id: true, email: true, fullName: true, loyaltyPoints: true, tokenVersion: true },
  });
  assert.deepEqual(signAsync.mock.calls[0].arguments[0], { sub: 'user-1', email: 'new@example.com', ver: 2 });
  assert.equal(result.accessToken, 'new-token');
  assert.equal(result.user.fullName, 'New Name');
});

test('updating profile rejects an email already used by another account', async () => {
  const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.4.0' });
  const service = new AuthService({ user: {
    findUnique: async () => ({ email: 'used@example.com', passwordHash: '' }),
    update: async () => { throw duplicate; },
  } }, { signAsync: async () => '' });
  await assert.rejects(service.updateProfile('user-1', { email: 'used@example.com', fullName: 'Name' }), { status: 409 });
});

test('changing email requires the current password', async () => {
  const update = mock.fn(async () => ({}));
  const service = new AuthService({ user: {
    findUnique: async () => ({ email: 'old@example.com', passwordHash: 'hash' }), update,
  } }, { signAsync: async () => '' });
  await assert.rejects(service.updateProfile('user-1', { email: 'new@example.com', fullName: 'Name' }), { status: 400 });
  assert.equal(update.mock.callCount(), 0);
});

test('changing email rejects an incorrect password', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4);
  const update = mock.fn(async () => ({}));
  const service = new AuthService({ user: {
    findUnique: async () => ({ email: 'old@example.com', passwordHash }), update,
  } }, { signAsync: async () => '' });
  await assert.rejects(service.updateProfile('user-1', {
    email: 'new@example.com', fullName: 'Name', currentPassword: 'wrong-password',
  }), { status: 401 });
  assert.equal(update.mock.callCount(), 0);
});
