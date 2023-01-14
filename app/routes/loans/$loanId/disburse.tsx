import type {
  Account,
  Client,
  Loan,
  LoanApplication,
  Receipt,
  User,
} from '@prisma/client'
import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import { LoanStatus, TransactionType } from '@prisma/client'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
  queryStringOptions,
} from '~/util/query-string'

import { DateTime } from 'luxon'
import Input from '~/components/form/input'
import { Permission } from '@prisma/client'
import Select from '~/components/form/select'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

type ExpandedPaymentReceipt = Awaited<
  ReturnType<typeof prisma.paymentReceipt.findUnique>
> & {
  receipt: Receipt
}

type ExpandedScheduledPayment = Awaited<
  ReturnType<typeof prisma.scheduledPayment.findUnique>
> & {
  paymentReceipts: ExpandedPaymentReceipt[]
}

type ExpandedLoan = Awaited<ReturnType<typeof prisma.loan.findUnique>> & {
  scheduledPayments: ExpandedScheduledPayment[]
  approvedBy: User
  client: Client
  loanApplication: LoanApplication
}
interface LoaderData {
  loggedInUser: User
  loan: ExpandedLoan
  assetAccounts: { value: string; label: string }[]
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.LOAN_DISBURSEMENT]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const loanId = params.loanId

  if (!loanId) return redirect(`/loans?${buildQueryStringFromRequest(request)}`)

  const loan = await prisma.loan.findUnique({
    where: {
      id: loanId,
    },
    include: {
      client: true,
      approvedBy: true,
      loanApplication: true,
      scheduledPayments: {
        include: {
          paymentReceipts: {
            include: {
              receipt: true,
            },
          },
        },
      },
    },
  })

  if (!loan) return redirect(`/loans?${buildQueryStringFromRequest(request)}`)

  const assetAccounts = (
    await prisma.account.findMany({
      where: {
        accountType: 'CASH',
      },
    })
  ).map((account: Account) => {
    return {
      value: account.id,
      label: account.name,
    }
  })

  return json<LoaderData>({ loggedInUser, loan, assetAccounts })
}

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [Permission.LOAN_DISBURSEMENT]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const serverValidator = withZod(schema)

  const data = await serverValidator.validate(await request.formData())

  if (data.error) {
    return validationError(data.error)
  }

  const loanId = params.loanId

  const loan = await prisma.loan.findUnique({
    where: {
      id: loanId,
    },
  })

  if (!loan) return redirect(`/loans?${buildQueryStringFromRequest(request)}`)

  const {
    account1,
    account1Amount,
    account2,
    account2Amount,
    account3,
    account3Amount,
  } = data.data

  const totalAmount =
    Number(account1Amount) + Number(account2Amount) + Number(account3Amount)
  const loanAmount = loan.amount

  if (totalAmount !== loanAmount) {
    let fieldErrors: any = {}
    fieldErrors[
      'account1Amount'
    ] = `The amounts must add up to $${loanAmount.toLocaleString('en-US')}`
    if (account2Amount)
      fieldErrors[
        'account2Amount'
      ] = `The amounts must add up to $${loanAmount.toLocaleString('en-US')}`
    if (account3Amount)
      fieldErrors[
        'account3Amount'
      ] = `The amounts must add up to $${loanAmount.toLocaleString('en-US')}`

    return validationError({ fieldErrors })
  }

  await prisma.loan.update({
    where: {
      id: loanId,
    },
    data: {
      actualDisbursementDate: DateTime.now().toISO(),
      disbursedBy: {
        connect: {
          id: loggedInUser.id,
        },
      },
      status: LoanStatus.ACTIVE,
    },
  })

  const loanControlAccount = await prisma.account.findFirst({
    where: {
      name: 'Loan Control',
    },
  })

  const recordPayout = async (accountId: string, amount: number) => {
    const transaction = await prisma.transaction.create({
      data: {
        amount,
        activityType: TransactionType.DISBURSEMENT,
        activityId: loan.id,
        date: DateTime.now().toISO(),
        debitAccount: {
          connect: {
            id: loanControlAccount!.id,
          },
        },
        creditAccount: {
          connect: {
            id: accountId,
          },
        },
      },
    })

    await prisma.account.update({
      where: {
        id: accountId,
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
        id: loanControlAccount!.id,
      },
      data: {
        debits: {
          connect: {
            id: transaction.id,
          },
        },
      },
    })
  }

  const recordUnearnedInterest = async (loan: Loan) => {
    const { initialUnearnedInterest } = loan

    const unearnedInterestAccount = await prisma.account.findFirst({
      where: {
        name: 'Unearned Interest',
      },
    })

    const transaction = await prisma.transaction.create({
      data: {
        amount: initialUnearnedInterest,
        activityType: TransactionType.DISBURSEMENT,
        activityId: loan.id,
        date: DateTime.now().toISO(),
        debitAccount: {
          connect: {
            id: loanControlAccount!.id,
          },
        },
        creditAccount: {
          connect: {
            id: unearnedInterestAccount!.id,
          },
        },
      },
    })

    await prisma.account.update({
      where: {
        id: unearnedInterestAccount!.id,
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
        id: loanControlAccount!.id,
      },
      data: {
        debits: {
          connect: {
            id: transaction.id,
          },
        },
      },
    })
  }

  if (account1Amount) {
    await recordPayout(account1, Number(account1Amount))
  }
  if (account2Amount) {
    await recordPayout(account2, Number(account2Amount))
  }
  if (account3Amount) {
    await recordPayout(account3, Number(account3Amount))
  }

  await recordUnearnedInterest(loan)

  return redirect(`/loans/?${buildQueryStringFromRequest(request)}`)
}

