import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { AccountType, Permission } from '@prisma/client'
import { useSearchParams } from '@remix-run/react'
import { ValidatedForm, validationError } from 'remix-validated-form'

import { defaultStartingAccountNumbers } from '~/util/constants'
import Input from '~/components/form/input'
import React from 'react'
import Select from '../../components/form/select'
import type { User } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

interface LoaderData {
  loggedInUser: User
}

const schema = z.object({
  name: z
    .string()
    .min(1, { message: 'Please enter the a name for the account' }),
  accountType: z.nativeEnum(AccountType, {
    errorMap: (issue, ctx) => {
      return { message: 'Please select a valid account type' }
    },
  }),
})

export const clientValidator = withZod(schema)

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.CREATE_ACCOUNT]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  return json<LoaderData>({ loggedInUser })
}

export const action: ActionFunction = async ({ request }) => {
  const permissions = [
    Permission.CLIENT_UPDATE_BASIC,
    Permission.CLIENT_UPDATE_ADVANCED,
  ]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const serverValidator = withZod(
    schema.refine(
      async (data) => {
        const foundAccount = await prisma.account.findFirst({
          where: {
            name: data.name,
          },
        })
        return !foundAccount
      },
      {
        message: 'That name has already been used',
        path: ['name'],
      }
    )
  )

  const data = await serverValidator.validate(await request.formData())

  if (data.error) {
    return validationError(data.error)
  }

  const { name, accountType } = data.data

  const getNextAccountNumber = async () => {
    const lastAccount = await prisma.account.findFirst({
      where: {
        accountType,
      },
      orderBy: {
        accountNum: 'desc',
      },
    })
    if (!lastAccount) return defaultStartingAccountNumbers[accountType]
    return `${parseInt(lastAccount.accountNum, 10) + 1}`
  }

  await prisma.account.create({
    data: {
      name,
      accountNum: await getNextAccountNumber(),
      accountType,
    },
  })

  return null
}

const CreateAccount = () => {
  const [searchParams] = useSearchParams()

  const options = [
    { value: '', label: 'Please select one...' },
    { value: AccountType.CASH, label: 'Cash' },
    { value: AccountType.OTHER_ASSET, label: 'Other Asset' },
    { value: AccountType.LIABILITY, label: 'Liability' },
    { value: AccountType.REVENUE, label: 'Revenue' },
    { value: AccountType.EXPENSE, label: 'Expense' },
  ]

  return (
    <ValidatedForm
      method="post"
      validator={clientValidator}
      resetAfterSubmit={true}
    >
      <div className="flex flex-col w-full p-4 mt-10 border border-gray-200 rounded-lg shadow-md bg-slate-300 sm:p-6 md:p-8">
        <h3 className="mb-6 grow-down">New Account...</h3>
        <div className="flex w-full space-x-12">
          <div className="w-1/3 space-y-4">
            <Input name={'name'} label={'Name'} />
            <Select name={'accountType'} label={'Type'} options={options} />

            <button
              type="submit"
              className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
            >
              <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                Save
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* insert hidden inputs for search params */}
      {Object.entries(searchParams).map(([key, value]) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={value}
          readOnly
          aria-hidden
        />
      ))}
    </ValidatedForm>
  )
}

export default CreateAccount
