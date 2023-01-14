import type { ActionFunction, LoaderFunction } from '@remix-run/node';
import { Client, LoanStatus, User } from '@prisma/client';
import { Link, useLoaderData, useSearchParams } from '@remix-run/react';
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
} from '~/util/query-string';

import AdjustmentEntryWithPaymentScheduleTable from '../../../../components/adjustment-entry-with-schedule';
import AdjustmentList from '../../../../components/adjustment-list';
import { DateTime } from 'luxon';
import PaymentScheduleTable from '~/components/payment-schedule-table';
import { Permission } from '@prisma/client';
import React from 'react';
import { TransactionType } from '@prisma/client';
import { authenticatedUser } from '~/services/server_side/user_services.server';
import { json } from '@remix-run/node';
import { prisma } from '~/util/prisma.server';
import { redirect } from '@remix-run/node';
import { validationError } from 'remix-validated-form';
import { withZod } from '@remix-validated-form/with-zod';
import { z } from 'zod';

type ExpandedPaymentReceipt = Awaited<
  ReturnType<typeof prisma.paymentReceipt.findUnique>
> & {
  receipt: ExpandedReceipt;
};

export type ExpandedReceipt = Awaited<
  ReturnType<typeof prisma.receipt.findUnique>
> & {
  receivedBy: User;
};

export type ExpandedScheduledPayment = Awaited<
  ReturnType<typeof prisma.scheduledPayment.findUnique>
> & {
  paymentReceipts: ExpandedPaymentReceipt[];
};

export type ExpandedLoan = Awaited<
  ReturnType<typeof prisma.loan.findUnique>
> & {
  scheduledPayments: ExpandedScheduledPayment[];
  loanAdjustments: ExpandedAdjustment[];
  client: Client;
};

export type ExpandedAdjustment = Awaited<
  ReturnType<typeof prisma.loanAdjustment.findUnique>
> & {
  createdBy: User;
};

interface LoaderData {
  loggedInUser: User;
  loan: ExpandedLoan;
  unearnedInterest: number;
  principalBalance: number;
}

const schema = z.object({
  amount: z.string().refine((val) => !Number.isNaN(Number(val)), {
    message: 'Please enter a valid amount',
  }),
});

const amountOutstanding = (payment: ExpandedScheduledPayment) => {
  const totalAmountPaid = payment.paymentReceipts.reduce((acc, curr) => {
    return acc + curr.amount;
  }, 0);

  return payment.amount - totalAmountPaid;
};

