import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import type { Client, User } from '@prisma/client'
import { IdType, Permission } from '@prisma/client'
import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
  queryStringOptions,
} from '~/util/query-string'

import { DateTime } from 'luxon'
import Input from '~/components/form/input'
import React from 'react'
import Select from '../../components/form/select'
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
  name: z.string().min(1, { message: "Please enter the client's name" }),
  dateBirth: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Please enter a valid date',
  }),
  occupation: z
    .string()
    .min(1, { message: "Please enter the client's occupation" }),
  street: z.string().min(1, { message: 'Street address is required' }),
  town: z.string().min(1, { message: 'City/town/district is required' }),
  parish: z.string().min(1, { message: 'Parish is required' }),
  phone: z.string().min(1, { message: 'Phone number is required' }),
  driverTrn: z
    .string()
    .min(1, { message: "Driver's License / TRN number is required" }),
  secondIdType: z.nativeEnum(IdType, {
    errorMap: (issue, ctx) => {
      return { message: 'Please select a valid ID type' }
    },
  }),
  secondIdNumber: z.string().min(1, { message: '2nd ID is required' }),
  otherContactName: z
    .string()
    .min(1, { message: 'Provide the name of a 2nd Contact' }),
  otherContactRelation: z.string().min(1, {
    message: "What is the client's relationship to the 2nd Contact?",
  }),
  otherContactPhone: z
    .string()
    .min(1, { message: 'Provide the phone # of the 2nd Contact' }),
  maxLoanAmount: z.string().refine((val) => !Number.isNaN(Number(val)), {
    message: 'Please enter a valid amount',
  }),
  maxActiveLoans: z.string().refine((val) => !Number.isNaN(Number(val)), {
    message: 'Please enter a valid amount',
  }),
})

export const clientValidator = withZod(schema)

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [
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
  })

  if (!client)
    return redirect(`/clients?${buildQueryStringFromRequest(request)}`)

  return json<LoaderData>({ loggedInUser, client })
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

  const {
    name,
    dateBirth,
    occupation,
    street,
    town,
    parish,
    phone,
    driverTrn,
    secondIdType,
    secondIdNumber,
    otherContactName,
    otherContactRelation,
    otherContactPhone,
    maxLoanAmount,
    maxActiveLoans,
  } = data.data

  const db = new Date(dateBirth)
  const offset = db.getTimezoneOffset()
  const db2 = new Date(db.getTime() + offset * 60 * 1000)

  const client = await prisma.client.update({
    where: {
      id: clientId,
    },
    data: {
      name,
      dateBirth: db2,
      occupation,
      address: {
        update: {
          street,
          town,
          parish,
        },
      },
      phone,
      driverTrn,
      secondIdType,
      secondIdNumber,
      otherContactName,
      otherContactRelation,
      otherContactPhone,
      maxLoanAmount: parseInt(maxLoanAmount, 10),
      maxActiveLoans: parseInt(maxActiveLoans, 10),
    },
  })

  return redirect(
    `/clients/${client.id}?${buildQueryStringFromRequest(request)}`
  )
}

const EditClient = () => {
  const [searchParams] = useSearchParams()

  const options = [
    { value: '', label: 'Please select one...' },
    { value: IdType.PASSPORT, label: 'Passport' },
    { value: IdType.NATIONAL_ID, label: 'National ID' },
    { value: IdType.OTHER, label: 'Other' },
  ]

  const { client, loggedInUser } = useLoaderData<LoaderData>()

  const canEditLoanLimits = loggedInUser.permissions.includes(
    Permission.CLIENT_UPDATE_ADVANCED
  )

  const {
    name,
    dateBirth,
    occupation,
    address: { street, town, parish },
    phone,
    driverTrn,
    secondIdType,
    secondIdNumber,
    otherContactName,
    otherContactRelation,
    otherContactPhone,
    maxLoanAmount,
    maxActiveLoans,
  } = client

  const dBirthString = DateTime.fromISO(dateBirth).toFormat('yyyy-MM-dd')

  return (
    <ValidatedForm
      method="post"
      validator={clientValidator}
      defaultValues={{
        name,
        dateBirth: dBirthString,
        occupation,
        street,
        town,
        parish,
        phone,
        driverTrn,
        secondIdType,
        secondIdNumber,
        otherContactName,
        otherContactRelation,
        otherContactPhone,
        maxLoanAmount: `${maxLoanAmount}`,
        maxActiveLoans: `${maxActiveLoans}`,
      }}
    >
      <div className="flex flex-col w-full p-4 mt-10 border border-gray-200 rounded-lg shadow-md bg-slate-300 sm:p-6 md:p-8">
        <h3 className="mb-6 grow-down">Editing Client...</h3>
        <div className="flex w-full space-x-12">
          <div className="w-1/3 space-y-4">
            <Input name={'name'} label={'Name'} />
            <Input name={'dateBirth'} label={'Date of Birth'} type={'date'} />
            <Input name={'occupation'} label={'Occupation'} />
            <Input name={'street'} label={'Street'} />
            <Input name={'town'} label={'Town'} />
            <Input name={'parish'} label={'Parish'} />
          </div>

          <div className="w-1/3 space-y-4">
            <Input name={'phone'} label={'Phone'} />
            <Input name={'driverTrn'} label={"Driver's License / TRN #"} />
            <Select
              name={'secondIdType'}
              label={'2nd ID Type'}
              options={options}
            />
            <Input name={'secondIdNumber'} label={'2nd ID #'} />
          </div>

          <div className="w-1/3 space-y-4">
            <Input
              name={'otherContactName'}
              label={'Name of Emergency Contact Person'}
            />
            <Input
              name={'otherContactRelation'}
              label={'Relationship to Emergency Contact'}
            />
            <Input
              name={'otherContactPhone'}
              label={'Phone # of Emergency Contact'}
            />
            {canEditLoanLimits && (
              <div className="flex justify-between space-x-6">
                <Input name={'maxLoanAmount'} label={'Maximum Loan Amount'} />
                <Input
                  name={'maxActiveLoans'}
                  label={'Maximum Concurrent Loans'}
                />
              </div>
            )}
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
  )
}

export default EditClient
