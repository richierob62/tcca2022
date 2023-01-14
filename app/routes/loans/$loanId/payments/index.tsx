import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { Client, LoanStatus, User } from '@prisma/client'
import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
} from '~/util/query-string'

import { DateTime } from 'luxon'
import PaymentScheduleTable from '~/components/payment-schedule-table'
import { Permission } from '@prisma/client'
import React from 'react'
import ReceiptList from '~/components/receipt-list'
import { TransactionType } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { validationError } from 'remix-validated-form'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

type ExpandedPaymentReceipt = Awaited<
  ReturnType<typeof prisma.paymentReceipt.findUnique>
> & {
  receipt: ExpandedReceipt
}

export type ExpandedScheduledPayment = Awaited<
  ReturnType<typeof prisma.scheduledPayment.findUnique>
> & {
  paymentReceipts: ExpandedPaymentReceipt[]
}

export type ExpandedLoan = Awaited<
  ReturnType<typeof prisma.loan.findUnique>
> & {
  scheduledPayments: ExpandedScheduledPayment[]
  client: Client
}

export type ExpandedReceipt = Awaited<
  ReturnType<typeof prisma.receipt.findUnique>
> & {
  receivedBy: User
}

interface LoaderData {
  loggedInUser: User
  loan: ExpandedLoan
  receipts: ExpandedReceipt[]
}

const schema = z.object({
  amount: z.string().refine((val) => !Number.isNaN(Number(val)), {
    message: 'Please enter a valid amount',
  }),
})

const amountOutstanding = (payment: ExpandedScheduledPayment) => {
  const totalAmountPaid = payment.paymentReceipts.reduce((acc, curr) => {
    return acc + curr.amount
  }, 0)

  return payment.amount - totalAmountPaid
}

