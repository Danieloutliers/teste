import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLoanContext } from '@/context/LoanContext';
import { differenceInDays } from 'date-fns';
import { formatCurrency } from '@/utils/format';

export default function UpcomingDueLoans() {
  const { getUpcomingDueLoans } = useLoanContext();
  
  // Get loans due in the next 15 days
  const upcomingLoans = getUpcomingDueLoans(15);
  
  const getDaysUntilDue = (dateString: string | null): number => {
    if (!dateString) return 0;
    return differenceInDays(new Date(dateString), new Date());
  };
  
  return (
    <Card className="bg-white border border-slate-200">
      <CardContent className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-900">Próximos Vencimentos</h3>
          <Link href="/loans">
            <Button variant="link" className="text-sm font-medium text-primary-600 hover:text-primary-700 p-0">
              Ver todos
            </Button>
          </Link>
        </div>
        
        <div className="space-y-4">
          {upcomingLoans.length > 0 ? (
            upcomingLoans.map((loan) => (
              <div 
                key={loan.id} 
                className="p-3 bg-slate-50 rounded-md border border-slate-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-800">{loan.borrowerName}</p>
                    <p className="text-sm text-slate-500">
                      Vence em {getDaysUntilDue(loan.nextPaymentDate)} dias
                    </p>
                  </div>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(loan.installmentAmount || 0)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-center">
              <p className="text-slate-500">Nenhum vencimento próximo</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
