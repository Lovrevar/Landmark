// The voice channel's EventSink (plan §4.1, §3.4): the loop's text as OpenAI
// `chat.completion.chunk` deltas, which the voice agent speaks as they arrive.
//
//   - textDelta is spoken, a word at a time, after `speakable()`. The first
//     sentence of each stretch of text is held until the next token shows what
//     follows it: if a tool call starts instead, the sentence was the model
//     announcing a lookup ("Trebam prvo pronaći projekt…"), which the filler
//     already covers, so it is dropped. Text-to-speech waits for a sentence
//     end anyway, so holding it costs almost nothing;
//   - toolStarting speaks one filler sentence per request, followed by a
//     paragraph break, so the caller does not sit in silence while tools run;
//   - textBlock repeats text already streamed as deltas, so it is spoken only
//     when it was not (the loop's own messages: the iteration cap, truncation);
//   - toolCall and toolResult are not spoken;
//   - done and error end the stream with finish_reason and `data: [DONE]`.

import type { EventSink, Usage } from '../_shared/orchestrator.ts'

// Written without an ellipsis: some TTS engines read "…" literally (plan §3.4).
const FILLERS = ['Samo trenutak, provjeravam.', 'Trenutak, gledam podatke.', 'Samo malo, dohvaćam to.']

/** Text as the voice should read it. The prompt asks for this too; this is
 * the deterministic backstop. TIC, OIB and IBAN are said as words and declined
 * (decided in phase 0); markup would be read aloud. */
export function speakable(text: string): string {
  return text
    .replace(/\bTIC(?:-?(a|u|om|e|ovi|ova))?\b/g, (_, s) => `tic${s ?? ''}`)
    .replace(/\bOIB(?:-?(a|u|om|i))?\b/g, (_, s) => `oib${s ?? ''}`)
    .replace(/\bIBAN(?:-?(a|u|om|i))?\b/g, (_, s) => `iban${s ?? ''}`)
    .replace(/\bEUR\b|€/g, 'eura')
    .replace(/\*\*|__|`|^#+\s*|^\s*[-*]\s+/gm, '')
}

export class OpenAiChunkSink implements EventSink {
  private readonly id = `chatcmpl-${crypto.randomUUID()}`
  private readonly created = Math.floor(Date.now() / 1000)
  private pending = ''
  private streamed = ''
  private fillerSpoken = false
  private holding = true
  private roleSent = false
  /** Everything spoken, for a non-streamed response. */
  spoken = ''
  /** When the first text went out (performance.now()), for the timing log. */
  firstOutputAt: number | null = null

  constructor(
    private readonly write: (chunk: string) => Promise<void>,
    private readonly model: string,
    private readonly pickFiller: () => string = () => FILLERS[Math.floor(Math.random() * FILLERS.length)],
  ) {}

  private async emit(delta: Record<string, unknown>, finishReason: string | null = null): Promise<void> {
    const chunk = {
      id: this.id,
      object: 'chat.completion.chunk',
      created: this.created,
      model: this.model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    }
    await this.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }

  private async say(text: string): Promise<void> {
    if (!text) return
    const content = speakable(text)
    this.firstOutputAt ??= performance.now()
    this.spoken += content
    await this.emit(this.roleSent ? { content } : { role: 'assistant', content })
    this.roleSent = true
  }

  // Up to the last whitespace, so an abbreviation is never split across chunks.
  private async flushWords(): Promise<void> {
    const cut = Math.max(this.pending.lastIndexOf(' '), this.pending.lastIndexOf('\n'))
    if (cut === -1) return
    const ready = this.pending.slice(0, cut + 1)
    this.pending = this.pending.slice(cut + 1)
    await this.say(ready)
  }

  private async flushAll(): Promise<void> {
    const rest = this.pending
    this.pending = ''
    await this.say(rest)
  }

  async textDelta(text: string): Promise<void> {
    this.streamed += text
    this.pending += text
    if (this.holding) {
      // Released once a sentence has ended and more text follows it.
      if (!/[.!?](\s+)\S/.test(this.pending)) return
      this.holding = false
    }
    await this.flushWords()
  }

  async toolStarting(): Promise<void> {
    // Held text followed by a tool call is an announcement of the lookup.
    if (this.holding) this.pending = ''
    this.holding = true
    if (this.fillerSpoken) return
    this.fillerSpoken = true
    await this.flushAll()
    // The paragraph break makes the agent synthesise the filler at once: its
    // TTS holds a sentence back until more text arrives, and the answer only
    // comes after the tools have run.
    await this.say(`${this.spoken && !/\s$/.test(this.spoken) ? ' ' : ''}${this.pickFiller()}\n\n`)
  }

  async textBlock(text: string): Promise<void> {
    if (this.streamed.startsWith(text)) {
      this.streamed = this.streamed.slice(text.length)
      return
    }
    await this.flushAll()
    await this.say(text)
  }

  async toolCall(_tool: string, _input: unknown, _id: string): Promise<void> {}
  async toolResult(_tool: string, _output: unknown, _id: string, _isError: boolean): Promise<void> {}

  /** Timing marks, sent as an SSE comment that OpenAI clients ignore. */
  timing: (() => string) | null = null

  async done(stopReason: string, _usage: Usage): Promise<void> {
    await this.flushAll()
    // A declined request (after any fallback) ends with nothing to say.
    if (stopReason === 'refusal' && !this.spoken.trim()) await this.say('Na to vam ne mogu odgovoriti.')
    if (this.timing) await this.write(`: timing ${this.timing()}\n\n`)
    await this.emit({}, 'stop')
    await this.write('data: [DONE]\n\n')
  }

  async error(_code: string, message: string): Promise<void> {
    await this.flushAll()
    await this.say(`${this.spoken ? ' ' : ''}${message}`)
    await this.emit({}, 'stop')
    await this.write('data: [DONE]\n\n')
  }
}
