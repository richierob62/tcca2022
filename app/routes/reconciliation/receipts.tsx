import type { Client, Loan, Receipt, User } from '@prisma/client'
import { json, redirect } from '@remix-run/node'

import { DateTime } from 'luxon'
import type { LoaderFunction } from '@remix-run/node'
import { Permission } from '@prisma/client'
import ReceiptListForClerk from '../../components/receipt-list-for-clerk'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { prisma } from '~/util/prisma.server'
import { useLoaderData } from '@remix-run/react'

export type ExpandedReceipt = Awaited<
  ReturnType<typeof prisma.receipt.findUnique>
> & {
  client: Client
  receivedBy: User
  loan: Loan
}

interface LoaderData {
  loggedInUser: User
  receipts: ExpandedReceipt[]
}

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.RECEIPT_VIEW]
  const loggedInUser = await authenticatedUser(request, permissions)

  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const url = new URL(request.url)

  const date = new Date(url.searchParams.get('date') as string)
  const receiverId = url.searchParams.get('receiverId') as string

  const receipts = await prisma.receipt.findMany({
    where: {
      receiptDate: {
        gte: DateTime.fromJSDate(date).startOf('day').toJSDate(),
        lte: DateTime.fromJSDate(date).endOf('day').toJSDate(),
      },
      receiverId: receiverId,
    },
    include: {
      client: true,
      receivedBy: true,
    },
  })

  const receiptsWithLoan = await Promise.all(
    receipts.map(async (receipt) => {
      const expandedReceipt = await prisma.receipt.findUnique({
        where: {
          id: receipt.id,
        },
        include: {
          paymentReceipts: {
            include: {
              scheduledPayment: {
                include: {
                  loan: true,
                },
              },
            },
          },
        },
      })

      const loanId =
        expandedReceipt?.paymentReceipts[0].scheduledPayment.loan.id

      const loan = await prisma.loan.findFirst({
        where: {
          id: loanId,
        },
      })

      return {
        ...receipt,
        loan: loan!,
      }
    })
  )

  return json<LoaderData>({ receipts: receiptsWithLoan, loggedInUser })
}

export default function LoanRoute() {
  const { receipts } = useLoaderData() as unknown as LoaderData

  return (
    <div className="mt-6">
      <ReceiptListForClerk receipts={receipts} />
    </div>
  )
}
