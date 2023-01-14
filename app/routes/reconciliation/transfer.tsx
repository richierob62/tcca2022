import type { Account, User } from '@prisma/client'
import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
  queryStringOptions,
} from '~/util/query-string'

import { DateTime } from 'luxon'
import Input from '~/components/form/input'
import ObjectId from 'bson-objectid'
import { Permission } from '@prisma/client'
import Select from '~/components/form/select'
import { TransactionType } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

interface LoaderData {
  loggedInUser: User
  assetAccounts: { value: string; label: string }[]
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.FINANCE_BANK_TRANSFER]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const assetAccounts = (
    await prisma.account.findMany({
      where: {
        accountType: 'CASH',
        name: {
          not: 'Unreconciled Receipts',
        },
      },
    })
  ).map((account: Account) => {
    return {
      value: account.id,
      label: account.name,
    }
  })

  return json<LoaderData>({ loggedInUser, assetAccounts })
}

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [Permission.FINANCE_BANK_TRANSFER]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const serverValidator = withZod(schema)

  const data = await serverValidator.validate(await request.formData())

  if (data.error) {
    return validationError(data.error)
  }

  const { fromAccount, toAccount, amount: a } = data.data

  const amount = Number(a)

  const creditAccount = await prisma.account.findFirst({
    where: {
      id: fromAccount,
    },
  })

  const debitAccount = await prisma.account.findFirst({
    where: {
      id: toAccount,
    },
  })

  const transaction = await prisma.transaction.create({
    data: {
      amount,
      activityType: TransactionType.TRANSFER,
      activityId: new ObjectId().toHexString(),
      date: DateTime.now().toISO(),
      debitAccount: {
        connect: {
          id: debitAccount!.id,
        },
      },
      creditAccount: {
        connect: {
          id: creditAccount!.id,
        },
      },
    },
  })

  await prisma.account.update({
    where: {
      id: creditAccount!.id,
    },
    data: {
      credits: {
        connect: {
          id: transaction.id,
        },
      },
    },
  })

  await prisma.account.update({
    where: {
      id: debitAccount!.id,
    },
    data: {
      debits: {
        connect: {
          id: transaction.id,
        },
      },
    },
  })

  return redirect(`/reconciliation/?${buildQueryStringFromRequest(request)}`)
}

const schema = z.object({
  fromAccount: z.string().min(1, { message: 'Please select an account' }),
  toAccount: z.string().min(1, { message: 'Please select an account' }),
  amount: z.string().refine((val) => !Number.isNaN(Number(val)), {
    message: 'Please enter a valid amount',
  }),
})

export const clientValidator = withZod(schema)

const Transfer = () => {
  const { assetAccounts } = useLoaderData<LoaderData>()

  const [searchParams] = useSearchParams()

  return (
    <div className="flex flex-col w-1/2 p-4 mt-10 border border-gray-200 rounded-lg shadow-md bg-slate-50 sm:p-6 md:p-8 text-slate-900">
      <div className="flex w-full text-sm">
        <ValidatedForm
          method="post"
          validator={clientValidator}
          className="w-full flex flex-col"
        >
          <div className="flex w-full space-x-4">
            <div className="w-1/3">
              <Select
                name={'fromAccount'}
                label={'Transfer From'}
                options={assetAccounts}
              />
            </div>
            <div className="w-1/3">
              <Select
                name={'toAccount'}
                label={'Transfer To'}
                options={assetAccounts}
              />
            </div>
            <div className="w-1/3">
              <Input name={'amount'} label={'Amount'} />
            </div>
          </div>

          <div className="mt-8 ml-auto space-x-6 rounded-md shadow-sm">
            <button
              type="submit"
              className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
            >
              <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                Save
              </span>
            </button>

            <Link
              to={`/reconciliation?${buildQueryStringFromSearchParams(
                searchParams
              )}`}
              className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-pink-500 to-orange-400 group-hover:from-pink-500 group-hover:to-orange-400 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-pink-200 dark:focus:ring-pink-800"
            >
              <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                Cancel
              </span>
            </Link>
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
      </div>
    </div>
  )
}

export default Transfer
