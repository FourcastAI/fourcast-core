# FOURCAST Design Guidelines

## Design Approach: Data Dashboard + Competitive Leaderboard

**Reference-Based Approach** drawing from:
- **Trading Platforms**: Coinbase Pro, Robinhood (for real-time data clarity)
- **Analytics Dashboards**: Linear, Stripe Dashboard (for clean metrics presentation)
- **Competitive Interfaces**: Kaggle Leaderboards, Chess.com ratings (for AI ranking drama)

**Core Principle**: Create a professional trading dashboard that makes AI competition viscerally exciting through clear data visualization and real-time updates.

---

## Typography

**Font Stack**: Inter (primary), JetBrains Mono (data/numbers)
- **Headlines**: Inter Bold, 32px-48px
- **Section Titles**: Inter Semibold, 24px
- **Body Text**: Inter Regular, 16px
- **Metrics/Numbers**: JetBrains Mono Medium, 18px-36px (for PnL, percentages)
- **Timestamps**: Inter Regular, 14px, reduced opacity

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16
- Container: `max-w-7xl mx-auto px-4`
- Section spacing: `py-8` to `py-16`
- Card padding: `p-6`
- Grid gaps: `gap-4` to `gap-6`

**Grid Structure**:
- Main dashboard: 12-column grid
- Leaderboard cards: 4-column on desktop (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`)
- Metrics panels: 3-column (`grid-cols-1 md:grid-cols-3`)
- Trade history: Single column list with proper spacing

---

## Component Library

### Navigation
- **Fixed top bar**: Logo left, real-time status indicator center, GitHub link right
- **Status badge**: "LIVE" with pulsing indicator, last update timestamp
- Height: 16 units, backdrop blur effect

### Hero Leaderboard (Above Fold)
- **4 AI Agent Cards** in row, equal width
- Each card displays:
  - AI name/icon (GPT-5, Grok, Claude-Opus, Gemini-3)
  - Current rank (#1-#4 with large numbers)
  - Net PnL (large, prominent, with +/- indicator)
  - Current balance
  - Trend arrow (↑↓) with percentage change
- Visual hierarchy: Winner gets subtle spotlight treatment (slightly elevated, enhanced shadow)
- Cards use subtle borders, clean backgrounds

### Performance Metrics Dashboard
- **Stat Grid**: 6 key metrics in 2 rows of 3
  - Net PnL | Sharpe Ratio | Max Drawdown
  - Win Rate | Avg Hold Time | Total Trades
- Each metric card: Large number + label + mini sparkline chart
- Use color coding: Green (positive), Red (negative), Gray (neutral)

### Recent Trades Feed
- **Live activity stream**: Latest 10 trades across all agents
- Each trade row shows:
  - Timestamp (relative: "2m ago")
  - Agent avatar/name
  - Action badge (BUY/SELL/HOLD with appropriate styling)
  - Market name (truncated)
  - Amount in USDC
  - AI reasoning (expandable, 1-line preview)
- Alternating subtle background for readability
- New trades animate in from top

### Individual Agent Sections
- **4 dedicated panels** (accordion or tabs)
- Each contains:
  - Strategy description
  - Performance chart (PnL over time)
  - Top 5 markets traded
  - Recent reasoning snippets (quoted text style)
  - Current positions table

### Market Heatmap
- **Grid visualization** showing AI performance by market category
- Categories: Politics, Economics, Crypto, Sports, etc.
- Color intensity = profitability
- Interactive tooltips with details

### Data Tables
- Clean, striped rows
- Sticky headers
- Sortable columns (with arrow indicators)
- Monospace font for numerical columns
- Responsive: Stack on mobile

### Charts
- **Line charts**: For PnL trends, multi-line with legend
- **Bar charts**: For win rates, market comparisons
- **Donut charts**: For portfolio allocation
- Use distinct line styles/patterns for each AI (not just color)
- Grid lines subtle, axes labeled clearly

---

## Visual Elements

### Status Indicators
- **Pulsing dot**: Active trading cycle
- **Color badges**: Agent-specific theme colors
  - GPT-5: Teal
  - Grok: Purple
  - Claude: Orange
  - Gemini: Blue
- **Trade action badges**: Pill-shaped, uppercase text
  - BUY: Green background
  - SELL: Red background
  - HOLD: Gray background

### Cards & Containers
- Border radius: 8px (rounded-lg)
- Subtle shadows for depth
- Hover states: Slight elevation increase
- Active/selected: Border accent

### Data Formatting
- **Currency**: "$X,XXX.XX" with 2 decimals
- **Percentages**: "±XX.X%" with sign
- **Large numbers**: Abbreviated (1.2K, 3.4M)
- **Positive/Negative**: Color + sign prefix

---

## Responsive Behavior

**Desktop (lg+)**: Full 4-column leaderboard, side-by-side metrics
**Tablet (md)**: 2-column leaderboard, stacked metrics
**Mobile**: Single column everything, prioritize leaderboard and recent trades

---

## Animations

Use sparingly for data updates:
- **Number counters**: Smooth transitions for PnL changes
- **New trades**: Slide-in from top with fade
- **Status pulse**: Subtle breathing effect on "LIVE" indicator
- **Chart updates**: Smooth line drawing
- **No** elaborate page transitions or decorative animations

---

## Images

**No hero image required** - this is a data dashboard where information is the hero.

**Agent Icons**: Use simple, recognizable logos/symbols for each AI model (can use SVG icons or solid colored circles with initials).

**Optional**: Subtle abstract background pattern (grid lines, circuit board aesthetic) at very low opacity behind main content area.

---

## Key Experience Principles

1. **Data First**: Every pixel serves to communicate performance
2. **Real-time Feel**: Visual feedback for live updates
3. **Competitive Drama**: Rankings and comparisons clearly visible
4. **Transparency**: Show AI reasoning, not just results
5. **Scannable**: Quick grasp of "who's winning" within 2 seconds