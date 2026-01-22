#![deny(clippy::all)]

use std::io::Cursor;
use std::path::Path;
use std::sync::Arc;

use grep::matcher::Matcher;
use grep::regex::{
  RegexMatcher as GrepRegexMatcher, RegexMatcherBuilder as GrepRegexMatcherBuilder,
};
use grep::searcher::{
  BinaryDetection as GrepBinaryDetection, Searcher as GrepSearcher,
  SearcherBuilder as GrepSearcherBuilder, Sink, SinkContext, SinkContextKind, SinkFinish,
  SinkMatch,
};
use napi::bindgen_prelude::*;
use napi_derive::napi;

// ============================================================================
// Enums
// ============================================================================

/// The kind of context reported by a searcher.
#[napi(string_enum)]
pub enum ContextKind {
  /// Context before a match.
  Before,
  /// Context after a match.
  After,
  /// Other context (e.g., passthru mode).
  Other,
}

impl From<SinkContextKind> for ContextKind {
  fn from(kind: SinkContextKind) -> Self {
    match kind {
      SinkContextKind::Before => ContextKind::Before,
      SinkContextKind::After => ContextKind::After,
      SinkContextKind::Other => ContextKind::Other,
    }
  }
}

/// Binary detection mode.
#[napi(string_enum)]
pub enum BinaryDetectionMode {
  /// No binary detection.
  None,
  /// Quit searching when binary data is detected.
  Quit,
  /// Convert binary data to text (replace NUL bytes).
  Convert,
}

// ============================================================================
// Result types
// ============================================================================

/// A single match found in a line.
#[napi(object)]
pub struct MatchRange {
  /// Start byte offset within the line.
  pub start: u32,
  /// End byte offset within the line.
  pub end: u32,
}

/// Represents a matching line found by the searcher.
#[napi(object)]
pub struct SearchMatch {
  /// The line number (1-based), if line numbers are enabled.
  pub line_number: Option<u32>,
  /// The absolute byte offset of the start of this match.
  pub absolute_byte_offset: i64,
  /// The matched line content.
  pub line: String,
  /// The bytes of the matched line.
  pub bytes: Buffer,
  /// All match ranges within the line.
  pub matches: Vec<MatchRange>,
}

/// Represents a context line (before/after a match).
#[napi(object)]
pub struct SearchContext {
  /// The line number (1-based), if line numbers are enabled.
  pub line_number: Option<u32>,
  /// The absolute byte offset of the start of this context line.
  pub absolute_byte_offset: i64,
  /// The context line content.
  pub line: String,
  /// The bytes of the context line.
  pub bytes: Buffer,
  /// The kind of context (before, after, other).
  pub kind: ContextKind,
}

/// Summary information returned after a search completes.
#[napi(object)]
pub struct SearchFinish {
  /// The absolute byte offset of the end of the search.
  pub byte_count: i64,
  /// Whether binary data was detected (if binary detection is enabled).
  pub binary_byte_offset: Option<i64>,
}

/// Complete search result containing all matches and context.
#[napi(object)]
pub struct SearchResult {
  /// All matching lines.
  pub matches: Vec<SearchMatch>,
  /// All context lines.
  pub context: Vec<SearchContext>,
  /// Summary information.
  pub finish: SearchFinish,
}

// ============================================================================
// RegexMatcherBuilder
// ============================================================================

/// Builder for constructing a RegexMatcher.
///
/// This builder re-exports many of the same options found on the regex crate's
/// builder, in addition to options like smart case, word matching, and line
/// terminator settings.
#[napi]
pub struct RegexMatcherBuilder {
  inner: GrepRegexMatcherBuilder,
}

#[napi]
impl RegexMatcherBuilder {
  /// Create a new builder with default configuration.
  #[napi(constructor)]
  pub fn new() -> Self {
    Self {
      inner: GrepRegexMatcherBuilder::new(),
    }
  }

  /// Build a new matcher for the provided pattern.
  #[napi]
  pub fn build(&self, pattern: String) -> Result<RegexMatcher> {
    let matcher = self
      .inner
      .build(&pattern)
      .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
    Ok(RegexMatcher {
      inner: Arc::new(matcher),
    })
  }

  /// Build a new matcher from multiple patterns (joined as alternation).
  #[napi]
  pub fn build_many(&self, patterns: Vec<String>) -> Result<RegexMatcher> {
    let matcher = self
      .inner
      .build_many(&patterns)
      .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
    Ok(RegexMatcher {
      inner: Arc::new(matcher),
    })
  }

