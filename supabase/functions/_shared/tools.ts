// AI chat tool catalog.
//
// This file defines the 12 tools the assistant can invoke and the role-based
// filter that selects which tools each user is allowed to use. Each handler
// is currently a stub that echoes its input back; real handlers move to
// ./tool-handlers.ts in Phase 3.2.
//
// Descriptions are model-facing English: they are the only signal the model
// uses to choose tools, so they must be specific (what / when / non-obvious
// constraints).

import type { AuthContext, Role } from './auth.ts'
import {
  handleCreateDocument,
  handleGetDocumentDownloadLink,
  handleGetInvoiceSummary,
  handleGetProjectDetails,
  handleGetProjectFinancialSummary,
  handleGetSubcontractorPaymentStatus,
  handleListContracts,
  handleListDocumentsForEntity,
  handleListPaymentsForSubcontractor,
  handleListProjectPhases,
  handleListUnpaidInvoices,
  handleSearchProjects,
  handleSearchSubcontractors,
  type CreateDocumentInput,
  type GetDocumentDownloadLinkInput,
  type GetInvoiceSummaryInput,
  type GetProjectDetailsInput,
  type GetProjectFinancialSummaryInput,
  type GetSubcontractorPaymentStatusInput,
  type ListContractsInput,
  type ListDocumentsForEntityInput,
  type ListPaymentsForSubcontractorInput,
  type ListProjectPhasesInput,
  type ListUnpaidInvoicesInput,
  type SearchProjectsInput,
  type SearchSubcontractorsInput,
} from './tool-handlers.ts'
import { handleSearchHelp, type HelpSearchContext, type SearchHelpInput } from './help-search.ts'

/**
 * Per-request, non-auth context threaded into every tool handler. Existing
 * handlers ignore it (TS allows a 2-arg function to satisfy this 3-arg type);
 * search_help reads `helpSearch` to apply route boost and to log telemetry.
 */
export interface ToolHandlerExtras {
  helpSearch: HelpSearchContext
}

export interface ToolDefinition<I = Record<string, unknown>, O = unknown> {
  name: string
  description: string
  // JSON Schema shaped for Anthropic's tools API. We intentionally don't pull
  // in a JSON Schema type from a library — the field is documentation for the
  // model, not runtime-validated here. Phase 3.2 may add validation per tool.
  input_schema: Record<string, unknown>
  requiredRoles: Role[]
  handler: (input: I, ctx: AuthContext, extras: ToolHandlerExtras) => Promise<O>
}

const ALL_ROLES: Role[] = ['Director', 'Accounting', 'Sales', 'Supervision', 'Investment']
const FINANCE_ROLES: Role[] = ['Director', 'Accounting']
const FINANCE_PLUS_SUPERVISION: Role[] = ['Director', 'Accounting', 'Supervision']

// ---------------------------------------------------------------------------
// TOOLS
// ---------------------------------------------------------------------------
// Order matches the role-gating table in the spec. Phase 3.2 batches will
// replace each stub handler with real logic.

