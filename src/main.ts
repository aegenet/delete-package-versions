import {getInput, setFailed} from '@actions/core'
import {context} from '@actions/github'
import {Input} from './input'
import {deleteVersions, sleep} from './delete'

/** Don't flood github api */
export const PACKAGE_SLEEP_MS = 15000

function getActionInput(packageName: string): Input {
  return new Input({
    packageVersionIds: getInput('package-version-ids')
      ? getInput('package-version-ids').split(',')
      : [],
    owner: getInput('owner') ? getInput('owner') : context.repo.owner,
    packageName,
    packageType: getInput('package-type'),
    numOldVersionsToDelete: Number(getInput('num-old-versions-to-delete')),
    minVersionsToKeep: Number(getInput('min-versions-to-keep')),
    ignoreVersions: RegExp(getInput('ignore-versions')),
    deletePreReleaseVersions: getInput(
      'delete-only-pre-release-versions'
    ).toLowerCase(),
    token: getInput('token'),
    deleteUntaggedVersions: getInput(
      'delete-only-untagged-versions'
    ).toLowerCase()
  })
}

async function run(): Promise<void> {
  try {
    const packageName = getInput('package-name')
    const packageNames = getInput('package-names')
      ? getInput('package-names')
          .split(',')
          .map(f => String(f).trim())
          .filter(f => f)
      : []

    if (packageNames.length) {
      for (let i = 0; i < packageNames.length; i++) {
        await deleteVersions(getActionInput(packageNames[i]))
        // Anti flood
        sleep(PACKAGE_SLEEP_MS)
      }
    } else if (packageName) {
      // Standard
      await deleteVersions(getActionInput(packageName))
    } else {
      throw new Error('package-name or package-names is mandatory')
    }
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message)
    }
  }
}

run()
