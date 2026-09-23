// Tests for the fake itself. The characterisation suite relies on two
// properties, and both are pinned here:
//
//   1. The same scripted turn comes back identically through the real SDK's
//      `messages.create` and `messages.stream().finalMessage()`. Phase 2
//      switches the orchestrator from one to the other; the suite can only
//      prove parity across that switch if the fake is call-style neutral.
//   2. It rejects the conversation shapes the real API rejects.
//
// Run: `deno test --allow-net --allow-env ai-chat/tests/` from supabase/functions/.

import { assertEquals, assertMatch, assertRejects } from 'jsr:@std/assert@1'
import Anthropic from 'npm:@anthropic-ai/sdk@0.97.0'
import { answer, FakeAnthropic, text, toolUse, validateConversation } from './fake-anthropic.ts'

function client(fake: FakeAnthropic): Anthropic {
  return new Anthropic({
    apiKey: 'sk-ant-fake',
    baseURL: 'http://fake-anthropic.test',
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => fake.handle(new Request(input, init))) as typeof fetch,
  })
}

const REQUEST = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user' as const, content: 'Koliko je plaćeno?' }],
}

Deno.test('fake-anthropic: create and stream yield the same message for text, thinking and tool_use', async () => {
  const turn = {
    content: [
      { type: 'thinking' as const, thinking: 'Trebam projekt.', signature: 'sig-1' },
      text('Provjeravam projekt Funtana — trenutak.'),
      toolUse('search_projects', { query: 'Funtana', limit: 5 }),
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 321, output_tokens: 45 },
  }
  const fake = new FakeAnthropic()
  fake.script(turn, turn)
  const created = await client(fake).messages.create(REQUEST)
  const streamed = await client(fake).messages.stream(REQUEST).finalMessage()

  assertEquals(streamed.content, created.content)
  assertEquals(created.content as unknown, turn.content as unknown)
  assertEquals(streamed.stop_reason, 'tool_use')
  assertEquals(streamed.usage.output_tokens, created.usage.output_tokens)
  assertEquals(fake.calls[0].body.stream, undefined)
  assertEquals(fake.calls[1].body.stream, true)
})

Deno.test('fake-anthropic: stream delivers text as incremental deltas', async () => {
  const fake = new FakeAnthropic()
  fake.script(answer('Funtana ima jednu fazu i dva ugovora.'))
  const deltas: string[] = []
  const stream = client(fake).messages.stream(REQUEST)
  stream.on('text', (d) => deltas.push(d))
  await stream.finalMessage()
  assertEquals(deltas.join(''), 'Funtana ima jednu fazu i dva ugovora.')
  assertEquals(deltas.length > 1, true)
})

Deno.test('fake-anthropic: scripted API errors surface as the SDK typed errors, without retries', async () => {
  const fake = new FakeAnthropic()
  fake.script({ error: { status: 429, type: 'rate_limit_error', message: 'slow down' } })
  await assertRejects(() => client(fake).messages.create(REQUEST), Anthropic.RateLimitError)
  assertEquals(fake.calls.length, 1)
})

Deno.test('fake-anthropic: rejects a tool_use that is not answered in the next user turn', () => {
  const tu = toolUse('search_projects', { query: 'x' })
  const problem = validateConversation([
    { role: 'user', content: [text('a')] },
    { role: 'assistant', content: [tu] },
    { role: 'user', content: [text('b')] },
  ])
  assertMatch(problem ?? '', /tool_use` ids were found without `tool_result` blocks immediately after/)
})

Deno.test('fake-anthropic: rejects a tool_result that answers nothing, and a non-user first turn', () => {
  assertMatch(
    validateConversation([{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_x', content: '{}' }] }]) ?? '',
    /unexpected `tool_use_id`/,
  )
  assertMatch(validateConversation([{ role: 'assistant', content: [text('x')] }]) ?? '', /first message/)
})

Deno.test('fake-anthropic: accepts a well-formed tool round trip', () => {
  const tu = toolUse('search_projects', { query: 'x' })
  assertEquals(
    validateConversation([
      { role: 'user', content: [text('a')] },
      { role: 'assistant', content: [tu] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: tu.id, content: '{}' }] },
      { role: 'assistant', content: [text('b')] },
      { role: 'user', content: [text('c')] },
    ]),
    null,
  )
})
