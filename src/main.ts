import {getInput, setFailed} from '@actions/core'
import {context} from '@actions/github'
import {Input} from './input'
import {deleteVersions, sleep} from './delete'

function getActionInput(packageName: string): Input {
  const includeVersions = getInput('include-versions')
  const ignoreVersions = getInput('ignore-versions')

  return new Input({
    packageVersionIds: getInput('package-version-ids')
      ? getInput('package-version-ids')
          .split(',')
          .map(f => parseInt(f, 10))
      : [],
    owner: getInput('owner') ? getInput('owner') : context.repo.owner,
    packageName,
    packageType: getInput('package-type'),
    numOldVersionsToDelete: parseInt(
      getInput('num-old-versions-to-delete'),
      10
    ),
    minVersionsToKeep: parseInt(getInput('min-versions-to-keep'), 10),
    ignoreVersions: ignoreVersions
      ? new RegExp(getInput('ignore-versions'))
      : null,
    includeVersions: includeVersions ? new RegExp(includeVersions) : null,
    deletePreReleaseVersions: toBoolean(
      getInput('delete-only-pre-release-versions')
    ),
    token: getInput('token'),
    deleteUntaggedVersions: toBoolean(
      getInput('delete-only-untagged-versions')
    ),
    verbose: toBoolean(getInput('verbose')),
    simulate: toBoolean(getInput('simulate'))
  })
}

function toBoolean(str?: string): boolean {
  str = str?.trim().toLowerCase()
  return str === 'true' || str === '1'
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
      const sleepIntervalStr = getInput('sleep-interval')
      const sleepInterval = sleepIntervalStr
        ? parseInt(sleepIntervalStr, 10)
        : process.env.GH_DELETE_PACKAGE_VERSIONS_SLEEP
          ? parseInt(process.env.GH_DELETE_PACKAGE_VERSIONS_SLEEP, 10)
          : 15000

      for (let i = 0; i < packageNames.length; i++) {
        await deleteVersions(getActionInput(packageNames[i]))
        // Anti flood
        await sleep(sleepInterval)
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
