import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import type { Client, User } from '@prisma/client'
import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
} from '~/util/query-string'

import { DEFAULT_TERM } from '../../../util/constants'
import { DateTime } from 'luxon'
import Input from '~/components/form/input'
import { LoanApplicationStatus } from '@prisma/client'
import { Permission } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

interface LoaderData {
  loggedInUser: User
  client: Client
}

const schema = z.object({
  requestedDisbursementDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Requested start date required',
    }),
  requestedAmount: z
    .string()
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: 'Please enter a valid amount',
    }),
  requestedTerm: z
    .string()
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: 'Please enter a valid amount',
    }),
  purpose: z.string().min(1, { message: 'Purpose of loan required' }),
})

export const clientValidator = withZod(schema)

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.APPLICATION_CREATE]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const url = new URL(request.url)
  const clientId = url.searchParams.get('clientId')

  if (!clientId)
    return redirect(`/clients?${buildQueryStringFromRequest(request)}`)

  const client = await prisma.client.findUnique({
    where: {
      id: clientId,
    },
  })

  if (!client)
    return redirect(`/clients?${buildQueryStringFromRequest(request)}`)

  return json({ loggedInUser, client })
}

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [Permission.APPLICATION_CREATE]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const url = new URL(request.url)
  const clientId = url.searchParams.get('clientId')

  if (!clientId)
    return redirect(`/clients?${buildQueryStringFromRequest(request)}`)

  const serverValidator = withZod(
    schema.refine(
      async (data) => {
        const client = await prisma.client.findFirst({
          where: {
            id: clientId,
          },
        })
        return Number(data.requestedAmount) <= (client?.maxLoanAmount || 0)
      },
      {
        message: 'This amount exceeds the maximum loan amount for this client',
        path: ['requestedAmount'],
      }
    )
  )

  const data = await serverValidator.validate(await request.formData())

  if (data.error) {
    return validationError(data.error)
  }

  const { requestedDisbursementDate, requestedAmount, requestedTerm, purpose } =
    data.data

  const getNextApplicationNumber = async () => {
    const lastApplication = await prisma.loanApplication.findFirst({
      orderBy: {
        applicationNum: 'desc',
      },
    })
    if (!lastApplication) return '5000'
    return `${parseInt(lastApplication.applicationNum, 10) + 1}`
  }

  const reqdte = new Date(requestedDisbursementDate)
  const offset = reqdte.getTimezoneOffset()
  const reqdte2 = new Date(reqdte.getTime() + offset * 60 * 1000)

  await prisma.loanApplication.create({
    data: {
      applicationDate: new Date(),
      requestedDisbursementDate: reqdte2,
      requestedAmount: Number(requestedAmount),
      requestedTerm: Number(requestedTerm) || DEFAULT_TERM,
      purpose,
      status: LoanApplicationStatus.PENDING,
      client: {
        connect: {
          id: clientId,
        },
      },
      createdBy: {
        connect: {
          id: loggedInUser.id,
        },
      },
      applicationNum: await getNextApplicationNumber(),
    },
  })

  return redirect(
    `/loans/applications/?${buildQueryStringFromRequest(request)}`
  )
}

const NewLoanApplication = () => {
  const { client } = useLoaderData<LoaderData>()

  const [searchParams] = useSearchParams()

  return (
    <div className="flex flex-col w-full p-4 mt-10 space-y-6 border border-gray-200 rounded-lg shadow-md bg-slate-50 sm:p-6 md:p-8 text-slate-900">
      <div className="flex w-full space-x-6">
        <div className="w-1/2 text-sm">
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

        <div className="w-1/2 text-sm ">
          <div className="flex w-full p-1">
            <ValidatedForm
              className="w-full max-w-md space-y-4"
              method="post"
              validator={clientValidator}
              resetAfterSubmit={true}
            >
              <Input
                name={'requestedDisbursementDate'}
                label={'Requested Start Date'}
                type={'date'}
              />
              <Input
                name={'requestedAmount'}
                label={'Requested Amount'}
                type="number"
              />
              <Input
                name={'requestedTerm'}
                label={'Requested Term'}
                type="number"
              />
              <Input name={'purpose'} label={'Purpose of Loan'} />

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
                  to={`/clients/${client.id}?${buildQueryStringFromSearchParams(
                    searchParams
                  )}`}
                  className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-pink-500 to-orange-400 group-hover:from-pink-500 group-hover:to-orange-400 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-pink-200 dark:focus:ring-pink-800"
                >
                  <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                    Cancel
                  </span>
                </Link>
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewLoanApplication
