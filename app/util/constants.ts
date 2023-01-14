import { AccountType } from '@prisma/client'

export const DEFAULT_MAXIMUM_LOAN_AMOUNT = 10000
export const DEFAULT_TERM = 6

export const defaultStartingAccountNumbers = {
  [AccountType.CASH]: '1000',
  [AccountType.OTHER_ASSET]: '2000',
  [AccountType.LIABILITY]: '3000',
  [AccountType.REVENUE]: '4000',
  [AccountType.EXPENSE]: '5000',
}
