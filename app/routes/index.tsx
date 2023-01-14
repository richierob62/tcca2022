import type { ActionFunction, LoaderFunction } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';
import { json, redirect } from '@remix-run/node';

import type { AppError } from '~/util';
import { auth } from '~/auth.server/index.server';
import { prisma } from '~/util/prisma.server';
import { useRef } from 'react';

export let meta = () => {
  return {
    title: 'Login',
  };
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const form = await request.formData();

    const email: any = form.get('email');
    const password: any = form.get('password');

    if (!email || email.trim() === '') {
      return json<AppError>(
        {
          status: 'error',
          errorCode: 'signup/invalid-email',
          errorMessage: 'Email field cannot be empty',
        },
        { status: 400 }
      );
    }

    if (!password || password.trim() === '') {
      return json<AppError>(
        {
          status: 'error',
          errorCode: 'signup/invalid-password',
          errorMessage: 'Password field cannot be empty',
        },
        { status: 400 }
      );
    }

    // TODO: CSRF check
    return auth.login({ username: email, password });
  } catch (error) {
    return json<AppError>(
      {
        status: 'error',
        errorCode: 'login/general',
        errorMessage: 'There was a problem logging in',
      },
      { status: 500 }
    );
  }
};

export const loader: LoaderFunction = async ({ request }) => {
  // redirect if already signed in
  const fbUser = await auth.user(request);
  if (fbUser) {
    const user = await prisma?.user.findUnique({
      where: {
        firebaseId: fbUser?.id,
      },
      select: {
        status: true,
      },
    });

    if (user?.status === 'DISABLED') {
      return auth.logout(request, '/');
    }

    return redirect('/home');
  } else {
    return null;
  }
};

export default function Index() {
  const actionError = useActionData();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  return (
    <div className="w-96 bg-slate-200 p-8">
      <Form className="" method="post">
        <div className="mb-6">
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-300"
          >
            Your Email
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-gray-500 dark:text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
              </svg>
            </div>
            <input
              type="text"
              name="email"
              ref={emailRef}
              id="email"
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 pl-10 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500  dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-6">
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-300"
          >
            Your password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            ref={passwordRef}
            className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 sm:w-auto"
        >
          Log In
        </button>

        {actionError?.errorCode && (
          <p className="mt-4 text-red-600">
            <em>Login failed: {actionError.errorMessage}</em>
          </p>
        )}
      </Form>
    </div>
  );
}
