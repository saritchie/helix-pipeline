const yaml = require('js-yaml');

/**
 * Given an mdast tree and it's text representation, this finds all
 * the frontmatter in it.
 *
 * Frontmatter looks like this:
 *
 * ```
 * ---
 * Foo: bar
 * ---
 * ```
 *
 * The frontmatter is delimited by a `thematicBreak` made from three
 * dashes in the mdast and contains a yaml-encoded payload.
 *
 * Not any yaml and any thematicBreak is accepted; in order to avoid
 * false positives, the following restrictions apply:
 *
 * - There must be the start or end of the document or an empty line (`\n\n`)
 *   before and after the frontmatter block
 * - There may be no empty line within the frontmatter block; not even lines
 *   containing only whitespace
 * - The yaml must yield an object (as in key-value pairs); strings, numbers or
 *   arrays are not considered to be frontmatter in this context
 * - The thematic break must be made up of three dashes
 *
 * Note that most of the information required to asses these properties
 * is not contained in the mdast itself, which is why this algorithm requires
 * access to the original markdown string. (The mdast is an Abstract Syntax Tree,
 * the proper tool for a task like this would be a Concrete Syntax Tree, but we have
 * no such thing...).
 *
 * Note that converting the mdast to a markdown string will not do, since
 * the generated markdown will be much different.
 *
 * # Future directions
 *
 * This function is likely to change in the following ways:
 *
 * - Relaxed restrictions on what constitutes frontmatter.
 * - The ability to specify custom formats; by specifying the name
 *   of the format explicitly we reduce ambiguity to pretty much zero
 *   and can allow for far more complex frontmatter formats.
 *
 *    ```
 *    ---json
 *    {"foo": 42}
 *    ---
 *    ```
 *
 * # Ambiguous Frontmatter
 *
 * Normally, when one of the conditions above is triggered,
 * (e.g. Frontmatter containing an empty line; not being an array
 * instead of an object), a warning will be emitted instead of the
 * frontmatter being actually parsed & returned.
 * This warning may be processed by the caller in any way; e.g. by
 * printing a warning on the console or by throwing an error...
 *
 * In order to avoid ambiguous cases, the format described above
 * should be used for valid frontmatter; in order to use horizontal
 * rules unambiguously, the markdown author should either use symbols
 * other than dash to mark horizontal rules, or leave at least one empty
 * line before and after the three dashes.
 *
 * Both ways are guaranteed to be interpreted as horizontal rules and
 * never yield warnings.
 *
 * @param {Mdast} The object containing the mdast, including the root node and position information!
 * @param {Source} The original markdown
 * @returns {Iterable} Returns an iterable where each element represents either a
 *   block frontmatter or a warning issued.
 *   The order of warnings/frontmatter blocks is the same as in the input document.
 *
 *   Blocks of frontmatter use the following format:
 *
 *   ```
 *   {
 *     type: 'frontmatter',
 *     payload: {...},
 *     start: Number,
 *     end: Number
 *   }
 *   ```
 *
 *   `start` and `end` represent the index of the mdast node
 *   node that starts/ends the frontmatter block.
 *   Just replace all those nodes with an appropriate frontmatter
 *   node containing the payload to actually insert the frontmatter
 *   into the yaml.
 *
 *   Note that the `mdast` block does not necessarily contain
 *   only mdast blocks; settext headers for instance require
 *   us in some cases to 
 *
 *   Warnings use the following format:
 *
 *   ```
 *   {
 *     type: 'warning',
 *     warning: String,
 *     source: String, // Source code of the frontmatter block
 *     start: Number, // Node index as in 'frontmatter' type
 *     end: Number,
 *     cause: Error, // The error that caused the problem if any
 *   }
 *   ```
 */
