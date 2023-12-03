import * as core from '@actions/core'
import { diff as semVerDiff, parse, satisfies as semVerSatisfies, SemVer } from 'semver'
import axios, { isAxiosError } from 'axios'

function parts(version: SemVer): void {
  core.setOutput('release', `${version.major}.${version.minor}.${version.patch}`)
  core.setOutput('major', version.major)
  core.setOutput('minor', version.minor)
  core.setOutput('patch', version.patch)
}

function increments(versionInput: string): void {
  const identifierInput = core.getInput('identifier')
  let identifier = undefined

  if (identifierInput.trim() !== '') {
    identifier = identifierInput
  }

  core.setOutput('inc-major', parse(versionInput)?.inc('major', identifier).format())
  core.setOutput('inc-premajor', parse(versionInput)?.inc('premajor', identifier).format())
  core.setOutput('inc-minor', parse(versionInput)?.inc('minor', identifier).format())
  core.setOutput('inc-preminor', parse(versionInput)?.inc('preminor', identifier).format())
  core.setOutput('inc-patch', parse(versionInput)?.inc('patch', identifier).format())
  core.setOutput('inc-prepatch', parse(versionInput)?.inc('prepatch', identifier).format())
  core.setOutput('inc-prerelease', parse(versionInput)?.inc('prerelease', identifier).format())
}

function build(version: SemVer): void {
  if (version.build.length > 0) {
    core.setOutput('build', version.build.join('.'))
    core.setOutput('build-parts', version.build.length)

    version.build.forEach((buildPart, index) => {
      core.setOutput(`build-${index}`, buildPart)
    })
  }
}

function prerelease(version: SemVer): void {
  if (version.prerelease.length > 0) {
    core.setOutput('prerelease', version.prerelease.join('.'))
    core.setOutput('prerelease-parts', version.prerelease.length)

    version.prerelease.forEach((prereleasePart, index) => {
      core.setOutput(`prerelease-${index}`, prereleasePart)
    })
  }
}

function compare(version: SemVer): void {
  const compareToInput: string = core.getInput('compare-to')
  const compareTo = parse(compareToInput)

  if (compareTo != null) {
    switch (version.compare(compareTo)) {
      case -1:
        core.setOutput('comparison-result', '<')
        break
      case 0:
        core.setOutput('comparison-result', '=')
        break
      case 1:
        core.setOutput('comparison-result', '>')
        break
    }
  }
}

function diff(version: SemVer): void {
  const diffWithInput: string = core.getInput('diff-with')
  const compareToInput: string = core.getInput('compare-to')
  let diffTo: SemVer | null = null

  if (diffWithInput) {
    diffTo = parse(diffWithInput)
  } else if (compareToInput) {
    diffTo = parse(compareToInput)
  }

  if (diffTo) {
    core.setOutput('diff-result', semVerDiff(version, diffTo))
  }
}

function satisfies(version: SemVer): void {
  const satisfiesRangeInput: string = core.getInput('satisfies')

  if (satisfiesRangeInput) {
    core.setOutput('satisfies', semVerSatisfies(version, satisfiesRangeInput))
  }
}

async function validateSubscription(): Promise<void> {
  const API_URL = `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/subscription`

  try {
    await axios.get(API_URL, { timeout: 3000 })
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      core.error('Subscription is not valid. Reach out to support@stepsecurity.io')
      process.exit(1)
    } else {
      core.info('Timeout or API not reachable. Continuing to next step.')
    }
  }
}

async function run(): Promise<void> {
  await validateSubscription()
  try {
    const lenient = core.getInput('lenient').toLowerCase() !== 'false'
    const versionInput = core.getInput('version', { required: true })
    const version = parse(versionInput)

    if (version === null) {
      if (!lenient) {
        core.setFailed(`Invalid version: ${versionInput}`)
      }
      return
    }

    parts(version)
    increments(versionInput)
    build(version)
    prerelease(version)
    compare(version)
    diff(version)
    satisfies(version)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}

run()
