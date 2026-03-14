# Configuration Guide

This guide covers all configuration options for Spec Workflow MCP.

## Command-Line Options

### Basic Usage

```bash
npx -y @pimzino/spec-workflow-mcp@latest [project-path] [options]
```

`project-path` is optional. If omitted, the MCP server runs in project-agnostic mode and resolves the active project per request.

### Available Options

| Option | Description | Example |
|--------|-------------|---------|
| `--help` | Show comprehensive usage information | `npx -y @pimzino/spec-workflow-mcp@latest --help` |
| `--dashboard` | Run dashboard-only mode (default port: 5091) | `npx -y @pimzino/spec-workflow-mcp@latest --dashboard` |
| `--port <number>` | Specify custom dashboard port (1024-65535) | `npx -y @pimzino/spec-workflow-mcp@latest --dashboard --port 8080` |
| `--no-open` | Don't auto-open browser when starting dashboard | `npx -y @pimzino/spec-workflow-mcp@latest --dashboard --no-open` |
| `--no-shared-worktree-specs` | Disable shared `.spec-workflow` in git worktrees (use workspace-local instead) | `npx -y @pimzino/spec-workflow-mcp@latest ~/worktree --no-shared-worktree-specs` |

### Important Notes

- **Single Dashboard Instance**: Only one dashboard runs at a time. All MCP servers connect to the same dashboard.
- **Default Port**: Dashboard uses port 5091 by default. Use `--port` only if 5091 is unavailable.
- **Separate Dashboard**: Always run the dashboard separately from MCP servers.
- **Project Binding Order**: `projectPath` override in a tool/prompt call -> startup path passed to the server -> exactly one MCP client filesystem root -> error.

## Usage Examples

### Typical Workflow

1. **Start the Dashboard** (do this first, only once):
```bash
# Uses default port 5091
npx -y @pimzino/spec-workflow-mcp@latest --dashboard
```

2. **Start an MCP Server**:
```bash
# Project-agnostic mode (recommended for clients with a single active root)
npx -y @pimzino/spec-workflow-mcp@latest

# Optional fixed startup binding
npx -y @pimzino/spec-workflow-mcp@latest ~/projects/app1
```

Projects appear in the dashboard lazily after the first prompt/tool call that resolves to that workspace or repo family. The dashboard runs at http://localhost:5091 by default.

### Dashboard with Custom Port

Only use a custom port if port 5091 is unavailable:

```bash
# Start dashboard on port 8080
npx -y @pimzino/spec-workflow-mcp@latest --dashboard --port 8080
```

## Environment Variables

### SPEC_WORKFLOW_HOME

Override the default global state directory (`~/.spec-workflow-mcp`). This is useful for sandboxed environments where `$HOME` is read-only.

| Variable | Default | Description |
|----------|---------|-------------|
| `SPEC_WORKFLOW_HOME` | `~/.spec-workflow-mcp` | Directory for global state files |

**Files stored in this directory:**
- `activeProjects.json` - Project registry
- `activeSession.json` - Dashboard session info
- `settings.json` - Global settings
- `job-execution-history.json` - Job execution history
- `migration.log` - Implementation log migration tracking

**Usage examples:**

```bash
# Absolute path with startup binding
SPEC_WORKFLOW_HOME=/workspace/.spec-workflow-mcp npx -y @pimzino/spec-workflow-mcp@latest /workspace

# Relative path with project-agnostic mode
SPEC_WORKFLOW_HOME=./.spec-workflow-mcp npx -y @pimzino/spec-workflow-mcp@latest

# For dashboard mode
SPEC_WORKFLOW_HOME=/workspace/.spec-workflow-mcp npx -y @pimzino/spec-workflow-mcp@latest --dashboard
```

**Sandboxed environments (e.g., Codex CLI):**

When running in sandboxed environments like Codex CLI with `sandbox_mode=workspace-write`, set `SPEC_WORKFLOW_HOME` to a writable location within your workspace:

```bash
SPEC_WORKFLOW_HOME=/workspace/.spec-workflow-mcp npx -y @pimzino/spec-workflow-mcp@latest
```

### SPEC_WORKFLOW_SHARED_ROOT

Override the automatic git worktree detection. By default, when running in a git worktree, specs are stored in the main repository's `.spec-workflow/` directory so all worktrees share the same specs.

| Variable | Default | Description |
|----------|---------|-------------|
| `SPEC_WORKFLOW_SHARED_ROOT` | (auto-detected) | Override the project root for spec storage |

**Automatic behavior (no env var set):**

- **Main git repo**: Specs stored in `<project>/.spec-workflow/`
- **Git worktree**: Specs stored in `<main-repo>/.spec-workflow/` (shared with all worktrees)
- **Non-git directory**: Specs stored in `<project>/.spec-workflow/`

**When to use this variable:**

Use `SPEC_WORKFLOW_SHARED_ROOT` to override the automatic detection:

