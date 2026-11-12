// AI chat tool catalog.
//
// This file defines the 15 tools the assistant can invoke and the role-based
// filter that selects which tools each user is allowed to use. The handlers
// themselves live in ./tool-handlers.ts (search_help in ./help-search.ts);
// each entry here only wires its schema and role gate to its handler.
//
// Descriptions are model-facing English: they are the only signal the model
// uses to choose tools, so they say what the tool returns, when to call it and
// when not to. The voice-exposed ones stay at 300 characters or fewer (the
// model deliberates longer over long ones; tools.test.ts checks it). The
// data-model warnings live in DOMAIN_RULES_HR (prompts.ts), which every
// channel's system prompt carries, not here.

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
  handleListCostClassifications,
  ListCostClassificationsInput,
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
  // True when the handler only reads. Voice may only reach read-only tools
  // (TOOL_ALLOWLIST below, checked at module load).
  readOnly: boolean
  handler: (input: I, ctx: AuthContext, extras: ToolHandlerExtras) => Promise<O>
}

const ALL_ROLES: Role[] = ['Director', 'Accounting', 'Sales', 'Supervision', 'Investment']
const FINANCE_ROLES: Role[] = ['Director', 'Accounting']
const FINANCE_PLUS_SUPERVISION: Role[] = ['Director', 'Accounting', 'Supervision']

// ---------------------------------------------------------------------------
// TOOLS
// ---------------------------------------------------------------------------
// Order matches the role-gating table in the spec.

export const TOOLS: ToolDefinition[] = [
  {
    name: 'search_projects',
    description:
      'Construction projects the caller can see: id, name, location, status. Omit `query` to list them all in name order (up to `limit`); give part of a name to find one. Call it first when you need a project_id. Retail projects are not included.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Substring to match against project name. Case-insensitive. Omit or leave empty to list every project you can see.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return.',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
      },
      required: [],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    readOnly: true,
    handler: (input, ctx) => handleSearchProjects(input as unknown as SearchProjectsInput, ctx),
  },

  {
    name: 'get_project_details',
    description:
      'One project\'s details: name, location, dates, budget, status, and counts of phases, contracts and milestones. Use for "tell me about project X" or a status overview. For money questions use `get_project_financial_summary`.',
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
    readOnly: true,
    handler: (input, ctx) => handleGetProjectDetails(input as unknown as GetProjectDetailsInput, ctx),
  },

  {
    name: 'list_project_phases',
    description:
      'A project\'s phases (time divisions such as Faza 1, Faza 2) in order, with dates, status and `budget_allocated`. Use when the user asks about phases. Not for cost categories (use `list_cost_classifications` and `list_contracts`) or spend (use `get_project_financial_summary`).',
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
    readOnly: true,
    handler: (input, ctx) => handleListProjectPhases(input as unknown as ListProjectPhasesInput, ctx),
  },

  {
    name: 'search_subcontractors',
    description:
      'Subcontractors (izvođači, the construction-side suppliers) by name: id, name, contact, active_contracts_count. Call it when the user names a subcontractor and you need its subcontractor_id for another tool.',
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
    readOnly: true,
    handler: (input, ctx) => handleSearchSubcontractors(input as unknown as SearchSubcontractorsInput, ctx),
  },

  {
    name: 'list_cost_classifications',
    description:
      'The cost classifications (stavke troškovnika: Zemljište, Priprema i razvoj, Izgradnja i uređenje…) with their ids. Call it to turn a cost category the user named into a classification_id for `list_contracts`.',
    input_schema: {
      type: 'object',
      properties: {
        include_inactive: { type: 'boolean', description: 'Include deactivated classifications. Defaults to false.' },
      },
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    readOnly: true,
    handler: (input, ctx) => handleListCostClassifications(input as unknown as ListCostClassificationsInput, ctx),
  },

  {
    name: 'list_contracts',
    description:
      'Construction contracts, filtered by project, phase, cost classification, subcontractor or status: amounts, `budget_realized` (the authoritative spend), dates, status. Use for contract questions, and for spend on a cost category (filter by classification_id, not by phase).',
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', format: 'uuid', description: 'Filter to contracts on this project.' },
        phase_id: { type: 'string', format: 'uuid', description: 'Filter to contracts on this phase (a time division, not a cost category).' },
        classification_id: { type: 'integer', description: 'Filter to contracts in this cost classification. This is the right filter for "spend on land", "spend on preparation", etc.' },
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
    readOnly: true,
    handler: (input, ctx) => handleListContracts(input as unknown as ListContractsInput, ctx),
  },

  {
    name: 'get_subcontractor_payment_status',
    description:
      'One subcontractor\'s totals: contracted, invoiced, paid and still owed. Use for "is X paid up?" or "how much do we still owe X?". For the individual payments use `list_payments_for_subcontractor`. Construction only, not retail.',
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
    readOnly: true,
    handler: (input, ctx) =>
      handleGetSubcontractorPaymentStatus(input as unknown as GetSubcontractorPaymentStatusInput, ctx),
  },

  {
    name: 'list_unpaid_invoices',
    description:
      'Invoices still UNPAID or PARTIALLY_PAID, optionally for one subcontractor or project, earliest due date first. Use for "what do we still owe?" or overdue invoices. For counts and totals across all invoices use `get_invoice_summary`.',
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
    readOnly: true,
    handler: (input, ctx) => handleListUnpaidInvoices(input as unknown as ListUnpaidInvoicesInput, ctx),
  },

  {
    name: 'list_payments_for_subcontractor',
    description:
      'Individual payments on one subcontractor\'s invoices: date, amount, method and invoice number. Use for a subcontractor\'s payment history. For the totals use `get_subcontractor_payment_status`.',
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
    readOnly: true,
    handler: (input, ctx) =>
      handleListPaymentsForSubcontractor(input as unknown as ListPaymentsForSubcontractorInput, ctx),
  },

  {
    name: 'get_invoice_summary',
    description:
      'Counts and sums across all invoices, filtered by type, status, company or a search term: filtered_count, filtered_unpaid_sum, total_unpaid_sum. Use for "how many unpaid invoices?" or "total outstanding for company X". To list invoices use `list_unpaid_invoices`.',
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
    readOnly: true,
    handler: (input, ctx) => handleGetInvoiceSummary(input as unknown as GetInvoiceSummaryInput, ctx),
  },

  {
    name: 'get_project_financial_summary',
    description:
      'One project\'s money: budget (from its TIC), contracted, paid (`budget_realized`), unpaid invoices and remaining budget. Use for "how is project X doing?" or "are we over budget?". Without a TIC there is no budget; say so. Construction only, not retail.',
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
    readOnly: true,
    handler: (input, ctx) =>
      handleGetProjectFinancialSummary(input as unknown as GetProjectFinancialSummaryInput, ctx),
  },

  {
    name: 'search_help',
    description:
      'Searches the Cognilion help base and returns up to 5 matching articles as markdown. Use when the user asks how, where or why in the app (pages, workflows, terms, role access). Not for data such as projects, contracts or payments: other tools fetch those.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The user\'s question, or keywords to search the help base for, in Croatian or English.',
          minLength: 1,
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    requiredRoles: ALL_ROLES,
    readOnly: true,
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
    readOnly: true,
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
    readOnly: true,
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
    readOnly: false,
    handler: (input) => handleCreateDocument(input as unknown as CreateDocumentInput),
  },
]

