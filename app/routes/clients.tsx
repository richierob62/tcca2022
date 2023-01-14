import type { LinksFunction, LoaderFunction } from '@remix-run/node';
import { Outlet, useLoaderData, useParams } from '@remix-run/react';
import { Permission, User } from '@prisma/client';
import { json, redirect } from '@remix-run/node';

import React from 'react';
import SecondaryNav from '../components/secondary-nav';
import { authenticatedUser } from '../services/server_side/user_services.server';
import styles from '~/styles/nav.css';

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [
    Permission.CLIENT_UPDATE_ADVANCED,
    Permission.CLIENT_UPDATE_BASIC,
    Permission.CLIENT_VIEW,
  ];

  const loggedInUser = await authenticatedUser(request, permissions);

  if (typeof loggedInUser === 'string') return redirect(loggedInUser);

  return json({ loggedInUser });
};

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: styles }];
};

const Clients = () => {
  const { loggedInUser } = useLoaderData();

  const { permissions } = loggedInUser;

  const { clientId } = useParams();

  const navLinks = [
    {
      label: 'Client List',
      href: '/clients',
      hasPermission: permissions.includes(Permission.CLIENT_VIEW),
    },
    {
      label: 'Profile',
      href: clientId ? `/clients/${clientId}` : '',
      hasPermission: permissions.includes(Permission.CLIENT_VIEW),
    },
    {
      label: 'New Client',
      href: '/clients/new',
      hasPermission:
        permissions.includes(Permission.CLIENT_UPDATE_ADVANCED) ||
        permissions.includes(Permission.CLIENT_UPDATE_BASIC),
    },
  ];

  return (
    <>
      <nav className="px-2 bg-white border-gray-200 rounded">
        <div className="container flex flex-wrap items-center justify-between mx-auto">
          <div className="w-full" id="navbar-default">
            <ul className="flex flex-row justify-start py-3 mt-0 space-x-2 text-sm font-medium border-0 border-gray-100 rounded-lg bg-gray-50 ">
              {navLinks.map((link) => (
                <SecondaryNav key={link.label} link={link} />
              ))}
            </ul>
          </div>
        </div>
      </nav>

      <Outlet />
    </>
  );
};

export default Clients;
