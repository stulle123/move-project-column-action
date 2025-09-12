/**
 * Unit tests for the action's main functionality, src/main.js
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals'
import {
  createMockCore,
  createMockGithub,
  createDefaultInputs
} from './test-utils.js'

// Mock the moveIssue function from the projects utility
const mockMoveIssue = jest.fn()
jest.unstable_mockModule('../src/utils/projects.js', () => ({
  moveIssue: mockMoveIssue
}))

// Create mock objects for external dependencies using utilities
const mockCore = createMockCore()
const mockGithub = createMockGithub()

// Mock the external modules BEFORE importing main
jest.unstable_mockModule('@actions/core', () => mockCore)
jest.unstable_mockModule('@actions/github', () => mockGithub)

// Import the module under test after mocking dependencies
const main = await import('../src/main')

/**
 * Test suite for the main action functionality
 */
describe('GitHub Action - Move Issue to Project Column', () => {
  /**
   * Helper function to create default input values for tests
   */
  const createDefaultInputsLocal = createDefaultInputs

  /**
   * Helper function to setup mock input implementation
   */
  const setupMockInputs = (inputs) => {
    mockCore.getInput.mockImplementation((name) => {
      return inputs[name] || ''
    })
  }

  /**
   * Helper function to reset GitHub context to default state
   */
  const resetGitHubContext = (contextOverrides = {}) => {
    mockGithub.context = {
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
      ...contextOverrides
    }
  }

  beforeEach(() => {
    // Clear all mock calls and implementations
    jest.clearAllMocks()

    // Setup default mock implementations
    setupMockInputs(createDefaultInputsLocal())

    // Always reset GitHub context to default state
    resetGitHubContext()
  })

  afterEach(() => {
    // Reset all mocks to their initial state
    jest.resetAllMocks()
  })

  describe('Successful execution', () => {
    it('should successfully move an issue to a project column with all inputs provided', async () => {
      // Execute the action
      await main.run()

      // Verify all required inputs are retrieved
      expect(mockCore.getInput).toHaveBeenCalledWith('issue-number', {
        required: true
      })
      expect(mockCore.getInput).toHaveBeenCalledWith('project-number', {
        required: true
      })
      expect(mockCore.getInput).toHaveBeenCalledWith('column-name', {
        required: true
      })
      expect(mockCore.getInput).toHaveBeenCalledWith('github-token', {
        required: true
      })
      expect(mockCore.getInput).toHaveBeenCalledWith('repo-owner')
      expect(mockCore.getInput).toHaveBeenCalledWith('repo-name')

      // Verify info logging
      expect(mockCore.info).toHaveBeenCalledWith(
        'Moving issue #123 for owner test-owner in repository test-repo to project 1 column "In Progress"...'
      )

      // Verify moveIssue is called with correct parameters
      expect(mockMoveIssue).toHaveBeenCalledWith(
        123,
        1,
        'In Progress',
        'test-repo',
        'test-owner'
      )

      // Verify no failure occurred
      expect(mockCore.setFailed).not.toHaveBeenCalled()
    })

    it('should use default repo owner and name from GitHub context when not provided in inputs', async () => {
      // Setup inputs without repo-owner and repo-name
      const inputs = createDefaultInputsLocal({
        'issue-number': '456',
        'project-number': '2',
        'column-name': 'Done',
        'repo-owner': '',
        'repo-name': ''
      })
      setupMockInputs(inputs)

      // Execute the action
      await main.run()

      // Verify moveIssue uses GitHub context defaults
      expect(mockMoveIssue).toHaveBeenCalledWith(
        456,
        2,
        'Done',
        'default-repo',
        'default-owner'
      )
    })

    it('should warn when issue number input differs from event issue number', async () => {
      // Setup inputs with different issue number than context
      const inputs = createDefaultInputsLocal({
        'issue-number': '789'
      })
      setupMockInputs(inputs)

      // Set GitHub context with different issue number and ensure it's an issue event
      resetGitHubContext({
        eventName: 'issues',
        payload: {
          issue: {
            number: 123
          }
        }
      })

      // Execute the action
      await main.run()

      // Verify warning is logged
      expect(mockCore.warning).toHaveBeenCalledWith(
        'Issue number input (789) differs from event issue number (123). Using input value.'
      )

      // Verify moveIssue uses the input value, not the context value
      expect(mockMoveIssue).toHaveBeenCalledWith(
        789,
        1,
        'In Progress',
        'test-repo',
        'test-owner'
      )
    })

    it('should work with workflow_dispatch event', async () => {
      // Setup GitHub context for workflow_dispatch (no issue in payload)
      resetGitHubContext({
        eventName: 'workflow_dispatch',
        payload: {}
      })

      // Execute the action
      await main.run()

      // Verify moveIssue is called with input values
      expect(mockMoveIssue).toHaveBeenCalledWith(
        123,
        1,
        'In Progress',
        'test-repo',
        'test-owner'
      )

      // Verify no error or warning occurred
      expect(mockCore.setFailed).not.toHaveBeenCalled()
      expect(mockCore.warning).not.toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should fail when GitHub token is missing or empty', async () => {
      // Setup inputs with empty GitHub token
      const inputs = createDefaultInputsLocal({ 'github-token': '' })
      setupMockInputs(inputs)

      // Execute the action
      await main.run()

      // Verify error handling
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'GitHub token is required'
      )
      expect(mockMoveIssue).not.toHaveBeenCalled()
    })

    it('should fail when moveIssue function throws an error', async () => {
      const errorMessage = 'Failed to move issue to project column'

      // Setup moveIssue to reject
      mockMoveIssue.mockRejectedValueOnce(new Error(errorMessage))

      // Execute the action
      await main.run()

      // Verify error handling
      expect(mockCore.setFailed).toHaveBeenCalledWith(errorMessage)
    })

    it('should fail when input validation throws an error', async () => {
      // Setup getInput to throw an error
      mockCore.getInput.mockImplementation(() => {
        throw new Error('Required input is missing')
      })

      // Execute the action
      await main.run()

      // Verify error handling
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'Required input is missing'
      )
    })
  })
})
