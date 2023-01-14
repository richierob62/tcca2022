import type { User } from '@prisma/client'

export const canManageUsers = (user: User): boolean =>
  user?.permissions?.includes('MANAGE_USERS') || false

export const canManageDevices = (user: User): boolean =>
  user?.permissions?.includes('MANAGE_DEVICES') || false
