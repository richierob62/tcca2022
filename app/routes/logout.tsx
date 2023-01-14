import type { ActionFunction, LoaderFunction } from '@remix-run/node';

import { auth } from '~/auth.server/index.server';
import { redirect } from '@remix-run/node';

export const loader: LoaderFunction = async () => {
  // not expecting direct access, so redirect away
  return redirect('/');
};

export const action: ActionFunction = async ({ request }) => {
  return auth.logout(request, '/');
};
