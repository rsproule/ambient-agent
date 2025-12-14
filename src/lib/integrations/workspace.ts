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
  // CLAUDE.md - Read automatically by Claude Code, enforces project rules
  {
    path: "CLAUDE.md",
    content: (username: string) => `# ${username}'s Workspace

This is a persistent workspace. All changes are committed to GitHub.

## CRITICAL: Directory Structure

\`\`\`
public/           <- DEPLOYED (Vite + React app)
  src/
    apps/         <- ADD NEW APPS HERE as folders
    App.tsx       <- ADD ROUTES HERE for new apps
notes/            <- NOT deployed - documentation
tools/            <- NOT deployed - scripts/utilities
.logs/            <- Auto-generated logs
\`\`\`

## Rules

1. **Web apps go in \`public/src/apps/\`** - Create a folder, add components
2. **Register routes in \`public/src/App.tsx\`** - Import and add Route
3. **Scripts/tools go in \`tools/\`** - Not deployed
4. **Notes/docs go in \`notes/\`** - Not deployed
5. **Never modify \`.logs/\` or \`.claude/\`** - System managed

## Adding a New App

\`\`\`bash
# 1. Create the app folder
mkdir -p public/src/apps/myapp

# 2. Create the main component
cat > public/src/apps/myapp/index.tsx << 'EOF'
export default function MyApp() {
  return <div>My App</div>
}
EOF

# 3. Edit public/src/App.tsx to add:
#    - Import: import MyApp from './apps/myapp'
#    - Route: <Route path="/apps/myapp/*" element={<MyApp />} />
#    - Manifest entry in the apps array
\`\`\`

## Building & Testing

\`\`\`bash
cd public
npm install    # First time only
npm run dev    # Local dev server
npm run build  # Production build
\`\`\`
`,
  },
  {
    path: "README.md",
    content: (username: string) => `# ${username}'s Workspace

This is your persistent Claude workspace. Code and projects here are saved across sessions.

See [CLAUDE.md](./CLAUDE.md) for directory structure and rules.

## Quick Start

- Web apps: \`public/src/apps/\`
- Scripts: \`tools/\`
- Notes: \`notes/\`

All changes are auto-committed to GitHub.
`,
  },
  // Vite + React app in public/
  {
    path: "public/package.json",
    content: (username: string) =>
      JSON.stringify(
        {
          name: `${username}-workspace`,
          private: true,
          version: "0.0.1",
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            "react-router-dom": "^6.20.0",
          },
          devDependencies: {
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
            "@vitejs/plugin-react": "^4.2.0",
            typescript: "^5.3.0",
            vite: "^5.0.0",
          },
        },
        null,
        2,
      ),
  },
  {
    path: "public/vite.config.ts",
    content: () => `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
  },
  {
    path: "public/tsconfig.json",
    content: () =>
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          include: ["src"],
        },
        null,
        2,
      ),
  },
  {
    path: "public/index.html",
    content: (username: string) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${username}'s Apps</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  },
  {
    path: "public/src/main.tsx",
    content: () => `import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
`,
  },
  {
    path: "public/src/App.tsx",
    content: (
      username: string,
    ) => `import { Routes, Route, Link } from 'react-router-dom'

// Import your apps here
// import MyApp from './apps/myapp'

const apps = [
  // Add your apps to this manifest
  // { name: 'My App', path: '/apps/myapp', description: 'Description here' },
]

function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>${username}'s Apps</h1>
      {apps.length === 0 ? (
        <p style={{ color: '#666' }}>No apps yet. Create one in src/apps/</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {apps.map((app) => (
            <li key={app.path} style={{ marginBottom: '1rem' }}>
              <Link to={app.path} style={{ fontSize: '1.2rem' }}>{app.name}</Link>
              <p style={{ margin: '0.25rem 0', color: '#666' }}>{app.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* Add routes for your apps here */}
      {/* <Route path="/apps/myapp/*" element={<MyApp />} /> */}
    </Routes>
  )
}
`,
  },
  {
    path: "public/src/index.css",
    content: () => `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
}

a {
  color: #0066cc;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
`,
  },
  {
    path: "public/src/apps/.gitkeep",
    content: () => "# Add your sub-apps here as folders\n",
  },
  // Non-deployed folders
  {
    path: "notes/.gitkeep",
    content: () => "# Documentation and notes\n",
  },
  {
    path: "tools/.gitkeep",
    content: () => "# Scripts and utilities\n",
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
 * Rename a branch in a GitHub repository
 */
async function renameDefaultBranch(
  repo: string,
  token: string,
  oldName: string,
  newName: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${MERITSPACE_ORG}/${repo}/branches/${oldName}/rename`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_name: newName,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      console.warn(
        `Failed to rename branch from ${oldName} to ${newName}:`,
        error,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`Error renaming branch:`, error);
    return false;
  }
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

      // Rename default branch from main to master (claudflare expects master)
      await renameDefaultBranch(username, token, "main", "master");
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
 * Creates a new commit that completely replaces the tree with the default structure
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
    const defaultBranch = repo.default_branch || "master";

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

    // Get the current tree to find all existing files
    const currentCommitResponse = await fetch(
      `https://api.github.com/repos/${MERITSPACE_ORG}/${username}/git/commits/${parentSha}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!currentCommitResponse.ok) {
      return { success: false, error: "Could not get current commit" };
    }

    const currentCommit = await currentCommitResponse.json();

    // Get the full tree recursively
    const currentTreeResponse = await fetch(
      `https://api.github.com/repos/${MERITSPACE_ORG}/${username}/git/trees/${currentCommit.tree.sha}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!currentTreeResponse.ok) {
      return { success: false, error: "Could not get current tree" };
    }

    const currentTree = await currentTreeResponse.json();

    // Build tree items: first delete all existing files, then add new ones
    const treeItems: Array<{
      path: string;
      mode: "100644";
      type: "blob";
      sha?: string | null;
      content?: string;
    }> = [];

    // Mark all existing files for deletion (sha: null)
    for (const item of currentTree.tree) {
      if (item.type === "blob") {
        treeItems.push({
          path: item.path,
          mode: "100644",
          type: "blob",
          sha: null, // This deletes the file
        });
      }
    }

    // Add all files from WORKSPACE_STRUCTURE
    for (const file of WORKSPACE_STRUCTURE) {
      treeItems.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        content: file.content(username),
      });
    }

    // Create a new tree based on the current tree with our modifications
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
          base_tree: currentCommit.tree.sha,
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
