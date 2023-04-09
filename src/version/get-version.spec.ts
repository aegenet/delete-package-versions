import {rest} from 'msw'
import {setupServer} from 'msw/node'
import * as assert from 'node:assert'
import {getOldestVersions as _getOldestVersions, RestQueryInfo} from '.'
import {getMockedVersionsResponse} from './rest.mock'
import {RATE_LIMIT} from '../delete'

describe('get versions tests -- mock rest', () => {
  let server = setupServer()

  before(() => {
    server = setupServer()
    server.listen()
  })

  after(() => {
    server.close()
  })

  it('getOldestVersions -- success', async () => {
    const numVersions = RATE_LIMIT
    const resp = getMockedVersionsResponse(numVersions)

    server.use(
      rest.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async (req, res, ctx) => {
          return res(ctx.status(200), ctx.json(resp))
        }
      )
    )

    const result = await getOldestVersions({numVersions})
    assert.strictEqual(result.versions.length, numVersions)
    for (let i = 0; i < numVersions; i++) {
      assert.strictEqual(result.versions[i].id, resp[i].id)
      assert.strictEqual(result.versions[i].version, resp[i].name)
      assert.strictEqual(result.versions[i].created_at, resp[i].created_at)
    }
    assert.strictEqual(result.isOver, false)
    assert.strictEqual(result.totalCount, numVersions)
  })

  it('getOldestVersions -- success - GHES', async () => {
    const numVersions = RATE_LIMIT
    const resp = getMockedVersionsResponse(numVersions)

    // set GITHUB_API_URL to a different base url
    process.env.GITHUB_API_URL = 'https://github.someghesinstance.com/api/v3'

    server.use(
      rest.get(
        'https://github.someghesinstance.com/api/v3/users/test-owner/packages/npm/test-package/versions',
        async (req, res, ctx) => {
          return res(ctx.status(200), ctx.json(resp))
        }
      )
    )

    const result = await getOldestVersions({numVersions})
    assert.strictEqual(result.versions.length, numVersions)
    for (let i = 0; i < numVersions; i++) {
      assert.strictEqual(result.versions[i].id, resp[i].id)
      assert.strictEqual(result.versions[i].version, resp[i].name)
      assert.strictEqual(result.versions[i].created_at, resp[i].created_at)
    }
    assert.strictEqual(result.isOver, false)
    assert.strictEqual(result.totalCount, numVersions)

    delete process.env.GITHUB_API_URL
  })

  it('getOldestVersions -- success - container tagged versions', async () => {
    const numVersions = 6
    const numTaggedVersions = 3
    const numUntaggedVersions = numVersions - numTaggedVersions

    const respTagged = getMockedVersionsResponse(
      numTaggedVersions,
      0,
      'container',
      true
    )
    const respUntagged = getMockedVersionsResponse(
      numUntaggedVersions,
      numTaggedVersions,
      'container',
      false
    )
    const resp = respTagged.concat(respUntagged)

    server.use(
      rest.get(
        'https://api.github.com/users/test-owner/packages/container/test-package/versions',
        async (req, res, ctx) => {
          return res(ctx.status(200), ctx.json(resp))
        }
      )
    )

    const result = await getOldestVersions({
      numVersions,
      packageType: 'container'
    })
    assert.strictEqual(result.versions.length, numVersions)
    for (let i = 0; i < numVersions; i++) {
      assert.strictEqual(result.versions[i].id, resp[i].id)
      assert.strictEqual(result.versions[i].version, resp[i].name)
      assert.strictEqual(result.versions[i].created_at, resp[i].created_at)
      if (i < numTaggedVersions) {
        assert.strictEqual(result.versions[i].tagged, true)
      } else {
        assert.strictEqual(result.versions[i].tagged, false)
      }
    }
    assert.strictEqual(result.isOver, false)
    assert.strictEqual(result.totalCount, numVersions)
  })

  it('getOldestVersions -- paginate is false when fetched versions is less than page size', async () => {
    const numVersions = 5

    server.use(
      rest.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(getMockedVersionsResponse(numVersions))
          )
        }
      )
    )

    // In the call numVersions is set to RATE_LIMIT, but the response has only 5 versions.
    const result = await getOldestVersions()
    assert.strictEqual(result.isOver, true)
  })

  it('getOldestVersions -- API error', async () => {
    server.use(
      rest.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async (req, res, ctx) => {
          return res(ctx.status(500))
        }
      )
    )

    try {
      await getOldestVersions()
      throw new Error('should not get here.')
    } catch (err) {
      assert.ok((err as Error).message.includes('get versions API failed.'))
    }
  })
})

interface Params {
  owner?: string
  packageName?: string
  packageType?: string
  numVersions?: number
  page?: number
  token?: string
}

const defaultParams = {
  owner: 'test-owner',
  packageName: 'test-package',
  packageType: 'npm',
  numVersions: RATE_LIMIT,
  page: 1,
  token: 'test-token'
}

async function getOldestVersions(params?: Params): Promise<RestQueryInfo> {
  const p: Required<Params> = {...defaultParams, ...params}
  return _getOldestVersions(
    p.owner,
    p.packageName,
    p.packageType,
    p.numVersions,
    p.page,
    p.token
  )
}
