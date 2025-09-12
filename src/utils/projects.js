import * as core from '@actions/core'
import * as github from '@actions/github'

/**
 * Moves an issue to a different column in a project board.
 *
 * @param {number} issueNumber The number of the issue to move.
 * @param {number} projectNumber The number of the project to move the issue in.
 * @param {string} column The name of the column to move the issue to.
 * @param {string} repoOwner The owner of the repository (username or organization).
 * @param {string} repoName The name of the repository.
 */
export async function moveIssue(
  issueNumber,
  projectNumber,
  column,
  repoName,
  repoOwner
) {
  core.info(`Moving to Project Column: ${column}...`)

  const octokit = github.getOctokit(
    core.getInput('github-token', { required: true })
  )

  // ProjectsV2 uses the GraphQL API. In this case, we need to get the `Status`
  // field, the allowed options, and other metadata in order to change the value
  // for the specific project item that corresponds to the issue.
  const response = await octokit.graphql(
    `
      query ($owner: String!, $repo: String!, $project: Int!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $issueNumber) {
            projectItems(first: 1) {
              nodes {
                id
                fieldValueByName(name: "Status") {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    optionId
                  }
                }
              }
            }
          }
          projectV2(number: $project) {
            id
            field(name: "Status") {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `,
    {
      owner: repoOwner,
      repo: repoName,
      project: projectNumber,
      issueNumber
    }
  )

  core.info('GraphQL Response:')
  core.info(JSON.stringify(response, null, 2))

  // Check if the issue is part of the project
  if (!response.repository.issue.projectItems.nodes.length) {
    throw new Error(
      `Issue #${issueNumber} is not part of project #${projectNumber}. Make sure the issue is added to the project first.`
    )
  }

  // Find the target column option
  const targetOption = response.repository.projectV2.field.options.find(
    (option) => option.name === column
  )

  if (!targetOption) {
    throw new Error(
      `Column "${column}" not found in project. Available columns: ${response.repository.projectV2.field.options.map((opt) => opt.name).join(', ')}`
    )
  }

  // Update the `Status` field for the issue in the project.
  await octokit.graphql(
    `
      mutation(
        $fieldId: ID!,
        $itemId: ID!,
        $projectId: ID!,
        $value: String!
      ) {
        updateProjectV2ItemFieldValue(input: {
          fieldId: $fieldId,
          itemId: $itemId,
          projectId: $projectId,
          value: { singleSelectOptionId: $value }
        }) {
          projectV2Item {
            id
          }
        }
      }
    `,
    {
      fieldId: response.repository.projectV2.field.id,
      itemId: response.repository.issue.projectItems.nodes[0].id,
      projectId: response.repository.projectV2.id,
      value: targetOption.id
    }
  )
}