const schema = z.object({
  account1: z.string().min(1, { message: 'Please select an account' }),
  account1Amount: z.string().refine((val) => !Number.isNaN(Number(val)), {
    message: 'Please enter a valid amount',
  }),
  account2: z.string().min(1, { message: 'Please select an account' }),
  account2Amount: z.string().refine((val) => !Number.isNaN(Number(val)), {
    message: 'Please enter a valid amount',
  }),
  account3: z.string().min(1, { message: 'Please select an account' }),
  account3Amount: z.string().refine((val) => !Number.isNaN(Number(val)), {
    message: 'Please enter a valid amount',
  }),
})

export const clientValidator = withZod(schema)

const DisburseLoan = () => {
  const { loan: ln, loggedInUser, assetAccounts } = useLoaderData<LoaderData>()

  const loan = ln as unknown as ExpandedLoan
  const client = loan.client

  const [searchParams] = useSearchParams()

  const getNextDueDate = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments

    const balanceByScheduledPayment = scheduledPayments.map(
      (scheduledPayment) => {
        const paymentReceipts = scheduledPayment.paymentReceipts

        const totalPaid = paymentReceipts.reduce((acc, curr) => {
          return acc + curr.amount
        }, 0)

        return {
          scheduledPayment,
          balance: scheduledPayment.amount - totalPaid,
        }
      }
    )

    const nextDueDate = balanceByScheduledPayment.filter(
      (scheduledPayment) => scheduledPayment.balance > 0
    )[0]?.scheduledPayment?.dueDate

    if (!nextDueDate) return 'N/A'

    return typeof nextDueDate === 'string'
      ? DateTime.fromISO(nextDueDate).toLocaleString()
      : DateTime.fromJSDate(nextDueDate).toLocaleString()
  }

  const getMaturityDate = (loan: ExpandedLoan) => {
    const sd =
      typeof loan.loanStartDate === 'string'
        ? DateTime.fromISO(loan.loanStartDate)
        : DateTime.fromJSDate(loan.loanStartDate)

    return sd
      .plus({
        months: loan.numPayments,
      })
      .toLocaleString()
  }

  const getInterestRate = (loan: ExpandedLoan) => {
    return `${loan.interestRate}%`
  }

  const getTotalInterest = (loan: ExpandedLoan) => {
    return loan.numPayments * loan.dueMonthly - loan.amount
  }

  const getTotalLoanAmountt = (loan: ExpandedLoan) => {
    return loan.numPayments * loan.dueMonthly
  }

  return (
    <div className="flex flex-col w-full p-4 mt-10 space-y-6 border border-gray-200 rounded-lg shadow-md bg-slate-50 sm:p-6 md:p-8 text-slate-900">
      <div className="flex w-full space-x-6">
        <div className="w-5/12 text-sm">
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Client Name</div>
            <div className="w-2/3 font-semibold">
              <Link
                to={`/clients/${client.id}?${buildQueryStringFromSearchParams(
                  searchParams
                )}`}
                className="font-semibold text-blue-500 cursor-pointer"
              >
                <div>{client.name}</div>
              </Link>
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Client Number</div>
            <div className="w-2/3 font-semibold">
              <Link
                to={`/clients/${client.id}?${buildQueryStringFromSearchParams(
                  searchParams
                )}`}
                className="font-semibold text-blue-500 cursor-pointer"
              >
                <div>{client.clientNum}</div>
              </Link>
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Loan Number</div>
            <div className="w-2/3 font-semibold">{loan.loanNum}</div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Application Number</div>
            <div className="w-2/3 font-semibold">
              <Link
                to={`/loans/applications/${
                  loan.loanApplication.id
                }?${buildQueryStringFromSearchParams(searchParams)}`}
                className="font-semibold text-blue-500 cursor-pointer"
              >
                <div>{loan.loanApplication.applicationNum}</div>
              </Link>
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Loan Amount</div>
            <div className="w-2/3 font-semibold">
              {`$${loan.amount.toLocaleString('en-US')}`}
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Monthly Pmt</div>
            <div className="w-2/3 font-semibold">
              {`$${loan.dueMonthly.toLocaleString('en-US')}`}
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">First Due</div>
            <div className="w-2/3 font-semibold">{getNextDueDate(loan)}</div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Maturity Date</div>
            <div className="w-2/3 font-semibold">{getMaturityDate(loan)}</div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Interest Rate</div>
            <div className="w-2/3 font-semibold">{getInterestRate(loan)}</div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Total Interest</div>
            <div className="w-2/3 font-semibold">
              {`$${getTotalInterest(loan).toLocaleString('en-US')}`}
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Total</div>
            <div className="w-2/3 font-semibold">
              {`$${getTotalLoanAmountt(loan).toLocaleString('en-US')}`}
            </div>
          </div>
        </div>

        <div className="flex-col w-7/12 text-sm">
          <ValidatedForm method="post" validator={clientValidator}>
            <div className="flex flex-col w-full p-4 border border-gray-200 rounded-lg shadow-md bg-slate-300 sm:p-6 md:p-8">
              <h3 className="mb-6 grow-down">Select Sources...</h3>
              <div className="flex flex-col w-full space-y-4">
                <div className="flex w-full space-x-4">
                  <div className="w-1/2">
                    <Select
                      name={'account1'}
                      label={'Account'}
                      options={assetAccounts}
                    />
                  </div>

                  <div className="w-1/2">
                    <Input name={'account1Amount'} label={'Amount'} />
                  </div>
                </div>

                <div className="flex w-full space-x-4">
                  <div className="w-1/2">
                    <Select
                      name={'account2'}
                      label={''}
                      options={assetAccounts}
                    />
                  </div>

                  <div className="w-1/2">
                    <Input name={'account2Amount'} label={''} />
                  </div>
                </div>

                <div className="flex w-full space-x-4">
                  <div className="w-1/2">
                    <Select
                      name={'account3'}
                      label={''}
                      options={assetAccounts}
                    />
                  </div>

                  <div className="w-1/2">
                    <Input name={'account3Amount'} label={''} />
                  </div>
                </div>

                <div className="mt-12 ml-auto space-x-6 rounded-md shadow-sm">
                  <button
                    type="submit"
                    className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
                  >
                    <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                      Save
                    </span>
                  </button>

                  <Link
                    to={`/loans?${buildQueryStringFromSearchParams(
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
    </div>
  )
}

export default DisburseLoan