  /// Build a new matcher from literal strings (optimized alternation).
  #[napi]
  pub fn build_literals(&self, literals: Vec<String>) -> Result<RegexMatcher> {
    let matcher = self
      .inner
      .build_literals(&literals)
      .map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
    Ok(RegexMatcher {
      inner: Arc::new(matcher),
    })
  }

  /// Set the value for the case insensitive (`i`) flag.
  ///
  /// When enabled, letters in the pattern will match both upper case and
  /// lower case variants.
  #[napi]
  pub fn case_insensitive(&mut self, yes: bool) -> &Self {
    self.inner.case_insensitive(yes);
    self
  }

  /// Whether to enable "smart case" or not.
  ///
  /// When smart case is enabled, the builder will automatically enable
  /// case insensitive matching based on how the pattern is written.
  /// Specifically, case insensitive mode is enabled when:
  /// 1. The pattern contains at least one literal character.
  /// 2. Of the literals in the pattern, none of them are uppercase.
  #[napi]
  pub fn case_smart(&mut self, yes: bool) -> &Self {
    self.inner.case_smart(yes);
    self
  }

  /// Set the value for the multi-line matching (`m`) flag.
  ///
  /// When enabled, `^` matches the beginning of lines and `$` matches
  /// the end of lines.
  #[napi]
  pub fn multi_line(&mut self, yes: bool) -> &Self {
    self.inner.multi_line(yes);
    self
  }

  /// Set the value for the any character (`s`) flag.
  ///
  /// When enabled, `.` matches any character including newlines.
  #[napi]
  pub fn dot_matches_new_line(&mut self, yes: bool) -> &Self {
    self.inner.dot_matches_new_line(yes);
    self
  }

  /// Set the value for the greedy swap (`U`) flag.
  ///
  /// When enabled, `a*` is lazy and `a*?` is greedy.
  #[napi]
  pub fn swap_greed(&mut self, yes: bool) -> &Self {
    self.inner.swap_greed(yes);
    self
  }

  /// Set the value for the ignore whitespace (`x`) flag.
  ///
  /// When enabled, whitespace and comments in the pattern are ignored.
  #[napi]
  pub fn ignore_whitespace(&mut self, yes: bool) -> &Self {
    self.inner.ignore_whitespace(yes);
    self
  }

  /// Set the value for the Unicode (`u`) flag.
  ///
  /// When disabled, character classes like `\w` only match ASCII.
  #[napi]
  pub fn unicode(&mut self, yes: bool) -> &Self {
    self.inner.unicode(yes);
    self
  }

  /// Whether to support octal syntax or not.
  ///
  /// Octal syntax is disabled by default.
  #[napi]
  pub fn octal(&mut self, yes: bool) -> &Self {
    self.inner.octal(yes);
    self
  }

  /// Set the approximate size limit of the compiled regular expression.
  #[napi]
  pub fn size_limit(&mut self, bytes: u32) -> &Self {
    self.inner.size_limit(bytes as usize);
    self
  }

  /// Set the approximate size of the cache used by the DFA.
  #[napi]
  pub fn dfa_size_limit(&mut self, bytes: u32) -> &Self {
    self.inner.dfa_size_limit(bytes as usize);
    self
  }

  /// Set the nesting limit for the parser.
  #[napi]
  pub fn nest_limit(&mut self, limit: u32) -> &Self {
    self.inner.nest_limit(limit);
    self
  }

  /// Set an ASCII line terminator for the matcher.
  ///
  /// When set, the matcher will never produce a match containing this byte.
  #[napi]
  pub fn line_terminator(&mut self, byte: Option<u32>) -> &Self {
    self.inner.line_terminator(byte.map(|b| b as u8));
    self
  }

  /// Ban a byte from occurring in a pattern.
  ///
  /// If this byte is found in the pattern, an error will be returned.
  #[napi]
  pub fn ban_byte(&mut self, byte: Option<u32>) -> &Self {
    self.inner.ban_byte(byte.map(|b| b as u8));
    self
  }

  /// Set CRLF mode for line terminators.
  ///
  /// When enabled, `$` will match both `\r\n` and `\n`.
  #[napi]
  pub fn crlf(&mut self, yes: bool) -> &Self {
    self.inner.crlf(yes);
    self
  }

  /// Require that all matches occur on word boundaries.
  #[napi]
  pub fn word(&mut self, yes: bool) -> &Self {
    self.inner.word(yes);
    self
  }

