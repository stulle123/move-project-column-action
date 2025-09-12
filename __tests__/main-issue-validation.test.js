/**
 * Test for the issue validation in main.js
 */
import { describe, expect, it, jest } from '@jest/globals'
import {
  createMockCore,
  createMockGithub,
  createDefaultInputs
} from './test-utils.js'

// Create mock objects for external dependencies using utilities
const mockCore = createMockCore()
const mockGithub = createMockGithub({ payload: {} }) // No issue in payload

// Mock the moveIssue function from the projects utility
const mockMoveIssue = jest.fn()
jest.unstable_mockModule('../src/utils/projects.js', () => ({
  moveIssue: mockMoveIssue
}))

// Mock the external modules BEFORE importing main
jest.unstable_mockModule('@actions/core', () => mockCore)
jest.unstable_mockModule('@actions/github', () => mockGithub)

// Import the module under test after mocking dependencies
const main = await import('../src/main')

describe('Main - Issue Validation', () => {
  it('should fail when the action is not run on an issue or workflow_dispatch', async () => {
    // Setup default inputs using utility
    mockCore.getInput.mockImplementation((name) => {
      const inputs = createDefaultInputs({
        'github-token': 'fake-token',
        'repo-owner': 'test-owner',
        'repo-name': 'test-repo'
      })
      return inputs[name] || ''
    })

    // Set event name to something other than workflow_dispatch
    mockGithub.context.eventName = 'push'

    // Execute the action
    await main.run()

    // Verify error handling
    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'This action can only be run on issues or via workflow_dispatch.'
    )
    expect(mockMoveIssue).not.toHaveBeenCalled()
  })

  it('should succeed when run via workflow_dispatch even without issue in payload', async () => {
    // Setup default inputs using utility
    mockCore.getInput.mockImplementation((name) => {
      const inputs = createDefaultInputs({
        'github-token': 'fake-token',
        'repo-owner': 'test-owner',
        'repo-name': 'test-repo'
      })
      return inputs[name] || ''
    })

    // Set event name to workflow_dispatch
    mockGithub.context.eventName = 'workflow_dispatch'

    // Execute the action
    await main.run()

    // Verify moveIssue was called (no error should occur)
    expect(mockMoveIssue).toHaveBeenCalledWith(
      123,
      1,
      'In Progress',
      'test-repo',
      'test-owner'
    )
    expect(mockCore.setFailed).not.toHaveBeenCalled()
  })
})
