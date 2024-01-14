import * as assert from 'node:assert'
import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'
import {Input, InputParams} from './input'
import {deleteVersions, finalIds, RATE_LIMIT} from './delete'
import {getMockedVersionsResponse} from './version/rest.mock'

describe('index tests -- call rest', () => {
  let server = setupServer()

  before(() => {
    server = setupServer()
    server.listen()
  })

  after(() => {
    server.close()
  })

  it('finalIds test - supplied package version id', async () => {
    const suppliedIds = [123, 456, 789]
    const ids = await finalIds(getInput({packageVersionIds: suppliedIds}))
    assert.deepStrictEqual(ids, suppliedIds)
    console.log('ok')
  })

  it('finalIDs test - success', async () => {
    const numVersions = 10
    let apiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async () => {
          apiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    const ids = await finalIds(getInput())
    assert.strictEqual(apiCalled, 1)
    assert.strictEqual(ids.length, numVersions)
    for (let i = 0; i < numVersions; i++) {
      assert.strictEqual(ids[i], versions[i].id)
    }
  })

  it('finalIDs test - success - GHES', async () => {
    process.env.GITHUB_API_URL = 'https://github.someghesinstance.com/api/v3'

    const numVersions = 10
    let apiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)

    server.use(
      http.get(
        'https://github.someghesinstance.com/api/v3/users/test-owner/packages/npm/test-package/versions',
        async () => {
          apiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    const ids = await finalIds(getInput())
    assert.strictEqual(apiCalled, 1)
    assert.strictEqual(ids.length, numVersions)
    for (let i = 0; i < numVersions; i++) {
      assert.strictEqual(ids[i], versions[i].id)
    }

    delete process.env.GITHUB_API_URL
  })

  it('finalIDs test - success - pagination', async () => {
    const numVersions = RATE_LIMIT * 2
    let apiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)

    const firstPage = versions.slice(0, RATE_LIMIT)
    const secondPage = versions.slice(RATE_LIMIT)

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async ({request}) => {
          apiCalled++
          const url = new URL(request.url)
          const page = url.searchParams.get('page')
          if (page === '1') {
            return new HttpResponse(JSON.stringify(firstPage), {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            })
          } else if (page === '2') {
            return new HttpResponse(JSON.stringify(secondPage), {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            })
          } else {
            return new HttpResponse(JSON.stringify([]), {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            })
          }
        }
      )
    )

    const ids = await finalIds(getInput())
    assert.strictEqual(apiCalled, 3) // 2 full pages + 1 empty page
    // never returns more than RATE_LIMIT versions
    assert.strictEqual(ids.length, 200)
    for (let i = 0; i < ids.length; i++) {
      assert.strictEqual(ids[i], versions[i].id)
    }
  })

  it('finalIDs test - success - sorting accross pages', async () => {
    const numVersions = RATE_LIMIT * 2
    let apiCalled = 0

    // versions is in ascending order of created_at
    const versions = getMockedVersionsResponse(numVersions)

    // return newer versions on first page to test sorting
    const firstPage = versions.slice(RATE_LIMIT).reverse()
    const secondPage = versions.slice(0, RATE_LIMIT).reverse()

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async ({request}) => {
          apiCalled++
          const url = new URL(request.url)
          const page = url.searchParams.get('page')
          if (page === '1') {
            return new HttpResponse(JSON.stringify(firstPage), {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            })
          } else if (page === '2') {
            return new HttpResponse(JSON.stringify(secondPage), {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            })
          } else {
            return new HttpResponse(JSON.stringify([]), {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            })
          }
        }
      )
    )

    const ids = await finalIds(getInput())
    assert.strictEqual(apiCalled, 3) // 2 full pages + 1 empty page
    assert.strictEqual(ids.length, versions.length)
    for (let i = 0; i < ids.length; i++) {
      assert.strictEqual(ids[i], versions[i].id)
    }
  })

  it('finalIds test - do not delete more than numOldVersionsToDelete', async () => {
    const numVersions = 50
    let apiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async () => {
          apiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    const numOldVersionsToDelete = 10

    const ids = await finalIds(getInput({numOldVersionsToDelete}))
    assert.strictEqual(apiCalled, 1)
    assert.strictEqual(ids.length, numOldVersionsToDelete)
    for (let i = 0; i < numOldVersionsToDelete; i++) {
      assert.strictEqual(ids[i], versions[i].id)
    }
  })

  it('finalIds test - keep minVersionsToKeep', async () => {
    const numVersions = 50
    let apiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async () => {
          apiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    const minVersionsToKeep = 10

    const ids = await finalIds(getInput({minVersionsToKeep}))
    assert.strictEqual(apiCalled, 1)
    assert.strictEqual(ids.length, numVersions - minVersionsToKeep)
    for (let i = 0; i < numVersions - minVersionsToKeep; i++) {
      assert.strictEqual(ids[i], versions[i].id)
    }
  })

  it('finalIds test - delete only prerelease versions with minVersionsToKeep', async () => {
    const numVersions = 50
    let apiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)
    // make half versions prerelease
    for (let i = 0; i < numVersions; i++) {
      if (i % 2 === 0) {
        versions[i].name += '-alpha'
      }
    }

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async () => {
          apiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    const toDelete = numVersions / 2 - 10

    const ids = await finalIds(
      getInput({
        ignoreVersions: RegExp('^(0|[1-9]\\d*)((\\.(0|[1-9]\\d*))*)$'),
        minVersionsToKeep: 10
      })
    )
    assert.strictEqual(apiCalled, 1)
    assert.strictEqual(ids.length, toDelete)
    for (let i = 0; i < toDelete; i++) {
      assert.strictEqual(ids[i], versions[i * 2].id)
    }
  })

  it('finalIds test - delete only not ignoreVersions with minVersionsToKeep', async () => {
    const numVersions = 50
    let apiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)
    // make half versions 999
    for (let i = 0; i < numVersions; i++) {
      versions[i].name = `999.${i}.${i * 2}`
    }
    versions[1].name = `1.2.3`

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async () => {
          apiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    const toDelete = numVersions - 6 // 5 keep and one untouchable

    const ids = await finalIds(
      getInput({
        ignoreVersions: RegExp('^(?:(?!999)\\d+)\\.\\d+\\.\\d+$'),
        minVersionsToKeep: 5
      })
    )
    assert.strictEqual(apiCalled, 1)
    assert.strictEqual(ids.length, toDelete)
    for (let i = 0; i < toDelete; i++) {
      assert.strictEqual(ids[i], i > 0 ? versions[i + 1].id : versions[i].id)
    }
  })

  it('finalIds test - delete only includeVersions with minVersionsToKeep', async () => {
    const numVersions = 50
    let apiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)
    // make half versions 999
    for (let i = 0; i < numVersions; i++) {
      versions[i].name = `999.${i}.${i * 2}`
    }
    versions[1].name = `1.2.3`

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async () => {
          apiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    const toDelete = numVersions - 6 // 5 keep and one untouchable

    const ids = await finalIds(
      getInput({
        includeVersions: RegExp('^999\\.'),
        minVersionsToKeep: 5
      })
    )
    assert.strictEqual(apiCalled, 1)
    assert.strictEqual(ids.length, toDelete)
    for (let i = 0; i < toDelete; i++) {
      assert.strictEqual(ids[i], i > 0 ? versions[i + 1].id : versions[i].id)
    }
  })

  it('finalIds test - delete only untagged versions with minVersionsToKeep', async () => {
    const numVersions = 50
    const numTaggedVersions = 20
    const numUntaggedVersions = numVersions - numTaggedVersions

    const taggedVersions = getMockedVersionsResponse(
      numTaggedVersions,
      0,
      'container',
      true
    )
    const untaggedVersions = getMockedVersionsResponse(
      numUntaggedVersions,
      numTaggedVersions,
      'container',
      false
    )
    const versions = taggedVersions.concat(untaggedVersions)

    let apiCalled = 0

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/container/test-package/versions',
        async () => {
          apiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    const ids = await finalIds(
      getInput({
        minVersionsToKeep: 10,
        deleteUntaggedVersions: true,
        packageType: 'container'
      })
    )
    assert.strictEqual(apiCalled, 1)
    assert.strictEqual(ids.length, numUntaggedVersions - 10)
    for (let i = 0; i < numUntaggedVersions - 10; i++) {
      assert.strictEqual(ids[i], untaggedVersions[i].id)
    }
  })

  it('finalIds test - no versions deleted if API error even once', async () => {
    const numVersions = RATE_LIMIT * 2
    let apiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)

    const firstPage = versions.slice(0, RATE_LIMIT)
    const secondPage = versions.slice(RATE_LIMIT)

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async ({request}) => {
          apiCalled++
          const url = new URL(request.url)
          const page = url.searchParams.get('page')
          if (page === '1') {
            return new HttpResponse(JSON.stringify(firstPage), {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            })
          } else if (page === '2') {
            return new HttpResponse(JSON.stringify(secondPage), {
              status: 500,
              headers: {
                'Content-Type': 'application/json'
              }
            })
          } else {
            return new HttpResponse(JSON.stringify([]), {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            })
          }
        }
      )
    )

    try {
      await finalIds(getInput())
      throw new Error('should not complete')
    } catch (err) {
      assert.strictEqual(apiCalled, 2) // 1 full page + 1 error page
      assert.ok(err)
      assert.ok((err as Error).message.includes('get versions API failed.'))
    }
  })

  it('deleteVersions test - missing token', async () => {
    try {
      await deleteVersions(getInput({token: ''}))
      assert.fail('no error thrown')
    } catch (err) {
      assert.ok(err)
    }
  })

  it('deleteVersions test - missing packageName', async () => {
    try {
      await deleteVersions(getInput({packageName: ''}))
      throw new Error('no error thrown')
    } catch (err) {
      assert.ok(err)
    }
  })

  it('deleteVersions test - missing packageType', async () => {
    try {
      await deleteVersions(getInput({packageType: ''}))
      throw new Error('no error thrown')
    } catch (err) {
      assert.ok(err)
    }
  })

  it('deleteVersions test - zero numOldVersionsToDelete', async () => {
    const result = await deleteVersions(getInput({numOldVersionsToDelete: 0}))
    assert.strictEqual(result, true)
  })

  it('deleteVersions test - success complete flow', async () => {
    const numVersions = 10
    let getApiCalled = 0
    let deleteApiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)
    const versionsDeleted: string[] = []

    server.use(
      http.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        async () => {
          getApiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    server.use(
      http.delete(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions/:versionId',
        async ({params}) => {
          deleteApiCalled++
          versionsDeleted.push(params.versionId as string)
          return new HttpResponse(null, {
            status: 204
          })
        }
      )
    )

    const result = await deleteVersions(getInput())
    assert.strictEqual(result, true)

    assert.strictEqual(getApiCalled, 1)
    assert.strictEqual(deleteApiCalled, numVersions)
    for (let i = 0; i < numVersions; i++) {
      assert.strictEqual(versionsDeleted[i], versions[i].id.toString())
    }
  })

  it('deleteVersions test - success complete flow - GHES', async () => {
    process.env.GITHUB_API_URL = 'https://github.someghesinstance.com/api/v3'

    const numVersions = 10
    let getApiCalled = 0
    let deleteApiCalled = 0

    const versions = getMockedVersionsResponse(numVersions)
    const versionsDeleted: string[] = []

    server.use(
      http.get(
        'https://github.someghesinstance.com/api/v3/users/test-owner/packages/npm/test-package/versions',
        async () => {
          getApiCalled++
          return new HttpResponse(JSON.stringify(versions), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      )
    )

    server.use(
      http.delete(
        'https://github.someghesinstance.com/api/v3/users/test-owner/packages/npm/test-package/versions/:versionId',
        async ({params}) => {
          deleteApiCalled++
          versionsDeleted.push(params.versionId as string)
          return new HttpResponse(null, {
            status: 204
          })
        }
      )
    )

    const result = await deleteVersions(getInput())
    assert.strictEqual(result, true)

    assert.strictEqual(getApiCalled, 1)
    assert.strictEqual(deleteApiCalled, numVersions)
    for (let i = 0; i < numVersions; i++) {
      assert.strictEqual(versionsDeleted[i], versions[i].id.toString())
    }

    delete process.env.GITHUB_API_URL
  })
})

const defaultInput: InputParams = {
  packageVersionIds: [],
  owner: 'test-owner',
  packageName: 'test-package',
  packageType: 'npm',
  numOldVersionsToDelete: -1,
  minVersionsToKeep: -1,
  ignoreVersions: RegExp('^$'),
  token: 'test-token'
}

function getInput(params?: InputParams): Input {
  return new Input({...defaultInput, ...params})
}