const getNextAdjustmenttNum = async () => {
  const lastAdjustment = await prisma.loanAdjustment.findFirst({
    orderBy: {
      adjustmentNum: 'desc',
    },
  });
  if (!lastAdjustment) return '100';
  return `${parseInt(lastAdjustment.adjustmentNum, 10) + 1}`;
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.LOAN_ADJUSTMENT];
  const loggedInUser = await authenticatedUser(request, permissions);
  if (typeof loggedInUser === 'string') return redirect(loggedInUser);

  const loanId = params.loanId;

  if (!loanId)
    return redirect(`/loans?${buildQueryStringFromRequest(request)}`);

  const loan = await prisma.loan.findUnique({
    where: {
      id: loanId,
    },
    include: {
      client: true,
      loanAdjustments: {
        include: {
          createdBy: true,
        },
      },
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
  });

  if (!loan) return redirect(`/loans?${buildQueryStringFromRequest(request)}`);

  // for each scheduled payment, we need to calculate the interest and principal outstanding and add them up
  const principalPerPayment = Math.round(
    (loan.dueMonthly * loan.numPayments - loan.initialUnearnedInterest) /
      loan.numPayments
  );

  let unearnedInterest = 0;
  let principalBalance = 0;
  loan.scheduledPayments.forEach((payment) => {
    const amountOutstandingForPayment = amountOutstanding(payment);
    if (amountOutstandingForPayment > principalPerPayment) {
      unearnedInterest += amountOutstandingForPayment - principalPerPayment;
      principalBalance += principalPerPayment;
    } else {
      principalBalance += amountOutstandingForPayment;
    }
  });

  return json<LoaderData>({
    loggedInUser,
    loan,
    unearnedInterest,
    principalBalance,
  });
};

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [Permission.RECEIPT_CREATE];
  const loggedInUser = await authenticatedUser(request, permissions);
  if (typeof loggedInUser === 'string') return redirect(loggedInUser);

  const loanId = params.loanId;

  if (!loanId)
    return redirect(`/loans?${buildQueryStringFromRequest(request)}`);

  const fd = await request.formData();

  const formAction = fd.get('action');

  if (formAction === 'adjustment') {
    const loan = await prisma.loan.findUnique({
      where: {
        id: loanId,
      },
      include: {
        loanAdjustments: {
          include: {
            createdBy: true,
          },
        },
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
    });

    if (!loan)
      return redirect(`/loans?${buildQueryStringFromRequest(request)}`);

    const serverValidator = withZod(schema);
    const data = await serverValidator.validate(fd);
    if (data.error) {
      return validationError(data.error);
    }
    const scheduledPayments = loan.scheduledPayments
      .map((sp) => {
        return {
          ...sp,
          balance: amountOutstanding(sp),
        };
      })
      .filter((sp) => sp.balance > 0)
      .sort((a, b) => a.paymentNumber - b.paymentNumber);

    const totalBalance = scheduledPayments.reduce((acc, curr) => {
      return acc + curr.balance;
    }, 0);

    if (Number(data.data.amount) > totalBalance) {
      return validationError({
        fieldErrors: {
          amount: 'Amount is greater than the total balance',
        },
      });
    }

    let paidOff = Number(data.data.amount) === totalBalance;

    const allocatedAdjustments = [];

    let principalAdjustments = 0;
    let interestAdjustments = 0;

    let availableAdjustment = Number(data.data.amount);

    const principalPerPayment = Math.round(loan.amount / loan.numPayments);

    // first, allocate the interest
    for (let idx: number = 0; idx < scheduledPayments.length; idx++) {
      const schedPmt = scheduledPayments[idx];

      const interestOutstanding =
        schedPmt.balance < principalPerPayment
          ? 0
          : schedPmt.balance - principalPerPayment;

      if (interestOutstanding > 0 && availableAdjustment > 0) {
        if (interestOutstanding <= availableAdjustment) {
          allocatedAdjustments.push({
            id: scheduledPayments[idx].id,
            amount: interestOutstanding,
          });
          availableAdjustment -= interestOutstanding;
          interestAdjustments += interestOutstanding;
        } else {
          allocatedAdjustments.push({
            id: scheduledPayments[idx].id,
            amount: availableAdjustment,
          });
          interestAdjustments += Math.min(
            interestOutstanding,
            availableAdjustment
          );
          availableAdjustment = 0;
        }
      }
    }

    // then, allocate the principal
    if (availableAdjustment > 0) {
      for (let idx: number = 0; idx < scheduledPayments.length; idx++) {
        const schedPmt = scheduledPayments[idx];

        const interestAllocation = allocatedAdjustments.find(
          (a) => a.id === schedPmt.id
        );

        const balanceReductionForInterest: number = interestAllocation
          ? interestAllocation.amount
          : 0;

        const principalOutstanding =
          schedPmt.balance > principalPerPayment
            ? principalPerPayment
            : schedPmt.balance - balanceReductionForInterest;

        if (principalOutstanding > 0 && availableAdjustment > 0) {
          if (principalOutstanding <= availableAdjustment) {
            allocatedAdjustments.push({
              id: schedPmt.id,
              amount: principalOutstanding,
            });
            availableAdjustment -= principalOutstanding;
            principalAdjustments += principalOutstanding;
          } else {
            allocatedAdjustments.push({
              id: schedPmt.id,
              amount: availableAdjustment,
            });

            principalAdjustments += Math.min(
              principalOutstanding,
              availableAdjustment
            );
            availableAdjustment = 0;
          }
        }
      }
    }

    // summarize allocatedAdjustments by id
    const summary = allocatedAdjustments.reduce((acc: any, curr) => {
      if (acc[curr.id]) {
        acc[curr.id] += curr.amount;
      } else {
        acc[curr.id] = curr.amount;
      }
      return acc;
    }, {});

    // convert to array
    const summaryArray = Object.keys(summary).map((key) => {
      return {
        id: key,
        amount: summary[key],
      };
    });

    // reduce all the scheduled payment amounts based on whats in allocatedAdjustments
    await Promise.all(
      summaryArray.map((ap) => {
        return prisma.scheduledPayment.update({
          where: {
            id: ap.id,
          },
          data: {
            amount: {
              decrement: ap.amount,
            },
          },
        });
      })
    );

    const nextAdjustmentNum = await getNextAdjustmenttNum();
    const adjustment = await prisma.loanAdjustment.create({
      data: {
        adjustmentNum: nextAdjustmentNum,
        amount: Number(data.data.amount),
        loan: {
          connect: {
            id: loan.id,
          },
        },
        createdBy: {
          connect: {
            id: loggedInUser.id,
          },
        },
      },
    });

    const loanControlAccount = await prisma.account.findFirst({
      where: {
        name: 'Loan Control',
      },
    });

    const unearnedInterestAccount = await prisma.account.findFirst({
      where: {
        name: 'Unearned Interest',
      },
    });

    const loanAdjustmentsAccount = await prisma.account.findFirst({
      where: {
        name: 'Bad Debt / Loan Adjustments',
      },
    });

    // reverse the interest
    if (interestAdjustments > 0) {
      const interestTransaction = await prisma.transaction.create({
        data: {
          amount: interestAdjustments,
          activityType: TransactionType.ADJUSTMENT,
          activityId: adjustment.id,
          date: DateTime.now().toISO(),
          debitAccount: {
            connect: {
              id: unearnedInterestAccount!.id,
            },
          },
          creditAccount: {
            connect: {
              id: loanControlAccount!.id,
            },
          },
        },
      });

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
      });

      await prisma.account.update({
        where: {
          id: loanControlAccount!.id,
        },
        data: {
          credits: {
            connect: {
              id: interestTransaction.id,
            },
          },
        },
      });
    }

    // reduce the principal
    if (principalAdjustments > 0) {
      const lossTransaction = await prisma.transaction.create({
        data: {
          amount: principalAdjustments,
          activityType: TransactionType.ADJUSTMENT,
          activityId: adjustment.id,
          date: DateTime.now().toISO(),
          debitAccount: {
            connect: {
              id: loanAdjustmentsAccount!.id,
            },
          },
          creditAccount: {
            connect: {
              id: loanControlAccount!.id,
            },
          },
        },
      });

      await prisma.account.update({
        where: {
          id: loanAdjustmentsAccount!.id,
        },
        data: {
          debits: {
            connect: {
              id: lossTransaction.id,
            },
          },
        },
      });

      await prisma.account.update({
        where: {
          id: loanControlAccount!.id,
        },
        data: {
          credits: {
            connect: {
              id: lossTransaction.id,
            },
          },
        },
      });
    }

    if (paidOff) {
      await prisma.loan.update({
        where: {
          id: loan.id,
        },
        data: {
          status: LoanStatus.PAID,
        },
      });
    }
  }
  return null;
};