const getNextReceiptNum = async () => {
  const lastReceipt = await prisma.receipt.findFirst({
    orderBy: {
      receiptNum: 'desc',
    },
  })
  if (!lastReceipt) return '100'
  return `${parseInt(lastReceipt.receiptNum, 10) + 1}`
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.RECEIPT_VIEW]
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
      scheduledPayments: {
        include: {
          paymentReceipts: {
            include: {
              receipt: {
                include: {
                  receivedBy: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!loan) return redirect(`/loans?${buildQueryStringFromRequest(request)}`)

  const receipts: ExpandedReceipt[] = []
  for (const sp of loan.scheduledPayments) {
    for (const pr of sp.paymentReceipts) {
      if (pr.receipt) {
        const found = receipts.find((r) => r.id === pr.receipt.id)
        if (!found) receipts.push(pr.receipt)
      }
    }
  }

  return json<LoaderData>({ loggedInUser, loan, receipts })
}

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [Permission.RECEIPT_CREATE]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const loanId = params.loanId

  if (!loanId) return redirect(`/loans?${buildQueryStringFromRequest(request)}`)

  const fd = await request.formData()

  const formAction = fd.get('action')

  if (formAction === 'payment') {
    const loan = await prisma.loan.findUnique({
      where: {
        id: loanId,
      },
      include: {
        scheduledPayments: {
          include: {
            paymentReceipts: {
              include: {
                receipt: {
                  include: {
                    receivedBy: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!loan) return redirect(`/loans?${buildQueryStringFromRequest(request)}`)

    const serverValidator = withZod(schema)
    const data = await serverValidator.validate(fd)
    if (data.error) {
      return validationError(data.error)
    }
    const scheduledPayments = loan.scheduledPayments
      .map((sp) => {
        return {
          ...sp,
          balance: amountOutstanding(sp),
        }
      })
      .filter((sp) => sp.balance > 0)
      .sort((a, b) => a.paymentNumber - b.paymentNumber)

    const totalBalance = scheduledPayments.reduce((acc, curr) => {
      return acc + curr.balance
    }, 0)

    if (Number(data.data.amount) > totalBalance) {
      return validationError({
        fieldErrors: {
          amount: 'Amount is greater than the total balance',
        },
      })
    }

    let paidOff = Number(data.data.amount) === totalBalance

    const allocatedPayments = []

    let principalPaid = 0
    let interestPaid = 0

    let availableFunds = Number(data.data.amount)

    const totalPrincipal = loan.amount
    const principalPerPayment = Math.round(totalPrincipal / loan.numPayments)

    let idx = 0
    while (availableFunds > 0 && scheduledPayments.length > idx) {
      const interestOutstanding =
        scheduledPayments[idx].balance < principalPerPayment
          ? 0
          : scheduledPayments[idx].balance - principalPerPayment
      const principalOutstanding =
        scheduledPayments[idx].balance > principalPerPayment
          ? principalPerPayment
          : scheduledPayments[idx].balance

      if (scheduledPayments[idx].balance <= availableFunds) {
        allocatedPayments.push({
          id: scheduledPayments[idx].id,
          amount: scheduledPayments[idx].balance,
        })
        availableFunds -= scheduledPayments[idx].balance
        idx++

        interestPaid += interestOutstanding
        principalPaid += principalOutstanding
      } else {
        allocatedPayments.push({
          id: scheduledPayments[idx].id,
          amount: availableFunds,
        })

        interestPaid += Math.min(interestOutstanding, availableFunds)
        principalPaid += Math.max(0, availableFunds - interestPaid)

        availableFunds = 0
      }
    }
    const nextReceiptNum = await getNextReceiptNum()
    const receipt = await prisma.receipt.create({
      data: {
        receiptNum: nextReceiptNum,
        amount: Number(data.data.amount),
        receiptDate: new Date(Date.now()),
        client: {
          connect: {
            id: loan.clientId,
          },
        },
        receivedBy: {
          connect: {
            id: loggedInUser.id,
          },
        },
      },
    })
    // add paymentReceiots to receipt
    await Promise.all(
      allocatedPayments.map((ap) => {
        return prisma.paymentReceipt.create({
          data: {
            amount: ap.amount,
            receipt: {
              connect: {
                id: receipt.id,
              },
            },
            scheduledPayment: {
              connect: {
                id: ap.id,
              },
            },
          },
        })
      })
    )

    const loanControlAccount = await prisma.account.findFirst({
      where: {
        name: 'Loan Control',
      },
    })

    const unreconciledReceiptsAccount = await prisma.account.findFirst({
      where: {
        name: 'Unreconciled Receipts',
      },
    })

    const unearnedInterestAccount = await prisma.account.findFirst({
      where: {
        name: 'Unearned Interest',
      },
    })

    const interestIncomeAccount = await prisma.account.findFirst({
      where: {
        name: 'Interest Income',
      },
    })

    // record payment transactions
    if (principalPaid + interestPaid > 0) {
      const principalTransaction = await prisma.transaction.create({
        data: {
          amount: principalPaid + interestPaid,
          activityType: TransactionType.RECEIPT,
          activityId: receipt.id,
          date: DateTime.now().toISO(),
          debitAccount: {
            connect: {
              id: unreconciledReceiptsAccount!.id,
            },
          },
          creditAccount: {
            connect: {
              id: loanControlAccount!.id,
            },
          },
        },
      })

      await prisma.account.update({
        where: {
          id: unreconciledReceiptsAccount!.id,
        },
        data: {
          debits: {
            connect: {
              id: principalTransaction.id,
            },
          },
        },
      })

      await prisma.account.update({
        where: {
          id: loanControlAccount!.id,
        },
        data: {
          credits: {
            connect: {
              id: principalTransaction.id,
            },
          },
        },
      })
    }

    if (interestPaid > 0) {
      const interestTransaction = await prisma.transaction.create({
        data: {
          amount: interestPaid,
          activityType: TransactionType.RECEIPT,
          activityId: receipt.id,
          date: DateTime.now().toISO(),
          debitAccount: {
            connect: {
              id: unearnedInterestAccount!.id,
            },
          },
          creditAccount: {
            connect: {
              id: interestIncomeAccount!.id,
            },
          },
        },
      })

      await prisma.account.update({
        where: {
          id: unearnedInterestAccount!.id,
        },
        data: {
          debits: {
            connect: {
              id: interestTransaction.id,
            },
          },
        },
      })

      await prisma.account.update({
        where: {
          id: interestIncomeAccount!.id,
        },
        data: {
          credits: {
            connect: {
              id: interestTransaction.id,
            },
          },
        },
      })
    }

    if (paidOff) {
      await prisma.loan.update({
        where: {
          id: loan.id,
        },
        data: {
          status: LoanStatus.PAID,
        },
      })
    }
  }

  return null
}

const Payments = () => {
  const { loan: ln, loggedInUser: u, receipts: r } = useLoaderData<LoaderData>()

  const loan = ln as unknown as ExpandedLoan
  const receipts = r as unknown as ExpandedReceipt[]
  const loggedInUser = u as unknown as User
  const client = loan.client

  const [searchParams] = useSearchParams()

  const getLastPaymentNum = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments

    let paymentNum = 0
    const numPayments = loan.numPayments

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

    return `${paymentNum}/${numPayments}`
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

  return (
    <div className="flex flex-col w-full p-4 mt-10 space-y-6 border border-gray-200 rounded-lg shadow-md bg-slate-50 sm:p-6 md:p-8 text-slate-900">
      <div className="flex w-full space-x-6">
        <div className="w-1/4 text-sm">
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
            <div className="w-2/3 font-semibold">
              <Link
                to={`/loans/${loan.id}?${buildQueryStringFromSearchParams(
                  searchParams
                )}`}
                className="font-semibold text-blue-500 cursor-pointer"
              >
                <div>{loan.loanNum}</div>
              </Link>
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Status</div>
            <div className="w-2/3 font-semibold">{loan.status}</div>
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
            <div className="w-1/3 mr-4 text-right">Balance</div>
            <div className="w-2/3 font-semibold">
              {`$${getAmountOutstanding(loan).toLocaleString('en-US')}`}
            </div>
          </div>
        </div>

        <div className="w-1/4 text-sm">
          <PaymentScheduleTable loan={loan} loggedInUser={loggedInUser} />
        </div>

        <div className="w-1/2 text-sm">
          <ReceiptList receipts={receipts} />
        </div>
      </div>
    </div>
  )
}

export default Payments
