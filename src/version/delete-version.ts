import {Octokit} from '@octokit/rest'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/parameters-and-response-types'
import {RATE_LIMIT, SLEEP_TIMEOUT, sleep} from '../delete'

type PackageType =
  RestEndpointMethodTypes['packages']['getAllPackageVersionsForPackageOwnedByUser']['parameters']['package_type']

export async function deletePackageVersion(
  packageVersionId: number,
  owner: string,
  packageName: string,
  packageType: string,
  token: string
): Promise<boolean> {
  const octokit = new Octokit({
    auth: token,
    baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com'
  })
  const package_type: PackageType = packageType as PackageType

  const deleteResp = await octokit.rest.packages.deletePackageVersionForUser({
    package_type,
    package_name: packageName,
    username: owner,
    package_version_id: packageVersionId
  })
  return deleteResp.status === 204
}

export async function deletePackageVersions(
  packageVersionIds: number[],
  owner: string,
  packageName: string,
  packageType: string,
  token: string
): Promise<boolean> {
  if (packageVersionIds.length === 0) {
    return true
  }

  let delCursor = 0
  try {
    for (delCursor = 0; delCursor < packageVersionIds.length; delCursor++) {
      if (
        !(await deletePackageVersion(
          packageVersionIds[delCursor],
          owner,
          packageName,
          packageType,
          token
        ))
      ) {
        console.log(
          `version with id: ${packageVersionIds[delCursor]}, not deleted`
        )
      }
      if (delCursor % RATE_LIMIT === 0) {
        await sleep(SLEEP_TIMEOUT)
      }
    }
  } catch (err: any) {
    const msg = 'delete version API failed.'
    throw new Error(
      err.errors && err.errors.length > 0
        ? `${msg} ${err.errors[0].message}`
        : `${msg} ${err.message} \n${delCursor + 1} versions deleted till now.`
    )
  }

  console.log(`Total versions deleted till now: ${delCursor + 1}`)
  return true
}