const find_frontmatter = (mdast, src) => {
  const hspace = "[^\S\n\r]"; // Horizontal space
  const re = (x) => new RegExp(x);
  // Access the md source of a markdown ast element
  const start = (idx) => mdast.childen[idx].position.start.offset;
  const end = (idx) => mdast.childen[idx].position.start.offset;
  const nodeStr = (idx) => src.slice(start(idx), end(idx));

  const warn = (fst, last, txt, cause, prosa) => ({
    type: 'warning',
    warning: prosa,
    source: txt,
    start: fst,
    end: last
  });

  const ishead = (elm) => elm.after && elm.nod.type === 'heading';
  const ishr = (elm) => elm.after && elm.before;
  const toignore = (elm) => ishead(elm) || ishr(elm);

  const analyzenode = map(([idx, nod]) => {
    const mat = nodeStr(idx).match(re(`(?<=^|\n)---${hspace}*\n?$`));
    if (!mat) {
      return null;
    }

    // Offset of the actual separator line
    const off_start = mat.index + idx;
    const off_end = off_start + size(mat[0]);
    // Is there a new line or EOF before/after the separator?
    const before = Boolean(str.slice(0, off).match(re(`(^|(^|\n)${hspace}*\n)$`)));
    const after = Boolean(str.slice(off_end).match(re(`(${hspace}(\n|$)|$)`)));

    return {
      idx, nod, off_start, off_end, before, after
    };
  });

  const procwarnigns =map(blocks, ([fst, last]) => {
    const src = src.slice(fst.off_start, fst.off_end);

    if (toignore(fst) && toignore(last)) {
      return null;
    } else if (!fst.before) {
      return warn(fst, last, src, null,
          'Found ambigous frontmatter block: No empty line before the block! ' +
          'Make sure your frontmatter blocks contain no empty lines ' +
          'and your horizontal rules have an empty line before AND after them.');
    } else if (!last.after) {
      return warn(fst, last, src, null,
          'Found ambigous frontmatter block: No empty line after the block! ' +
          'Make sure your frontmatter blocks contain no empty lines ' +
          'and your horizontal rules have an empty line before AND after them.');
    } else if (txt.match(re(`\n${hspace.source}*\n`))) {
      return warn(fst, last, src, null,
          'Found ambigous frontmatter block: Block contains empty line! ' +
          'Make sure your frontmatter blocks contain no empty lines ' +
          'and your horizontal rules have an empty line before AND after them.');
    }

    const txt = src.slice(fst.off_end, last.off_end);
    let data;
    try {
      data = yaml.safeLoad(txt);
    } catch (e) {
      return warn(fst, last, src, e, `Exception ocurred while parsing yaml: ${e}`);
    }

    if (data.constructor !== Object) {
      return warn(fst, last, src, null,
          'Found ambigous frontmatter block: Block contains valid yaml, but ' +
          `it's data type is ${data.constructor} instead of Object.` +
          'Make sure your yaml blocks contain only key-value pairs at the root level!');
    }

    return {
      type: 'frontmatter',
      payload: data,
      start: fst.idx,
      end: last.idx,
    };
  };

  // Preprocessing
  const blocks = pipe(
    enumerate(mdast.children)
    // Find any potential frontmatter starts/ends;
    filter(([idx, nod]) => true
      && ( false
        || nod.type === 'thematicBreak'
        || (nod.type === 'heading' && nod.depth === 2))
    // Source code extraction, yaml parsing, checking constraints
    analyzenode,
    // Filter out those nodes that did not match the basic regexp above
    filter(identity),
    // Group the fences into actual pairs of start/end fence
    trySlidingWindow(2),
    // Decide which blocks to ignore, which deserve warnings and which
    // are actual frontmatter
    procwarnigns,
    // Filter out those nodes that where ignored by the last step
    filter(identity));
};

class FrontmatterParsingError extends Error {};

const parse_frontmatter = ({ content: { mdast } }) => {

  // We splice the mdast.
  let off = 0;

  for (const block in list(find_frontmatter(mdast))) {
    if (block.type === 'frontmatter') {
      // Replace all the ast nodes making up a frontmatter block
      // with the respective frontmatter block
      const cnt = block.end - block.start;
      mdast.children.splice(block.start + off, cnt, {
        type: 'yaml',
        payload: block.payload,
      });
      off -= cnt;

    } else {
      const {warning, source} = block;
      const fst = mdast.children[block.start];
      // This also needs to account for settext headings
      const line = fst.position.end.line;

      // Source file pretty printing with line numbers
      const sourceref = pipe(
        block.source.split('\n'),
        zipLeast2(range(line, Infinity)),
        map(([line, no]) => `    ${no} | ${line} `),
        join(""));

      throw new Error(`${warning}\n${sourceref}`);
    }
  }

  return { content: { mdast } };
};

assign(parse_frontmatter, {find_frontmatter, FrontmatterParsingError});

module.exports = parse_frontmatter;
