import { Bench } from 'tinybench'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'

import {
  RegexMatcher,
  RegexMatcherBuilder,
  Searcher,
  SearcherBuilder,
  search,
  isMatch,
  find,
  findAll,
} from '../index.js'

const __filename = fileURLToPath(import.meta.url)
dirname(__filename) // ESM compatibility

// ============================================================================
// Test data generation
// ============================================================================

function generateText(lines: number, wordsPerLine: number = 10): string {
  const words = [
    'the',
    'quick',
    'brown',
    'fox',
    'jumps',
    'over',
    'lazy',
    'dog',
    'hello',
    'world',
    'foo',
    'bar',
    'baz',
    'test',
    'data',
    'line',
    'function',
    'const',
    'let',
    'var',
    'return',
    'if',
    'else',
    'for',
    'while',
    'import',
    'export',
    'class',
    'interface',
    'type',
    'async',
    'await',
    'promise',
    'error',
    'result',
    'value',
    'key',
    'object',
  ]

  const result: string[] = []
  for (let i = 0; i < lines; i++) {
    const lineWords: string[] = []
    for (let j = 0; j < wordsPerLine; j++) {
      lineWords.push(words[Math.floor(Math.random() * words.length)])
    }
    // Add some special patterns occasionally
    if (i % 100 === 0) lineWords[0] = 'ERROR'
    if (i % 50 === 0) lineWords[0] = 'function'
    if (i % 25 === 0) lineWords[0] = 'TODO'
    result.push(lineWords.join(' '))
  }
  return result.join('\n')
}

function generateCodeLikeText(lines: number): string {
  const templates = [
    'function {name}() { return {value}; }',
    'const {name} = {value};',
    'let {name} = {value};',
    'if ({name} === {value}) { }',
    'for (let i = 0; i < {value}; i++) { }',
    'class {name} { constructor() {} }',
    'import { {name} } from "{value}";',
    'export const {name} = {value};',
    '// TODO: implement {name}',
    '/* {name}: {value} */',
    'console.log("{name}", {value});',
    'throw new Error("{name}");',
  ]
  const names = ['foo', 'bar', 'baz', 'qux', 'test', 'data', 'result', 'value', 'item', 'node']
  const values = ['42', '"hello"', 'true', 'false', 'null', '[]', '{}', '0', '100', '"world"']

  const result: string[] = []
  for (let i = 0; i < lines; i++) {
    const template = templates[i % templates.length]
    const name = names[Math.floor(Math.random() * names.length)]
    const value = values[Math.floor(Math.random() * values.length)]
    result.push(template.replace('{name}', name).replace('{value}', value))
  }
  return result.join('\n')
}

// ============================================================================
// Comparison implementations (pure JS)
// ============================================================================

function jsIsMatch(pattern: string, text: string): boolean {
  const regex = new RegExp(pattern)
  return regex.test(text)
}

function jsFind(pattern: string, text: string): { start: number; end: number } | null {
  const regex = new RegExp(pattern)
  const match = regex.exec(text)
  if (!match) return null
  return { start: match.index, end: match.index + match[0].length }
}

function jsFindAll(pattern: string, text: string): Array<{ start: number; end: number }> {
  const regex = new RegExp(pattern, 'g')
  const results: Array<{ start: number; end: number }> = []
  for (const match of text.matchAll(regex)) {
    results.push({ start: match.index!, end: match.index! + match[0].length })
  }
  return results
}

function jsSearchLines(pattern: string, text: string): Array<{ lineNumber: number; line: string }> {
  const regex = new RegExp(pattern)
  const lines = text.split('\n')
  const results: Array<{ lineNumber: number; line: string }> = []
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      results.push({ lineNumber: i + 1, line: lines[i] })
    }
  }
  return results
}

// ============================================================================
// Benchmark runner
// ============================================================================

async function runBenchmark(name: string, bench: Bench) {
  console.log(chalk.cyan(`\n${'='.repeat(60)}`))
  console.log(chalk.cyan.bold(` ${name}`))
  console.log(chalk.cyan(`${'='.repeat(60)}\n`))

  await bench.run()
  console.table(bench.table())
}

// ============================================================================
// Main benchmarks
// ============================================================================

