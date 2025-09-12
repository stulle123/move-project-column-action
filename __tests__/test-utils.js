/**
 * Shared test utilities and mock factories
 */
import { jest } from '@jest/globals'

export const createMockCore = () => ({
  getInput: jest.fn(),
  info: jest.fn(),
  setFailed: jest.fn(),
  warning: jest.fn()
})

export const createMockGithubContext = (overrides = {}) => ({
  repo: {
    owner: 'default-owner',
    repo: 'default-repo'
  },
  payload: {
    issue: {
      number: 123
    }
  },
  eventName: 'issues',
  ...overrides
})

export const createMockGithub = (contextOverrides = {}) => ({
  context: createMockGithubContext(contextOverrides)
})

export const createMockOctokit = () => ({
  graphql: jest.fn()
})

export const createDefaultInputs = (overrides = {}) => {
  const defaults = {
    'issue-number': '123',
    'project-number': '1',
    'column-name': 'In Progress',
    'github-token': 'fake-token',
    'repo-owner': 'test-owner',
    'repo-name': 'test-repo'
  }
  return { ...defaults, ...overrides }
}
