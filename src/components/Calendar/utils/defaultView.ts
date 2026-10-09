/**
 * The view a user lands on before they have chosen one.
 *
 * A month grid on a phone is a page of dots too small to read or tap, so a narrow screen starts
 * on the agenda — a plain list of what is coming (UI-8). A wider one keeps the month. A view the
 * user has picked is stored and always wins over this.
 */
export function defaultView(isNarrow: boolean): 'agenda' | 'month' {
  return isNarrow ? 'agenda' : 'month'
}