  /// Whether the patterns should be treated as literal strings.
  ///
  /// When enabled, all regex meta characters are matched literally.
  #[napi]
  pub fn fixed_strings(&mut self, yes: bool) -> &Self {
    self.inner.fixed_strings(yes);
    self
  }

  /// Whether each pattern should match the entire line.
  ///
  /// Equivalent to surrounding the pattern with `(?m:^)` and `(?m:$)`.
  #[napi]
  pub fn whole_line(&mut self, yes: bool) -> &Self {
    self.inner.whole_line(yes);
    self
  }
}

impl Default for RegexMatcherBuilder {
  fn default() -> Self {
    Self::new()
  }
}

// ============================================================================
// RegexMatcher
// ============================================================================

/// A compiled regex matcher.
///
/// Use `RegexMatcherBuilder` to construct this.
#[napi]
pub struct RegexMatcher {
  inner: Arc<GrepRegexMatcher>,
}

#[napi]
impl RegexMatcher {
  /// Create a new matcher from a pattern with default options.
  #[napi(factory)]
  pub fn from_pattern(pattern: String) -> Result<Self> {
    let matcher =
      GrepRegexMatcher::new(&pattern).map_err(|e| Error::new(Status::InvalidArg, e.to_string()))?;
    Ok(Self {
      inner: Arc::new(matcher),
    })
  }

  /// Check if the given text matches the pattern.
  #[napi]
  pub fn is_match(&self, text: Either<String, Buffer>) -> Result<bool> {
    let bytes = match &text {
      Either::A(s) => s.as_bytes(),
      Either::B(b) => b.as_ref(),
    };
    self
      .inner
      .is_match(bytes)
      .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
  }

  /// Find the first match in the given text.
  ///
  /// Returns the start and end byte offsets, or null if no match.
  #[napi]
  pub fn find(&self, text: Either<String, Buffer>) -> Result<Option<MatchRange>> {
    let bytes = match &text {
      Either::A(s) => s.as_bytes(),
      Either::B(b) => b.as_ref(),
    };
    match self.inner.find(bytes) {
      Ok(Some(m)) => Ok(Some(MatchRange {
        start: m.start() as u32,
        end: m.end() as u32,
      })),
      Ok(None) => Ok(None),
      Err(e) => Err(Error::new(Status::GenericFailure, e.to_string())),
    }
  }

  /// Find all matches in the given text.
  #[napi]
  pub fn find_all(&self, text: Either<String, Buffer>) -> Result<Vec<MatchRange>> {
    let bytes = match &text {
      Either::A(s) => s.as_bytes(),
      Either::B(b) => b.as_ref(),
    };
    let mut matches = Vec::new();
    let mut start = 0;
    while start < bytes.len() {
      match self.inner.find(&bytes[start..]) {
        Ok(Some(m)) => {
          matches.push(MatchRange {
            start: (start + m.start()) as u32,
            end: (start + m.end()) as u32,
          });
          start += m.end().max(1);
        }
        Ok(None) => break,
        Err(e) => return Err(Error::new(Status::GenericFailure, e.to_string())),
      }
    }
    Ok(matches)
  }
}

// ============================================================================
// SearcherBuilder
// ============================================================================

/// Builder for configuring a Searcher.
///
/// A search builder permits specifying configuration options like whether to
/// invert the search, enable multi-line search, or configure context lines.
#[napi]
pub struct SearcherBuilder {
  inner: GrepSearcherBuilder,
}

#[napi]
impl SearcherBuilder {
  /// Create a new builder with default configuration.
  #[napi(constructor)]
  pub fn new() -> Self {
    Self {
      inner: GrepSearcherBuilder::new(),
    }
  }

  /// Build a searcher with the current configuration.
  #[napi]
  pub fn build(&self) -> Searcher {
    Searcher {
      inner: self.inner.build(),
    }
  }

  /// Set the line terminator used by the searcher.
  ///
  /// By default, this is `\n` (byte value 10).
  #[napi]
  pub fn line_terminator(&mut self, byte: u32) -> &Self {
    self
      .inner
      .line_terminator(grep::matcher::LineTerminator::byte(byte as u8));
    self
  }

  /// Whether to invert matching.
  ///
  /// When enabled, non-matching lines are reported instead of matching lines.
  #[napi]
  pub fn invert_match(&mut self, yes: bool) -> &Self {
    self.inner.invert_match(yes);
    self
  }

  /// Whether to count and include line numbers with matching lines.
  ///
  /// Enabled by default.
  #[napi]
  pub fn line_number(&mut self, yes: bool) -> &Self {
    self.inner.line_number(yes);
    self
  }

