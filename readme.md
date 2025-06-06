# OPR Army Tracker

# Convergence Protocol Campaign Tracker

A comprehensive web application for tracking tabletop wargaming campaigns, specifically designed for One Page Rules (OPR) games. Manage armies, track mission progress, calculate standings, and reference rules all in one place.

## ✨ Features

### 🎯 Campaign Management

- **Mission Tracking**: Current, completed, and upcoming missions with detailed objectives
- **Battle Reports**: Integrated reporting system with structured data
- **Dynamic Leaderboard**: Real-time calculation of campaign standings based on wins, VP, and objectives
- **Progress Dashboard**: At-a-glance overview of campaign status

### 🪖 Army Management

- **Live Unit Tracking**: Real-time health, status, and equipment management
- **State Persistence**: Game state automatically saved between sessions
- **OPR Integration**: Direct integration with Army Forge API for unit data
- **Command Points**: Automatic calculation and tracking based on army composition
- **Hero Joining**: Support for heroes joining units with combined stat tracking

### 📋 Rules Reference

- **Interactive Definitions**: Hover over terms for instant rule explanations
- **Custom Rule Sets**: Support for campaign-specific rules and doctrines
- **Searchable Content**: Quick access to rules and definitions

### 🎨 User Experience

- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark/Light Themes**: Toggle between themes with automatic persistence
- **Accessibility**: Screen reader friendly with proper ARIA labels
- **Toast Notifications**: Non-intrusive feedback system

## 🚀 Live Demo

Visit the live application: **https://majawat.github.io/convergence-protocol2/**

## 📁 Project Structure

```
├── index.html              # Dashboard/Homepage
├── army.html              # Army management interface
├── campaign.html          # Campaign status and leaderboard
├── rules.html             # Rules reference system
├── css/
│   └── style.css          # Custom styling and theme variables
├── js/                    # Modular JavaScript architecture
│   ├── app.js             # Main application entry point
│   ├── state.js           # Centralized state management
│   ├── dataLoader.js      # API and data fetching
│   ├── ui.js              # UI rendering and updates
│   └── ...               # Additional specialized modules
├── data/                  # Campaign and rules data
│   ├── campaign.json      # Campaign configuration
│   ├── missions.json      # Mission definitions
│   └── rules/             # Custom rules and definitions
└── assets/                # Static assets and favicons
```

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Styling**: Bootstrap 5.3.3, Bootstrap Icons
- **Storage**: LocalStorage for state persistence
- **APIs**: One Page Rules Army Forge integration
- **Hosting**: GitHub Pages compatible (static site)

## 🎮 Usage

### Getting Started

1. Visit the application URL
2. Navigate to "View Armies" to load army data from Army Forge
3. Use the dashboard to track current mission status
4. Check "Campaign Status" for leaderboards and historical data

### Army Management

- Select armies using Army Forge list IDs
- Track unit health, actions, and status in real-time
- Command points automatically calculated per OPR rules
- Game state persists between browser sessions

### Campaign Tracking

- Missions defined in `data/missions.json` with structured objectives
- Battle reports link to detailed post-game analysis
- Leaderboard calculates based on wins, earned VP, and objectives completed

## ⚙️ Configuration

### Campaign Data

Edit `data/campaign.json` to configure:

- Campaign name and description
- Base point values
- Army rosters and current standings
- Faction information

### Missions

Modify `data/missions.json` to add:

- Mission objectives and special rules
- Victory conditions and rewards
- Terrain suggestions
- Scheduling information

### Custom Rules

Add definitions to `data/rules/custom-definitions.json` for:

- Campaign-specific rules
- Interactive term definitions
- Doctrine modifications

## 🔧 Development

### Architecture Principles

- **Modular Design**: Each JavaScript file has a single responsibility
- **State Management**: Centralized state with predictable updates
- **Clean Code**: Meaningful names, DRY principles, modern practices
- **Performance**: Efficient DOM updates and minimal re-rendering

### Key Modules

- `state.js` - Centralized application state management
- `dataLoader.js` - API integration and data fetching
- `ui.js` - DOM manipulation and rendering
- `eventHandlers.js` - User interaction processing
- `gameLogic.js` - Game rule calculations and validation

### Future Enhancements

- **Server Integration**: Planned migration to client/server architecture
- **Multiplayer Support**: Real-time synchronization between players
- **Extended Reporting**: Enhanced battle report features
- **Mobile App**: Native mobile application development

## 📄 License

This project is designed for personal and gaming group use. One Page Rules content used under fair use for gaming purposes.

## 🤝 Contributing

This is a personal project for campaign tracking. Feel free to fork and adapt for your own gaming groups!

---

**Convergence Protocol Tracker** - Bringing order to the chaos of tabletop campaigns.
