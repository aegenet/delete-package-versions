export interface InputParams {
  packageVersionIds?: number[]
  owner?: string
  packageName?: string
  packageType?: string
  numOldVersionsToDelete?: number
  minVersionsToKeep?: number
  ignoreVersions?: RegExp | null
  includeVersions?: RegExp | null
  token?: string
  deletePreReleaseVersions?: boolean
  deleteUntaggedVersions?: boolean
  verbose?: boolean
  simulate?: boolean
}

const defaultParams = {
  packageVersionIds: [],
  owner: '',
  packageName: '',
  packageType: '',
  numOldVersionsToDelete: 0,
  minVersionsToKeep: 0,
  ignoreVersions: new RegExp(''),
  includeVersions: null,
  deletePreReleaseVersions: false,
  token: '',
  deleteUntaggedVersions: false,
  verbose: false,
  simulate: false
}

export class Input {
  packageVersionIds: number[]
  owner: string
  packageName: string
  packageType: string
  numOldVersionsToDelete: number
  minVersionsToKeep: number
  ignoreVersions: RegExp | null
  includeVersions: RegExp | null
  deletePreReleaseVersions: boolean
  token: string
  numDeleted: number
  deleteUntaggedVersions: boolean
  verbose: boolean
  simulate: boolean

  constructor(params?: InputParams) {
    const validatedParams: Required<InputParams> = {...defaultParams, ...params}

    this.packageVersionIds = validatedParams.packageVersionIds
    this.owner = validatedParams.owner
    this.packageName = validatedParams.packageName
    this.packageType = validatedParams.packageType
    this.numOldVersionsToDelete = validatedParams.numOldVersionsToDelete
    this.minVersionsToKeep = validatedParams.minVersionsToKeep
    this.ignoreVersions = validatedParams.ignoreVersions
    this.includeVersions = validatedParams.includeVersions
    this.deletePreReleaseVersions = validatedParams.deletePreReleaseVersions
    this.token = validatedParams.token
    this.numDeleted = 0
    this.deleteUntaggedVersions = validatedParams.deleteUntaggedVersions
    this.verbose = validatedParams.verbose
    this.simulate = validatedParams.simulate
  }

  hasOldestVersionQueryInfo(): boolean {
    return !!(
      this.owner &&
      this.packageName &&
      (this.numOldVersionsToDelete === -1 ||
        this.numOldVersionsToDelete >= 0) &&
      this.token
    )
  }

  checkInput(): boolean {
    if (this.packageType.toLowerCase() !== 'container') {
      this.deleteUntaggedVersions = false
    }

    if (
      this.numOldVersionsToDelete > 1 &&
      (this.minVersionsToKeep >= 0 ||
        this.deletePreReleaseVersions ||
        this.deleteUntaggedVersions)
    ) {
      return false
    }

    if (this.packageType === '' || this.packageName === '') {
      return false
    }

    if (this.deletePreReleaseVersions) {
      this.minVersionsToKeep =
        this.minVersionsToKeep > 0 ? this.minVersionsToKeep : 0
      this.ignoreVersions = new RegExp('^(0|[1-9]\\d*)((\\.(0|[1-9]\\d*))*)$')
    }

    if (this.deleteUntaggedVersions) {
      this.minVersionsToKeep =
        this.minVersionsToKeep > 0 ? this.minVersionsToKeep : 0
    }

    if (this.minVersionsToKeep >= 0) {
      this.numOldVersionsToDelete = 0
    }

    return true
  }
}
