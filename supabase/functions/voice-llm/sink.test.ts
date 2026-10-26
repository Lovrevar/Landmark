import { assertEquals } from 'jsr:@std/assert@1'
import { OpenAiChunkSink, speakable } from './sink.ts'

Deno.test('speakable: TIC, OIB and IBAN as declined words; R1 and PDV stay; markup and EUR go', () => {
  assertEquals(speakable('Prema TIC-u, bez TIC-a, TIC je spremljen.'), 'Prema ticu, bez tica, tic je spremljen.')
  assertEquals(speakable('OIB-a nema, IBAN-a ni IBAN.'), 'oiba nema, ibana ni iban.')
  assertEquals(speakable('R1 račun i PDV ostaju.'), 'R1 račun i PDV ostaju.')
  assertEquals(speakable('**Ukupno** 100 EUR'), 'Ukupno 100 eura')
})

async function spoken(run: (s: OpenAiChunkSink) => Promise<void>): Promise<string[]> {
  const contents: string[] = []
  const sink = new OpenAiChunkSink(async (chunk) => {
    if (chunk.startsWith('data: {')) {
      const c = JSON.parse(chunk.slice(6)).choices[0].delta.content
      if (c) contents.push(c)
    }
  }, 'test', () => 'Samo trenutak.')
  await run(sink)
  return contents
}

Deno.test('an abbreviation split across deltas is still rewritten: text is released a word at a time', async () => {
  const out = await spoken(async (s) => {
    await s.textDelta('Prema TI')
    await s.textDelta('C-u je sve u redu.')
    await s.done('end_turn', { input_tokens: 0, output_tokens: 0 })
  })
  assertEquals(out.join(''), 'Prema ticu je sve u redu.')
})

Deno.test('the filler is spoken once per request, and streamed text is not repeated by textBlock', async () => {
  const out = await spoken(async (s) => {
    await s.toolStarting()
    await s.toolStarting()
    await s.textDelta('Gotovo je.')
    await s.textBlock('Gotovo je.')
    await s.done('end_turn', { input_tokens: 0, output_tokens: 0 })
  })
  assertEquals(out.join(''), 'Samo trenutak. Gotovo je.')
})

Deno.test('a textBlock that was never streamed (the loop\'s own message) is spoken', async () => {
  const out = await spoken(async (s) => {
    await s.textBlock('Dostignut je limit poziva alata.')
    await s.done('tool_limit_reached', { input_tokens: 0, output_tokens: 0 })
  })
  assertEquals(out.join(''), 'Dostignut je limit poziva alata.')
})
