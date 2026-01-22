# grep-js

A Node.js binding for the [grep](https://docs.rs/grep/latest/grep/) crate - the same regex search library that powers [ripgrep](https://github.com/BurntSushi/ripgrep).

This library provides fast, line-oriented regex searching with support for:

- Multi-line search
- Context lines (before/after matches)
- Binary detection
- Inverted matching
- Smart case sensitivity
- Word boundary matching
- And more...

## Installation

```bash
npm install grep-js
```

## Imports

You can import everything from the main package or use subpackages for better tree-shaking:

```javascript
// Import everything
import { search, RegexMatcher, Searcher } from 'grep-js'

// Or import specific modules
import { RegexMatcher, RegexMatcherBuilder } from 'grep-js/matcher'
import { Searcher, SearcherBuilder, BinaryDetectionMode } from 'grep-js/searcher'
```

CommonJS:

```javascript
// Main package
const { search, RegexMatcher } = require('grep-js')

// Subpackages
const { RegexMatcher, RegexMatcherBuilder } = require('grep-js/matcher')
const { Searcher, SearcherBuilder } = require('grep-js/searcher')
```

## Quick Start

```javascript
import { search, searchFile, isMatch, find, findAll } from 'grep-js'

// Simple search in a string
const result = search('hello\\s+\\w+', 'hello world\nhello there\ngoodbye')
console.log(result.matches)
// [
//   { lineNumber: 1, line: 'hello world\n', matches: [{ start: 0, end: 11 }], ... },
//   { lineNumber: 2, line: 'hello there\n', matches: [{ start: 0, end: 11 }], ... }
// ]

// Search in a file
const fileResult = searchFile('TODO|FIXME', './src/lib.rs')
console.log(fileResult.matches)

// Quick match check
if (isMatch('error', logContent)) {
  console.log('Errors found!')
}

// Find first match
const match = find('\\d+', 'abc123def')
console.log(match) // { start: 3, end: 6 }

// Find all matches
const allMatches = findAll('\\d+', 'a1b2c3')
console.log(allMatches) // [{ start: 1, end: 2 }, { start: 3, end: 4 }, { start: 5, end: 6 }]
```

## Advanced Usage

### RegexMatcherBuilder

Configure regex matching behavior with the builder pattern:

```javascript
import { RegexMatcherBuilder, Searcher } from 'grep-js'

const builder = new RegexMatcherBuilder()
  .caseInsensitive(true) // Case insensitive matching
  .multiLine(true) // ^ and $ match line boundaries
  .word(true) // Match whole words only
  .unicode(true) // Enable Unicode support

const matcher = builder.build('error')

const searcher = new Searcher()
const result = searcher.searchSlice(matcher, 'ERROR: something failed\nWarning: error detected')
```

#### RegexMatcherBuilder Options

| Method                    | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `caseInsensitive(bool)`   | Enable case-insensitive matching                           |
| `caseSmart(bool)`         | Auto-enable case insensitivity if pattern has no uppercase |
| `multiLine(bool)`         | `^` and `$` match line boundaries                          |
| `dotMatchesNewLine(bool)` | `.` matches newlines                                       |
| `swapGreed(bool)`         | Make `*` lazy and `*?` greedy                              |
| `ignoreWhitespace(bool)`  | Ignore whitespace in pattern                               |
| `unicode(bool)`           | Enable Unicode support (default: true)                     |
| `octal(bool)`             | Enable octal escape sequences                              |
| `word(bool)`              | Match only at word boundaries                              |
| `fixedStrings(bool)`      | Treat pattern as literal string                            |
| `wholeLine(bool)`         | Pattern must match entire line                             |
| `crlf(bool)`              | Enable CRLF line endings                                   |
| `lineTerminator(byte)`    | Set custom line terminator                                 |
| `sizeLimit(bytes)`        | Set regex compilation size limit                           |
| `dfaSizeLimit(bytes)`     | Set DFA cache size limit                                   |
| `nestLimit(n)`            | Set pattern nesting limit                                  |

### SearcherBuilder

Configure search behavior:

```javascript
import { RegexMatcher, SearcherBuilder, BinaryDetectionMode } from 'grep-js'

const matcher = RegexMatcher.fromPattern('function\\s+\\w+')

const searcher = new SearcherBuilder()
  .lineNumber(true) // Include line numbers
  .beforeContext(2) // Show 2 lines before each match
  .afterContext(2) // Show 2 lines after each match
  .invertMatch(false) // Show matching lines (not non-matching)
  .multiLine(false) // Single-line mode
  .binaryDetection(BinaryDetectionMode.Quit) // Stop on binary files
  .maxMatches(100) // Limit results
  .build()

const result = searcher.searchPath(matcher, './src/index.ts')

// Process matches
for (const match of result.matches) {
  console.log(`${match.lineNumber}: ${match.line}`)
}

// Process context lines
for (const ctx of result.context) {
  console.log(`  ${ctx.lineNumber}: ${ctx.line}`)
}
```

#### SearcherBuilder Options

| Method                  | Description                                   |
| ----------------------- | --------------------------------------------- |
| `lineNumber(bool)`      | Include line numbers (default: true)          |
| `lineTerminator(byte)`  | Set line terminator (default: `\n`)           |
| `invertMatch(bool)`     | Report non-matching lines                     |
| `multiLine(bool)`       | Enable multi-line matching                    |
| `beforeContext(n)`      | Lines of context before match                 |
| `afterContext(n)`       | Lines of context after match                  |
| `passthru(bool)`        | Report all lines as context                   |
| `heapLimit(bytes)`      | Set heap usage limit                          |
| `binaryDetection(mode)` | Binary detection mode                         |
| `bomSniffing(bool)`     | Auto-detect UTF-16 via BOM                    |
| `stopOnNonmatch(bool)`  | Stop after first non-match (for sorted files) |
| `maxMatches(n)`         | Maximum number of matches                     |

### Binary Detection Modes

```javascript
import { BinaryDetectionMode } from 'grep-js'

// No binary detection - search everything
BinaryDetectionMode.None

// Stop searching when binary data is detected
BinaryDetectionMode.Quit

// Convert NUL bytes to line terminators
BinaryDetectionMode.Convert
```

## Result Types

### SearchResult

```typescript
interface SearchResult {
  matches: SearchMatch[] // All matching lines
  context: SearchContext[] // Context lines (before/after)
  finish: SearchFinish // Summary information
}
```

### SearchMatch

```typescript
interface SearchMatch {
  lineNumber?: number // Line number (1-based)
  absoluteByteOffset: number // Byte offset from start
  line: string // Matched line content
  bytes: Buffer // Raw bytes of matched line
  matches: MatchRange[] // All match positions in line
}
```

### SearchContext

```typescript
interface SearchContext {
  lineNumber?: number // Line number (1-based)
  absoluteByteOffset: number // Byte offset from start
  line: string // Context line content
  bytes: Buffer // Raw bytes
  kind: ContextKind // 'Before', 'After', or 'Other'
}
```

### MatchRange

```typescript
interface MatchRange {
  start: number // Start byte offset
  end: number // End byte offset
}
```

## Performance

This library uses the same regex engine as ripgrep, providing:

- Fast regex compilation
- Efficient DFA-based matching
- Memory-mapped file support
- Optimized literal string matching

## License

MIT
