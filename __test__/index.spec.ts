import test from 'ava'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import {
  RegexMatcher,
  RegexMatcherBuilder,
  Searcher,
  SearcherBuilder,
  BinaryDetectionMode,
  ContextKind,
  search,
  searchFile,
  isMatch,
  find,
  findAll,
} from '../index'

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================================================
// Test data
// ============================================================================

const SAMPLE_TEXT = `Hello World
This is a test file
Hello there, friend
The quick brown fox jumps over the lazy dog
Another Hello line
Goodbye World`

const MULTILINE_TEXT = `function foo() {
  return 42
}

function bar() {
  return "hello"
}

class MyClass {
  constructor() {}
}`

// ============================================================================
// RegexMatcher tests
// ============================================================================

test('RegexMatcher.fromPattern - creates matcher', (t) => {
  const matcher = RegexMatcher.fromPattern('hello')
  t.truthy(matcher)
})

test('RegexMatcher.fromPattern - throws on invalid pattern', (t) => {
  t.throws(() => RegexMatcher.fromPattern('[invalid'))
})

test('RegexMatcher.isMatch - returns true for matching text', (t) => {
  const matcher = RegexMatcher.fromPattern('hello')
  t.true(matcher.isMatch('hello world'))
})

test('RegexMatcher.isMatch - returns false for non-matching text', (t) => {
  const matcher = RegexMatcher.fromPattern('hello')
  t.false(matcher.isMatch('goodbye world'))
})

test('RegexMatcher.isMatch - works with Buffer', (t) => {
  const matcher = RegexMatcher.fromPattern('hello')
  t.true(matcher.isMatch(Buffer.from('hello world')))
})

test('RegexMatcher.find - returns match range', (t) => {
  const matcher = RegexMatcher.fromPattern('world')
  const result = matcher.find('hello world')
  t.deepEqual(result, { start: 6, end: 11 })
})

test('RegexMatcher.find - returns null for no match', (t) => {
  const matcher = RegexMatcher.fromPattern('xyz')
  const result = matcher.find('hello world')
  t.is(result, null)
})

test('RegexMatcher.findAll - returns all matches', (t) => {
  const matcher = RegexMatcher.fromPattern('\\d+')
  const result = matcher.findAll('a1b22c333')
  t.deepEqual(result, [
    { start: 1, end: 2 },
    { start: 3, end: 5 },
    { start: 6, end: 9 },
  ])
})

test('RegexMatcher.findAll - returns empty array for no matches', (t) => {
  const matcher = RegexMatcher.fromPattern('\\d+')
  const result = matcher.findAll('no numbers here')
  t.deepEqual(result, [])
})

// ============================================================================
// RegexMatcherBuilder tests
// ============================================================================

test('RegexMatcherBuilder - default build', (t) => {
  const builder = new RegexMatcherBuilder()
  const matcher = builder.build('test')
  t.true(matcher.isMatch('this is a test'))
})

test('RegexMatcherBuilder.caseInsensitive', (t) => {
  const matcher = new RegexMatcherBuilder().caseInsensitive(true).build('hello')
  t.true(matcher.isMatch('HELLO'))
  t.true(matcher.isMatch('Hello'))
  t.true(matcher.isMatch('hello'))
})

test('RegexMatcherBuilder.caseSmart - lowercase pattern', (t) => {
  const matcher = new RegexMatcherBuilder().caseSmart(true).build('hello')
  t.true(matcher.isMatch('HELLO'))
  t.true(matcher.isMatch('hello'))
})

test('RegexMatcherBuilder.caseSmart - uppercase pattern', (t) => {
  const matcher = new RegexMatcherBuilder().caseSmart(true).build('Hello')
  t.false(matcher.isMatch('HELLO'))
  t.true(matcher.isMatch('Hello'))
})

test('RegexMatcherBuilder.multiLine', (t) => {
  const matcher = new RegexMatcherBuilder().multiLine(true).build('^test')
  t.true(matcher.isMatch('line1\ntest line'))
})

test('RegexMatcherBuilder.word', (t) => {
  const matcher = new RegexMatcherBuilder().word(true).build('test')
  t.true(matcher.isMatch('this is a test'))
  t.false(matcher.isMatch('testing'))
})

test('RegexMatcherBuilder.fixedStrings', (t) => {
  const matcher = new RegexMatcherBuilder().fixedStrings(true).build('a.*b')
  t.true(matcher.isMatch('a.*b'))
  t.false(matcher.isMatch('aXXXb'))
})

test('RegexMatcherBuilder.wholeLine', (t) => {
  const matcher = new RegexMatcherBuilder().wholeLine(true).build('test')
  t.true(matcher.isMatch('test'))
  t.false(matcher.isMatch('test line'))
})

