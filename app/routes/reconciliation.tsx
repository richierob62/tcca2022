import type { LinksFunction, LoaderFunction } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { json, redirect } from '@remix-run/node'

import { Permission } from '@prisma/client'
import React from 'react'
import SecondaryNav from '../components/secondary-nav'
import { authenticatedUser } from '../services/server_side/user_services.server'
import styles from '~/styles/nav.css'

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [
    Permission.RECONCILE_MANAGE,
    Permission.RECONCILE_VIEW,
    Permission.FINANCE_ACCOUNT_DETAILS_DOWNLOAD,
    Permission.FINANCE_ACCOUNT_DETAILS_VIEW,
    Permission.FINANCE_BANK_TRANSFER,
    Permission.FINANCE_CASH_FLOW,
  ]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  return json({ loggedInUser })
}

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: styles }]
}

const Reconciliation = () => {
  const { loggedInUser } = useLoaderData()

  const { permissions } = loggedInUser

  const navLinks = [
    {
      label: 'Daily Receipts',
      href: '/reconciliation',
      hasPermission: permissions.includes(Permission.RECONCILE_VIEW),
    },
    {
      label: 'Record Transfer',
      href: '/reconciliation/transfer',
      hasPermission: permissions.includes(Permission.FINANCE_BANK_TRANSFER),
    },
    {
      label: 'Cash Flow',
      href: '/reconciliation/cash-flow',
      hasPermission: permissions.includes(Permission.FINANCE_CASH_FLOW),
    },
    {
      label: 'Loan Control',
      href: '/reconciliation/loan-control',
      hasPermission: permissions.includes(
        Permission.FINANCE_ACCOUNT_DETAILS_VIEW
      ),
    },
    {
      label: 'Unearned Interest',
      href: '/reconciliation/unearned-interest',
      hasPermission: permissions.includes(
        Permission.FINANCE_ACCOUNT_DETAILS_VIEW
      ),
    },
    {
      label: 'Loan Balances',
      href: '/reconciliation/loan-balances',
      hasPermission: permissions.includes(
        Permission.FINANCE_ACCOUNT_DETAILS_VIEW
      ),
    },
  ]

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
  )
}

export default Reconciliation
