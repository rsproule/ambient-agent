/**
 * MeritSpace Workspace Management
 *
 * Handles creating and initializing GitHub repositories for user workspaces.
 * Each workspace has a standard directory structure for Claude to work with.
 */

import { meritSpaceConfig } from "@/src/lib/config/env";

const MERITSPACE_ORG = meritSpaceConfig.org;

/**
 * Default workspace directory structure
 */
const WORKSPACE_STRUCTURE = [
  {
    path: "README.md",
    content: (username: string) => `# ${username}'s Workspace

This is your persistent Claude workspace. Any code, files, or projects created here will be saved and available for future sessions.

## Directory Structure

- \`tools/\` - Custom scripts and utilities
- \`projects/\` - Your coding projects
- \`notes/\` - Documentation and notes
- \`.logs/\` - Execution logs (auto-generated)
- \`.claude/\` - Claude configuration and state

## Getting Started

Ask Claude to help you with any coding task. All changes will be automatically committed to this repository.
`,
  },
  {
    path: "tools/.gitkeep",
    content: () => "# Custom tools and scripts\n",
  },
  {
    path: "projects/.gitkeep",
    content: () => "# Your coding projects\n",
  },
  {
    path: "notes/.gitkeep",
    content: () => "# Documentation and notes\n",
  },
  {
    path: ".logs/.gitkeep",
    content: () => "# Execution logs\n",
  },
  {
    path: ".claude/config.json",
    content: (username: string) =>
      JSON.stringify(
        {
          workspace: username,
          created: new Date().toISOString(),
          version: 1,
        },
        null,
        2,
      ),
  },
];

/**
 * Create a file in a GitHub repository
 */
async function createFile(
  repo: string,
  path: string,
  content: string,
  token: string,
  message: string = `Initialize ${path}`,
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${MERITSPACE_ORG}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          content: Buffer.from(content).toString("base64"),
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      // File already exists is fine
      if (response.status === 422) {
        return true;
      }
      console.error(`Failed to create ${path}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error creating ${path}:`, error);
    return false;
  }
}

/**
 * Initialize workspace with default directory structure
 */
async function initializeWorkspaceStructure(
  username: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  // Create files sequentially to avoid race conditions
  for (const file of WORKSPACE_STRUCTURE) {
    // Skip README.md as it's created by auto_init
    if (file.path === "README.md") {
      // Update the README instead
      try {
        // First get the existing README to get its SHA
        const getResponse = await fetch(
          `https://api.github.com/repos/${MERITSPACE_ORG}/${username}/contents/README.md`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          },
        );

        if (getResponse.ok) {
          const existing = await getResponse.json();
          // Update with our custom README
          await fetch(
            `https://api.github.com/repos/${MERITSPACE_ORG}/${username}/contents/README.md`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: "Initialize workspace README",
                content: Buffer.from(file.content(username)).toString("base64"),
                sha: existing.sha,
              }),
            },
          );
        }
      } catch {
        // Ignore README update errors
      }
      continue;
    }

    const success = await createFile(
      username,
      file.path,
      file.content(username),
      token,
      `Initialize workspace: ${file.path}`,
    );

    if (!success) {
      console.warn(`Failed to create ${file.path}, continuing...`);
    }
  }

  return { success: true };
}

/**
 * Create a GitHub repository in the MeritSpace org with default structure
 */
export async function createWorkspaceRepo(
  username: string,
): Promise<{ success: boolean; error?: string; repoUrl?: string }> {
  const token = meritSpaceConfig.githubToken;

  if (!token) {
    console.warn("MERITSPACE_GITHUB_TOKEN not set, skipping repo creation");
    return { success: true }; // Allow claiming without repo creation in dev
  }

  try {
    // Create the repository
    const response = await fetch(
      `https://api.github.com/orgs/${MERITSPACE_ORG}/repos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: username,
          description: `Claude workspace for ${username}`,
          private: false,
          auto_init: true, // Creates initial commit with README
        }),
      },
    );

    let repoExists = false;

    if (!response.ok) {
      const error = await response.json();

      // If repo already exists, we'll still try to initialize structure
      if (
        response.status === 422 &&
        error.errors?.[0]?.message?.includes("already exists")
      ) {
        repoExists = true;
      } else {
        console.error("GitHub API error:", error);
        return {
          success: false,
          error: error.message || "Failed to create repository",
        };
      }
    }

    // Wait a moment for GitHub to initialize the repo
    if (!repoExists) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Initialize the workspace structure
    const initResult = await initializeWorkspaceStructure(username, token);
    if (!initResult.success) {
      console.warn("Failed to fully initialize workspace structure");
      // Don't fail the whole operation, the repo is still usable
    }

    return {
      success: true,
      repoUrl: `https://github.com/${MERITSPACE_ORG}/${username}`,
    };
  } catch (error) {
    console.error("Error creating GitHub repo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the full repo path for a workspace username
 */
export function getWorkspaceRepoPath(username: string): string {
  return `${MERITSPACE_ORG}/${username}`;
}

/**
 * Get the GitHub URL for a workspace
 */
export function getWorkspaceRepoUrl(username: string): string {
  return `https://github.com/${MERITSPACE_ORG}/${username}`;
}

/**
 * Reset a workspace to its initial state (preserves git history)
 * Creates a new commit that restores the default structure
 */
export async function resetWorkspaceRepo(
  username: string,
): Promise<{ success: boolean; error?: string }> {
  const token = meritSpaceConfig.githubToken;

  if (!token) {
    return { success: false, error: "GitHub token not configured" };
  }

  try {
    // Get the default branch
    const repoResponse = await fetch(
      `https://api.github.com/repos/${MERITSPACE_ORG}/${username}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!repoResponse.ok) {
      return { success: false, error: "Repository not found" };
    }

    const repo = await repoResponse.json();
    const defaultBranch = repo.default_branch || "main";

    // Get the current commit SHA
    const refResponse = await fetch(
      `https://api.github.com/repos/${MERITSPACE_ORG}/${username}/git/ref/heads/${defaultBranch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!refResponse.ok) {
      return { success: false, error: "Could not get branch reference" };
    }

    const ref = await refResponse.json();
    const parentSha = ref.object.sha;

    // Build the tree for the initial workspace structure
    const treeItems = WORKSPACE_STRUCTURE.map((file) => ({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      content: file.content(username),
    }));

    // Create a new tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${MERITSPACE_ORG}/${username}/git/trees`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tree: treeItems,
        }),
      },
    );

    if (!treeResponse.ok) {
      const error = await treeResponse.json();
      console.error("Failed to create tree:", error);
      return { success: false, error: "Failed to create new tree" };
    }

    const tree = await treeResponse.json();

    // Create a new commit
    const commitResponse = await fetch(
      `https://api.github.com/repos/${MERITSPACE_ORG}/${username}/git/commits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Reset workspace to initial state",
          tree: tree.sha,
          parents: [parentSha],
        }),
      },
    );

    if (!commitResponse.ok) {
      const error = await commitResponse.json();
      console.error("Failed to create commit:", error);
      return { success: false, error: "Failed to create commit" };
    }

    const commit = await commitResponse.json();

    // Update the branch reference
    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${MERITSPACE_ORG}/${username}/git/refs/heads/${defaultBranch}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sha: commit.sha,
        }),
      },
    );

    if (!updateRefResponse.ok) {
      const error = await updateRefResponse.json();
      console.error("Failed to update ref:", error);
      return { success: false, error: "Failed to update branch" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error resetting workspace:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
