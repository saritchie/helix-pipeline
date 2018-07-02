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
/* eslint-env mocha */
const assert = require('assert');
const pipeline = require('../index.js');

describe('Testing Attacher', () => {
  it('Executes once', (done) => {
    pipeline().once(() => {
      done();
    })();
  });

  it('Executes pre', (done) => {
    pipeline().pre(() => {
      done();
    })();
  });

  it('Executes post', (done) => {
    pipeline().post(() => {
      done();
    })();
  });

  it('Executes promises', (done) => {
    const retval = pipeline()
      .post(() => Promise.resolve({ foo: 'bar' }))
      .post((v) => {
        // console.log(v);
        assert.equal(v.foo, 'bar');
      })();
    retval.then((r) => {
      assert.equal(r.foo, 'bar');
      done();
    });
  });
});