// ESM wrapper for grep-js
import binding from './index.js'

export const {
  RegexMatcher,
  RegexMatcherBuilder,
  Searcher,
  SearcherBuilder,
  BinaryDetectionMode,
  ContextKind,
  find,
  findAll,
  isMatch,
  search,
  searchFile,
} = binding

export default binding
