import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { Link, useSearchParams } from '@remix-run/react'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
  queryStringOptions,
} from '~/util/query-string'

import CheckboxGroup from '../../components/form/checkbox-group'
import Input from '~/components/form/input'
import { Permission } from '@prisma/client'
import React from 'react'
import type { User } from '@prisma/client'
import { auth } from '~/auth.server'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'
import { zfd } from 'zod-form-data'

interface LoaderData {
  loggedInUser: User
}

const schema = z
  .object({
    name: z.string().min(1, { message: "Please enter the user's name" }),
    email: z
      .string()
      .min(1, { message: 'An email is required' })
      .email('Must be a valid email address'),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, { message: 'Use a password of at least 8 letters' }),
    passwordConfirm: z.string(),
    permissions: zfd.repeatable(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  })

export const clientValidator = withZod(schema)

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.MANAGE_USERS]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  return json<LoaderData>({ loggedInUser })
}

export const action: ActionFunction = async ({ request }) => {
  const permissions = [Permission.MANAGE_USERS]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const serverValidator = withZod(
    schema.refine(
      async (data) => {
        const foundEmail = await prisma.user.findFirst({
          where: {
            email: data.email,
          },
        })
        return !foundEmail
      },
      {
        message: 'That email has already been registered',
        path: ['email'],
      }
    )
  )

  const data = await serverValidator.validate(await request.formData())

  if (data.error) return validationError(data.error)

  const {
    name,
    email,
    phone,
    password,
    permissions: userPermissions,
  } = data.data

  const res = await (
    await auth.createAccount({ username: email, password })
  ).json()

  const firebaseId = res.user?.uid
  if (!firebaseId) {
    throw new Error('No firebaseId returned from auth.createAccount')
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      firebaseId,
      status: 'ACTIVE',
      permissions: userPermissions,
    },
  })

  return redirect(
    `/permissions/${user.id}?${buildQueryStringFromRequest(request)}`
  )
}

const CreateUser = () => {
  const [searchParams] = useSearchParams()

  return (
    <ValidatedForm method="post" validator={clientValidator}>
      <div className="flex flex-col w-full p-4 mt-10 border border-gray-200 rounded-lg shadow-md bg-slate-300 sm:p-6 md:p-8">
        <h3 className="mb-6 grow-down">New User...</h3>

        <div className="flex w-full space-x-12">
          <div className="w-1/4 space-y-4">
            <Input name={'name'} label={'Name'} />

            <Input name={'email'} type={'email'} label={'Email'} />

            <Input name={'phone'} label={'Phone'} />

            <Input name={'password'} type={'password'} label={'Password'} />

            <Input
              name={'passwordConfirm'}
              type={'password'}
              label={'Retype the same password'}
            />
          </div>

          <div className="w-1/4 space-y-4">
            <CheckboxGroup
              label={'clients'}
              checkboxes={[
                {
                  label: 'View Clients',
                  name: 'permissions',
                  value: Permission.CLIENT_VIEW,
                },
                {
                  label: 'Update Clients - Basic',
                  name: 'permissions',
                  value: Permission.CLIENT_UPDATE_BASIC,
                },
                {
                  label: 'Update Clients - Advanced',
                  name: 'permissions',
                  value: Permission.CLIENT_UPDATE_ADVANCED,
                },
                {
                  label: 'Record Customer Calls',
                  name: 'permissions',
                  value: Permission.CALL_LOG,
                },
              ]}
            />

            <CheckboxGroup
              label={'payments'}
              checkboxes={[
                {
                  label: 'View Payments / Receipts',
                  name: 'permissions',
                  value: Permission.RECEIPT_VIEW,
                },
                {
                  label: 'Record Payments',
                  name: 'permissions',
                  value: Permission.RECEIPT_CREATE,
                },
              ]}
            />
          </div>

          <div className="w-1/4 space-y-4">
            <CheckboxGroup
              label={'Applications'}
              checkboxes={[
                {
                  label: 'View Applications',
                  name: 'permissions',
                  value: Permission.APPLICATION_LIST,
                },
                {
                  label: 'Enter New Applications',
                  name: 'permissions',
                  value: Permission.APPLICATION_CREATE,
                },
                {
                  label: 'Approve/Deny Applications',
                  name: 'permissions',
                  value: Permission.APPLICATION_DECISION,
                },
              ]}
            />
            <CheckboxGroup
              label={'loans'}
              checkboxes={[
                {
                  label: 'View Loans',
                  name: 'permissions',
                  value: Permission.LOAN_LIST,
                },
                {
                  label: 'Disburse Loans',
                  name: 'permissions',
                  value: Permission.LOAN_DISBURSEMENT,
                },
                {
                  label: 'Adjust Loan Balances',
                  name: 'permissions',
                  value: Permission.LOAN_ADJUSTMENT,
                },
              ]}
            />
          </div>

          <div className="w-1/4 space-y-4">
            <CheckboxGroup
              label={'Reconciliation'}
              checkboxes={[
                {
                  label: 'View Recon Summary',
                  name: 'permissions',
                  value: Permission.RECONCILE_VIEW,
                },
                {
                  label: 'Manage Reconciliation',
                  name: 'permissions',
                  value: Permission.RECONCILE_MANAGE,
                },
              ]}
            />
            <CheckboxGroup
              label={'financials'}
              checkboxes={[
                {
                  label: 'Cash Flow',
                  name: 'permissions',
                  value: Permission.FINANCE_CASH_FLOW,
                },
                {
                  label: 'Record Bank Transfer',
                  name: 'permissions',
                  value: Permission.FINANCE_BANK_TRANSFER,
                },
                {
                  label: 'View Financials',
                  name: 'permissions',
                  value: Permission.FINANCE_ACCOUNT_DETAILS_VIEW,
                },
                {
                  label: 'Download Financials',
                  name: 'permissions',
                  value: Permission.FINANCE_ACCOUNT_DETAILS_DOWNLOAD,
                },
              ]}
            />
            <CheckboxGroup
              label={'Permissions'}
              checkboxes={[
                {
                  label: 'Manage Users',
                  name: 'permissions',
                  value: Permission.MANAGE_USERS,
                },
                {
                  label: 'Manage Devices',
                  name: 'permissions',
                  value: Permission.MANAGE_DEVICES,
                },
              ]}
            />
          </div>
        </div>

        <div className="mt-12 ml-auto space-x-6 rounded-md shadow-sm">
          <button className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800">
            <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
              Save
            </span>
          </button>

          <Link
            to={`/permissions?${buildQueryStringFromSearchParams(
              searchParams
            )}`}
            className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-pink-500 to-orange-400 group-hover:from-pink-500 group-hover:to-orange-400 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-pink-200 dark:focus:ring-pink-800"
          >
            <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
              Cancel
            </span>
          </Link>
        </div>
      </div>

      {queryStringOptions.map((option, idx) => {
        return (
          <input
            type="hidden"
            key={idx}
            name={option}
            value={searchParams.get(option) || undefined}
            readOnly
            aria-hidden
          />
        )
      })}
    </ValidatedForm>
  )
}

export default CreateUser