// ---------------------------------------------------------------------------
// Channel allowlist (plan §5)
// ---------------------------------------------------------------------------
// Default-deny: a tool added to TOOLS reaches chat automatically, as before,
// but reaches voice only when its name is added here, in a reviewed diff.
// Speech-to-text output is a new injection surface and several reachable
// tables have USING(true) policies, so the voice blast radius is capped by
// what the model can call, below the prompt layer.

export type Channel = 'chat' | 'voice'

const VOICE_V1_TOOLS = [
  'search_projects', 'get_project_details', 'list_project_phases',
  'search_subcontractors', 'list_cost_classifications', 'list_contracts',
  'get_subcontractor_payment_status', 'list_unpaid_invoices',
  'list_payments_for_subcontractor', 'get_invoice_summary',
  'get_project_financial_summary', 'search_help',
]

export const TOOL_ALLOWLIST: Record<Channel, readonly string[]> = {
  chat: TOOLS.map((t) => t.name),
  voice: VOICE_V1_TOOLS,
}

// A write tool must never reach voice through an allowlist typo or a later
// edit: fail at module load, before any request is served.
for (const name of TOOL_ALLOWLIST.voice) {
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) throw new Error(`TOOL_ALLOWLIST.voice names an unknown tool: ${name}`)
  if (!tool.readOnly) throw new Error(`TOOL_ALLOWLIST.voice names a tool that writes: ${name}`)
}

// ---------------------------------------------------------------------------
// Role filter
// ---------------------------------------------------------------------------

// Returns the subset of TOOLS the given user is allowed to invoke on this
// channel: their role's tools, intersected with the channel's allowlist. No
// project-scoping here — that's per-handler logic in 3.2.
export function selectAvailableTools(ctx: Pick<AuthContext, 'role'>, channel: Channel = 'chat'): ToolDefinition[] {
  const allowed = new Set(TOOL_ALLOWLIST[channel])
  return TOOLS.filter((t) => t.requiredRoles.includes(ctx.role) && allowed.has(t.name))
}

// Looks up a tool by name, but only among the tools this user's role may
// invoke on this channel. The orchestration loop dispatches whatever name the
// model returned, and selectAvailableTools only controls which tools are
// *advertised* — so dispatch must re-apply the gate itself, or a name the model
// was never given would still run. Returns undefined for unknown and forbidden alike.
export function findAvailableTool(
  ctx: Pick<AuthContext, 'role'>,
  name: string,
  channel: Channel = 'chat',
): ToolDefinition | undefined {
  return selectAvailableTools(ctx, channel).find((t) => t.name === name)
}
