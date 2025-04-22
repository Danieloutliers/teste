import { differenceInDays, addDays, addWeeks, addMonths, format, parse, isAfter } from 'date-fns';
import { Loan, Payment, PaymentFrequency, LoanStatus } from '../types';

/**
 * Calculate the total amount due for a loan (principal + interest)
 */
export function calculateTotalDue(loan: Loan | undefined): number {
  if (!loan) return 0;
  
  const principal = loan.principal;
  const rate = loan.interestRate / 100;
  
  // Calcular baseado na frequência de pagamento
  let interest = 0;
  
  if (loan.frequency && loan.installments) {
    // Calcula o número de períodos com base na frequência
    let periods = loan.installments;
    let periodRate: number;
    
    switch (loan.frequency) {
      case 'weekly':
        periodRate = rate / 52; // Taxa anual dividida por 52 semanas
        break;
      case 'biweekly':
        periodRate = rate / 26; // Taxa anual dividida por 26 períodos de duas semanas
        break;
      case 'monthly':
        periodRate = rate / 12; // Taxa anual dividida por 12 meses
        break;
      case 'quarterly':
        periodRate = rate / 4;  // Taxa anual dividida por 4 trimestres
        break;
      case 'yearly':
        periodRate = rate;      // Taxa anual
        break;
      case 'custom':
      default:
        // Para frequência personalizada, usamos o cálculo com base nos dias
        const daysTotal = differenceInDays(
          new Date(loan.dueDate),
          new Date(loan.issueDate)
        );
        interest = principal * rate * (daysTotal / 365);
        return principal + interest;
    }
    
    // Para as frequências padrão, calculamos o juros com base no período e número de parcelas
    interest = principal * periodRate * periods;
  } else {
    // Método alternativo se não tivermos frequência ou número de parcelas
    const daysTotal = differenceInDays(
      new Date(loan.dueDate),
      new Date(loan.issueDate)
    );
    interest = principal * rate * (daysTotal / 365);
  }
  
  return principal + interest;
}

/**
 * Calculate the remaining balance on a loan after all payments
 */
export function calculateRemainingBalance(loan: Loan | undefined, payments: Payment[] = []): number {
  if (!loan) return 0;
  
  const totalDue = calculateTotalDue(loan);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  
  return Math.max(0, totalDue - totalPaid);
}

/**
 * Calculate the principal balance remaining on a loan after all payments
 */
export function calculatePrincipalBalance(loan: Loan | undefined, payments: Payment[] = []): number {
  if (!loan) return 0;
  
  const principal = loan.principal;
  const principalPaid = payments.reduce((sum, payment) => sum + payment.principal, 0);
  
  return Math.max(0, principal - principalPaid);
}

/**
 * Check if a loan is overdue
 */
export function isLoanOverdue(loan: Loan | undefined): boolean {
  if (!loan) return false;
  if (loan.status === 'paid') return false;
  
  const today = new Date();
  
  // If there's a next payment date and it's in the past
  if (loan.nextPaymentDate && isAfter(today, new Date(loan.nextPaymentDate))) {
    return true;
  }
  
  // If the entire loan is past due date
  if (isAfter(today, new Date(loan.dueDate))) {
    return true;
  }
  
  return false;
}

/**
 * Get the number of days a loan is overdue
 */
export function getDaysOverdue(loan: Loan | undefined): number {
  if (!loan) return 0;
  if (loan.status === 'paid') return 0;
  
  const today = new Date();
  const checkDate = loan.nextPaymentDate 
    ? new Date(loan.nextPaymentDate)
    : new Date(loan.dueDate);
  
  if (isAfter(today, checkDate)) {
    return differenceInDays(today, checkDate);
  }
  
  return 0;
}

/**
 * Distribute a payment between principal and interest
 */