  /// Whether to enable multi-line search.
  ///
  /// When enabled, matches may span multiple lines.
  /// Warning: requires loading entire file into memory.
  #[napi]
  pub fn multi_line(&mut self, yes: bool) -> &Self {
    self.inner.multi_line(yes);
    self
  }

  /// Number of context lines to include after each match.
  #[napi]
  pub fn after_context(&mut self, line_count: u32) -> &Self {
    self.inner.after_context(line_count as usize);
    self
  }

  /// Number of context lines to include before each match.
  #[napi]
  pub fn before_context(&mut self, line_count: u32) -> &Self {
    self.inner.before_context(line_count as usize);
    self
  }

  /// Whether to enable passthru mode.
  ///
  /// When enabled, all non-matching lines are reported as context.
  #[napi]
  pub fn passthru(&mut self, yes: bool) -> &Self {
    self.inner.passthru(yes);
    self
  }

  /// Set an approximate heap limit in bytes.
  ///
  /// Set to 0 to disable heap usage (requires memory maps for large files).
  #[napi]
  pub fn heap_limit(&mut self, bytes: Option<u32>) -> &Self {
    self.inner.heap_limit(bytes.map(|b| b as usize));
    self
  }

  /// Set binary detection mode.
  ///
  /// - "None": No binary detection
  /// - "Quit": Stop searching when binary data is detected
  /// - "Convert": Convert NUL bytes to line terminators
  #[napi]
  pub fn binary_detection(&mut self, mode: BinaryDetectionMode) -> &Self {
    let detection = match mode {
      BinaryDetectionMode::None => GrepBinaryDetection::none(),
      BinaryDetectionMode::Quit => GrepBinaryDetection::quit(0),
      BinaryDetectionMode::Convert => GrepBinaryDetection::convert(0),
    };
    self.inner.binary_detection(detection);
    self
  }

  /// Enable automatic BOM sniffing for encoding detection.
  ///
  /// When enabled, UTF-16 files with BOM will be searched correctly.
  #[napi]
  pub fn bom_sniffing(&mut self, yes: bool) -> &Self {
    self.inner.bom_sniffing(yes);
    self
  }

  /// Stop searching when a non-matching line is found after a matching line.
  ///
  /// Useful for searching sorted files.
  #[napi]
  pub fn stop_on_nonmatch(&mut self, yes: bool) -> &Self {
    self.inner.stop_on_nonmatch(yes);
    self
  }

  /// Set the maximum number of matches to return.
  #[napi]
  pub fn max_matches(&mut self, limit: Option<u32>) -> &Self {
    self.inner.max_matches(limit.map(|l| l as u64));
    self
  }
}

impl Default for SearcherBuilder {
  fn default() -> Self {
    Self::new()
  }
}

// ============================================================================
// Searcher
// ============================================================================

/// A searcher executes searches over a haystack and collects results.
///
/// Use `SearcherBuilder` to construct this with custom configuration.
#[napi]
pub struct Searcher {
  inner: GrepSearcher,
}

#[napi]
impl Searcher {
  /// Create a new searcher with default configuration.
  #[napi(constructor)]
  pub fn new() -> Self {
    Self {
      inner: GrepSearcher::new(),
    }
  }

  /// Search a file for matches.
  #[napi]
  pub fn search_path(&mut self, matcher: &RegexMatcher, path: String) -> Result<SearchResult> {
    let mut sink = CollectSink::new(matcher.inner.clone());
    self
      .inner
      .search_path(&*matcher.inner, Path::new(&path), &mut sink)
      .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    Ok(sink.into_result())
  }

  /// Search a byte slice for matches.
  #[napi]
  pub fn search_slice(
    &mut self,
    matcher: &RegexMatcher,
    slice: Either<String, Buffer>,
  ) -> Result<SearchResult> {
    let bytes = match &slice {
      Either::A(s) => s.as_bytes(),
      Either::B(b) => b.as_ref(),
    };
    let mut sink = CollectSink::new(matcher.inner.clone());
    self
      .inner
      .search_slice(&*matcher.inner, bytes, &mut sink)
      .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    Ok(sink.into_result())
  }

  /// Search a reader for matches.
  #[napi]
  pub fn search_reader(&mut self, matcher: &RegexMatcher, data: Buffer) -> Result<SearchResult> {
    let mut sink = CollectSink::new(matcher.inner.clone());
    let cursor = Cursor::new(data.as_ref());
    self
      .inner
      .search_reader(&*matcher.inner, cursor, &mut sink)
      .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    Ok(sink.into_result())
  }
}