async function main() {
  console.log(chalk.yellow.bold('\n🚀 grep-js Benchmark Suite\n'))

  // Generate test data
  const smallText = generateText(100) // ~1KB
  const mediumText = generateText(1000) // ~10KB
  const largeText = generateText(10000) // ~100KB
  const hugeText = generateText(100000) // ~1MB
  const codeText = generateCodeLikeText(10000) // ~100KB of code-like text

  const mediumBuffer = Buffer.from(mediumText)
  const largeBuffer = Buffer.from(largeText)

  console.log(chalk.gray(`Test data sizes:`))
  console.log(chalk.gray(`  Small:  ${(smallText.length / 1024).toFixed(1)} KB (100 lines)`))
  console.log(chalk.gray(`  Medium: ${(mediumText.length / 1024).toFixed(1)} KB (1,000 lines)`))
  console.log(chalk.gray(`  Large:  ${(largeText.length / 1024).toFixed(1)} KB (10,000 lines)`))
  console.log(chalk.gray(`  Huge:   ${(hugeText.length / 1024 / 1024).toFixed(1)} MB (100,000 lines)`))
  console.log(chalk.gray(`  Code:   ${(codeText.length / 1024).toFixed(1)} KB (10,000 lines)`))

  // Pre-compile matchers for fair comparison
  const simpleMatcher = RegexMatcher.fromPattern('hello')
  const complexMatcher = RegexMatcher.fromPattern('function\\s+\\w+')
  const errorMatcher = RegexMatcher.fromPattern('ERROR')
  const todoMatcher = RegexMatcher.fromPattern('TODO')

  // =========================================================================
  // Benchmark 1: Simple pattern matching (isMatch)
  // =========================================================================
  {
    const bench = new Bench({ time: 1000 })

    bench.add('grep-js isMatch (small)', () => {
      isMatch('hello', smallText)
    })

    bench.add('JS RegExp.test (small)', () => {
      jsIsMatch('hello', smallText)
    })

    bench.add('grep-js isMatch (large)', () => {
      isMatch('hello', largeText)
    })

    bench.add('JS RegExp.test (large)', () => {
      jsIsMatch('hello', largeText)
    })

    await runBenchmark('Simple Pattern Matching (isMatch)', bench)
  }

  // =========================================================================
  // Benchmark 2: Find first match
  // =========================================================================
  {
    const bench = new Bench({ time: 1000 })

    bench.add('grep-js find (medium)', () => {
      find('function', mediumText)
    })

    bench.add('JS RegExp.exec (medium)', () => {
      jsFind('function', mediumText)
    })

    bench.add('grep-js find (large)', () => {
      find('function', largeText)
    })

    bench.add('JS RegExp.exec (large)', () => {
      jsFind('function', largeText)
    })

    await runBenchmark('Find First Match', bench)
  }

  // =========================================================================
  // Benchmark 3: Find all matches
  // =========================================================================
  {
    const bench = new Bench({ time: 1000 })

    bench.add('grep-js findAll (medium)', () => {
      findAll('\\w+', mediumText)
    })

    bench.add('JS RegExp (medium)', () => {
      jsFindAll('\\w+', mediumText)
    })

    bench.add('grep-js findAll digits (large)', () => {
      findAll('\\d+', largeText)
    })

    bench.add('JS RegExp digits (large)', () => {
      jsFindAll('\\d+', largeText)
    })

    await runBenchmark('Find All Matches', bench)
  }

  // =========================================================================
  // Benchmark 4: Line-oriented search
  // =========================================================================
  {
    const bench = new Bench({ time: 1000 })
    const searcher = new Searcher()

    bench.add('grep-js search lines (medium)', () => {
      searcher.searchSlice(errorMatcher, mediumText)
    })

    bench.add('JS line search (medium)', () => {
      jsSearchLines('ERROR', mediumText)
    })

    bench.add('grep-js search lines (large)', () => {
      searcher.searchSlice(errorMatcher, largeText)
    })

    bench.add('JS line search (large)', () => {
      jsSearchLines('ERROR', largeText)
    })

    await runBenchmark('Line-Oriented Search', bench)
  }

  // =========================================================================
  // Benchmark 5: Complex regex patterns
  // =========================================================================
  {
    const bench = new Bench({ time: 1000 })
    const searcher = new Searcher()

    bench.add('grep-js complex pattern', () => {
      searcher.searchSlice(complexMatcher, codeText)
    })

    bench.add('JS complex pattern', () => {
      jsSearchLines('function\\s+\\w+', codeText)
    })

    const emailMatcher = RegexMatcher.fromPattern('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}')
    const textWithEmails = mediumText + '\ncontact@example.com\ntest@test.org\n'

    bench.add('grep-js email pattern', () => {
      searcher.searchSlice(emailMatcher, textWithEmails)
    })

    bench.add('JS email pattern', () => {
      jsSearchLines('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', textWithEmails)
    })

    await runBenchmark('Complex Regex Patterns', bench)
  }

  // =========================================================================
  // Benchmark 6: Reusing compiled matcher
  // =========================================================================
  {
    const bench = new Bench({ time: 1000 })
    const searcher = new Searcher()

    // With pre-compiled matcher
    bench.add('grep-js pre-compiled matcher', () => {
      searcher.searchSlice(simpleMatcher, mediumText)
    })

    // Creating new matcher each time
    bench.add('grep-js new matcher each time', () => {
      search('hello', mediumText)
    })

    // JS with pre-compiled
    const jsRegexPrecompiled = /hello/
    bench.add('JS pre-compiled regex', () => {
      const lines = mediumText.split('\n')
      lines.filter((line) => jsRegexPrecompiled.test(line))
    })

    // JS creating new each time
    bench.add('JS new regex each time', () => {
      const newRegex = new RegExp('hello')
      const lines = mediumText.split('\n')
      lines.filter((line) => newRegex.test(line))
    })

    await runBenchmark('Matcher Reuse vs Creation', bench)
  }

  // =========================================================================
  // Benchmark 7: Buffer vs String input
  // =========================================================================
  {
    const bench = new Bench({ time: 1000 })
    const searcher = new Searcher()

    bench.add('grep-js string input (medium)', () => {
      searcher.searchSlice(simpleMatcher, mediumText)
    })

    bench.add('grep-js Buffer input (medium)', () => {
      searcher.searchSlice(simpleMatcher, mediumBuffer)
    })

    bench.add('grep-js string input (large)', () => {
      searcher.searchSlice(simpleMatcher, largeText)
    })

    bench.add('grep-js Buffer input (large)', () => {
      searcher.searchSlice(simpleMatcher, largeBuffer)
    })

    await runBenchmark('String vs Buffer Input', bench)
  }

  // =========================================================================
  // Benchmark 8: Search with context
  // =========================================================================
  {
    const bench = new Bench({ time: 1000 })

    const searcherNoContext = new Searcher()
    const searcherWithContext = new SearcherBuilder().beforeContext(2).afterContext(2).build()

    bench.add('grep-js no context (large)', () => {
      searcherNoContext.searchSlice(todoMatcher, largeText)
    })

    bench.add('grep-js with context (large)', () => {
      searcherWithContext.searchSlice(todoMatcher, largeText)
    })

    await runBenchmark('Search With/Without Context', bench)
  }

  // =========================================================================
  // Benchmark 9: Case sensitivity options
  // =========================================================================
  {
    const bench = new Bench({ time: 1000 })
    const searcher = new Searcher()

    const caseSensitiveMatcher = RegexMatcher.fromPattern('ERROR')
    const caseInsensitiveMatcher = new RegexMatcherBuilder().caseInsensitive(true).build('error')

    bench.add('grep-js case sensitive', () => {
      searcher.searchSlice(caseSensitiveMatcher, largeText)
    })

    bench.add('grep-js case insensitive', () => {
      searcher.searchSlice(caseInsensitiveMatcher, largeText)
    })

    bench.add('JS case sensitive', () => {
      jsSearchLines('ERROR', largeText)
    })

    bench.add('JS case insensitive', () => {
      const regex = /error/i
      const lines = largeText.split('\n')
      lines.filter((line) => regex.test(line))
    })

    await runBenchmark('Case Sensitivity', bench)
  }

  // =========================================================================
  // Benchmark 10: Huge file throughput
  // =========================================================================
  {
    const bench = new Bench({ time: 2000 })
    const searcher = new Searcher()

    bench.add('grep-js huge file (1MB)', () => {
      searcher.searchSlice(errorMatcher, hugeText)
    })

    bench.add('JS huge file (1MB)', () => {
      jsSearchLines('ERROR', hugeText)
    })

    await runBenchmark('Huge File Throughput (1MB)', bench)

    // Calculate throughput
    const hugeSize = hugeText.length / 1024 / 1024 // MB
    console.log(chalk.green(`\n📊 Throughput Summary:`))
    console.log(chalk.gray(`   File size: ${hugeSize.toFixed(2)} MB`))
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(chalk.yellow.bold('\n✅ Benchmark complete!\n'))
}

main().catch(console.error)
