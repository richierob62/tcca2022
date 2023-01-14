import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import type { Client, Reconciliation, User } from '@prisma/client'
import { json, redirect } from '@remix-run/node'

import { DateTime } from 'luxon'
import { Permission } from '@prisma/client'
import ReceiptSummaryList from '../../components/receipt-summary-list'
import ReconciliationSearch from '../../components/reconciliation-search'
import { TransactionType } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { prisma } from '~/util/prisma.server'
import { useLoaderData } from '@remix-run/react'

type ExpandedReceipt = Awaited<ReturnType<typeof prisma.receipt.findUnique>> & {
  client: Client
  receivedBy: User
  reconciliation?: Reconciliation | null
}

export type ReceiptSummary = {
  date: string
  receiver: User
  total: number
  count: number
  reconciled: number
  notes: string
}

type ReceiptSummaryByUserAndDate = {
  [key: string]: ExpandedReceipt[]
}

interface LoaderData {
  loggedInUser: User
  receiptSummaries: ReceiptSummary[]
}

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.RECONCILE_MANAGE]
  const loggedInUser = await authenticatedUser(request, permissions)

  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const url = new URL(request.url)

  const reconciliationFilter = url.searchParams.get('reconciliationFilter')
  const reconciliationFilterStartDate = url.searchParams.get(
    'reconciliationFilterStartDate'
  )
  const reconciliationFilterEndDate = url.searchParams.get(
    'reconciliationFilterEndDate'
  )

  let filter = {}

  if (
    reconciliationFilter &&
    reconciliationFilter !== 'undefined' &&
    reconciliationFilter !== 'null'
  )
    filter = {
      ...filter,
      OR: [
        {
          receivedBy: {
            name: {
              contains: reconciliationFilter,
              mode: 'insensitive',
            },
          },
        },
      ],
    }

  if (
    reconciliationFilterStartDate &&
    reconciliationFilterStartDate !== 'undefined' &&
    reconciliationFilterEndDate &&
    reconciliationFilterEndDate !== 'undefined'
  ) {
    const st = new Date(reconciliationFilterStartDate)
    const offset = st.getTimezoneOffset()
    const st2 = new Date(st.getTime() + offset * 60 * 1000)

    const et = new Date(`${reconciliationFilterEndDate}T23:59:59.999Z`)
    const et2 = new Date(et.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      receiptDate: {
        gte: st2,
        lte: et2,
      },
    }
  } else if (
    reconciliationFilterStartDate &&
    reconciliationFilterStartDate !== 'undefined'
  ) {
    const st = new Date(reconciliationFilterStartDate)
    const offset = st.getTimezoneOffset()
    const st2 = new Date(st.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      receiptDate: { gte: st2 },
    }
  } else if (
    reconciliationFilterEndDate &&
    reconciliationFilterEndDate !== 'undefined'
  ) {
    const et = new Date(`${reconciliationFilterEndDate}T23:59:59.999Z`)
    const offset = et.getTimezoneOffset()
    const et2 = new Date(et.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      receiptDate: { lte: et2 },
    }
  }

  const receipts: ExpandedReceipt[] = await prisma.receipt.findMany({
    where: filter as any,
    include: {
      client: true,
      receivedBy: true,
      reconciliation: true,
    },
  })

  const receiptSummariesByUserAndDate: ReceiptSummaryByUserAndDate = {}

  for (const r of receipts) {
    const startOfDay = DateTime.fromJSDate(r.receiptDate).startOf('day')
    const receivedBy = r.receivedBy.id
    const key = `${startOfDay.toISO()} ${receivedBy}`
    if (!receiptSummariesByUserAndDate[key]) {
      receiptSummariesByUserAndDate[key] = []
    }
    receiptSummariesByUserAndDate[key].push(r)
  }

  const receiptSummaries: ReceiptSummary[] = Object.entries(
    receiptSummariesByUserAndDate
  ).map(([key, receipts]) => {
    const total = receipts.reduce((acc, r) => acc + r.amount, 0)

    const reconciled = receipts[0]?.reconciliation?.amountSurrendered || 0

    const count = receipts.length
    return {
      date: key.split(' ')[0],
      receiver: receipts[0].receivedBy,
      total,
      count,
      reconciled,
      notes: receipts[0].reconciliation?.notes || '',
    }
  })

  return json<LoaderData>({ loggedInUser, receiptSummaries })
}

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [Permission.RECONCILE_MANAGE]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const data = await request.formData()

  const amtReceived = Number(data.get('amtReceived'))
  if (isNaN(amtReceived)) return null

  const date = new Date(data.get('date') as string)

  const receiverId = data.get('receiverId') as string

  const notes = (data.get('notes') as string) || ''

  // get all receipts for the date and receiver
  const receipts = await prisma.receipt.findMany({
    where: {
      receiptDate: {
        gte: DateTime.fromJSDate(date).startOf('day').toJSDate(),
        lte: DateTime.fromJSDate(date).endOf('day').toJSDate(),
      },
      receiverId: receiverId,
    },
  })

  const receiptTotal = receipts.reduce((acc, r) => acc + r.amount, 0)

  // create reconciliation record
  const reconciliation = await prisma.reconciliation.create({
    data: {
      amountSurrendered: amtReceived,
      amountExpected: receiptTotal,
      date,
      notes,
      receipts: {
        connect: receipts.map((r) => ({ id: r.id })),
      },
      reconciler: {
        connect: { id: loggedInUser.id },
      },
      clerk: {
        connect: { id: receiverId },
      },
    },
  })

  // create transactions
  const creditAccount = await prisma.account.findFirst({
    where: {
      name: 'Unreconciled Receipts',
    },
  })

  const debitAccount = await prisma.account.findFirst({
    where: {
      name: 'Cash on Hand',
    },
  })

  const transaction = await prisma.transaction.create({
    data: {
      amount: amtReceived,
      activityType: TransactionType.RECONCILIATION,
      activityId: reconciliation.id,
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

  return null
}

export default function ReconciliationRoute() {
  const { receiptSummaries } = useLoaderData() as unknown as LoaderData

  return (
    <div>
      <div className="mt-6 mb-6">
        <ReconciliationSearch />
      </div>
      <ReceiptSummaryList receiptSummaries={receiptSummaries} />
    </div>
  )
}
