const {cloneDeep} = require('lodash');
const yaml = require('js-yaml');
const parseMarkdown = require('../src/html/parse-markdown
const parseFront = require('../src/html/parse-frontmatter');
const {FrontmatterParsingError} = parseFront;

const logger = winston.createLogger({
  silent: true,
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
  ],
});

const procMd = (md) => {
  const body = multiline(md);
  const {mdast: orig} = parseMd({ content: {body} }, {logger}).content;
  const {mdast: proc} = parseFront({content: {mdast: cloneDeep(orig)}}).content;
  return {orig, proc};

};

const ck = (md, ast) => {
  const {proc} = procMd(md);
  assert.deepStrictEqual(proc.children, yaml.safeLoad(ast));
};

const ckNop = (md) => {
  const {proc, orig} = procMd(md);
  assert.deepStrictEqual(proc, orig);
};

const ckErr = (body) => {
  assert.throws(() => procMd(body), FrontmatterParsingError);
};

it('parseFrontmatter', () => {
  // NOPs
  ckNop('Empty document', '');
  ckNop('Just some text', 'Foo');
  ckNop('Hash based second level header', '## Foo');
  ckNop('Underline second level header', `
    Hello World
    ---
  `);
  ckNop('Single <hr>', `
    ---
  `);
  ckNop('h2 with underline followed by <hr>', `
    Hello
    ---

    ---
  `);

  ckNop('diversity of h2 with underline and <hr>', `
    Hello
    ---

    Bar
    ---

    ---

    Bang
  `);

  ckNop('resolving ambiguity by using h2 underlined with 4 dashes', `
    Foo
    ----
    Hello
    ----
  `);

  ckNop('resolving ambiguity by using hr with spaces between dashes', `
    Foo
    - - -
    Hello
  `);

  ckNop('resolving ambiguity by using hr with spaces between dashes', `
    Foo

    - - -
    Hello: 13
    - - -

    Bar
  `);

  ckNop('resolving ambiguity by using hr with asterisk', `
    Foo
    ***
    Hello
  `);

  ckNop('resolving ambiguity by using hr with asterisk #2', `
    ***
    Foo: 42
    ***
  `);

  // actual warnings
  ckErr('reject yaml with list', `
    ---
    - Foo
    ---
  `);
  ckErr('reject yaml with json style list', `
    ---
    [1,2,3,4]
    ---
  `);
  ckErr('reject yaml with number', `
    ---
    42
    ---
  `);
  ckErr('reject yaml with string', `
    ---
    Hello
    ---
  `);
  ckErr('Reject yaml with null', `
    ---
    null
    ---
  `);
  ckErr('frontmatter with corrupted yaml', `
      Foo
      ---
      Bar: 42
      ---
    `);
  ckErr('frontmatter with insufficient space before it', `
      Foo
      ---
      Bar: 42
      ---
    `);
  ckErr('frontmatter with insufficient space after it', `
      ---
      Bar
      ---
      XXX
    `);
  ckErr('frontmatter with insufficient space on both ends', `
      ab: 33
      ---
      Bar: 22
      ---
      XXX: 44
    `);
  ckErr('pseudo frontmatter starting with hash based h2', `
      # ab
      Bar: 14
      ---
    `);
  ckErr('frontmatter with empty line between paragraphs', `
      echo

      ---
      hello: 42

      world: 13
      ---

      delta
    `);
  ckErr('frontmatter with empty line', `
      ---
      hello: 42

      world: 13
      ---
    `);
  ckErr('frontmatter with empty line filled with space', `
      ---
      hello: 42
            
      world: 13
      ---
    `);

  // Good values

  ck('Entire doc is frontmatter', `
    ---
    foo: 42
    ---
  `, `
  `);

  ck('Entire doc is frontmatter w trailing space', `
    ---        
    foo: 42
    ---        
  `, `
  `);

  ck('Frontmatter; underline h2; frontmatter'`
    ---
    foo: 42
    ---

    Hello
    ---             

    ---
    my: 42
    ---
  `, `
  `);

  ck('Frontmatter; underline h2; frontmatter; w trailing space'`
    ---   
    foo: 42
    ---    

    Hello
    ---             

    ---
    my: 42
    ---        
  `, `
  `);

  ck('frontmatter; frontmatter', `
    ---
    {x: 23}
    ---

    ---
    my: 42
    ---
  `, `
  `);
  ck('frontmatter, <hr>, frontmatter'`
    ---
    {x: 23}
    ---

    ---
              
    ---
    my: 42
    ---      
  `, `
  `);
  ck('frontmatter, text, frontmatter', `
    ---
    {x: 23}
    ---
              
    Hurtz

    ---
    my: 42
    ---
  `, `
  `);
  ck('frontmatter, <hr>, frontmatter, <hr>'`
    ---        
    {x: 23}
    ---

    ---  

    ---
    my: 42
    ---

    ---
  `, `
  `);
});
