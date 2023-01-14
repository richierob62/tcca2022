import type { LinksFunction, LoaderFunction } from '@remix-run/node';
import { Outlet, useLoaderData, useParams } from '@remix-run/react';
import { json, redirect } from '@remix-run/node';

import { Permission } from '@prisma/client';
import React from 'react';
import SecondaryNav from '../components/secondary-nav';
import { authenticatedUser } from '../services/server_side/user_services.server';
import styles from '~/styles/nav.css';

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.MANAGE_USERS, Permission.MANAGE_DEVICES];
  const loggedInUser = await authenticatedUser(request, permissions);
  if (typeof loggedInUser === 'string') return redirect(loggedInUser);

  return json({ loggedInUser });
};

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: styles }];
};

const Home = () => {
  return null;
};

export default Home;
