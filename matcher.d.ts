/* grep-js/matcher types */

export interface MatchRange {
  /** Start byte offset within the line. */
  start: number
  /** End byte offset within the line. */
  end: number
}

/**
 * A compiled regex matcher.
 *
 * Use `RegexMatcherBuilder` to construct this.
 */
export declare class RegexMatcher {
  /** Create a new matcher from a pattern with default options. */
  static fromPattern(pattern: string): RegexMatcher
  /** Check if the given text matches the pattern. */
  isMatch(text: string | Buffer): boolean
  /**
   * Find the first match in the given text.
   *
   * Returns the start and end byte offsets, or null if no match.
   */
  find(text: string | Buffer): MatchRange | null
  /** Find all matches in the given text. */
  findAll(text: string | Buffer): Array<MatchRange>
}

/**
 * Builder for constructing a RegexMatcher.
 *
 * This builder re-exports many of the same options found on the regex crate's
 * builder, in addition to options like smart case, word matching, and line
 * terminator settings.
 */
export declare class RegexMatcherBuilder {
  /** Create a new builder with default configuration. */
  constructor()
  /** Build a new matcher for the provided pattern. */
  build(pattern: string): RegexMatcher
  /** Build a new matcher from multiple patterns (joined as alternation). */
  buildMany(patterns: Array<string>): RegexMatcher
  /** Build a new matcher from literal strings (optimized alternation). */
  buildLiterals(literals: Array<string>): RegexMatcher
  /**
   * Set the value for the case insensitive (`i`) flag.
   *
   * When enabled, letters in the pattern will match both upper case and
   * lower case variants.
   */
  caseInsensitive(yes: boolean): this
  /**
   * Whether to enable "smart case" or not.
   *
   * When smart case is enabled, the builder will automatically enable
   * case insensitive matching based on how the pattern is written.
   * Specifically, case insensitive mode is enabled when:
   * 1. The pattern contains at least one literal character.
   * 2. Of the literals in the pattern, none of them are uppercase.
   */
  caseSmart(yes: boolean): this
  /**
   * Set the value for the multi-line matching (`m`) flag.
   *
   * When enabled, `^` matches the beginning of lines and `$` matches
   * the end of lines.
   */
  multiLine(yes: boolean): this
  /**
   * Set the value for the any character (`s`) flag.
   *
   * When enabled, `.` matches any character including newlines.
   */
  dotMatchesNewLine(yes: boolean): this
  /**
   * Set the value for the greedy swap (`U`) flag.
   *
   * When enabled, `a*` is lazy and `a*?` is greedy.
   */
  swapGreed(yes: boolean): this
  /**
   * Set the value for the ignore whitespace (`x`) flag.
   *
   * When enabled, whitespace and comments in the pattern are ignored.
   */
  ignoreWhitespace(yes: boolean): this
  /**
   * Set the value for the Unicode (`u`) flag.
   *
   * When disabled, character classes like `\w` only match ASCII.
   */
  unicode(yes: boolean): this
  /**
   * Whether to support octal syntax or not.
   *
   * Octal syntax is disabled by default.
   */
  octal(yes: boolean): this
  /** Set the approximate size limit of the compiled regular expression. */
  sizeLimit(bytes: number): this
  /** Set the approximate size of the cache used by the DFA. */
  dfaSizeLimit(bytes: number): this
  /** Set the nesting limit for the parser. */
  nestLimit(limit: number): this
  /**
   * Set an ASCII line terminator for the matcher.
   *
   * When set, the matcher will never produce a match containing this byte.
   */
  lineTerminator(byte?: number | undefined | null): this
  /**
   * Ban a byte from occurring in a pattern.
   *
   * If this byte is found in the pattern, an error will be returned.
   */
  banByte(byte?: number | undefined | null): this
  /**
   * Set CRLF mode for line terminators.
   *
   * When enabled, `$` will match both `\r\n` and `\n`.
   */
  crlf(yes: boolean): this
  /** Require that all matches occur on word boundaries. */
  word(yes: boolean): this
  /**
   * Whether the patterns should be treated as literal strings.
   *
   * When enabled, all regex meta characters are matched literally.
   */
  fixedStrings(yes: boolean): this
  /**
   * Whether each pattern should match the entire line.
   *
   * Equivalent to surrounding the pattern with `(?m:^)` and `(?m:$)`.
   */
  wholeLine(yes: boolean): this
}
