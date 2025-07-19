# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Convergence Protocol Campaign Tracker" - a comprehensive web application for tracking tabletop wargaming campaigns, specifically designed for One Page Rules (OPR) games. It's a vanilla JavaScript single-page application that integrates with the Army Forge API for army data.

## Development Commands

- **Format code**: `npx prettier --write .`
- **Format with JSDoc**: `npx prettier --write . --plugin=prettier-plugin-jsdoc`

No build, test, or development server commands are present - this is a static site deployed to GitHub Pages.

## Core Architecture

### Frontend Stack
- **Pure vanilla JavaScript** (ES6 modules) - no frameworks
- **Modular architecture** with single-responsibility modules
- **Bootstrap 5.3.3** for UI components and responsive design
- **LocalStorage** for persistent state management
- **SessionStorage** for caching API data

### Key Architectural Patterns

**State Management**: Centralized in `js/state.js` with separate concerns:
- **Global non-persistent state**: Campaign data, army books, loaded army data
- **Per-army persistent state**: Unit status, command points, game state (stored in localStorage)
- **Global game state**: Current round, phase, game status

**Data Flow**: 
1. `js/dataLoader.js` fetches from Army Forge API and local JSON files
2. `js/dataProcessor.js` processes raw API data into usable format
3. `js/state.js` manages all application state
4. `js/ui.js` handles DOM updates and rendering

**Caching Strategy**:
- Army books cached in sessionStorage with version validation
- Definitions (rules/traits/spells) consolidated and cached
- Game state persisted per army in localStorage

### File Structure & Responsibilities

**Core Modules**:
- `js/state.js` - Centralized state management, getters/setters for all game data
- `js/dataLoader.js` - API integration, data fetching with caching
- `js/dataProcessor.js` - Raw data transformation and processing
- `js/ui.js` - DOM manipulation and UI rendering
- `js/eventHandlers.js` - User interaction processing
- `js/gameLogic.js` - Game rule calculations and validation

**Configuration**:
- `js/config.js` - API URLs, cache keys, game constants
- `data/campaign.json` - Campaign configuration, army rosters
- `data/missions.json` - Mission definitions and objectives
- `data/rules/` - Custom rule definitions and doctrines

**Pages**:
- `index.html` - Dashboard/homepage with mission status
- `army.html` - Army management interface with unit tracking
- `campaign.html` - Campaign leaderboard and battle reports
- `rules.html` - Interactive rules reference system

## Important Implementation Notes

### Army Forge API Integration
- Uses Army Forge list IDs to fetch army data
- Caches army books in sessionStorage with cache invalidation
- Processes raw API data into normalized format with `unitMap` for fast lookups

### State Persistence Strategy
- **Per-army state**: Health, status, equipment tracked per unit/model
- **Game state**: Round number, phase, completion status
- **Command points**: Auto-calculated based on list points (1 CP per 1000 pts)
- **Deployment tracking**: Support for scout, ambush, embarked deployment

### Key Data Structures
- `loadedArmiesData[armyId]` - Processed army data with `unitMap` for fast access
- `armyState.units[unitId]` - Per-unit game state (health, status, actions)
- `unitState.models[modelId]` - Individual model health and custom names

### Campaign System Features
- **Mission tracking** with structured objectives and victory conditions
- **Battle reports** with detailed post-game analysis
- **Leaderboard calculation** based on wins, VP, and objectives
- **Army progression** with casualty outcomes and kill tracking

## Development Guidelines

### Code Conventions
- Use ES6 modules with explicit imports/exports
- Functions are declarative with clear JSDoc comments
- State updates go through centralized state.js functions
- DOM updates happen through ui.js rendering functions
- All API calls routed through dataLoader.js with caching

### Adding New Features
1. Add state management functions to `state.js` if needed
2. Create UI components in `ui.js` with proper event binding
3. Add event handlers in `eventHandlers.js`
4. Update configuration in `config.js` for any new constants

### Data Management
- Never directly modify localStorage - use state.js functions
- All army data must go through dataProcessor.js for normalization
- Cache invalidation is handled automatically by version checking
- Use the consolidated definitions system for rule lookups

## Army Forge Integration Notes

The application integrates with One Page Rules' Army Forge:
- **API Base**: Uses armyforge.onepagerules.com API
- **Authentication**: No auth required for public lists
- **Data Processing**: Raw API data transformed to include `unitMap` for O(1) lookups
- **Caching**: Army books cached with version validation to minimize API calls

This codebase represents a complex state management challenge solved with vanilla JavaScript and careful architectural planning.