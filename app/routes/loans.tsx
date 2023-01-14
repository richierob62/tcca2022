import type { LinksFunction, LoaderFunction } from '@remix-run/node'
import { Outlet, useLoaderData, useParams } from '@remix-run/react'
import { json, redirect } from '@remix-run/node'

import { Permission } from '@prisma/client'
import React from 'react'
import SecondaryNav from '../components/secondary-nav'
import { authenticatedUser } from '../services/server_side/user_services.server'
import styles from '~/styles/nav.css'

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [
    Permission.CLIENT_UPDATE_ADVANCED,
    Permission.CLIENT_UPDATE_BASIC,
    Permission.CLIENT_VIEW,
  ]

  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  return json({ loggedInUser })
}

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: styles }]
}

const Loans = () => {
  const { loggedInUser } = useLoaderData()

  const { permissions } = loggedInUser

  const { scheduledPaymentId, loanId, applicationId } = useParams()

  const navLinks = [
    {
      label: 'Loans',
      href: '/loans',
      hasPermission: permissions.includes(Permission.LOAN_LIST),
    },
    {
      label: 'Loan Details',
      href: loanId ? `/loans/${loanId}` : '',
      hasPermission: permissions.includes(Permission.LOAN_LIST),
    },
    {
      label: 'Applications',
      href: '/loans/applications',
      hasPermission: permissions.includes(Permission.APPLICATION_LIST),
    },
    {
      label: 'New Application',
      href: '/loans/applications/new',
      hasPermission: permissions.includes(Permission.APPLICATION_CREATE),
    },
    {
      label: 'Application Detail',
      href: applicationId ? `/loans/applications/${applicationId}` : '',
      hasPermission: permissions.includes(Permission.APPLICATION_LIST),
    },
    {
      label: 'Scheduled Pmts',
      href: '/loans/scheduled-payments',
      hasPermission: permissions.includes(Permission.CALL_LOG),
    },
    {
      label: 'Call Log',
      href: scheduledPaymentId
        ? `/loans/scheduled-payments/${scheduledPaymentId}/calls`
        : '',
      hasPermission: permissions.includes(Permission.CALL_LOG),
    },
    {
      label: 'Payments',
      href: loanId ? `/loans/${loanId}/payments` : '',
      hasPermission: permissions.includes(Permission.RECEIPT_VIEW),
    },
    {
      label: 'Adjustments',
      href: loanId ? `/loans/${loanId}/adjustments` : '',
      hasPermission: permissions.includes(Permission.LOAN_ADJUSTMENT),
    },
  ]

  return (
    <>
      <nav className="px-2 bg-white border-gray-200 rounded">
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

export default Loans