```bash
# Force specs to be stored in the current worktree (opt-out of sharing)
SPEC_WORKFLOW_SHARED_ROOT=$(pwd) npx -y @pimzino/spec-workflow-mcp@latest ./my-worktree

# Force a specific shared location
SPEC_WORKFLOW_SHARED_ROOT=/path/to/shared/specs npx -y @pimzino/spec-workflow-mcp@latest ~/my-worktree
```

**Git worktree example:**

```bash
# In main repo: /home/user/myproject
git worktree add ../myproject-feature feature-branch

# Start MCP server in worktree - specs automatically shared with main repo
cd ../myproject-feature
npx -y @pimzino/spec-workflow-mcp@latest
# Output: Git worktree detected. Using main repo: /home/user/myproject

# Both the main repo and worktree see the same specs in /home/user/myproject/.spec-workflow/
```

## Git Worktree Configuration

Git worktrees are fully supported with two operating modes:

### Default Mode: Shared Specs

By default, all worktrees of a repository share the same `.spec-workflow/` directory (stored in the main repo). However, each worktree registers as its own project in the dashboard with a distinct identity.

**Dashboard behavior:**
- Each worktree appears as a separate project in the project dropdown
- Project names show `repo · worktree` format (e.g., `myproject · feature-auth`)
- Approval file resolution prioritizes the worktree path, then falls back to shared workflow root

```bash
# Main repo
npx -y @pimzino/spec-workflow-mcp@latest ~/myproject
# Dashboard shows: "myproject"

# Worktree
npx -y @pimzino/spec-workflow-mcp@latest ~/myproject-feature
# Dashboard shows: "myproject · myproject-feature"
# Specs are shared from ~/myproject/.spec-workflow/
```

### Project-agnostic Mode

When you start the server without a path, it does not bind to `process.cwd()`. Instead, each request is resolved using the binding order described above.

Use this mode when:
- Your MCP client already scopes each conversation to one filesystem root
- You want one global server definition for many repositories
- You only want dashboard projects to appear after they are actually used

If the client exposes multiple roots and you do not pass a startup path, you must provide `projectPath` explicitly on stateful tool calls.

### Isolated Mode: Workspace-Local Specs

Use `--no-shared-worktree-specs` when you want each worktree to have its own independent `.spec-workflow/` directory:

```bash
npx -y @pimzino/spec-workflow-mcp@latest ~/myproject-feature --no-shared-worktree-specs
# Output: Shared worktree specs disabled. Using workspace-local .spec-workflow.
# Specs stored in ~/myproject-feature/.spec-workflow/
```

**When to use isolated mode:**
- Different worktrees have completely different feature scopes
- You want to experiment with specs without affecting other worktrees
- Team members working on different worktrees need independent spec histories

**Comparison:**

| Aspect | Default (Shared) | `--no-shared-worktree-specs` |
|--------|------------------|------------------------------|
| `.spec-workflow/` location | Main repo | Each worktree |
| Specs visible across worktrees | Yes | No |
| Dashboard project identity | Separate per worktree | Separate per worktree |
| Approval file resolution | Worktree → Main repo | Worktree only |

## Dashboard Session Management

The dashboard stores its session information in `~/.spec-workflow-mcp/activeSession.json` (or `$SPEC_WORKFLOW_HOME/activeSession.json` if set). This file:
- Enforces single dashboard instance
- Allows MCP servers to discover the running dashboard
- Automatically cleans up when dashboard stops

### Single Instance Enforcement

Only one dashboard can run at any time. If you try to start a second dashboard:

```
Dashboard is already running at: http://localhost:5091

You can:
  1. Use the existing dashboard at: http://localhost:5091
  2. Stop it first (Ctrl+C or kill PID), then start a new one

Note: Only one dashboard instance is needed for all your projects.
```

## Port Management

**Default Port**: 5091
**Custom Port**: Use `--port <number>` only if port 5091 is unavailable

### Port Conflicts

If port 5091 is already in use by another service:

```bash
Failed to start dashboard: Port 5091 is already in use.

This might be another service using port 5091.
To use a different port:
  spec-workflow-mcp --dashboard --port 8080
```

## Configuration File (Deprecated)

### Default Location

The server looks for configuration at: `<project-dir>/.spec-workflow/config.toml`

### File Format

Configuration uses TOML format. Here's a complete example:

```toml
# Project directory (defaults to current directory)
projectDir = "/path/to/your/project"

# Dashboard port (1024-65535)
port = 3456

# Run dashboard-only mode
dashboardOnly = false

# Interface language
# Options: en, ja, zh, es, pt, de, fr, ru, it, ko, ar
lang = "en"

# Sound notifications (VSCode extension only)
[notifications]
enabled = true
volume = 0.5

# Advanced settings
[advanced]
# WebSocket reconnection attempts
maxReconnectAttempts = 10

# File watcher settings
[watcher]
enabled = true
debounceMs = 300
```

### Configuration Options

#### Basic Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectDir` | string | Current directory | Project directory path |
| `port` | number | Ephemeral | Dashboard port (1024-65535) |
| `dashboardOnly` | boolean | false | Run dashboard without MCP server |
| `lang` | string | "en" | Interface language |

