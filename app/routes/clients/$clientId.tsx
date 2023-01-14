import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import type { Receipt, User } from '@prisma/client'
import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
  queryStringOptions,
} from '~/util/query-string'

import { DateTime } from 'luxon'
import NotesList from '../../components/notes-list'
import { Permission } from '@prisma/client'
import React from 'react'
import TextArea from '../../components/form/textarea'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'
import LoanHistoryList from '../../components/loan-history-list'

export type ExpandedClientNote = Awaited<
  ReturnType<typeof prisma.clientNote.findUnique>
> & {
  createdBy: User
}

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
}

type ExpandedClient = Awaited<ReturnType<typeof prisma.client.findUnique>> & {
  notes: ExpandedClientNote[]
  loans: ExpandedLoan[]
}

interface LoaderData {
  loggedInUser: User
  client: ExpandedClient
}

const schema = z.object({
  note: z.string().min(1, { message: 'Please write something!' }),
})

export const clientValidator = withZod(schema)

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [
    Permission.CLIENT_VIEW,
    Permission.CLIENT_UPDATE_BASIC,
    Permission.CLIENT_UPDATE_ADVANCED,
  ]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const clientId = params.clientId

  if (!clientId)
    return redirect(`/clients?${buildQueryStringFromRequest(request)}`)

  const client = await prisma.client.findUnique({
    where: {
      id: clientId,
    },
    include: {
      notes: {
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          createdBy: true,
        },
      },
      loans: {
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          scheduledPayments: {
            orderBy: {
              dueDate: 'asc',
            },
            include: {
              paymentReceipts: {
                include: {
                  receipt: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!client)
    return redirect(`/clients?${buildQueryStringFromRequest(request)}`)

  return json({ loggedInUser, client })
}

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [
    Permission.CLIENT_UPDATE_BASIC,
    Permission.CLIENT_UPDATE_ADVANCED,
  ]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const serverValidator = withZod(schema)

  const data = await serverValidator.validate(await request.formData())

  if (data.error) {
    return validationError(data.error)
  }

  const clientId = params.clientId

  const { note } = data.data

  const client = await prisma.client.update({
    where: {
      id: clientId,
    },
    data: {
      notes: {
        create: {
          note,
          createdBy: {
            connect: {
              id: loggedInUser.id,
            },
          },
        },
      },
    },
  })

  return redirect(
    `/clients/${client.id}?${buildQueryStringFromRequest(request)}`
  )
}

const ClientProfile = () => {
  const { client, loggedInUser } = useLoaderData<LoaderData>()

  const [searchParams] = useSearchParams()

  const notes = client.notes as unknown as ExpandedClientNote[]
  const loans = client.loans as unknown as ExpandedLoan[]

  const canUpdateUser =
    loggedInUser.permissions.includes(Permission.CLIENT_UPDATE_BASIC) ||
    loggedInUser.permissions.includes(Permission.CLIENT_UPDATE_ADVANCED)

  const imageSrc = client.imageUrl || '/assets/image-placeholder.jpg'

  return (
    <div className="flex flex-col w-full p-4 mt-10 space-y-6 border border-gray-200 rounded-lg shadow-md bg-slate-50 sm:p-6 md:p-8 text-slate-900">
      <div className="flex w-full space-x-6">
        <div className="w-4/12 text-sm">
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Client Name</div>
            <div className="w-2/3 font-semibold">{client.name}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Client Number</div>
            <div className="w-2/3 font-semibold">{client.clientNum}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Date Birth</div>
            <div className="w-2/3 font-semibold">
              {DateTime.fromISO(client.dateBirth).toLocaleString()}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Occupation</div>
            <div className="w-2/3 font-semibold">{client.occupation}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Address</div>
            <div className="w-2/3 font-semibold">
              {[
                client.address.street,
                client.address.town,
                client.address.parish,
              ].join(', ')}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Phone</div>
            <div className="w-2/3 font-semibold">{client.phone}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">License / TRN</div>
            <div className="w-2/3 font-semibold">{client.driverTrn}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">2nd ID Type</div>
            <div className="w-2/3 font-semibold">{client.secondIdType}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">2nd ID Number</div>
            <div className="w-2/3 font-semibold">{client.secondIdNumber}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Emergency Contact</div>
            <div className="w-2/3 font-semibold">{client.otherContactName}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Contact Relationship</div>
            <div className="w-2/3 font-semibold">
              {client.otherContactRelation}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Contact Phone</div>
            <div className="w-2/3 font-semibold">
              {client.otherContactPhone}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Max Loan Amount</div>
            <div className="w-2/3 font-semibold">
              {`$${client.maxLoanAmount.toLocaleString('en-US')}`}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Max Concurrent Loans</div>
            <div className="w-2/3 font-semibold">{client.maxActiveLoans}</div>
          </div>
        </div>

        <div className="w-4/12 text-sm text-center border-x-2 border-r-zinc-200">
          <img className="w-full h-auto px-8 mx-auto" src={imageSrc} alt="" />
          {canUpdateUser && (
            <Link
              to={`/clients/${
                client.id
              }/image-upload?${buildQueryStringFromSearchParams(searchParams)}`}
              className="w-full mx-auto text-sm text-gray-900 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700"
            >
              Upload/Change Image
            </Link>
          )}

          <div className="flex justify-between p-1 mx-10 mt-14">
            <Link
              to={`/loans/applications/new?clientId=${
                client.id
              }&${buildQueryStringFromSearchParams(searchParams)}`}
              className="relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
            >
              <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                New Loan Application
              </span>
            </Link>

            <Link
              to={`edit?${buildQueryStringFromSearchParams(searchParams)}`}
              className="relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
            >
              <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                Edit Profile
              </span>
            </Link>
          </div>
        </div>

        <div className="w-4/12 text-sm ">
          <div className="flex w-full p-1">
            <ValidatedForm
              className="w-full"
              method="post"
              validator={clientValidator}
              defaultValues={{ note: '' }}
              resetAfterSubmit={true}
            >
              <div className="w-full rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                <div className="px-4 py-2 mb-2 bg-white border-2 rounded-t-lg border-slate-200 dark:bg-gray-800">
                  <TextArea
                    name={'note'}
                    label={'Enter new note here...'}
                  ></TextArea>
                </div>

                <div className="relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-xs font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800">
                  <button
                    type="submit"
                    className="relative w-full px-5 py-1 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0"
                  >
                    Save Note
                  </button>
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
          <div className="flex flex-col w-full border-2 rounded-t-lg border-slate-200">
            <NotesList notes={notes} />
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full ">
        <h4 className="my-2 font-medium">Loan History</h4>
        <LoanHistoryList loans={loans} />
      </div>
    </div>
  )
}

export default ClientProfile
