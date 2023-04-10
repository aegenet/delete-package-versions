import {Input} from './input'
import {
  deletePackageVersions,
  getOldestVersions,
  RestQueryInfo,
  RestVersionInfo
} from './version'

import {promisify} from 'node:util'
export const sleep = promisify(setTimeout)

/** Don't flood github api */
export const SLEEP_TIMEOUT = 2500

export const RATE_LIMIT = 100

export async function getVersionIds(
  owner: string,
  packageName: string,
  packageType: string,
  pageSize: number,
  page: number,
  token: string
): Promise<RestVersionInfo[]> {
  const versions: RestVersionInfo[] = []
  let oldestVersions: RestQueryInfo

  do {
    oldestVersions = await getOldestVersions(
      owner,
      packageName,
      packageType,
      pageSize,
      page,
      token
    )
    versions.push(...oldestVersions.versions)
    page++

    if (!oldestVersions.isOver) {
      // Don't flood the Github api...
      await sleep(SLEEP_TIMEOUT)
    }
  } while (!oldestVersions.isOver)

  return versions
}

export async function finalIds(input: Input): Promise<number[]> {
  if (input.packageVersionIds.length > 0) {
    return input.packageVersionIds
  }

  if (input.hasOldestVersionQueryInfo()) {
    let versionsIds = await getVersionIds(
      input.owner,
      input.packageName,
      input.packageType,
      RATE_LIMIT,
      1,
      input.token
    )

    if (input.verbose) {
      console.log(
        `${versionsIds.length} versions ids: ${versionsIds
          .map(f => `[${f.id}] ${f.version}`)
          .join(', ')}`
      )
    }

    /* 
      Only included versions
    */
    if (input.includeVersions) {
      versionsIds = versionsIds.filter(info =>
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        input.includeVersions!.test(info.version)
      )

      if (input.verbose) {
        console.log(
          `${versionsIds.length} versions ids after includeVersions (${
            input.includeVersions
          }): ${versionsIds.map(f => `[${f.id}] ${f.version}`).join(', ')}`
        )
      }
    }

    /* 
      Here first filter out the versions that are to be ignored.
      Then compute number of versions to delete (toDelete) based on the inputs.
    */
    if (input.ignoreVersions) {
      versionsIds = versionsIds.filter(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        info => !input.ignoreVersions!.test(info.version)
      )

      if (input.verbose) {
        console.log(
          `${versionsIds.length} versions ids after ignoreVersions (${
            input.ignoreVersions
          }): ${versionsIds.map(f => `[${f.id}] ${f.version}`).join(', ')}`
        )
      }
    }

    // We need to delete oldest versions
    versionsIds.sort((a, b) => {
      if (a.created_at === b.created_at) {
        return a.id - b.id
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    if (input.deleteUntaggedVersions) {
      versionsIds = versionsIds.filter(info => !info.tagged)
    }

    let toDelete = versionsIds.length
    if (input.minVersionsToKeep < 0) {
      if (input.numOldVersionsToDelete !== -1) {
        toDelete = Math.min(versionsIds.length, input.numOldVersionsToDelete)
      }
    } else {
      toDelete = versionsIds.length - input.minVersionsToKeep
    }

    if (toDelete <= 0) {
      return []
    }

    versionsIds = versionsIds.slice(0, toDelete)

    if (input.verbose) {
      console.log(
        `${versionsIds.length} versions ids to be deleted: ${versionsIds
          .map(f => `[${f.id}] ${f.version}`)
          .join(', ')}`
      )
    }

    return versionsIds.map(info => info.id)
  }

  throw new Error(
    "Could not get packageVersionIds. Explicitly specify using the 'package-version-ids' input"
  )
}

export async function deleteVersions(input: Input): Promise<boolean> {
  console.log(`Deleting versions for package ${input.packageName}...`)

  if (!input.token) {
    throw new Error('No token found')
  }

  if (!input.checkInput()) {
    throw new Error('Invalid input combination')
  }

  if (input.numOldVersionsToDelete === 0 && input.minVersionsToKeep < 0) {
    console.log(
      'Number of old versions to delete input is 0 or less, no versions will be deleted'
    )
    return true
  }

  const deletedIds = await finalIds(input)

  if (input.verbose) {
    console.log(`IDs to be deleted: ${deletedIds.join(', ')}`)
  }

  if (!input.simulate) {
    return await deletePackageVersions(
      deletedIds,
      input.owner,
      input.packageName,
      input.packageType,
      input.token
    )
  } else {
    return true
  }
}
