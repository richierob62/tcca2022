import type {
  Client,
  LoanAdjustment,
  LoanApplication,
  Receipt,
  User,
} from '@prisma/client'
import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
} from '~/util/query-string'

import { DateTime } from 'luxon'
import type { LoaderFunction } from '@remix-run/node'
import LoanDetailsTable from '~/components/loan-details-table'
import { Permission } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'

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

export type ExpandedLoan = Awaited<
  ReturnType<typeof prisma.loan.findUnique>
> & {
  scheduledPayments: ExpandedScheduledPayment[]
  loanAdjustments: Awaited<ReturnType<typeof prisma.loanAdjustment.findMany>>
  approvedBy: User
  client: Client
  loanApplication: LoanApplication
}

export type ExpandedTransaction = Awaited<
  ReturnType<typeof prisma.transaction.findUnique>
> & {
  debitAccount: Awaited<ReturnType<typeof prisma.account.findUnique>>
  creditAccount: Awaited<ReturnType<typeof prisma.account.findUnique>>
}

interface LoaderData {
  loggedInUser: User
  loan: ExpandedLoan
  transactions: ExpandedTransaction[]
  receipts: Receipt[]
  adjustments: LoanAdjustment[]
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [
    Permission.LOAN_LIST,
    Permission.LOAN_DISBURSEMENT,
    Permission.LOAN_ADJUSTMENT,
  ]
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
      loanAdjustments: true,
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

  const receipts = loan.scheduledPayments
    .map((scheduledPayment) => scheduledPayment.paymentReceipts)
    .flat()
    .map((paymentReceipt) => paymentReceipt.receipt)

  const receiptIds = receipts.map((receipt) => receipt.id)

  const adjustments = loan.loanAdjustments

  const adjustmentIds = adjustments.map((adj) => adj.id)

  const transactions = await prisma.transaction.findMany({
    where: {
      activityId: { in: [loan.id, ...receiptIds, ...adjustmentIds] },
    },
    include: {
      debitAccount: true,
      creditAccount: true,
    },
    orderBy: {
      date: 'asc',
    },
  })

  return json<LoaderData>({
    loggedInUser,
    loan,
    transactions,
    receipts,
    adjustments,
  })
}

