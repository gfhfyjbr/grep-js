/* grep-js/searcher types */

import type { RegexMatcher, MatchRange } from './matcher'

/** Binary detection mode. */
export declare const enum BinaryDetectionMode {
  /** No binary detection. */
  None = 'None',
  /** Quit searching when binary data is detected. */
  Quit = 'Quit',
  /** Convert binary data to text (replace NUL bytes). */
  Convert = 'Convert',
}

/** The kind of context reported by a searcher. */
export declare const enum ContextKind {
  /** Context before a match. */
  Before = 'Before',
  /** Context after a match. */
  After = 'After',
  /** Other context (e.g., passthru mode). */
  Other = 'Other',
}

/** Represents a context line (before/after a match). */
export interface SearchContext {
  /** The line number (1-based), if line numbers are enabled. */
  lineNumber?: number
  /** The absolute byte offset of the start of this context line. */
  absoluteByteOffset: number
  /** The context line content. */
  line: string
  /** The bytes of the context line. */
  bytes: Buffer
  /** The kind of context (before, after, other). */
  kind: ContextKind
}

/** Summary information returned after a search completes. */
export interface SearchFinish {
  /** The absolute byte offset of the end of the search. */
  byteCount: number
  /** Whether binary data was detected (if binary detection is enabled). */
  binaryByteOffset?: number
}

/** Represents a matching line found by the searcher. */
export interface SearchMatch {
  /** The line number (1-based), if line numbers are enabled. */
  lineNumber?: number
  /** The absolute byte offset of the start of this match. */
  absoluteByteOffset: number
  /** The matched line content. */
  line: string
  /** The bytes of the matched line. */
  bytes: Buffer
  /** All match ranges within the line. */
  matches: Array<MatchRange>
}

/** Complete search result containing all matches and context. */
export interface SearchResult {
  /** All matching lines. */
  matches: Array<SearchMatch>
  /** All context lines. */
  context: Array<SearchContext>
  /** Summary information. */
  finish: SearchFinish
}

/**
 * A searcher executes searches over a haystack and collects results.
 *
 * Use `SearcherBuilder` to construct this with custom configuration.
 */
export declare class Searcher {
  /** Create a new searcher with default configuration. */
  constructor()
  /** Search a file for matches. */
  searchPath(matcher: RegexMatcher, path: string): SearchResult
  /** Search a byte slice for matches. */
  searchSlice(matcher: RegexMatcher, slice: string | Buffer): SearchResult
  /** Search a reader for matches. */
  searchReader(matcher: RegexMatcher, data: Buffer): SearchResult
}

/**
 * Builder for configuring a Searcher.
 *
 * A search builder permits specifying configuration options like whether to
 * invert the search, enable multi-line search, or configure context lines.
 */
export declare class SearcherBuilder {
  /** Create a new builder with default configuration. */
  constructor()
  /** Build a searcher with the current configuration. */
  build(): Searcher
  /**
   * Set the line terminator used by the searcher.
   *
   * By default, this is `\n` (byte value 10).
   */
  lineTerminator(byte: number): this
  /**
   * Whether to invert matching.
   *
   * When enabled, non-matching lines are reported instead of matching lines.
   */
  invertMatch(yes: boolean): this
  /**
   * Whether to count and include line numbers with matching lines.
   *
   * Enabled by default.
   */
  lineNumber(yes: boolean): this
  /**
   * Whether to enable multi-line search.
   *
   * When enabled, matches may span multiple lines.
   * Warning: requires loading entire file into memory.
   */
  multiLine(yes: boolean): this
  /** Number of context lines to include after each match. */
  afterContext(lineCount: number): this
  /** Number of context lines to include before each match. */
  beforeContext(lineCount: number): this
  /**
   * Whether to enable passthru mode.
   *
   * When enabled, all non-matching lines are reported as context.
   */
  passthru(yes: boolean): this
  /**
   * Set an approximate heap limit in bytes.
   *
   * Set to 0 to disable heap usage (requires memory maps for large files).
   */
  heapLimit(bytes?: number | undefined | null): this
  /**
   * Set binary detection mode.
   *
   * - "None": No binary detection
   * - "Quit": Stop searching when binary data is detected
   * - "Convert": Convert NUL bytes to line terminators
   */
  binaryDetection(mode: BinaryDetectionMode): this
  /**
   * Enable automatic BOM sniffing for encoding detection.
   *
   * When enabled, UTF-16 files with BOM will be searched correctly.
   */
  bomSniffing(yes: boolean): this
  /**
   * Stop searching when a non-matching line is found after a matching line.
   *
   * Useful for searching sorted files.
   */
  stopOnNonmatch(yes: boolean): this
  /** Set the maximum number of matches to return. */
  maxMatches(limit?: number | undefined | null): this
}