const Adjustments = () => {
  const {
    loan: ln,
    loggedInUser: u,
    unearnedInterest,
    principalBalance,
  } = useLoaderData<LoaderData>();

  const loan = ln as unknown as ExpandedLoan;
  const loggedInUser = u as unknown as User;
  const client = loan.client;

  const [searchParams] = useSearchParams();

  const getLastPaymentNum = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments;

    let paymentNum = 0;
    const numPayments = loan.numPayments;

    const paymentReceipts = scheduledPayments
      .map((scheduledPayment) => scheduledPayment.paymentReceipts)
      .flat();

    const adjustments = paymentReceipts.map(
      (paymentReceipt) => paymentReceipt.receipt
    );

    const lastReceipt = adjustments.sort((a, b) => {
      if (a.receiptDate < b.receiptDate) return 1;
      if (a.receiptDate > b.receiptDate) return -1;
      return 0;
    })[0];

    if (lastReceipt) {
      const lastPaymentReceipt = paymentReceipts
        .filter((paymentReceipt) => paymentReceipt.receiptId === lastReceipt.id)
        .sort((a, b) => {
          if (a.createdAt < b.createdAt) return 1;
          if (a.createdAt > b.createdAt) return -1;
          return 0;
        })[0];

      if (lastPaymentReceipt) {
        const lastScheduledPayment = scheduledPayments.filter(
          (scheduledPayment) =>
            scheduledPayment.id === lastPaymentReceipt.scheduledPaymentId
        )[0];

        if (lastScheduledPayment) {
          paymentNum = lastScheduledPayment.paymentNumber;
        }
      }
    }

    return `${paymentNum}/${numPayments}`;
  };

  const getAmountOutstanding = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments;

    const allPayments = scheduledPayments
      .map((scheduledPayment) => scheduledPayment.paymentReceipts)
      .flat();

    const totalAmountPaid = allPayments.reduce((acc, curr) => {
      return acc + curr.amount;
    }, 0);

    const totalAmountExpected = scheduledPayments.reduce((acc, curr) => {
      return acc + curr.amount;
    }, 0);

    return totalAmountExpected - totalAmountPaid;
  };

  return (
    <div className="flex flex-col w-full p-4 mt-10 space-y-6 border border-gray-200 rounded-lg shadow-md bg-slate-50 text-slate-900 sm:p-6 md:p-8">
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
          <AdjustmentEntryWithPaymentScheduleTable
            loan={loan}
            unearnedInterest={unearnedInterest}
            principalBalance={principalBalance}
            loggedInUser={loggedInUser}
          />
        </div>

        <div className="w-1/2 text-sm">
          <AdjustmentList adjustments={loan.loanAdjustments} />
        </div>
      </div>
    </div>
  );
};

export default Adjustments;
