import { Form, NavLink, useSearchParams } from '@remix-run/react';

import React from 'react';
import type { User } from '@prisma/client';
import { buildQueryStringFromSearchParams } from '../util/query-string';

interface Props {
  user?: User | null;
}

const Nav: React.FC<Props> = ({ user }) => {
  const [searchParams] = useSearchParams();

  const showClients = user?.permissions?.some((permission) =>
    permission.includes('CLIENT')
  );
  const showLoans = user?.permissions?.some(
    (permission) =>
      permission.includes('LOAN') || permission.includes('APPLICATION')
  );
  const showReconciliation = user?.permissions?.some(
    (permission) =>
      permission.includes('RECONCILE') || permission.includes('FINANCE')
  );
  const showPermissions = user?.permissions?.some((permission) =>
    permission.includes('MANAGE')
  );
  const showSignOut = user && typeof user !== 'string';

  return (
    <nav className="h-screen w-fit ">
      <aside className="w-48 h-full " aria-label="Sidebar">
        <div className="h-full px-3 py-4 rounded bg-gray-50">
          <a href="/" className="mb-5 flex items-center pl-2.5">
            <span className="self-center text-xl font-semibold whitespace-nowrap dark:text-white">
              TCCA 2022
            </span>
          </a>
          <ul className="space-y-2">
            {showClients && (
              <li>
                <NavLink
                  to={`/clients?${buildQueryStringFromSearchParams(
                    searchParams
                  )}`}
                >
                  {({ isActive }: { isActive: boolean }) => (
                    <div
                      className={
                        isActive
                          ? 'flex items-center rounded-lg bg-blue-500 p-2 text-base font-normal text-white'
                          : 'flex items-center rounded-lg bg-transparent p-2 text-base font-normal text-gray-900 hover:bg-gray-100'
                      }
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke={isActive ? 'white' : 'currentColor'}
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        ></path>
                      </svg>
                      <span className="ml-3">Clients</span>
                    </div>
                  )}
                </NavLink>
              </li>
            )}

            {showLoans && (
              <li>
                <NavLink
                  to={`/loans?${buildQueryStringFromSearchParams(
                    searchParams
                  )}`}
                >
                  {({ isActive }: { isActive: boolean }) => (
                    <div
                      className={
                        isActive
                          ? 'flex items-center rounded-lg bg-blue-500 p-2 text-base font-normal text-white'
                          : 'flex items-center rounded-lg bg-transparent p-2 text-base font-normal text-gray-900 hover:bg-gray-100'
                      }
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke={isActive ? 'white' : 'currentColor'}
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <span className="ml-3">Loans</span>
                    </div>
                  )}
                </NavLink>
              </li>
            )}

            {showReconciliation && (
              <li>
                <NavLink
                  to={`/reconciliation?${buildQueryStringFromSearchParams(
                    searchParams
                  )}`}
                >
                  {({ isActive }: { isActive: boolean }) => (
                    <div
                      className={
                        isActive
                          ? 'flex items-center rounded-lg bg-blue-500 p-2 text-base font-normal text-white'
                          : 'flex items-center rounded-lg bg-transparent p-2 text-base font-normal text-gray-900 hover:bg-gray-100'
                      }
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke={isActive ? 'white' : 'currentColor'}
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        ></path>
                      </svg>
                      <span className="ml-3">Reconciliation</span>
                    </div>
                  )}
                </NavLink>
              </li>
            )}

            {showPermissions && (
              <li>
                <NavLink
                  to={`/permissions?${buildQueryStringFromSearchParams(
                    searchParams
                  )}`}
                >
                  {({ isActive }: { isActive: boolean }) => (
                    <div
                      className={
                        isActive
                          ? 'flex items-center rounded-lg bg-blue-500 p-2 text-base font-normal text-white'
                          : 'flex items-center rounded-lg bg-transparent p-2 text-base font-normal text-gray-900 hover:bg-gray-100'
                      }
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke={isActive ? 'white' : 'currentColor'}
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                        ></path>
                      </svg>
                      <span className="ml-3">Permissions</span>
                    </div>
                  )}
                </NavLink>
              </li>
            )}

            {showSignOut && (
              <li>
                <Form className="" method="post" action="/logout">
                  <button className="flex items-center p-2" type="submit">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      ></path>
                    </svg>
                    <span className="ml-3">Sign Out</span>
                  </button>
                </Form>
              </li>
            )}
          </ul>
        </div>
      </aside>
    </nav>
  );
};

export default Nav;
