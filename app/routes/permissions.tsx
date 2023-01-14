import type { LinksFunction, LoaderFunction } from '@remix-run/node'
import { Outlet, useLoaderData, useParams } from '@remix-run/react'
import { json, redirect } from '@remix-run/node'

import { Permission } from '@prisma/client'
import React from 'react'
import SecondaryNav from '../components/secondary-nav'
import { authenticatedUser } from '../services/server_side/user_services.server'
import styles from '~/styles/nav.css'

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.MANAGE_USERS, Permission.MANAGE_DEVICES]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  return json({ loggedInUser })
}

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: styles }]
}

const AccessManager = () => {
  const { loggedInUser } = useLoaderData()

  const { permissions } = loggedInUser

  const { userId } = useParams()

  const navLinks = [
    {
      label: 'User List',
      href: '/permissions',
      hasPermission: permissions.includes(Permission.MANAGE_USERS),
    },
    {
      label: 'User Profile',
      href: userId ? `/permissions/${userId}` : '',
      hasPermission: permissions.includes(Permission.MANAGE_USERS),
      end: false,
    },
    {
      label: 'New User',
      href: '/permissions/new',
      hasPermission: permissions.includes(Permission.MANAGE_USERS),
    },
    {
      label: 'Device List',
      href: '/permissions/devices',
      hasPermission: permissions.includes(Permission.MANAGE_DEVICES),
    },
    {
      label: 'New Device',
      href: '/permissions/devices/new',
      hasPermission: permissions.includes(Permission.MANAGE_DEVICES),
    },
  ]

  return (
    <>
      <nav className="bg-white border-gray-200 px-2 rounded">
        <div className="container flex flex-wrap items-center justify-between mx-auto">
          <div className="w-full" id="navbar-default">
            <ul className="flex flex-row justify-start space-x-2 py-3 mt-0 text-sm font-medium border-0 border-gray-100 rounded-lg bg-gray-50 ">
              {navLinks.map((link) => (
                <SecondaryNav key={link.href} link={link} />
              ))}
            </ul>
          </div>
        </div>
      </nav>

      <Outlet />
    </>
  )
}

export default AccessManager
