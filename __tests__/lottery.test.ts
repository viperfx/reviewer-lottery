import {Octokit} from '@octokit/rest'
import nock from 'nock'
import {runLottery, Pull} from '../src/lottery'

const octokit = new Octokit()
const prNumber = 123
const issueNumber = 456
const ref = 'refs/pull/branch-name'
const basePull = {number: prNumber, head: {ref}}

const mockGetPull = (pull: Pull) =>
  nock('https://api.github.com')
    .get('/repos/uesteibar/repository/pulls')
    .reply(200, [pull])

test('selects reviewers from a pool of users, ignoring author', async () => {
  const pull = {
    ...basePull,
    user: {login: 'author'},
    draft: false,
    issue_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347'
  }

  const getPullMock = mockGetPull(pull)

  const candidates = ['A', 'B', 'C', 'D', 'author']

  const postReviewersMock = nock('https://api.github.com')
    .post(
      `/repos/uesteibar/repository/pulls/${prNumber}/requested_reviewers`,
      (body): boolean => {
        body.reviewers.forEach((reviewer: string) => {
          expect(candidates).toContain(reviewer)
          expect(reviewer).not.toEqual('author')
        })
        return true
      }
    )
    .reply(200, pull)

  const config = {
    groups: [
      {
        name: 'Test',
        reviewers: 2,
        usernames: candidates
      }
    ]
  }

  await runLottery(octokit, config, {
    repository: 'uesteibar/repository',
    ref
  })

  getPullMock.done()
  postReviewersMock.done()

  nock.cleanAll()
})

test("doesn't assign reviewers if the PR is in draft state", async () => {
  const pull = {
    ...basePull,
    user: {login: 'author'},
    draft: true,
    issue_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347'
  }

  const getPullMock = mockGetPull(pull)

  const config = {
    groups: [
      {
        name: 'Test',
        reviewers: 2,
        usernames: ['A', 'B']
      }
    ]
  }

  await runLottery(octokit, config, {
    repository: 'uesteibar/repository',
    ref
  })

  getPullMock.done()
  nock.cleanAll()
})

test("doesn't send invalid reviewers if there is no elegible reviewers from one group", async () => {
  const pull = {
    ...basePull,
    user: {login: 'author'},
    draft: false,
    issue_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347'
  }

  const getPullMock = mockGetPull(pull)

  const config = {
    groups: [
      {
        name: 'Test',
        reviewers: 1,
        usernames: ['A']
      },
      {
        name: 'Other group',
        reviewers: 1,
        usernames: ['author']
      }
    ]
  }

  const postReviewersMock = nock('https://api.github.com')
    .post(
      `/repos/uesteibar/repository/pulls/${prNumber}/requested_reviewers`,
      (body): boolean => {
        expect(body.reviewers).toEqual(['A'])

        return true
      }
    )
    .reply(200, pull)

  await runLottery(octokit, config, {
    repository: 'uesteibar/repository',
    ref
  })

  postReviewersMock.done()
  getPullMock.done()
  nock.cleanAll()
})

test('selects internal reviewers if configured and author belongs to group', async () => {
  const pull = {
    ...basePull,
    user: {login: 'author'},
    draft: false,
    issue_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347'
  }

  const getPullMock = mockGetPull(pull)

  const candidates = ['A', 'B', 'C', 'D', 'author']

  const postReviewersMock = nock('https://api.github.com')
    .post(
      `/repos/uesteibar/repository/pulls/${prNumber}/requested_reviewers`,
      (body): boolean => {
        expect(body.reviewers).toHaveLength(1)

        body.reviewers.forEach((reviewer: string) => {
          expect(candidates).toContain(reviewer)
          expect(reviewer).not.toEqual('author')
        })
        return true
      }
    )
    .reply(200, pull)

  const config = {
    groups: [
      {
        name: 'Test',
        reviewers: 2,
        internal_reviewers: 1,
        usernames: candidates
      }
    ]
  }

  await runLottery(octokit, config, {
    repository: 'uesteibar/repository',
    ref
  })

  getPullMock.done()
  postReviewersMock.done()

  nock.cleanAll()
})

test("doesn't assign internal reviewers if the author doesn't belong to group", async () => {
  const pull = {
    ...basePull,
    user: {login: 'author'},
    draft: false,
    issue_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347'
  }

  const getPullMock = mockGetPull(pull)

  const candidates = ['A', 'B', 'C', 'D']

  const postReviewersMock = nock('https://api.github.com')
    .post(
      `/repos/uesteibar/repository/pulls/${prNumber}/requested_reviewers`,
      (body): boolean => {
        expect(body.reviewers).toHaveLength(2)

        body.reviewers.forEach((reviewer: string) => {
          expect(candidates).toContain(reviewer)
          expect(reviewer).not.toEqual('author')
        })
        return true
      }
    )
    .reply(200, pull)

  const config = {
    groups: [
      {
        name: 'Test',
        reviewers: 2,
        internal_reviewers: 1,
        usernames: candidates
      }
    ]
  }

  await runLottery(octokit, config, {
    repository: 'uesteibar/repository',
    ref
  })

  getPullMock.done()
  postReviewersMock.done()

  nock.cleanAll()
})

test("doesn't assign reviewers if the author doesn't belong to group", async () => {
  const pull = {
    ...basePull,
    user: {login: 'author'},
    draft: false,
    issue_url: 'https://api.github.com/repos/octocat/Hello-World/issues/1347'
  }

  const getPullMock = mockGetPull(pull)

  const candidates = ['A', 'B', 'C', 'D']

  const config = {
    groups: [
      {
        name: 'Test',
        internal_reviewers: 1,
        usernames: candidates
      }
    ]
  }

  await runLottery(octokit, config, {
    repository: 'uesteibar/repository',
    ref
  })

  getPullMock.done()

  nock.cleanAll()
})

test('selects assigner from a pool of users, ignoring author', async () => {
  const pull = {
    ...basePull,
    user: {login: 'author'},
    draft: false,
    issue_url: 'https://api.github.com/repos/octocat/Hello-World/issues/456'
  }

  const getPullMock = mockGetPull(pull)

  const candidates = ['A', 'B', 'C', 'D', 'author']

  const postAssigneesMock = nock('https://api.github.com')
    .post(
      `/repos/uesteibar/repository/issues/${issueNumber}/assignees`,
      (body): boolean => {
        body.assignees.forEach((reviewer: string) => {
          expect(candidates).toContain(reviewer)
          expect(reviewer).not.toEqual('author')
        })
        return true
      }
    )
    .reply(200, pull)

  const config = {
    groups: [
      {
        name: 'Test',
        reviewers: 2,
        assignee: 'yes',
        usernames: candidates
      }
    ]
  }

  await runLottery(octokit, config, {
    repository: 'uesteibar/repository',
    ref
  })

  getPullMock.done()
  postAssigneesMock.done()

  nock.cleanAll()
})
