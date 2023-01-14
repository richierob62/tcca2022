import { json, redirect } from '@remix-run/node'
import type { Client, Receipt, User } from '@prisma/client'

import type { LoaderFunction } from '@remix-run/node'
import LoanList from '~/components/loan-list'
import LoanSearch from '~/components/loan-search'
import { Permission } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { prisma } from '~/util/prisma.server'
import { useLoaderData } from '@remix-run/react'

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
  client: Client
}

interface LoaderData {
  loggedInUser: User
  loans: ExpandedLoan[]
}

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.LOAN_LIST]
  const loggedInUser = await authenticatedUser(request, permissions)

  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const url = new URL(request.url)

  const loanFilter = url.searchParams.get('loanFilter')
  const loanFilterStartDate = url.searchParams.get('loanFilterStartDate')
  const loanFilterEndDate = url.searchParams.get('loanFilterEndDate')
  const loanFilterStatus = url.searchParams.get('loanFilterStatus')

  let filter = {}

  if (loanFilter && loanFilter !== 'undefined' && loanFilter !== 'null')
    filter = {
      ...filter,
      OR: [
        {
          client: {
            name: {
              contains: loanFilter,
              mode: 'insensitive',
            },
          },
        },
        {
          loanNum: {
            contains: loanFilter,
            mode: 'insensitive',
          },
        },
      ],
    }

  if (
    loanFilterStartDate &&
    loanFilterStartDate !== 'undefined' &&
    loanFilterEndDate &&
    loanFilterEndDate !== 'undefined'
  ) {
    const st = new Date(loanFilterStartDate)
    const offset = st.getTimezoneOffset()
    const st2 = new Date(st.getTime() + offset * 60 * 1000)

    const et = new Date(`${loanFilterEndDate}T23:59:59.999Z`)
    const et2 = new Date(et.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      loanStartDate: {
        gte: st2,
        lte: et2,
      },
    }
  } else if (loanFilterStartDate && loanFilterStartDate !== 'undefined') {
    const st = new Date(loanFilterStartDate)
    const offset = st.getTimezoneOffset()
    const st2 = new Date(st.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      loanStartDate: { gte: st2 },
    }
  } else if (loanFilterEndDate && loanFilterEndDate !== 'undefined') {
    const et = new Date(`${loanFilterEndDate}T23:59:59.999Z`)
    const offset = et.getTimezoneOffset()
    const et2 = new Date(et.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      loanStartDate: { lte: et2 },
    }
  }

  if (
    loanFilterStatus &&
    loanFilterStatus !== 'undefined' &&
    loanFilterStatus !== 'null' &&
    loanFilterStatus !== 'All'
  )
    filter = {
      ...filter,
      status: loanFilterStatus,
    }

  const loans = await prisma.loan.findMany({
    where: filter as any,
    include: {
      client: true,
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

  return json<LoaderData>({ loans, loggedInUser })
}

export default function LoanRoute() {
  const { loans } = useLoaderData() as unknown as LoaderData

  return (
    <div>
      <div className="mt-6 mb-6">
        <LoanSearch />
      </div>
      <LoanList loans={loans} />
    </div>
  )
}
