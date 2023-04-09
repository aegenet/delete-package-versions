import {getInput, setFailed} from '@actions/core'
import {context} from '@actions/github'
import {Input} from './input'
import {deleteVersions} from './delete'

function getActionInput(): Input {
  return new Input({
    packageVersionIds: getInput('package-version-ids')
      ? getInput('package-version-ids').split(',')
      : [],
    owner: getInput('owner') ? getInput('owner') : context.repo.owner,
    packageName: getInput('package-name'),
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
    await deleteVersions(getActionInput())
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message)
    }
  }
}

run()