impl Default for Searcher {
  fn default() -> Self {
    Self::new()
  }
}

// ============================================================================
// Internal Sink implementation
// ============================================================================

struct CollectSink {
  matcher: Arc<GrepRegexMatcher>,
  matches: Vec<SearchMatch>,
  context: Vec<SearchContext>,
  finish: Option<SearchFinish>,
}

impl CollectSink {
  fn new(matcher: Arc<GrepRegexMatcher>) -> Self {
    Self {
      matcher,
      matches: Vec::new(),
      context: Vec::new(),
      finish: None,
    }
  }

  fn into_result(self) -> SearchResult {
    SearchResult {
      matches: self.matches,
      context: self.context,
      finish: self.finish.unwrap_or(SearchFinish {
        byte_count: 0,
        binary_byte_offset: None,
      }),
    }
  }
}

impl Sink for CollectSink {
  type Error = std::io::Error;

  fn matched(
    &mut self,
    _searcher: &GrepSearcher,
    mat: &SinkMatch<'_>,
  ) -> std::result::Result<bool, Self::Error> {
    let line_bytes = mat.bytes();
    let line_str = String::from_utf8_lossy(line_bytes).to_string();

    // Find all matches within this line
    let mut match_ranges = Vec::new();
    let mut start = 0;
    while start < line_bytes.len() {
      match self.matcher.find(&line_bytes[start..]) {
        Ok(Some(m)) => {
          match_ranges.push(MatchRange {
            start: (start + m.start()) as u32,
            end: (start + m.end()) as u32,
          });
          start += m.end().max(1);
        }
        _ => break,
      }
    }

    self.matches.push(SearchMatch {
      line_number: mat.line_number().map(|n| n as u32),
      absolute_byte_offset: mat.absolute_byte_offset() as i64,
      line: line_str,
      bytes: Buffer::from(line_bytes.to_vec()),
      matches: match_ranges,
    });
    Ok(true)
  }

  fn context(
    &mut self,
    _searcher: &GrepSearcher,
    ctx: &SinkContext<'_>,
  ) -> std::result::Result<bool, Self::Error> {
    let line_bytes = ctx.bytes();
    let line_str = String::from_utf8_lossy(line_bytes).to_string();

    self.context.push(SearchContext {
      line_number: ctx.line_number().map(|n| n as u32),
      absolute_byte_offset: ctx.absolute_byte_offset() as i64,
      line: line_str,
      bytes: Buffer::from(line_bytes.to_vec()),
      kind: ctx.kind().clone().into(),
    });
    Ok(true)
  }

  fn finish(
    &mut self,
    _searcher: &GrepSearcher,
    finish: &SinkFinish,
  ) -> std::result::Result<(), Self::Error> {
    self.finish = Some(SearchFinish {
      byte_count: finish.byte_count() as i64,
      binary_byte_offset: finish.binary_byte_offset().map(|o| o as i64),
    });
    Ok(())
  }
}

// ============================================================================
// Convenience functions
// ============================================================================

/// Search a string/buffer for a pattern with default options.
///
/// This is a convenience function for simple searches.
#[napi]
pub fn search(pattern: String, haystack: Either<String, Buffer>) -> Result<SearchResult> {
  let matcher = RegexMatcher::from_pattern(pattern)?;
  let mut searcher = Searcher::new();
  searcher.search_slice(&matcher, haystack)
}

/// Search a file for a pattern with default options.
#[napi]
pub fn search_file(pattern: String, path: String) -> Result<SearchResult> {
  let matcher = RegexMatcher::from_pattern(pattern)?;
  let mut searcher = Searcher::new();
  searcher.search_path(&matcher, path)
}

/// Check if a pattern matches anywhere in the given text.
#[napi]
pub fn is_match(pattern: String, text: Either<String, Buffer>) -> Result<bool> {
  let matcher = RegexMatcher::from_pattern(pattern)?;
  matcher.is_match(text)
}

/// Find the first match of a pattern in the given text.
#[napi]
pub fn find(pattern: String, text: Either<String, Buffer>) -> Result<Option<MatchRange>> {
  let matcher = RegexMatcher::from_pattern(pattern)?;
  matcher.find(text)
}

/// Find all matches of a pattern in the given text.
#[napi]
pub fn find_all(pattern: String, text: Either<String, Buffer>) -> Result<Vec<MatchRange>> {
  let matcher = RegexMatcher::from_pattern(pattern)?;
  matcher.find_all(text)
}