export const TOOLS: ToolDefinition[] = [
  {
    name: 'search_projects',
    description:
      'Search for construction projects by name using a case-insensitive substring match. ' +
      'Use this when the user mentions a project by name and you need its UUID for a subsequent tool call. ' +
      'Returns up to `limit` matches with id, name, location, and status. Does NOT search retail projects.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Substring to match against project name. Case-insensitive.',
          minLength: 1,
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return.',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    handler: (input, ctx) => handleSearchProjects(input as unknown as SearchProjectsInput, ctx),
  },

  {
    name: 'get_project_details',
    description:
      'Fetch full details for a single project: name, location, start/end dates, budget, status, and ' +
      'counts of phases, contracts, and milestones. Use this after `search_projects` has returned a ' +
      'project_id, when the user asks "tell me about project X" or wants a status overview.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          format: 'uuid',
          description: 'The project UUID, typically obtained from `search_projects`.',
        },
      },
      required: ['project_id'],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    handler: (input, ctx) => handleGetProjectDetails(input as unknown as GetProjectDetailsInput, ctx),
  },

  {
    name: 'list_project_phases',
    description:
      'List all phases for a given project, ordered by phase_number. Each phase includes its name, ' +
      'start/end dates, status, and the static `budget_allocated` figure. ' +
      'Note: the `budget_used` column on the phase row is NOT trigger-maintained and may be stale; ' +
      'if the user wants accurate spend numbers, call `get_project_financial_summary` instead.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          format: 'uuid',
          description: 'The project UUID whose phases to list.',
        },
      },
      required: ['project_id'],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    handler: (input, ctx) => handleListProjectPhases(input as unknown as ListProjectPhasesInput, ctx),
  },

  {
    name: 'search_subcontractors',
    description:
      'Search subcontractors (the construction-side suppliers) by name using a case-insensitive substring match. ' +
      'Use this when the user references a subcontractor by name and you need their UUID. ' +
      'Note: in this codebase, `accounting_invoices.supplier_id` points to subcontractors — there is no separate ' +
      '"suppliers" table. Returns id, name, contact, and active_contracts_count.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Substring to match against subcontractor name. Case-insensitive.',
          minLength: 1,
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return.',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    handler: (input, ctx) => handleSearchSubcontractors(input as unknown as SearchSubcontractorsInput, ctx),
  },

  {
    name: 'list_contracts',
    description:
      'List construction contracts with optional filters by project_id, phase_id, subcontractor_id, and status. ' +
      'Use this when the user asks about active or completed contracts, or wants to see work agreements with a ' +
      'particular subcontractor. The `budget_realized` field is automatically maintained from payments and is the ' +
      'authoritative spend figure for a contract.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', format: 'uuid', description: 'Filter to contracts on this project.' },
        phase_id: { type: 'string', format: 'uuid', description: 'Filter to contracts on this phase.' },
        subcontractor_id: { type: 'string', format: 'uuid', description: 'Filter to contracts with this subcontractor.' },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'completed', 'terminated'],
          description: 'Filter by contract status. Note: lowercase values, distinct from project/invoice status casing.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum number of results to return.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    handler: (input, ctx) => handleListContracts(input as unknown as ListContractsInput, ctx),
  },

  {
    name: 'get_subcontractor_payment_status',
    description:
      'Compute the headline payment status for a single subcontractor: total contracted amount, total invoiced ' +
      'amount, total paid, and outstanding balance. Use this when the user asks "is X paid up?" or "how much do we ' +
      'still owe X?". Construction-side only — retail invoices and retail suppliers are not aggregated here.',
    input_schema: {
      type: 'object',
      properties: {
        subcontractor_id: {
          type: 'string',
          format: 'uuid',
          description: 'The subcontractor UUID, typically obtained from `search_subcontractors`.',
        },
      },
      required: ['subcontractor_id'],
      additionalProperties: false,
    },
    requiredRoles: FINANCE_ROLES,
    handler: (input, ctx) =>
      handleGetSubcontractorPaymentStatus(input as unknown as GetSubcontractorPaymentStatusInput, ctx),
  },

  {
    name: 'list_unpaid_invoices',
    description:
      'List invoices with status UNPAID or PARTIALLY_PAID, optionally filtered by subcontractor_id or project_id. ' +
      'Use this for questions like "what do we still owe?" or "show me overdue invoices on project X". ' +
      'For Supervision users, RLS will scope results to projects they manage.',
    input_schema: {
      type: 'object',
      properties: {
        subcontractor_id: { type: 'string', format: 'uuid', description: 'Filter to invoices for this subcontractor (via supplier_id).' },
        project_id: { type: 'string', format: 'uuid', description: 'Filter to invoices for this project.' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum number of results to return.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    requiredRoles: FINANCE_PLUS_SUPERVISION,
    handler: (input, ctx) => handleListUnpaidInvoices(input as unknown as ListUnpaidInvoicesInput, ctx),
  },

  {
    name: 'list_payments_for_subcontractor',
    description:
      'List individual payment records made against invoices belonging to a given subcontractor. Use this when the ' +
      'user wants the payment history for a specific subcontractor, not aggregate totals. Joins through ' +
      '`accounting_invoices.supplier_id`; returns payment_date, amount, payment_method, and the linked invoice number.',
    input_schema: {
      type: 'object',
      properties: {
        subcontractor_id: {
          type: 'string',
          format: 'uuid',
          description: 'The subcontractor UUID whose payment history to fetch.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum number of payment rows to return.',
        },
      },
      required: ['subcontractor_id'],
      additionalProperties: false,
    },
    requiredRoles: FINANCE_ROLES,
    handler: (input, ctx) =>
      handleListPaymentsForSubcontractor(input as unknown as ListPaymentsForSubcontractorInput, ctx),
  },

  {
    name: 'get_invoice_summary',
    description:
      'Aggregate invoice statistics across the whole accounting_invoices table with optional filters by ' +
      'invoice_type, status, company_id, and a free-text search term. Returns filtered_count, filtered_unpaid_sum, ' +
      'and total_unpaid_sum. Use this for "how many unpaid invoices do we have?" or "what is the total outstanding ' +
      'for company X?". Backed by the `get_invoice_statistics` RPC.',
    input_schema: {
      type: 'object',
      properties: {
        invoice_type: {
          type: 'string',
          description: 'Invoice type filter. Use "ALL" or omit for all types.',
          default: 'ALL',
        },
        status: {
          type: 'string',
          enum: ['ALL', 'UNPAID', 'PAID', 'PARTIALLY_PAID', 'UNPAID_AND_PARTIAL'],
          default: 'ALL',
          description: 'Invoice status filter. Note: SHOUTING_SNAKE_CASE — distinct from contracts/projects status casing.',
        },
        company_id: { type: 'string', format: 'uuid', description: 'Filter to invoices issued to/from this accounting_companies.id.' },
        search_term: { type: 'string', description: 'Free-text substring filter applied across invoice_number and related entities.' },
      },
      required: [],
      additionalProperties: false,
    },
    requiredRoles: FINANCE_ROLES,
    handler: (input, ctx) => handleGetInvoiceSummary(input as unknown as GetInvoiceSummaryInput, ctx),
  },

  {
    name: 'get_project_financial_summary',
    description:
      'Compute a project\'s financial rollup: total project budget, sum of contract amounts, sum of contract ' +
      '`budget_realized` (paid via invoices), unpaid invoice total, and remaining budget. ' +
      'Use this for questions like "how is project X doing financially?" or "is project X over budget?". ' +
      'Construction-side only — retail projects are not included.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          format: 'uuid',
          description: 'The project UUID to summarize.',
        },
      },
      required: ['project_id'],
      additionalProperties: false,
    },
    requiredRoles: FINANCE_ROLES,
    handler: (input, ctx) =>
      handleGetProjectFinancialSummary(input as unknown as GetProjectFinancialSummaryInput, ctx),
  },

  {
    name: 'search_help',
    description:
      'Pretraži bazu znanja o platformi Cognilion za informacije o stranicama, tijekovima rada, ' +
      'domenskim pojmovima i pristupu po ulogama. Pozovite kada korisnik pita "kako", "gdje", ' +
      '"što je", "zašto ne vidim", ili treba pomoć s navigacijom kroz aplikaciju. ' +
      'Vraća do 5 najrelevantnijih unosa iz baze znanja kao markdown. ' +
      'Ne koristite za pretragu konkretnih podataka (projekata, ugovora, plaćanja) — za to postoje drugi alati.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Pitanje korisnika ili ključne riječi za pretragu baze znanja, na hrvatskom ili engleskom.',
          minLength: 1,
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    handler: (input, ctx, extras) =>
      handleSearchHelp(input as unknown as SearchHelpInput, ctx, extras.helpSearch),
  },

  {
    name: 'list_documents_for_entity',
    description:
      'List files attached to a single entity in the platform — typically a contract, project, subcontractor, ' +
      'or apartment unit. Use this when the user asks for "the document", "the contract file", "the attached invoice", ' +
      'or any phrasing that refers to a file already in the system (not a new report). Returns metadata only: ' +
      'id, file_name, mime_type, file_size, category, uploaded_at. To deliver one of the listed files to the user, ' +
      'pass its `id` to `get_document_download_link`.',
    input_schema: {
      type: 'object',
      properties: {
        entity_type: {
          type: 'string',
          enum: ['project', 'phase', 'subcontractor', 'contract', 'unit', 'customer', 'credit', 'company'],
          description: 'The kind of entity whose attached documents to list. "unit" maps to apartments.',
        },
        entity_id: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the entity, obtained from a prior search tool (e.g. `list_contracts`, `search_projects`).',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum number of document rows to return.',
        },
      },
      required: ['entity_type', 'entity_id'],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    handler: (input, ctx) =>
      handleListDocumentsForEntity(input as unknown as ListDocumentsForEntityInput, ctx),
  },

  {
    name: 'get_document_download_link',
    description:
      'Deliver an attached document to the user as a downloadable chip in the chat. Call this AFTER ' +
      '`list_documents_for_entity` has returned a document whose `id` you want to surface. Does not return raw ' +
      'bytes or a URL in the tool result text — the UI renders a download button that mints a fresh signed URL ' +
      'on click, so the user can always retry across session reloads. After this tool succeeds, briefly confirm ' +
      'the document is ready in your reply; do not paste the filename twice or repeat the metadata.',
    input_schema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the document, taken from `list_documents_for_entity`.',
        },
      },
      required: ['document_id'],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    handler: (input, ctx) =>
      handleGetDocumentDownloadLink(input as unknown as GetDocumentDownloadLinkInput, ctx),
  },

  {
    name: 'create_document',
    description:
      'Generate a downloadable document for the user — a PDF, an Excel spreadsheet, or a Markdown file. ' +
      'The user receives it as a Download button in the chat. ' +
      'Call this ONLY when the user explicitly asks for a document, report file, export, PDF, or Excel — ' +
      'never for an ordinary answer. ' +
      'You author the full content yourself from data you have ALREADY gathered with the other tools; ' +
      'this tool fetches nothing on its own — call the data tools first. ' +
      'Use format "pdf" or "markdown" with the `markdown` field for prose write-ups (reports, summaries, memos). ' +
      'Use format "xlsx" with the `sheets` field for tabular data exports. ' +
      'Stay within the limits: markdown <= 50000 chars; <= 10 sheets, <= 50 columns and <= 5000 rows per sheet. ' +
      'After the tool succeeds, briefly tell the user the document is ready — do NOT paste its full content into the reply. ' +
      'If the user asks for a document that is likely ALREADY attached to an entity in the system (e.g. "send me the contract", ' +
      '"I need that invoice"), first call `list_documents_for_entity` for that entity. If the listing contains a document that ' +
      'matches the request, deliver it via `get_document_download_link` instead of generating a new one. Use `create_document` ' +
      'for new reports, summaries, or exports the user could not have had before.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Document title. Also the basis for the download filename.',
        },
        format: {
          type: 'string',
          enum: ['pdf', 'xlsx', 'markdown'],
          description: 'pdf/markdown for prose write-ups; xlsx for tabular data.',
        },
        markdown: {
          type: 'string',
          maxLength: 50000,
          description:
            'Document body as Markdown. Required for "pdf" and "markdown" formats; ignored for "xlsx". ' +
            'Supports headings (#, ##, ###), paragraphs, **bold**, and bullet/numbered lists.',
        },
        sheets: {
          type: 'array',
          maxItems: 10,
          description: 'Worksheets. Required for "xlsx" format; ignored otherwise.',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                minLength: 1,
                maxLength: 31,
                description: 'Worksheet name (<= 31 characters).',
              },
              columns: {
                type: 'array',
                maxItems: 50,
                items: { type: 'string' },
                description: 'Header row — one string per column.',
              },
              rows: {
                type: 'array',
                maxItems: 5000,
                items: {
                  type: 'array',
                  maxItems: 50,
                  items: { type: ['string', 'number', 'boolean', 'null'] },
                },
                description: 'Data rows. Each row is an array of cells aligned to `columns`.',
              },
            },
            required: ['name', 'columns', 'rows'],
            additionalProperties: false,
          },
        },
      },
      required: ['title', 'format'],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    handler: (input) => handleCreateDocument(input as unknown as CreateDocumentInput),
  },
]

// ---------------------------------------------------------------------------
// Role filter
// ---------------------------------------------------------------------------

// Returns the subset of TOOLS the given user is allowed to invoke based on
// their role. No project-scoping here — that's per-handler logic in 3.2.
export function selectAvailableTools(ctx: AuthContext): ToolDefinition[] {
  return TOOLS.filter((t) => t.requiredRoles.includes(ctx.role))
}