const LoanDetails = () => {
  const {
    loan: ln,
    loggedInUser,
    transactions: t,
    receipts: r,
    adjustments: a,
  } = useLoaderData<LoaderData>()

  const loan = ln as unknown as ExpandedLoan
  const transactions = t as unknown as ExpandedTransaction[]
  const receipts = r as unknown as Receipt[]
  const adjustments = a as unknown as LoanAdjustment[]

  const client = loan.client

  const canEnterPayment = loggedInUser.permissions.includes(
    Permission.RECEIPT_CREATE
  )

  const canEnterAdjustment = loggedInUser.permissions.includes(
    Permission.LOAN_ADJUSTMENT
  )

  const [searchParams] = useSearchParams()

  const getLastPaymentNum = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments

    let paymentNum = 0
    const numPaymantes = loan.numPayments

    const paymentReceipts = scheduledPayments
      .map((scheduledPayment) => scheduledPayment.paymentReceipts)
      .flat()

    const receipts = paymentReceipts.map(
      (paymentReceipt) => paymentReceipt.receipt
    )

    const lastReceipt = receipts.sort((a, b) => {
      if (a.receiptDate < b.receiptDate) return 1
      if (a.receiptDate > b.receiptDate) return -1
      return 0
    })[0]

    if (lastReceipt) {
      const lastPaymentReceipt = paymentReceipts
        .filter((paymentReceipt) => paymentReceipt.receiptId === lastReceipt.id)
        .sort((a, b) => {
          if (a.createdAt < b.createdAt) return 1
          if (a.createdAt > b.createdAt) return -1
          return 0
        })[0]

      if (lastPaymentReceipt) {
        const lastScheduledPayment = scheduledPayments.filter(
          (scheduledPayment) =>
            scheduledPayment.id === lastPaymentReceipt.scheduledPaymentId
        )[0]

        if (lastScheduledPayment) {
          paymentNum = lastScheduledPayment.paymentNumber
        }
      }
    }

    return `${paymentNum}/${numPaymantes}`
  }

  const getTimesLate = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments

    const duesDateAndPaymentReceipts = scheduledPayments
      .map((scheduledPayment) => {
        return {
          dueDate: scheduledPayment.dueDate,
          amountExpected: scheduledPayment.amount,
          ...scheduledPayment.paymentReceipts
            .map((paymentReceipt) => {
              return {
                receiptDate: paymentReceipt.receipt.receiptDate,
                amount: paymentReceipt.amount,
              }
            })
            .reduce(
              (acc: any, curr) => {
                const dte =
                  acc.receiptDate < curr.receiptDate
                    ? curr.receiptDate
                    : acc.receiptDate
                const amt = acc.totalAmountPaid + curr.amount
                return {
                  latestReceiptDate: dte,
                  totalAmountPaid: amt,
                }
              },
              { latestReceiptDate: null, totalAmountPaid: 0 }
            ),
        }
      })
      .map((dueDateAndPaymentReceipts) => {
        const { dueDate, amountExpected, latestReceiptDate, totalAmountPaid } =
          dueDateAndPaymentReceipts

        let isLate = false

        const dueDateIsInPast =
          DateTime.fromISO(dueDate).toMillis() < Date.now()

        if (dueDateIsInPast) {
          const amountOutStanding = amountExpected - totalAmountPaid > 0
          if (amountOutStanding) {
            isLate = true
          } else {
            if (latestReceiptDate) {
              if (
                DateTime.fromISO(latestReceiptDate).toMillis() >
                DateTime.fromISO(dueDate).toMillis()
              ) {
                isLate = true
              }
            }
          }
        }

        return {
          dueDate,
          amountExpected,
          latestReceiptDate,
          totalAmountPaid,
          isLate,
        }
      })

    return duesDateAndPaymentReceipts.filter((dueDateAndPaymentReceipts) => {
      return dueDateAndPaymentReceipts.isLate
    }).length
  }

  const getAmountOutstanding = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments

    const allPayments = scheduledPayments
      .map((scheduledPayment) => scheduledPayment.paymentReceipts)
      .flat()

    const totalAmountPaid = allPayments.reduce((acc, curr) => {
      return acc + curr.amount
    }, 0)

    const totalAmountExpected = scheduledPayments.reduce((acc, curr) => {
      return acc + curr.amount
    }, 0)

    return totalAmountExpected - totalAmountPaid
  }

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
      <div className="flex w-full">
        <div className="w-1/3 text-sm">
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
            <div className="w-1/3 mr-4 text-right">Status</div>
            <div className="w-2/3 font-semibold">{loan.status}</div>
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
            <div className="w-1/3 mr-4 text-right">Last Payment #</div>
            <div className="w-2/3 font-semibold">{getLastPaymentNum(loan)}</div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Times Late</div>
            <div className="w-2/3 font-semibold">{getTimesLate(loan)}</div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Balance</div>
            <div className="w-2/3 font-semibold">
              {`$${getAmountOutstanding(loan).toLocaleString('en-US')}`}
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Next Due</div>
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

          <div className="flex flex-col items-center w-full p-1 mt-6">
            {canEnterPayment && (
              <Link
                to={`payments?${buildQueryStringFromSearchParams(
                  searchParams
                )}`}
                className=" w-40 inline-flex items-center justify-center p-0.5 mb-2  overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
              >
                <span className="text-center w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                  Payments
                </span>
              </Link>
            )}
            {canEnterAdjustment && (
              <Link
                to={`adjustments?${buildQueryStringFromSearchParams(
                  searchParams
                )}`}
                className=" w-40 inline-flex items-center justify-center p-0.5 mb-2  overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
              >
                <span className="text-center w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                  Make Adjustment
                </span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex-col w-2/3 text-sm">
          <LoanDetailsTable
            transactions={transactions}
            receipts={receipts}
            adjustments={adjustments}
            loanId={loan.id}
          />
        </div>
      </div>
    </div>
  )
}

export default LoanDetails
