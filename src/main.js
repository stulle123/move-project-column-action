import * as core from '@actions/core'
import * as github from '@actions/github'
import { moveIssue } from './utils/projects.js'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    const issueNumber = parseInt(
      core.getInput('issue-number', { required: true })
    )
    const projectNumber = parseInt(
      core.getInput('project-number', { required: true })
    )
    const projectColumnName = core.getInput('column-name', { required: true })
    const repoName = core.getInput('repo-name') || github.context.repo.repo
    const repoOwner = core.getInput('repo-owner') || github.context.repo.owner

    // Get the GitHub token from the action inputs
    const githubToken = core.getInput('github-token', { required: true })
    if (!githubToken) {
      throw new Error('GitHub token is required')
    }

    // Validate event context - allow workflow_dispatch with issue-number input
    const isIssueEvent = !!github.context.payload.issue
    const isWorkflowDispatch = github.context.eventName === 'workflow_dispatch'

    if (!isIssueEvent && !isWorkflowDispatch) {
      throw new Error(
        'This action can only be run on issues or via workflow_dispatch.'
      )
    }

    // If it's an issue event, validate that the issue number matches
    if (isIssueEvent && github.context.payload.issue.number !== issueNumber) {
      core.warning(
        `Issue number input (${issueNumber}) differs from event issue number (${github.context.payload.issue.number}). Using input value.`
      )
    }

    core.info(
      `Moving issue #${issueNumber} for owner ${repoOwner} in repository ${repoName} to project ${projectNumber} column "${projectColumnName}"...`
    )

    // Move the issue to a different project column.
    await moveIssue(
      issueNumber,
      projectNumber,
      projectColumnName,
      repoName,
      repoOwner
    )
  } catch (error) {
    // Fail the workflow step if an error occurs
    core.setFailed(error.message)
  }
}
