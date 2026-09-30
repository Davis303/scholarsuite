# Spec 2 — Deep Proofread Mode (Section 28)

A dedicated "Deep Proofread" mode INSIDE the Academic Writing Assistant (same workspace,
shares the document, style profile, terminology rules, citation context, accepted edits).

Comprehensive final-quality review. User chooses scope: selected text | current
paragraph | current section | entire document. The system identifies possible problems
WITHOUT automatically changing the document. Reviews actual document context (section
heading, paragraph, surrounding paragraphs, document terminology, style profile,
citation style, previous accepted edits) — never isolated sentences.

## Check categories
- **Grammar**: mistakes, verb forms, subject-verb agreement, articles, prepositions,
  pronouns, sentence construction, punctuation.
- **Academic Writing**: unclear sentences, awkward wording, weak structure, informal
  language, repetition, poor paragraph flow, inconsistent tone, wordiness, excessive
  passive voice hurting readability.
- **Meaning and Logic**: contradictions, missing connections, unclear references,
  repeated ideas, abrupt transitions, apparently unsupported claims, statements needing
  clarification. Do NOT invent facts or judge factual truth without a user-provided source.
- **Citations**: whether citations attach to relevant claims, inconsistent formatting,
  possibly missing citation where writing indicates one is needed, confusing placement.
  Never create citations, invent sources, or auto-modify the reference list.
- **References**: obvious formatting inconsistencies (mixed styles, missing punctuation,
  capitalization, author formatting, confident duplicates). Never invent missing info.
- **Numbers and Technical Information**: flag inconsistent numbers, percentages, dates,
  names, technical terms, abbreviations, units. Never silently change; ask user to verify.

## Results interface
Professional proofreading panel. Summary header "Proofread Complete" with counts:
Issues Found, Grammar, Academic Style, Clarity, Citations, Consistency, Items to Verify.
Each issue: page number, original text, issue type, explanation, suggested correction,
confidence level. Example format:
  "Possible grammar issue" / Original: "The results shows a significant difference." /
  Suggestion: "The results show a significant difference." /
  Explanation: "Results is plural, so the verb should be 'show'."
Severity: Minor | Needs Review | Important (no alarming language for ordinary issues).

## User controls per suggestion
Accept | Reject | Edit | Ignore | Add to terminology rules. NEVER auto-apply corrections.
After decisions, show final summary: corrections accepted, suggestions rejected, items
still requiring review, citation items to verify, consistency items to verify.

## Style guardrails
Never make the document sound artificially sophisticated; keep the author's natural
academic style; never use an em dash.