export function calculatePaymentDistribution(
  loan: Loan | undefined, 
  paymentAmount: number, 
  payments: Payment[] = []
): { principal: number; interest: number } {
  if (!loan) {
    return { principal: 0, interest: 0 };
  }
  
  // Calculate accumulated interest so far
  const principal = loan.principal;
  const rate = loan.interestRate / 100;
  const issueDate = new Date(loan.issueDate);
  const today = new Date();
  
  // Calculate days since issue or last payment
  const lastPaymentDate = payments.length > 0
    ? new Date(Math.max(...payments.map(p => new Date(p.date).getTime())))
    : issueDate;
  
  const daysSinceLastPayment = differenceInDays(today, lastPaymentDate);
  
  // Get remaining principal
  const remainingPrincipal = calculatePrincipalBalance(loan, payments);
  
  // Ajustar a taxa conforme a frequência de pagamento
  let periodRate = rate;
  
  // Ajustar a taxa de juros de acordo com a frequência de pagamento
  if (loan.frequency) {
    switch (loan.frequency) {
      case 'weekly':
        periodRate = rate / 52; // Taxa anual dividida por 52 semanas
        break;
      case 'biweekly':
        periodRate = rate / 26; // Taxa anual dividida por 26 períodos de duas semanas
        break;
      case 'monthly':
        periodRate = rate / 12; // Taxa anual dividida por 12 meses
        break;
      case 'quarterly':
        periodRate = rate / 4;  // Taxa anual dividida por 4 trimestres
        break;
      case 'yearly':
        // Taxa anual permanece a mesma
        break;
      default:
        // Para 'custom' ou outros valores, usamos a taxa diária
        periodRate = rate / 365;  // Taxa diária
        break;
    }
  }
  
  // Calcular juros acumulados com base na frequência
  let accruedInterest;
  
  if (loan.frequency === 'custom') {
    // Para frequência personalizada, usamos a taxa diária
    accruedInterest = remainingPrincipal * rate * (daysSinceLastPayment / 365);
  } else {
    // Para as outras frequências, aplicamos a taxa do período
    accruedInterest = remainingPrincipal * periodRate;
  }
  
  // If payment covers interest and some principal
  if (paymentAmount > accruedInterest) {
    return {
      interest: accruedInterest,
      principal: paymentAmount - accruedInterest
    };
  }
  
  // If payment only covers part of the interest
  return {
    interest: paymentAmount,
    principal: 0
  };
}

/**
 * Determine the new loan status based on payment history
 */
export function determineNewLoanStatus(
  loan: Loan | undefined, 
  payments: Payment[] = []
): LoanStatus {
  if (!loan) return 'active';
  
  // Check if fully paid
  const remainingBalance = calculateRemainingBalance(loan, payments);
  if (remainingBalance <= 0) {
    return 'paid';
  }
  
  // Check if defaulted (90+ days overdue)
  const daysOverdue = getDaysOverdue(loan);
  if (daysOverdue >= 90) {
    return 'defaulted';
  }
  
  // Check if overdue
  if (daysOverdue > 0) {
    return 'overdue';
  }
  
  // Otherwise active
  return 'active';
}

/**
 * Calculate the next payment date based on frequency
 */
export function calculateNextPaymentDate(
  currentDate: Date, 
  frequency: PaymentFrequency
): Date {
  switch (frequency) {
    case 'weekly':
      return addWeeks(currentDate, 1);
    case 'biweekly':
      return addWeeks(currentDate, 2);
    case 'monthly':
      return addMonths(currentDate, 1);
    case 'quarterly':
      return addMonths(currentDate, 3);
    case 'yearly':
      return addMonths(currentDate, 12);
    case 'custom':
    default:
      return addMonths(currentDate, 1); // Default to monthly
  }
}

/**
 * Calculate installment amount based on loan terms
 */
export function calculateInstallmentAmount(loan: Loan | undefined): number {
  if (!loan) return 0;
  if (!loan.installments || loan.installments <= 0) return calculateTotalDue(loan);
  
  const totalDue = calculateTotalDue(loan);
  return totalDue / loan.installments;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'dd/MM/yyyy');
}
