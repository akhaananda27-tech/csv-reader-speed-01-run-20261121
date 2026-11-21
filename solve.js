// Fast drop-in for csv-reader 1.0.0 (make.fun), written for csv-reader-speed-01-run-20261121.
// Returns exactly csv-reader's {columns, rows, errors} for every {text, header}, but reads
// the text with slice() cuts instead of one character at a time: a field is cut out whole
// once its end is found, and the ends are found with RegExp scans, not a per-character loop.
//
// The policy is csv-reader's own, followed exactly:
//  - a U+FEFF at the very start is dropped;
//  - a record ends at LF or CRLF, and a line left with no characters is no record;
//  - outside quotes a CR not followed by LF is dropped (stray_cr);
//  - a field that opens with a quote runs to the next quote that is not doubled, "" inside
//    it one quote and each CRLF or lone CR inside it read as LF; what follows its closing
//    quote, up to the next comma or line break, is appended as it stands (quote_junk, when
//    the field ends); a quote that never closes is a literal character, and the text after
//    it is read again as unquoted (unterminated_quote);
//  - a quote inside an unquoted field is a literal character; fields stay strings, never
//    trimmed or converted;
//  - columns is the first record when header is true, else null; rows holds the records
//    after it (every record when header is false), each padded with "" (short_row, with
//    fields: its field count) or cut (long_row, with extra: the cut fields) to the first
//    record's width;
//  - each error is {code, line, row}, in the order met, a record's short_row or long_row
//    when it ends: line the 1-based line its record starts on, counting every LF, CRLF
//    and lone CR inside quotes, and row its record's index in rows, null for the header.

/** How a field ended: at a comma (the record goes on), at a line break or at the end of the text. */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // Delimiters of an unquoted field (a run of plain characters), and the characters
  // that matter inside a quoted one. Fresh per call: nothing is kept from one case
  // to the next.
  const reU = /[^,\n\r]*/g;
  const reQ = /["\r\n]/g;

  // Reads unquoted characters onto `value` (and `parts`, when a stray CR has already split
  // it) up to the next comma or line break: a CR not followed by LF is dropped (stray_cr).
  // Returns the field and how it ended; `added` counts the characters kept here.
  // The regex matches a whole run of plain characters at once, so the field's content
  // comes out of the match itself instead of a slice.
  function readUnquoted(value, parts) {
    let added = 0;
    reU.lastIndex = pos;
    let m;
    for (;;) {
      m = reU.exec(text);
      const runEnd = m.index + m[0].length;
      if (runEnd >= n) {
        // No delimiter left: the field runs to the end of the text.
        const tail = m[0];
        if (parts) value = value + parts.join('') + tail;
        else if (value !== '') value += tail;
        else value = tail;
        added += tail.length;
        pos = n;
        return { value, ended: END, added };
      }
      const d = text.charCodeAt(runEnd);
      if (d === 44) {
        // ','
        const tail = m[0];
        if (parts) value = value + parts.join('') + tail;
        else if (value !== '') value += tail;
        else value = tail;
        added += tail.length;
        pos = runEnd + 1;
        return { value, ended: COMMA, added };
      }
      if (d === 10) {
        // '\n'
        const tail = m[0];
        if (parts) value = value + parts.join('') + tail;
        else if (value !== '') value += tail;
        else value = tail;
        added += tail.length;
        pos = runEnd + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // d === 13 ('\r')
      if (text.charCodeAt(runEnd + 1) === 10) {
        // CRLF: one line break.
        const tail = m[0];
        if (parts) value = value + parts.join('') + tail;
        else if (value !== '') value += tail;
        else value = tail;
        added += tail.length;
        pos = runEnd + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // A lone CR: dropped (stray_cr); the field goes on after it.
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      if (!parts) parts = [];
      parts.push(m[0]);
      added += m[0].length;
      reU.lastIndex = runEnd + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let segStart = pos + 1;
    let parts = null;
    let closed = false;
    let closeQ = -1;
    reQ.lastIndex = pos + 1;
    let m;
    while ((m = reQ.exec(text)) !== null) {
      const idx = m.index;
      const ch = m[0];
      if (ch === '"') {
        if (text.charCodeAt(idx + 1) === 34) {
          // "" inside the field is one quote.
          if (!parts) parts = [];
          parts.push(text.slice(segStart, idx));
          parts.push('"');
          segStart = idx + 2;
          reQ.lastIndex = idx + 2;
          continue;
        }
        closed = true;
        closeQ = idx;
        break;
      }
      if (ch === '\r') {
        // CRLF and a lone CR inside quotes are each one LF.
        if (!parts) parts = [];
        parts.push(text.slice(segStart, idx));
        parts.push('\n');
        line += 1;
        if (text.charCodeAt(idx + 1) === 10) {
          segStart = idx + 2;
          reQ.lastIndex = idx + 2;
        } else {
          segStart = idx + 1;
        }
        continue;
      }
      // '\n' inside quotes stays an LF; only the line moves.
      line += 1;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after it is
      // read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"', null);
    }
    let value;
    if (parts) value = parts.join('') + text.slice(segStart, closeQ);
    else value = text.slice(segStart, closeQ);
    pos = closeQ + 1;
    if (pos >= n) return { value, ended: END };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the next comma
    // or line break.
    const junk = readUnquoted(value, null);
    if (junk.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('', null);
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