test('RegexMatcherBuilder.buildMany', (t) => {
  const matcher = new RegexMatcherBuilder().buildMany(['foo', 'bar', 'baz'])
  t.true(matcher.isMatch('foo'))
  t.true(matcher.isMatch('bar'))
  t.true(matcher.isMatch('baz'))
  t.false(matcher.isMatch('qux'))
})

test('RegexMatcherBuilder.buildLiterals', (t) => {
  const matcher = new RegexMatcherBuilder().buildLiterals(['foo', 'bar', 'baz'])
  t.true(matcher.isMatch('foo'))
  t.true(matcher.isMatch('bar'))
  t.true(matcher.isMatch('baz'))
  t.false(matcher.isMatch('qux'))
})

// ============================================================================
// Searcher tests
// ============================================================================

test('Searcher - basic search', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.is(result.matches.length, 3)
  t.true(result.matches[0].line.includes('Hello'))
})

test('Searcher - line numbers', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.is(result.matches[0].lineNumber, 1)
  t.is(result.matches[1].lineNumber, 3)
  t.is(result.matches[2].lineNumber, 5)
})

test('Searcher - match ranges in line', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.true(result.matches[0].matches.length > 0)
  t.is(result.matches[0].matches[0].start, 0)
  t.is(result.matches[0].matches[0].end, 5)
})

test('Searcher - bytes included', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.true(Buffer.isBuffer(result.matches[0].bytes))
})

test('Searcher - finish info', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.truthy(result.finish)
  t.true(result.finish.byteCount > 0)
})

test('Searcher - no matches', (t) => {
  const matcher = RegexMatcher.fromPattern('NOTFOUND')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.is(result.matches.length, 0)
})

test('Searcher - works with Buffer input', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, Buffer.from(SAMPLE_TEXT))

  t.is(result.matches.length, 3)
})

// ============================================================================
// SearcherBuilder tests
// ============================================================================

test('SearcherBuilder.lineNumber(false)', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new SearcherBuilder().lineNumber(false).build()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.is(result.matches[0].lineNumber, undefined)
})

test('SearcherBuilder.invertMatch', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new SearcherBuilder().invertMatch(true).build()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  // Should return lines that DON'T match Hello
  t.true(result.matches.length > 0)
  for (const match of result.matches) {
    t.false(match.line.includes('Hello'))
  }
})

test('SearcherBuilder.beforeContext', (t) => {
  const matcher = RegexMatcher.fromPattern('quick')
  const searcher = new SearcherBuilder().beforeContext(1).build()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.true(result.context.length > 0)
  t.is(result.context[0].kind, ContextKind.Before)
})

test('SearcherBuilder.afterContext', (t) => {
  const matcher = RegexMatcher.fromPattern('quick')
  const searcher = new SearcherBuilder().afterContext(1).build()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.true(result.context.length > 0)
  t.is(result.context[0].kind, ContextKind.After)
})

test('SearcherBuilder.maxMatches', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new SearcherBuilder().maxMatches(1).build()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.is(result.matches.length, 1)
})

test('SearcherBuilder.binaryDetection', (t) => {
  const matcher = RegexMatcher.fromPattern('test')
  const searcher = new SearcherBuilder().binaryDetection(BinaryDetectionMode.None).build()
  const result = searcher.searchSlice(matcher, 'test\x00binary')

  t.truthy(result)
})

test('SearcherBuilder.passthru', (t) => {
  const matcher = RegexMatcher.fromPattern('Hello')
  const searcher = new SearcherBuilder().passthru(true).build()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  // In passthru mode, non-matching lines appear as context
  t.true(result.context.length > 0)
})

// ============================================================================
// Convenience functions tests
// ============================================================================

test('search() - basic usage', (t) => {
  const result = search('Hello', SAMPLE_TEXT)
  t.is(result.matches.length, 3)
})

test('search() - with Buffer', (t) => {
  const result = search('Hello', Buffer.from(SAMPLE_TEXT))
  t.is(result.matches.length, 3)
})

test('search() - regex pattern', (t) => {
  const result = search('\\w+ello', SAMPLE_TEXT)
  t.is(result.matches.length, 3)
})

test('isMatch() - returns true for match', (t) => {
  t.true(isMatch('Hello', SAMPLE_TEXT))
})

test('isMatch() - returns false for no match', (t) => {
  t.false(isMatch('NOTFOUND', SAMPLE_TEXT))
})

test('find() - returns first match', (t) => {
  const result = find('\\d+', 'a1b22c333')
  t.deepEqual(result, { start: 1, end: 2 })
})

test('find() - returns null for no match', (t) => {
  const result = find('\\d+', 'no numbers')
  t.is(result, null)
})

