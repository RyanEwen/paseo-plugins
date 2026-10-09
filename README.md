<!-- fork-overview:start -->

## Ryan's Paseo plugins fork

This is [RyanEwen/paseo-plugins](https://github.com/RyanEwen/paseo-plugins), an
experimental fork of [omercnet/paseo-plugins](https://github.com/omercnet/paseo-plugins).
It accompanies [Ryan's Paseo fork](https://github.com/RyanEwen/paseo).

The default branch, `ryan/preview`, contains the combined preview changes.
Feature branches keep individual changes separate for review. `main` retains
the upstream branch history.

The Shared Browser additions include:

- **Independent browser tabs:** Clients and agents select tabs separately while
  sharing the same site logins. New browsers start with one tab, new tabs retain
  their creation order, and agents can recover tab access after being idle.
- **More browser controls:** Display and capture settings, mobile emulation, and
  continuous mouse and touch gestures.
- **Live browser video:** Encoded video for supported desktop, web, and Android
  clients, with image capture available for other clients. Android video requires
  the matching Paseo host support.
- **Hardware WebGL on WSL:** An optional graphics mode uses the Windows GPU through
  WSL's Direct3D 12 driver. It requires compatible host drivers and fails clearly
  if hardware rendering is unavailable. See the
  [Shared Browser setup](paseo-shared-browser/README.md#runtime-environment-overrides).

These are source previews, not a separate published plugin release. The package
names and installation instructions in the individual plugin READMEs refer to
upstream packages. Review each plugin's requirements before installing this
fork's source, and avoid replacing a live plugin during development testing.

<!-- fork-overview:end -->

---

# Paseo plugins

A collection of plugins for [Paseo](https://paseo.sh). Each directory contains its
own setup instructions and documentation.

| Plugin | Purpose |
| --- | --- |
| [Shared Browser](paseo-shared-browser/README.md) | Share a real Chromium browser across workspace clients and agents. |
| [Agent Crew](agent-crew/README.md) | View and control managed agent crews. |
| [Agent Monitor](agent-monitor/README.md) | Triage agents across a host. |
| [Context Mode](context-mode/README.md) | Inspect Context Mode health and MCP activation. |
| [Fresh Worktrees](fresh-worktrees/README.md) | Update clean base branches before creating worktrees. |
| [Beads](paseo-beads/README.md) | Manage a dependency-aware work queue. |
| [Dracula](paseo-dracula/README.md) | Use Dracula and Alucard themes. |
| [Gas City](paseo-gas-city/README.md) | Observe and operate Gas City supervisors. |
| [OMP](paseo-omp/README.md) | Use OMP providers and workspace tools. |
| [PR Radar](pr-radar/README.md) | View pull requests associated with Paseo workspaces. |
| [Queens](queens/README.md) | Play the Queens logic puzzle. |
| [Tell Agent](tell-agent/README.md) | Send messages to agents in other workspaces. |

See [SECURITY.md](SECURITY.md) for security reporting and [LICENSE](LICENSE) for
licensing.
