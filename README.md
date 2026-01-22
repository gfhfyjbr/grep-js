# @gfhfyjbr/grep-js

[![CI](https://github.com/gfhfyjbr/grep-js/actions/workflows/CI.yml/badge.svg)](https://github.com/gfhfyjbr/grep-js/actions/workflows/CI.yml)
[![npm version](https://badge.fury.io/js/@gfhfyjbr%2Fgrep-js.svg)](https://www.npmjs.com/package/@gfhfyjbr/grep-js)

Node.js bindings for the [grep](https://docs.rs/grep/latest/grep/) crate - the same regex search library that powers [ripgrep](https://github.com/BurntSushi/ripgrep).

Fast, line-oriented regex searching with support for:

- Multi-line search
- Context lines (before/after matches)
- Binary detection
- Inverted matching
- Smart case sensitivity
- Word boundary matching

## Supported Platforms

| OS            | Architecture               |
| ------------- | -------------------------- |
| Windows       | x64, arm64                 |
| macOS         | x64, arm64 (Apple Silicon) |
| Linux (glibc) | x64, arm64                 |
| Linux (musl)  | x64, arm64                 |

## Installation

```bash
npm install @gfhfyjbr/grep-js
```

## Usage

### ES Modules

```javascript
// Import everything
import { search, RegexMatcher, Searcher } from '@gfhfyjbr/grep-js'

// Or import specific modules
import { RegexMatcher, RegexMatcherBuilder } from '@gfhfyjbr/grep-js/matcher'
import { Searcher, SearcherBuilder, BinaryDetectionMode } from '@gfhfyjbr/grep-js/searcher'
```

### CommonJS

```javascript
const { search, RegexMatcher } = require('@gfhfyjbr/grep-js')

const { RegexMatcher, RegexMatcherBuilder } = require('@gfhfyjbr/grep-js/matcher')
const { Searcher, SearcherBuilder } = require('@gfhfyjbr/grep-js/searcher')
```

## Quick Start

```javascript
import { search, searchFile, isMatch, find, findAll } from '@gfhfyjbr/grep-js'

// Search in a string
const result = search('hello\\s+\\w+', 'hello world\nhello there\ngoodbye')
console.log(result.matches)
// [
//   { lineNumber: 1, line: 'hello world\n', matches: [{ start: 0, end: 11 }] },
//   { lineNumber: 2, line: 'hello there\n', matches: [{ start: 0, end: 11 }] }
// ]

// Search in a file
const fileResult = searchFile('TODO|FIXME', './src/lib.rs')

// Quick match check
if (isMatch('error', logContent)) {
  console.log('Errors found!')
}

// Find first match
const match = find('\\d+', 'abc123def')
// { start: 3, end: 6 }

// Find all matches
const allMatches = findAll('\\d+', 'a1b2c3')
// [{ start: 1, end: 2 }, { start: 3, end: 4 }, { start: 5, end: 6 }]
```

## Advanced Usage

### RegexMatcherBuilder

```javascript
import { RegexMatcherBuilder, Searcher } from '@gfhfyjbr/grep-js'

const matcher = new RegexMatcherBuilder().caseInsensitive(true).multiLine(true).word(true).build('error')

const searcher = new Searcher()
const result = searcher.searchSlice(matcher, 'ERROR: failed\nWarning: error detected')
```

#### Options

| Method                    | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `caseInsensitive(bool)`   | Case-insensitive matching                       |
| `caseSmart(bool)`         | Auto case-insensitivity if pattern is lowercase |
| `multiLine(bool)`         | `^` and `$` match line boundaries               |
| `dotMatchesNewLine(bool)` | `.` matches newlines                            |
| `word(bool)`              | Match only at word boundaries                   |
| `fixedStrings(bool)`      | Treat pattern as literal string                 |
| `wholeLine(bool)`         | Pattern must match entire line                  |
| `unicode(bool)`           | Enable Unicode support                          |

### SearcherBuilder

```javascript
import { RegexMatcher, SearcherBuilder, BinaryDetectionMode } from '@gfhfyjbr/grep-js'

const matcher = RegexMatcher.fromPattern('function\\s+\\w+')

const searcher = new SearcherBuilder()
  .lineNumber(true)
  .beforeContext(2)
  .afterContext(2)
  .binaryDetection(BinaryDetectionMode.Quit)
  .maxMatches(100)
  .build()

const result = searcher.searchPath(matcher, './src/index.ts')

for (const match of result.matches) {
  console.log(`${match.lineNumber}: ${match.line}`)
}
```

#### Options

| Method                  | Description                          |
| ----------------------- | ------------------------------------ |
| `lineNumber(bool)`      | Include line numbers (default: true) |
| `invertMatch(bool)`     | Report non-matching lines            |
| `multiLine(bool)`       | Enable multi-line matching           |
| `beforeContext(n)`      | Lines of context before match        |
| `afterContext(n)`       | Lines of context after match         |
| `binaryDetection(mode)` | Binary detection mode                |
| `maxMatches(n)`         | Maximum number of matches            |

### Binary Detection

```javascript
import { BinaryDetectionMode } from '@gfhfyjbr/grep-js'

BinaryDetectionMode.None // Search everything
BinaryDetectionMode.Quit // Stop on binary data
BinaryDetectionMode.Convert // Convert NUL bytes
```

## Types

```typescript
interface SearchResult {
  matches: SearchMatch[]
  context: SearchContext[]
  finish: SearchFinish
}

interface SearchMatch {
  lineNumber?: number
  absoluteByteOffset: number
  line: string
  bytes: Buffer
  matches: MatchRange[]
}

interface MatchRange {
  start: number
  end: number
}
```

## Performance

Uses the same regex engine as ripgrep:

- Fast DFA-based matching
- Optimized literal string matching
- Memory-mapped file support

## License

MIT