test('findAll() - returns all matches', (t) => {
  const result = findAll('\\d+', 'a1b22c333')
  t.is(result.length, 3)
})

// ============================================================================
// File search tests
// ============================================================================

test('searchFile() - search this test file', (t) => {
  const testFilePath = join(__dirname, 'index.spec.ts')
  const result = searchFile('test\\(', testFilePath)
  t.true(result.matches.length > 0)
})

test('Searcher.searchPath - search file', (t) => {
  const matcher = RegexMatcher.fromPattern('import')
  const searcher = new Searcher()
  const testFilePath = join(__dirname, 'index.spec.ts')
  const result = searcher.searchPath(matcher, testFilePath)
  t.true(result.matches.length > 0)
})

// ============================================================================
// Complex patterns tests
// ============================================================================

test('search for function definitions', (t) => {
  const matcher = new RegexMatcherBuilder().multiLine(true).build('function\\s+\\w+')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, MULTILINE_TEXT)

  t.is(result.matches.length, 2)
  t.true(result.matches[0].line.includes('function foo'))
  t.true(result.matches[1].line.includes('function bar'))
})

test('search for class definitions', (t) => {
  const result = search('class\\s+\\w+', MULTILINE_TEXT)
  t.is(result.matches.length, 1)
  t.true(result.matches[0].line.includes('class MyClass'))
})

test('case insensitive search', (t) => {
  const matcher = new RegexMatcherBuilder().caseInsensitive(true).build('hello')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.is(result.matches.length, 3)
})

// ============================================================================
// Edge cases
// ============================================================================

test('empty text search', (t) => {
  const result = search('test', '')
  t.is(result.matches.length, 0)
})

test('empty pattern', (t) => {
  // Empty pattern matches everything
  const result = search('', 'hello')
  t.true(result.matches.length > 0)
})

test('unicode text search', (t) => {
  const result = search('привет', 'Привет мир! привет!')
  t.is(result.matches.length, 1)
})

test('unicode case insensitive', (t) => {
  // Searcher works line by line, so we need multiple lines to test multiple matches
  const matcher = new RegexMatcherBuilder().caseInsensitive(true).unicode(true).build('hello')
  const searcher = new Searcher()
  const result = searcher.searchSlice(matcher, 'Hello World!\nhello there!')

  t.is(result.matches.length, 2)
})

test('special regex characters in fixed strings mode', (t) => {
  const matcher = new RegexMatcherBuilder().fixedStrings(true).build('[test]')
  t.true(matcher.isMatch('array[test]'))
  t.false(matcher.isMatch('t'))
})

// ============================================================================
// Subpackage imports tests
// ============================================================================

test('matcher subpackage import', async (t) => {
  const { RegexMatcher: MatcherFromSubpkg, RegexMatcherBuilder: BuilderFromSubpkg } = await import('../matcher')

  const matcher = MatcherFromSubpkg.fromPattern('test')
  t.true(matcher.isMatch('this is a test'))

  const builder = new BuilderFromSubpkg()
  const matcher2 = builder.caseInsensitive(true).build('hello')
  t.true(matcher2.isMatch('HELLO'))
})

test('searcher subpackage import', async (t) => {
  const {
    Searcher: SearcherFromSubpkg,
    SearcherBuilder: BuilderFromSubpkg,
    BinaryDetectionMode: BDMode,
    ContextKind: CK,
  } = await import('../searcher')

  const { RegexMatcher: MatcherFromSubpkg } = await import('../matcher')

  const matcher = MatcherFromSubpkg.fromPattern('Hello')
  const searcher = new SearcherFromSubpkg()
  const result = searcher.searchSlice(matcher, SAMPLE_TEXT)

  t.is(result.matches.length, 3)

  // Test enums are accessible
  t.truthy(BDMode.None)
  t.truthy(BDMode.Quit)
  t.truthy(BDMode.Convert)
  t.truthy(CK.Before)
  t.truthy(CK.After)
  t.truthy(CK.Other)

  // Test builder
  const builder = new BuilderFromSubpkg()
  const searcher2 = builder.maxMatches(1).build()
  const result2 = searcher2.searchSlice(matcher, SAMPLE_TEXT)
  t.is(result2.matches.length, 1)
})

// ============================================================================
// Enum values tests
// ============================================================================

test('BinaryDetectionMode enum values', (t) => {
  t.truthy(BinaryDetectionMode.None)
  t.truthy(BinaryDetectionMode.Quit)
  t.truthy(BinaryDetectionMode.Convert)
})

test('ContextKind enum values', (t) => {
  t.truthy(ContextKind.Before)
  t.truthy(ContextKind.After)
  t.truthy(ContextKind.Other)
})
