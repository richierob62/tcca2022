import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
} from '~/util/query-string'

import CheckboxGroup from '~/components/form/checkbox-group'
import DisplayInput from '~/components/form/display-input'
import type { LoaderFunction } from '@remix-run/node'
import { Permission } from '@prisma/client'
import React from 'react'
import type { User } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'

interface LoaderData {
  loggedInUser: User
  user: User
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.MANAGE_USERS]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const userId = params.userId

  if (!userId)
    return redirect(`/permissions?${buildQueryStringFromRequest(request)}`)

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  })

  if (!user)
    return redirect(`/permissions?${buildQueryStringFromRequest(request)}`)

  return json({ loggedInUser, user })
}

const UserProfile = () => {
  const { user } = useLoaderData<LoaderData>()

  const [searchParams] = useSearchParams()

  const isChecked = (permission: Permission): boolean =>
    user.permissions.includes(permission)

  return (
    <div className="flex flex-col w-full p-4 mt-10 space-y-6 bg-gray-100 border border-gray-200 rounded-lg shadow-md sm:p-6 md:p-8">
      <div className="flex w-full space-x-12">
        <div className="w-1/4 space-y-4">
          <DisplayInput name={'name'} label={'Name'} value={user.name} />
          <DisplayInput name={'email'} label={'Email'} value={user.email} />
          <DisplayInput
            name={'phone'}
            label={'Phone'}
            value={user.phone || ''}
          />
          <DisplayInput name={'status'} label={'Status'} value={user.status} />
        </div>

        <div className="w-1/4 space-y-4">
          <CheckboxGroup
            label={'clients'}
            displayOnly={true}
            checkboxes={[
              {
                label: 'View Clients',
                name: Permission.CLIENT_VIEW,
                value: Permission.CLIENT_VIEW,
                checked: isChecked(Permission.CLIENT_VIEW),
              },
              {
                label: 'Update Clients - Basic',
                name: Permission.CLIENT_UPDATE_BASIC,
                value: Permission.CLIENT_UPDATE_BASIC,
                checked: isChecked(Permission.CLIENT_UPDATE_BASIC),
              },
              {
                label: 'Update Clients - Advanced',
                name: Permission.CLIENT_UPDATE_ADVANCED,
                value: Permission.CLIENT_UPDATE_ADVANCED,
                checked: isChecked(Permission.CLIENT_UPDATE_ADVANCED),
              },
              {
                label: 'Record Customer Calls',
                name: Permission.CALL_LOG,
                value: Permission.CALL_LOG,
                checked: isChecked(Permission.CALL_LOG),
              },
            ]}
          />
          <CheckboxGroup
            label={'payments'}
            displayOnly={true}
            checkboxes={[
              {
                label: 'View Payments / Receipts',
                name: Permission.RECEIPT_VIEW,
                value: Permission.RECEIPT_VIEW,
                checked: isChecked(Permission.RECEIPT_VIEW),
              },
              {
                label: 'Record Payments',
                name: Permission.RECEIPT_CREATE,
                value: Permission.RECEIPT_CREATE,
                checked: isChecked(Permission.RECEIPT_CREATE),
              },
            ]}
          />
        </div>

        <div className="w-1/4 space-y-4">
          <CheckboxGroup
            label={'Applications'}
            displayOnly={true}
            checkboxes={[
              {
                label: 'View Applications',
                name: Permission.APPLICATION_LIST,
                value: Permission.APPLICATION_LIST,
                checked: isChecked(Permission.APPLICATION_LIST),
              },
              {
                label: 'Enter New Applications',
                name: Permission.APPLICATION_CREATE,
                value: Permission.APPLICATION_CREATE,
                checked: isChecked(Permission.APPLICATION_CREATE),
              },
              {
                label: 'Approve/Deny Applications',
                name: Permission.APPLICATION_DECISION,
                value: Permission.APPLICATION_DECISION,
                checked: isChecked(Permission.APPLICATION_DECISION),
              },
            ]}
          />
          <CheckboxGroup
            label={'loans'}
            displayOnly={true}
            checkboxes={[
              {
                label: 'View Loans',
                name: Permission.LOAN_LIST,
                value: Permission.LOAN_LIST,
                checked: isChecked(Permission.LOAN_LIST),
              },
              {
                label: 'Disburse Loans',
                name: Permission.LOAN_DISBURSEMENT,
                value: Permission.LOAN_DISBURSEMENT,
                checked: isChecked(Permission.LOAN_DISBURSEMENT),
              },
              {
                label: 'Adjust Loan Balances',
                name: Permission.LOAN_ADJUSTMENT,
                value: Permission.LOAN_ADJUSTMENT,
                checked: isChecked(Permission.LOAN_ADJUSTMENT),
              },
            ]}
          />
        </div>

        <div className="w-1/4 space-y-4">
          <CheckboxGroup
            label={'Reconciliation'}
            displayOnly={true}
            checkboxes={[
              {
                label: 'View Recon Summary',
                name: Permission.RECONCILE_VIEW,
                value: Permission.RECONCILE_VIEW,
                checked: isChecked(Permission.RECONCILE_VIEW),
              },
              {
                label: 'Manage Reconciliation',
                name: Permission.RECONCILE_MANAGE,
                value: Permission.RECONCILE_MANAGE,
                checked: isChecked(Permission.RECONCILE_MANAGE),
              },
            ]}
          />
          <CheckboxGroup
            label={'financials'}
            displayOnly={true}
            checkboxes={[
              {
                label: 'Cash Flow',
                name: Permission.FINANCE_CASH_FLOW,
                value: Permission.FINANCE_CASH_FLOW,
                checked: isChecked(Permission.FINANCE_CASH_FLOW),
              },
              {
                label: 'Record Bank Transfer',
                name: Permission.FINANCE_BANK_TRANSFER,
                value: Permission.FINANCE_BANK_TRANSFER,
                checked: isChecked(Permission.FINANCE_BANK_TRANSFER),
              },
              {
                label: 'View Financials',
                name: Permission.FINANCE_ACCOUNT_DETAILS_VIEW,
                value: Permission.FINANCE_ACCOUNT_DETAILS_VIEW,
                checked: isChecked(Permission.FINANCE_ACCOUNT_DETAILS_VIEW),
              },
              {
                label: 'Download Financials',
                name: Permission.FINANCE_ACCOUNT_DETAILS_DOWNLOAD,
                value: Permission.FINANCE_ACCOUNT_DETAILS_DOWNLOAD,
                checked: isChecked(Permission.FINANCE_ACCOUNT_DETAILS_DOWNLOAD),
              },
            ]}
          />
          <CheckboxGroup
            label={'Permissions'}
            displayOnly={true}
            checkboxes={[
              {
                label: 'Manage Users',
                name: Permission.MANAGE_USERS,
                value: Permission.MANAGE_USERS,
                checked: isChecked(Permission.MANAGE_USERS),
              },
              {
                label: 'Manage Devices',
                name: Permission.MANAGE_DEVICES,
                value: Permission.MANAGE_DEVICES,
                checked: isChecked(Permission.MANAGE_DEVICES),
              },
            ]}
          />
        </div>
      </div>

      <Link
        to={`/permissions/${user.id}/edit?${buildQueryStringFromSearchParams(
          searchParams
        )}`}
        className="relative w-36 flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
      >
        <span className="text-center w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
          Edit Profile
        </span>
      </Link>
    </div>
  )
}

export default UserProfile
