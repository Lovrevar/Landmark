/*
  # bank_credits.monthly_payment under the company's repayment model

  DEFECT_BACKLOG FUND-5 (decided 2026-10-01): credits are repaid in equal principal instalments at
  the principal frequency, starting after the grace period, with interest on the outstanding
  balance at the interest frequency. The app stores `monthly_payment` as the monthly-equivalent debt
  service when principal repayment starts:

      principal per payment / months between principal payments
    + amount × annual rate / 12

  (`calculateMonthlyDebtService` in src/components/Funding/Investors/utils/creditCalculations.ts.)
  Until now it stored an annuity instalment, assuming ten years when there was no maturity date, so
  the "monthly debt service" on the Director dashboard and the general report mixed two models.

  This recomputes the stored figure for every non-equity credit with the same formula, so old and new
  rows agree:
  - number of principal payments = ceil(principal months / months per payment), at least 1, where
    principal months = whole months from start to maturity minus the grace period (at least 1);
  - 0 when there is no maturity date or the grace period reaches the maturity date;
  - repayment_type becomes 'monthly', the label the figure is shown under.
  Equity rows (`credit_type = 'equity'`) keep their own figures.
*/

WITH terms AS (
  SELECT
    bc.id,
    bc.amount,
    COALESCE(bc.interest_rate, 0) AS interest_rate,
    CASE bc.principal_repayment_type
      WHEN 'quarterly' THEN 3
      WHEN 'biyearly'  THEN 6
      WHEN 'yearly'    THEN 12
      ELSE 1
    END AS step_months,
    (bc.start_date + make_interval(months => COALESCE(bc.grace_period, 0)))::date AS principal_start,
    bc.maturity_date,
    GREATEST(1,
      (date_part('year',  age(bc.maturity_date, bc.start_date)) * 12
       + date_part('month', age(bc.maturity_date, bc.start_date)))::int
    ) AS total_months,
    COALESCE(bc.grace_period, 0) AS grace_months
  FROM public.bank_credits bc
  WHERE bc.credit_type IS DISTINCT FROM 'equity'
), plan AS (
  SELECT
    t.id,
    CASE
      WHEN t.maturity_date IS NULL OR t.principal_start >= t.maturity_date OR COALESCE(t.amount, 0) = 0 THEN 0
      ELSE round(
        t.amount / GREATEST(1, ceil(GREATEST(1, t.total_months - t.grace_months)::numeric / t.step_months))
                 / t.step_months
        + t.amount * t.interest_rate / 100 / 12
      , 2)
    END AS monthly_debt_service
  FROM terms t
)
UPDATE public.bank_credits bc
SET monthly_payment = plan.monthly_debt_service,
    repayment_type  = 'monthly'
FROM plan
WHERE bc.id = plan.id
  AND (bc.monthly_payment IS DISTINCT FROM plan.monthly_debt_service OR bc.repayment_type IS DISTINCT FROM 'monthly');
