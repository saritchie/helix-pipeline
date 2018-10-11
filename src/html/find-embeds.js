/*
 * Copyright 2018 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
const retext = require('retext');
const map = require('unist-util-map');
const URI = require("uri-js");

/**
 * Finds embeds like `video: https://www.youtube.com/embed/2Xc9gXyf2G4`
 * @param {*} text 
 */
function gatsbyEmbed(text) {
  const matches = /^[a-z]+: +(http.*)$/.exec(text);
  if (matches&&URI.parse(matches[1]).reference === 'absolute') {
    return URI.parse(matches[1]);
  }
  return false;
}

/**
 * Finds embeds that are single absolute links in a paragraph
 * @param {*} node An MDAST node
 */
function iaEmbed({type, children}) {
  if (type==='paragraph'
    && children.length 
    && children[0].type==='link'
    && URI.parse(children[0].url).reference === 'absolute') {
    return URI.parse(children[0].url);
  } 
}

function embed(uri, node) {
  const children = [Object.assign({}, node)];
  node.type = 'embed';
  node.children = children;
  node.url = URI.serialize(uri);
  if (node.value) {
    delete node.value;
  }
}

function find({ content: { mdast } }) {
  map(mdast, (node) => {
    if (node.type === 'inlineCode' && gatsbyEmbed(node.value)) {
      embed(gatsbyEmbed(node.value), node);
    } else if (node.type === 'paragraph' && iaEmbed(node)) {
      embed(iaEmbed(node), node);
    }
  });

  return { content: { mdast } };
}

module.exports = find;
