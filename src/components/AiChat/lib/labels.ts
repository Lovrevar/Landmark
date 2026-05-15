export const TOOL_LABELS_HR: Record<string, string> = {
  search_projects: 'Pretraživanje projekata',
  get_project_details: 'Učitavanje detalja projekta',
  list_project_phases: 'Učitavanje faza projekta',
  search_subcontractors: 'Pretraživanje izvođača',
  list_contracts: 'Učitavanje ugovora',
  get_subcontractor_payment_status: 'Provjera statusa plaćanja izvođača',
  list_payments_for_subcontractor: 'Učitavanje povijesti plaćanja',
  get_invoice_summary: 'Sažetak računa',
  get_project_financial_summary: 'Financijski sažetak projekta',
  list_unpaid_invoices: 'Neplaćeni računi',
}

export const ERROR_LABELS_HR: Record<string, string> = {
  bad_request: 'Neispravan zahtjev.',
  message_too_long: 'Poruka je predugačka.',
  session_not_found: 'Razgovor nije pronađen.',
  model_rate_limited: 'Model je trenutno preopterećen. Pokušajte ponovno za nekoliko trenutaka.',
  model_timeout: 'Model nije odgovorio na vrijeme. Pokušajte ponovno.',
  model_unreachable: 'Greška u komunikaciji s modelom. Pokušajte ponovno.',
  model_bad_request: 'Interna greška pri pripremi upita. Prijavite ovo administratoru.',
  model_auth_failed: 'Greška u autentikaciji s modelom. Prijavite ovo administratoru.',
  model_error: 'Greška pri pozivu modela. Pokušajte ponovno.',
  rate_limited: 'Previše zahtjeva. Pokušajte ponovno za nekoliko minuta.',
  persistence_error: 'Greška pri spremanju razgovora.',
  request_timeout: 'Zahtjev je trajao predugo. Pokušajte ponovno.',
  internal_error: 'Interna greška.',
  load_failed: 'Greška pri učitavanju razgovora.',
  unknown_error: 'Neočekivana greška. Pokušajte ponovno.',
}

export function toolLabel(tool: string): string {
  return TOOL_LABELS_HR[tool] || tool
}

export function errorLabel(code: string, fallback: string): string {
  return ERROR_LABELS_HR[code] || fallback
}