> **Note**: The `autoStartDashboard` option was removed in v2.0.0. The dashboard now uses a unified multi-project mode accessible via `--dashboard` flag.

#### Language Options

- `en` - English
- `ja` - Japanese (日本語)
- `zh` - Chinese (中文)
- `es` - Spanish (Español)
- `pt` - Portuguese (Português)
- `de` - German (Deutsch)
- `fr` - French (Français)
- `ru` - Russian (Русский)
- `it` - Italian (Italiano)
- `ko` - Korean (한국어)
- `ar` - Arabic (العربية)

### Creating a Custom Configuration

1. Copy the example configuration:
```bash
cp .spec-workflow/config.example.toml .spec-workflow/config.toml
```

2. Edit the configuration:
```toml
# My project configuration
projectDir = "/Users/myname/projects/myapp"
port = 3000
lang = "en"
```

3. Use the configuration:
```bash
# Uses .spec-workflow/config.toml automatically
npx -y @pimzino/spec-workflow-mcp@latest

# Or specify explicitly
npx -y @pimzino/spec-workflow-mcp@latest --config .spec-workflow/config.toml
```

## Configuration Precedence

Configuration values are applied in this order (highest to lowest priority):

1. **Command-line arguments** - Always take precedence
2. **Custom config file** - Specified with `--config`
3. **Default config file** - `.spec-workflow/config.toml`
4. **Built-in defaults** - Fallback values

### Example Precedence

```toml
# config.toml
port = 3000
```

```bash
# Command-line argument overrides config file
npx -y @pimzino/spec-workflow-mcp@latest --config config.toml --port 4000
# Result: port = 4000 (CLI wins)
```

## Environment-Specific Configurations

### Development Configuration

```toml
# dev-config.toml
projectDir = "./src"
port = 3000
lang = "en"

[advanced]
debugMode = true
verboseLogging = true
```

Usage:
```bash
npx -y @pimzino/spec-workflow-mcp@latest --config dev-config.toml
```

### Production Configuration

```toml
# prod-config.toml
projectDir = "/var/app"
port = 8080
lang = "en"

[advanced]
debugMode = false
verboseLogging = false
```

Usage:
```bash
npx -y @pimzino/spec-workflow-mcp@latest --config prod-config.toml
```

## Port Configuration

### Valid Port Range

Ports must be between 1024 and 65535.

### Ephemeral Ports

When no port is specified, the system automatically selects an available ephemeral port. This is recommended for:
- Development environments
- Multiple simultaneous projects
- Avoiding port conflicts

### Fixed Ports

Use fixed ports when you need:
- Consistent URLs for bookmarking
- Integration with other tools
- Team collaboration with shared configurations

### Port Conflict Resolution

If a port is already in use:

1. **Check what's using the port:**
   - Windows: `netstat -an | findstr :3000`
   - macOS/Linux: `lsof -i :3000`

2. **Solutions:**
   - Use a different port: `--port 3001`
   - Kill the process using the port
   - Omit `--port` to use an ephemeral port

## Multi-Project Setup

### Separate Configurations

Create project-specific configurations:

```bash
# Project A
project-a/
  .spec-workflow/
    config.toml  # port = 3000

# Project B
project-b/
  .spec-workflow/
    config.toml  # port = 3001
```

### Shared Configuration

Use a shared configuration with overrides:

```bash
# Shared base config
~/configs/spec-workflow-base.toml

# Project-specific overrides
npx -y @pimzino/spec-workflow-mcp@latest \
  --config ~/configs/spec-workflow-base.toml \
  --port 3000 \
  /path/to/project-a
```

## VSCode Extension Configuration

The VSCode extension has its own settings:

1. Open VSCode Settings (Cmd/Ctrl + ,)
2. Search for "Spec Workflow"
3. Configure:
   - Language preference
   - Sound notifications
   - Archive visibility
   - Auto-refresh interval

## Troubleshooting Configuration

### Configuration Not Loading

1. **Check file location:**
   ```bash
   ls -la .spec-workflow/config.toml
   ```

2. **Validate TOML syntax:**
   ```bash
   # Install toml CLI tool
   npm install -g @iarna/toml

   # Validate
   toml .spec-workflow/config.toml
   ```

3. **Check permissions:**
   ```bash
   # Ensure file is readable
   chmod 644 .spec-workflow/config.toml
   ```

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Use different port or omit for ephemeral |
| Config file not found | Check path and use absolute path if needed |
| Invalid TOML syntax | Validate with TOML linter |
| Settings not applying | Check configuration precedence |

## Best Practices

1. **Use version control** for configuration files
2. **Document custom settings** in your project README
3. **Use ephemeral ports** in development
4. **Keep sensitive data** out of configuration files
5. **Create environment-specific** configurations
6. **Test configuration changes** before deploying

## Related Documentation

- [User Guide](USER-GUIDE.md) - Using the configured server
- [Interfaces Guide](INTERFACES.md) - Dashboard and extension settings
- [Troubleshooting](TROUBLESHOOTING.md) - Common configuration issues
