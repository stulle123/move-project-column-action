/**
 * Unit tests for the projects utility functions, src/utils/projects.js
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from '@jest/globals'
import { createMockCore, createMockOctokit } from './test-utils.js'

// Create mock objects for external dependencies using utilities
const mockCore = createMockCore()
const mockOctokit = createMockOctokit()

const mockGithub = {
  getOctokit: jest.fn(() => mockOctokit)
}

// Mock the external modules
jest.unstable_mockModule('@actions/core', () => mockCore)
jest.unstable_mockModule('@actions/github', () => mockGithub)

// Import the module under test after mocking dependencies
const { moveIssue } = await import('../src/utils/projects.js')

/**
 * Test suite for the projects utility functions
 */
describe('Projects Utility Functions', () => {
  beforeEach(() => {
    // Clear all mock calls and implementations
    jest.clearAllMocks()

    // Setup default mock implementations
    mockCore.getInput.mockReturnValue('fake-github-token')
    mockGithub.getOctokit.mockReturnValue(mockOctokit)
  })

  afterEach(() => {
    // Reset all mocks to their initial state
    jest.resetAllMocks()
  })

  describe('moveIssue', () => {
    const defaultParams = {
      issueNumber: 123,
      projectNumber: 1,
      column: 'In Progress',
      repoOwner: 'test-owner',
      repoName: 'test-repo'
    }

    const mockGraphQLResponse = {
      repository: {
        issue: {
          projectItems: {
            nodes: [
              {
                id: 'PVTI_lADOANN5s84VhzbMzgBZrSI',
                fieldValueByName: {
                  name: 'Todo',
                  optionId: 'f75ad846'
                }
              }
            ]
          }
        },
        projectV2: {
          id: 'PVT_kwDOANN5s84VhzbM',
          field: {
            id: 'PVTSSF_lADOANN5s84VhzbMzgBZrSM',
            name: 'Status',
            options: [
              { id: 'f75ad846', name: 'Todo' },
              { id: 'f75ad847', name: 'In Progress' },
              { id: 'f75ad848', name: 'Done' }
            ]
          }
        }
      }
    }

    it('should successfully move an issue to a project column', async () => {
      // Setup mocks
      mockOctokit.graphql
        .mockResolvedValueOnce(mockGraphQLResponse) // Query response
        .mockResolvedValueOnce({
          // Mutation response
          updateProjectV2ItemFieldValue: {
            projectV2Item: {
              id: 'PVTI_lADOANN5s84VhzbMzgBZrSI'
            }
          }
        })

      // Execute the function
      await moveIssue(
        defaultParams.issueNumber,
        defaultParams.projectNumber,
        defaultParams.column,
        defaultParams.repoName,
        defaultParams.repoOwner
      )

      // Verify GitHub token retrieval
      expect(mockCore.getInput).toHaveBeenCalledWith('github-token', {
        required: true
      })

      // Verify octokit creation
      expect(mockGithub.getOctokit).toHaveBeenCalledWith('fake-github-token')

      // Verify info logging
      expect(mockCore.info).toHaveBeenCalledWith(
        'Moving to Project Column: In Progress...'
      )
      expect(mockCore.info).toHaveBeenCalledWith('GraphQL Response:')
      expect(mockCore.info).toHaveBeenCalledWith(
        JSON.stringify(mockGraphQLResponse, null, 2)
      )

      // Verify GraphQL query was called with correct parameters
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          'query ($owner: String!, $repo: String!, $project: Int!, $issueNumber: Int!)'
        ),
        {
          owner: defaultParams.repoOwner,
          repo: defaultParams.repoName,
          project: defaultParams.projectNumber,
          issueNumber: defaultParams.issueNumber
        }
      )

      // Verify GraphQL mutation was called with correct parameters
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('mutation'),
        {
          fieldId: 'PVTSSF_lADOANN5s84VhzbMzgBZrSM',
          itemId: 'PVTI_lADOANN5s84VhzbMzgBZrSI',
          projectId: 'PVT_kwDOANN5s84VhzbM',
          value: 'f75ad847' // 'In Progress' option ID
        }
      )
    })

    it('should throw an error when target column is not found', async () => {
      // Setup mock with response that doesn't contain the target column
      const responseWithoutTargetColumn = {
        ...mockGraphQLResponse,
        repository: {
          ...mockGraphQLResponse.repository,
          projectV2: {
            ...mockGraphQLResponse.repository.projectV2,
            field: {
              ...mockGraphQLResponse.repository.projectV2.field,
              options: [
                { id: 'f75ad846', name: 'Todo' },
                { id: 'f75ad848', name: 'Done' }
              ]
            }
          }
        }
      }

      mockOctokit.graphql.mockResolvedValueOnce(responseWithoutTargetColumn)

      // Execute and expect error
      await expect(
        moveIssue(
          defaultParams.issueNumber,
          defaultParams.projectNumber,
          'Non-existent Column',
          defaultParams.repoName,
          defaultParams.repoOwner
        )
      ).rejects.toThrow(
        'Column "Non-existent Column" not found in project. Available columns: Todo, Done'
      )

      // Verify mutation was not called
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(1)
    })

    it('should handle GraphQL query errors', async () => {
      const errorMessage = 'GraphQL query failed'
      mockOctokit.graphql.mockRejectedValueOnce(new Error(errorMessage))

      // Execute and expect error
      await expect(
        moveIssue(
          defaultParams.issueNumber,
          defaultParams.projectNumber,
          defaultParams.column,
          defaultParams.repoName,
          defaultParams.repoOwner
        )
      ).rejects.toThrow(errorMessage)

      // Verify only one GraphQL call was made
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(1)
    })

    it('should handle GraphQL mutation errors', async () => {
      const errorMessage = 'GraphQL mutation failed'

      mockOctokit.graphql
        .mockResolvedValueOnce(mockGraphQLResponse) // Query succeeds
        .mockRejectedValueOnce(new Error(errorMessage)) // Mutation fails

      // Execute and expect error
      await expect(
        moveIssue(
          defaultParams.issueNumber,
          defaultParams.projectNumber,
          defaultParams.column,
          defaultParams.repoName,
          defaultParams.repoOwner
        )
      ).rejects.toThrow(errorMessage)

      // Verify both GraphQL calls were made
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2)
    })

    it('should work with different column names', async () => {
      const modifiedResponse = {
        ...mockGraphQLResponse,
        repository: {
          ...mockGraphQLResponse.repository,
          projectV2: {
            ...mockGraphQLResponse.repository.projectV2,
            field: {
              ...mockGraphQLResponse.repository.projectV2.field,
              options: [
                { id: 'option1', name: 'Backlog' },
                { id: 'option2', name: 'Review' },
                { id: 'option3', name: 'Completed' }
              ]
            }
          }
        }
      }

      mockOctokit.graphql
        .mockResolvedValueOnce(modifiedResponse)
        .mockResolvedValueOnce({
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: 'test-id' }
          }
        })

      await moveIssue(456, 2, 'Review', 'repo', 'owner')

      // Verify the correct option ID was used
      expect(mockOctokit.graphql).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          value: 'option2' // 'Review' option ID
        })
      )
    })

    it('should handle empty project items response', async () => {
      const responseWithNoProjectItems = {
        ...mockGraphQLResponse,
        repository: {
          ...mockGraphQLResponse.repository,
          issue: {
            projectItems: {
              nodes: []
            }
          }
        }
      }

      mockOctokit.graphql.mockResolvedValueOnce(responseWithNoProjectItems)

      // This should throw an error when the issue is not part of the project
      await expect(
        moveIssue(
          defaultParams.issueNumber,
          defaultParams.projectNumber,
          defaultParams.column,
          defaultParams.repoName,
          defaultParams.repoOwner
        )
      ).rejects.toThrow(
        `Issue #${defaultParams.issueNumber} is not part of project #${defaultParams.projectNumber}. Make sure the issue is added to the project first.`
      )

      // Verify only one GraphQL call was made
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(1)
    })
  })
})
