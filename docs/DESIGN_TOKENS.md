# ORBIT Design Token Specification — Monochrome Editorial Minimal

ORBIT uses a centralized CSS custom property architecture defined in `src/styles/tokens.css` and mapped into Tailwind CSS v4 via `@theme` in `src/index.css`.

## Aesthetic Direction

- **Polarity**: **Obsidian Black Default** (`[data-theme="dark"]`) with crisp inverted white accents, paired with a calibrated **Gallery White** (`[data-theme="light"]`) companion theme switchable in Settings.
- **Color Discipline**: Strictly monochrome UI chrome (black, white, graphite, silver) with subtle desaturated scientific tones reserved exclusively for multi-series chart trajectories, dependency flow directions, and semantic alerts.
- **Geometry**: Flat obsidian/white planes separated by exact 1px hairline borders, restrained architectural radii (`4px` / `6px` / `8px`), and zero decorative shadows on static surfaces.

## Token Reference

| Token | Obsidian Black (Default) | Gallery White (Light) | Usage |
| :--- | :--- | :--- | :--- |
| `--orbit-background` | `#050506` | `#FAFAFA` | Primary application canvas |
| `--orbit-surface` | `#0B0B0D` | `#FFFFFF` | Sidebar, header, primary panels |
| `--orbit-surface-elevated` | `#141417` | `#F2F2F4` | Active nav, secondary buttons, tooltips |
| `--orbit-surface-inset` | `#08080A` | `#F7F7F8` | Inputs, equation fields, chart wells |
| `--orbit-border` | `#27272B` | `#D4D4D8` | Crisp structural hairline borders |
| `--orbit-border-subtle` | `#1A1A1E` | `#E4E4E7` | Subtle section and row dividers |
| `--orbit-primary` | `#FAFAFA` | `#09090B` | Primary CTA fill, active focus ring |
| `--orbit-on-primary` | `#050506` | `#FFFFFF` | Inverted primary CTA ink (>19:1 AAA) |
| `--orbit-text-primary` | `#FAFAFA` | `#09090B` | Primary headings and body ink |
| `--orbit-text-secondary` | `#A1A1AA` | `#52525B` | Secondary descriptions and metadata |
| `--orbit-text-muted` | `#71717A` | `#71717A` | Placeholders, timestamps, axis ticks |
| `--orbit-series-1` | `#FAFAFA` | `#09090B` | Primary / Baseline trajectory curve |
| `--orbit-series-2` | `#7DA0C4` | `#355C85` | Secondary / Variant curve (muted steel) |
| `--orbit-series-3` | `#6BA88A` | `#2B6E4F` | Tertiary series (muted sage) |
| `--orbit-series-4` | `#C9A461` | `#94681E` | Quaternary series (muted ochre) |
| `--orbit-success` | `#5EA885` | `#256F4D` | Validated / nominal state (icon + text) |
| `--orbit-warning` | `#CFA052` | `#8F6218` | Threshold warning (icon + text) |
| `--orbit-danger` | `#CE6A6A` | `#A1343A` | Error / critical state (icon + text) |

## Typography & Accessibility

- **Display & Headings**: `Plus Jakarta Sans` (`-0.02em` tracking, `text-wrap: balance`).
- **Body & UI Controls**: `DM Sans` (`16px` minimum body baseline, `1.5` line-height, `66ch` prose measure).
- **Data, Equations & Metrics**: `JetBrains Mono` with `font-variant-numeric: tabular-nums`.
- **Targets & Motion**: Minimum `44×44px` interactive targets, high-contrast `:focus-visible` outlines, and `prefers-reduced-motion` support.
