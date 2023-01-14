import { Permission } from '@prisma/client';
import type { User } from '@prisma/client';
import { auth } from '~/auth.server/index.server';
import { authorized } from '~/util/cookies';
import { prisma } from '~/util/prisma.server';

export const authenticatedUser = async (
  request: Request,
  permissions: Permission[] = []
): Promise<User | string> => {
  const path = new URL(request.url).pathname;

  const fbUser = await auth.user(request);

  if (!fbUser) return '/';

  const user = await prisma?.user.findUnique({
    where: {
      firebaseId: fbUser?.id,
    },
  });

  if (!user) return '/';

  if (!hasPermission(user, permissions) && path !== '/home') return '/home';

  const machineOK = await machineAuthorized(request);

  if (!machineOK) {
    if (hasPermission(user, [Permission.MANAGE_DEVICES])) {
      if (path !== '/permissions/devices/new')
        return '/permissions/devices/new';
      else {
        return user;
      }
    }
    return '/logout';
  }

  return user;
};

export const hasPermission = (
  user: User,
  requiredPermissions: Permission[]
) => {
  if (!user) return false;
  if (requiredPermissions.length === 0) return true;

  return requiredPermissions.some((permission) =>
    user.permissions?.includes(permission)
  );
};

export const machineAuthorized = async (request: Request) => {
  const cookieHeader = request.headers.get('Cookie');

  const { accessKey } = (await authorized.parse(cookieHeader)) || {};

  if (!accessKey) return false;

  const device = await prisma?.device.findUnique({
    where: {
      accessKey: accessKey,
    },
  });

  if (!device) return false;

  return true;
};
