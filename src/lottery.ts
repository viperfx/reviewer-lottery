import * as core from '@actions/core'
import {Octokit} from '@octokit/rest'
import {Config} from './config'

export interface Pull {
  user: {
    login: string
  }
  number: number
  draft: boolean
}

interface SelectReviewer {
  assignee: string
  reviewers: string[]
}

interface Env {
  repository: string
  ref: string
}

class Lottery {
  octokit: Octokit
  config: Config
  env: Env
  pr: Pull | undefined

  constructor({
    octokit,
    config,
    env
  }: {
    octokit: Octokit
    config: Config
    env: Env
  }) {
    this.octokit = octokit
    this.config = config
    this.env = {
      repository: env.repository,
      ref: env.ref
    }
    this.pr = undefined
  }

  async run(): Promise<void> {
    try {
      const ready = await this.isReadyToReview()
      if (ready) {
        const {assignee, reviewers} = await this.selectReviewers()
        reviewers.length > 0 && (await this.setReviewers(reviewers, assignee))
      }
    } catch (error) {
      core.error(error)
      core.setFailed(error)
    }
  }

  async isReadyToReview(): Promise<boolean> {
    try {
      const pr = await this.getPR()
      return !!pr && !pr.draft
    } catch (error) {
      core.error(error)
      core.setFailed(error)
      return false
    }
  }

  async setReviewers(reviewers: string[], assignee: string): Promise<object> {
    const ownerAndRepo = this.getOwnerAndRepo()
    const pr = this.getPRNumber()

    if (assignee === 'yes') {
      return this.octokit.issues.addAssignees({
        ...ownerAndRepo,
        issue_number: pr, // eslint-disable-line @typescript-eslint/camelcase
        assignees: reviewers.filter((r: string | undefined) => !!r)
      })
    }

    return this.octokit.pulls.requestReviewers({
      ...ownerAndRepo,
      pull_number: pr, // eslint-disable-line @typescript-eslint/camelcase
      reviewers: reviewers.filter((r: string | undefined) => !!r)
    })
  }

  async selectReviewers(): Promise<SelectReviewer> {
    let selected: string[] = []
    let assignee: string = 'no'
    const author = await this.getPRAuthor()

    try {
      for (const {
        reviewers,
        internal_reviewers: internalReviewers,
        usernames,
        assignee: assignee_in_grpup
      } of this.config.groups) {
        const reviewersToRequest =
          usernames.includes(author) && internalReviewers
            ? internalReviewers
            : reviewers

        if (reviewersToRequest) {
          selected = selected.concat(
            this.pickRandom(usernames, reviewersToRequest, author)
          )
        }
        assignee = assignee_in_grpup || 'no'
      }
    } catch (error) {
      core.error(error)
      core.setFailed(error)
    }

    return {
      reviewers: selected,
      assignee: assignee
    }
  }

  pickRandom(items: string[], n: number, ignore: string): string[] {
    const picks: string[] = []

    const candidates = items.filter(item => item !== ignore)

    while (picks.length < n) {
      const random = Math.floor(Math.random() * candidates.length)
      const pick = candidates.splice(random, 1)[0]

      if (!picks.includes(pick)) picks.push(pick)
    }

    return picks
  }

  async getPRAuthor(): Promise<string> {
    try {
      const pr = await this.getPR()

      return pr ? pr.user.login : ''
    } catch (error) {
      core.error(error)
      core.setFailed(error)
    }

    return ''
  }

  getOwnerAndRepo(): {owner: string; repo: string} {
    const [owner, repo] = this.env.repository.split('/')

    return {owner, repo}
  }

  getPRNumber(): number {
    return Number(this.pr?.number)
  }

  async getPR(): Promise<Pull | undefined> {
    if (this.pr) return this.pr

    try {
      const {data} = await this.octokit.pulls.list({
        ...this.getOwnerAndRepo()
      })

      this.pr = data.find(({head: {ref}}) => ref === this.env.ref)

      if (!this.pr) {
        throw new Error(`PR matching ref not found: ${this.env.ref}`)
      }

      return this.pr
    } catch (error) {
      core.error(error)
      core.setFailed(error)

      return undefined
    }
  }
}

export const runLottery = async (
  octokit: Octokit,
  config: Config,
  env = {
    repository: process.env.GITHUB_REPOSITORY || '',
    ref: process.env.GITHUB_HEAD_REF || ''
  }
): Promise<void> => {
  const lottery = new Lottery({octokit, config, env})

  await lottery.run()
}
