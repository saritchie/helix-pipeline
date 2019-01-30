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
/* eslint-disable no-underscore-dangle */
const Ajv = require('ajv');
const path = require('path');
const hash = require('object-hash');

const _ajv = {};

function ajv(logger, options = {}) {
  if (!_ajv[hash(options)]) {
    logger.debug(`initializing ajv ${JSON.stringify(options)}`);
    const schemadir = path.resolve(__dirname, '..', 'schemas');
    const validator = new Ajv(Object.assign({ allErrors: true, verbose: true }, options));
    // compromise: in order to avoid async code here
    // (which would complicate pipeline implementation considerably)
    // we're using static file names and synchronous reads/requires (#134)
    const schemas = [
require("../schemas/action.schema.json"),
require("../schemas/content.schema.json"),
require("../schemas/context.schema.json"),
require("../schemas/mdast.schema.json"),
require("../schemas/meta.schema.json"),
require("../schemas/position.schema.json"),
require("../schemas/rawrequest.schema.json"),
require("../schemas/request.schema.json"),
require("../schemas/response.schema.json"),
require("../schemas/secrets.schema.json"),
require("../schemas/section.schema.json"),
require("../schemas/textcoordinates.schema.json"),
    ];
    schemas.forEach((schemaData) => {
      /* eslint-disable global-require */
      /* eslint-disable import/no-dynamic-require */
      validator.addSchema(schemaData);
    });
    logger.debug('ajv initialized');
    _ajv[hash(options)] = validator;
  }
  return _ajv[hash(options)];
}

module.exports = ajv;
