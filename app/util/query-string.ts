export const buildQueryStringFromRequest = (request: Request) => {
  const url = new URL(request.url)
  return buildQueryString(url.searchParams)
}

export const buildQueryStringFromSearchParams = (
  searchParams: URLSearchParams
) => buildQueryString(searchParams)

const buildQueryString = (searchParams: URLSearchParams) => {
  let queryParams = ''

  //////////// -----------client

  const clientFilter = searchParams.get('clientFilter')
  if (clientFilter && clientFilter !== 'undefined' && clientFilter !== 'null')
    queryParams += `clientFilter=${clientFilter}&`

  const clientSortBy = searchParams.get('clientSortBy') || 'name'
  queryParams += `clientSortBy=${clientSortBy}&`

  //////////// -----------application

  const applicationFilter = searchParams.get('applicationFilter')
  if (
    applicationFilter &&
    applicationFilter !== 'undefined' &&
    applicationFilter !== 'null'
  )
    queryParams += `applicationFilter=${applicationFilter}&`

  const applicationSortBy = searchParams.get('applicationSortBy') || 'name'
  queryParams += `applicationSortBy=${applicationSortBy}&`

  const applicationFilterStartDate = searchParams.get(
    'applicationFilterStartDate'
  )
  if (
    applicationFilterStartDate &&
    applicationFilterStartDate !== 'undefined' &&
    applicationFilterStartDate !== 'null'
  )
    queryParams += `applicationFilterStartDate=${applicationFilterStartDate}&`

  const applicationFilterEndDate = searchParams.get('applicationFilterEndDate')
  if (
    applicationFilterEndDate &&
    applicationFilterEndDate !== 'undefined' &&
    applicationFilterEndDate !== 'null'
  )
    queryParams += `applicationFilterEndDate=${applicationFilterEndDate}&`

  const applicationFilterStatus = searchParams.get('applicationFilterStatus')
  if (
    applicationFilterStatus &&
    applicationFilterStatus !== 'undefined' &&
    applicationFilterStatus !== 'null'
  )
    queryParams += `applicationFilterStatus=${applicationFilterStatus}&`

  const applicationSortDir = searchParams.get('applicationSortDir') || 'asc'
  queryParams += `applicationSortDir=${applicationSortDir}&`

  //////////// -----------loan

  const loanFilter = searchParams.get('loanFilter')
  if (loanFilter && loanFilter !== 'undefined' && loanFilter !== 'null')
    queryParams += `loanFilter=${loanFilter}&`

  const loanSortBy = searchParams.get('loanSortBy') || 'name'
  queryParams += `loanSortBy=${loanSortBy}&`

  const loanFilterStartDate = searchParams.get('loanFilterStartDate')
  if (
    loanFilterStartDate &&
    loanFilterStartDate !== 'undefined' &&
    loanFilterStartDate !== 'null'
  )
    queryParams += `loanFilterStartDate=${loanFilterStartDate}&`

  const loanFilterEndDate = searchParams.get('loanFilterEndDate')
  if (
    loanFilterEndDate &&
    loanFilterEndDate !== 'undefined' &&
    loanFilterEndDate !== 'null'
  )
    queryParams += `loanFilterEndDate=${loanFilterEndDate}&`

  const loanFilterStatus = searchParams.get('loanFilterStatus')
  if (
    loanFilterStatus &&
    loanFilterStatus !== 'undefined' &&
    loanFilterStatus !== 'null'
  )
    queryParams += `loanFilterStatus=${loanFilterStatus}&`

  const loanSortDir = searchParams.get('loanSortDir') || 'asc'
  queryParams += `loanSortDir=${loanSortDir}&`

  //////////// ----------- sheduled payment

  const scheduledPaymentFilter = searchParams.get('scheduledPaymentFilter')
  if (
    scheduledPaymentFilter &&
    scheduledPaymentFilter !== 'undefined' &&
    scheduledPaymentFilter !== 'null'
  )
    queryParams += `scheduledPaymentFilter=${scheduledPaymentFilter}&`

  const scheduleSortBy = searchParams.get('scheduleSortBy') || 'dueDate'
  queryParams += `scheduleSortBy=${scheduleSortBy}&`

  const scheduledPaymentFilterStartDate = searchParams.get(
    'scheduledPaymentFilterStartDate'
  )
  if (
    scheduledPaymentFilterStartDate &&
    scheduledPaymentFilterStartDate !== 'undefined' &&
    scheduledPaymentFilterStartDate !== 'null'
  )
    queryParams += `scheduledPaymentFilterStartDate=${scheduledPaymentFilterStartDate}&`

  const scheduledPaymentFilterEndDate = searchParams.get(
    'scheduledPaymentFilterEndDate'
  )
  if (
    scheduledPaymentFilterEndDate &&
    scheduledPaymentFilterEndDate !== 'undefined' &&
    scheduledPaymentFilterEndDate !== 'null'
  )
    queryParams += `scheduledPaymentFilterEndDate=${scheduledPaymentFilterEndDate}&`

  const scheduledPaymentCallStatus = searchParams.get(
    'scheduledPaymentCallStatus'
  )
  if (
    scheduledPaymentCallStatus &&
    scheduledPaymentCallStatus !== 'undefined' &&
    scheduledPaymentCallStatus !== 'null'
  )
    queryParams += `scheduledPaymentCallStatus=${scheduledPaymentCallStatus}&`

  const schedulePaymentFilterPaidStatus = searchParams.get(
    'schedulePaymentFilterPaidStatus'
  )
  if (
    schedulePaymentFilterPaidStatus &&
    schedulePaymentFilterPaidStatus !== 'undefined' &&
    schedulePaymentFilterPaidStatus !== 'null'
  )
    queryParams += `schedulePaymentFilterPaidStatus=${schedulePaymentFilterPaidStatus}&`

  const scheduleSortDir = searchParams.get('scheduleSortDir') || 'asc'
  queryParams += `scheduleSortDir=${scheduleSortDir}&`

  return queryParams
}

export const queryStringOptions = [
  'clientFilter',
  'clientSortBy',
  'applicationFilter',
  'applicationSortBy',
  'applicationFilterStartDate',
  'applicationFilterEndDate',
  'applicationFilterStatus',
  'applicationSortDir',
  'loanFilter',
  'loanFilterStartDate',
  'loanFilterEndDate',
  'loanSortBy',
  'loanSortDir',
  'loanFilterStatus',
  'scheduledPaymentFilter',
  'scheduleSortBy',
  'scheduledPaymentFilterStartDate',
  'scheduledPaymentFilterEndDate',
  'scheduledPaymentCallStatus',
  'schedulePaymentFilterPaidStatus',
  'scheduleSortDir',
]
