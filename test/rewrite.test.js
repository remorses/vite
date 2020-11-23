const {
  transformCjsImport
} = require('../dist/node/server/serverPluginModuleRewrite')

describe('rewrite commonjs imports', () => {
  const packageName = 'react'
  const resolvedPackageName = '/@modules/react/index.js'
  const cases = [
    `import { useState } from 'react'`,
    `import { useState, useEffect } from 'react'`,
    `import * as React from 'react'`,
    `import { useState as something } from 'react'`,
    `import { useState as something, useEffect } from 'react'`,
    `import { useState as something, useEffect as alias } from 'react'`,
    `import { default as Default } from 'react'`,
    `import { default as Default, useEffect } from 'react'`,
    `import React from 'react'`,
    `import React, { useState } from 'react'`
  ]
  for (let testCase of cases) {
    test(`"${testCase}"`, () => {
      const res = transformCjsImport(
        testCase,
        packageName,
        resolvedPackageName,
        0
      )
      expect(res).toMatchSnapshot()
    })
  }
})
