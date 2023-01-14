import type { LinksFunction, LoaderFunction } from '@remix-run/node'
import { Outlet, useLoaderData, useParams } from '@remix-run/react'
import { Permission, User } from '@prisma/client'
import { json, redirect } from '@remix-run/node'

import React from 'react'
import SecondaryNav from '../components/secondary-nav'
import { authenticatedUser } from '../services/server_side/user_services.server'
import styles from '~/styles/nav.css'

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.RECEIPT_VIEW, Permission.RECEIPT_CREATE]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  return json({ loggedInUser })
}

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: styles }]
}

const Payments = () => {
  const { loggedInUser } = useLoaderData()

  const { permissions } = loggedInUser

  const { receiptId } = useParams()

  const navLinks = [
    {
      label: 'Payments Summary',
      href: '/payments',
      hasPermission: permissions.includes(Permission.RECEIPT_VIEW),
    },
    {
      label: 'Record Payment',
      href: '/payments/new-payment',
      hasPermission: permissions.includes(Permission.RECEIPT_CREATE),
    },
    {
      label: 'Payment Receipt',
      href: receiptId ? `/payments/${receiptId}` : '',
      hasPermission:
        permissions.includes(Permission.RECEIPT_CREATE) ||
        permissions.includes(Permission.RECEIPT_VIEW),
    },
  ]

  return (
    <>
      <nav className="bg-white border-gray-200 px-2 rounded">
        <div className="container flex flex-wrap items-center justify-between mx-auto">
          <div className="w-full" id="navbar-default">
            <ul className="flex flex-row justify-start space-x-2 py-3 mt-0 text-sm font-medium border-0 border-gray-100 rounded-lg bg-gray-50 ">
              {navLinks.map((link) => (
                <SecondaryNav key={link.label} link={link} />
              ))}
            </ul>
          </div>
        </div>
      </nav>

      <Outlet />
    </>
  )
}

export default Payments
