import { Form, useLocation, useSearchParams, useSubmit } from '@remix-run/react'
import React, { useRef } from 'react'

import { queryStringOptions } from '../util/query-string'

const ReconciliationSearch = () => {
  const [searchParams] = useSearchParams()
  let reconciliationFilter = searchParams.get('reconciliationFilter') || ''
  if (reconciliationFilter === 'undefined' || reconciliationFilter === 'null')
    reconciliationFilter = ''

  const reconciliationSortBy =
    searchParams.get('reconciliationSortBy') || 'date'
  const reconciliationFilterStartDate =
    searchParams.get('reconciliationFilterStartDate') || undefined
  const reconciliationFilterEndDate =
    searchParams.get('reconciliationFilterEndDate') || undefined
  const reconciliationSortDir =
    searchParams.get('reconciliationSortDir') || 'desc'

  const filterRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)

  const submit = useSubmit()

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    submit(e.currentTarget.form)
  }

  const clearFilters = (e: React.ChangeEvent<any>) => {
    if (filterRef?.current) filterRef.current.value = ''
    if (startRef?.current) startRef.current.value = ''
    if (endRef?.current) endRef.current.value = ''
    submit(e.currentTarget.form)
  }

  return (
    <div className="">
      <Form className="flex w-full space-x-6" method="get">
        <div className="flex w-1/3">
          <div className="w-full">
            <label htmlFor="reconciliationFilter" className="sr-only">
              Search
            </label>
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-gray-500 "
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </div>
              <input
                type="text"
                ref={filterRef}
                id="reconciliationFilter"
                name="reconciliationFilter"
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5  "
                placeholder="Search"
                onChange={(e) => handleChange(e)}
                defaultValue={reconciliationFilter}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start w-1/3">
          <div className="flex items-center w-full">
            <div className="w-20 pr-2 text-sm font-medium text-right text-slate-100">
              Between
            </div>
            <input
              className="w-32 p-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 "
              type="date"
              ref={startRef}
              id="reconciliationFilterStartDate"
              name="reconciliationFilterStartDate"
              defaultValue={reconciliationFilterStartDate}
              onChange={(e) => handleChange(e)}
            />
            <div className="justify-center px-2 text-sm font-medium text-slate-100">
              and
            </div>
            <input
              className="w-32 p-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 "
              type="date"
              ref={endRef}
              id="reconciliationFilterEndDate"
              name="reconciliationFilterEndDate"
              defaultValue={reconciliationFilterEndDate}
              onChange={(e) => handleChange(e)}
            />
          </div>

          <div className="flex items-center w-full mt-2">
            <div className="w-20 pr-2 text-sm font-medium text-right text-slate-100">
              Sort by
            </div>
            <select
              id="reconciliationSortBy"
              name="reconciliationSortBy"
              className="w-48 p-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 "
              defaultValue={reconciliationSortBy}
              onChange={(e) => handleChange(e)}
            >
              <option value="name">Name</option>
              <option value="date">Date</option>
            </select>

            <select
              id="reconciliationSortDir"
              name="reconciliationSortDir"
              className="w-20 p-2 ml-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 "
              defaultValue={reconciliationSortDir}
              onChange={(e) => handleChange(e)}
            >
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col w-1/3">
          <div className="mt-2 ml-20 w-36">
            <button
              onClick={clearFilters}
              type="button"
              className="relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
            >
              <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                Clear Filters
              </span>
            </button>
          </div>
        </div>

        {/* insert hidden inputs for search params */}
        {queryStringOptions.map((option, idx) => {
          if (
            [
              'reconciliationFilter',
              'reconciliationFilterStartDate',
              'reconciliationFilterEndDate',
              'reconciliationSortBy',
              'reconciliationSortDir',
            ].includes(option)
          )
            return null

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
      </Form>
    </div>
  )
}

export default ReconciliationSearch
