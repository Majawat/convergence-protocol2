# OPR Army Tracker - To-Do List

This list tracks the features and improvements planned for the OPR Army Tracker.

### II. Combat & Rules Implementation

- [ ] **Target Selection:** Implement UI for selecting targets for Shooting and Charge actions.
- [ ] **Shooting Logic:** Add logic/UI to handle shooting attacks (determining attacks, rolling/inputting hits, rolling/inputting blocks, applying wounds via `applyWound`).
- [ ] **Melee Logic:** Add logic/UI for the melee sequence (charge movement, determining attacks, rolling/inputting hits/blocks, applying wounds, handling `Fatigue`, striking back, melee resolution).
- [ ] **Set `fatigued` State:** Implement the logic to set a unit's `fatigued` state to `true` after its first melee attack in a round.
- [ ] **Apply `Fatigue` Effect:** (Requires Shooting/Melee logic) Modify attack resolution to check `fatigued` status and apply the "hit on 6s" penalty in melee.
- [ ] **Limited Weapon Tracking:**
  - [ ] Add UI element (e.g., button) to mark a `Limited` weapon as used.
  - [ ] Implement logic to set the `limitedWeaponUsed` state flag to `true` when marked.
  - [ ] Add UI indicator for used limited weapons.

### III. Morale & Unit Status

- [ ] **Morale Test Logic:** Implement the trigger conditions (melee loss, <=50% wounds) and the Quality test roll for Morale. (Requires access to unit's starting size/Tough).
- [ ] **Update `shaken` State:** Set `shaken: true` when a unit fails a morale test (and isn't Routed).
- [ ] **Update `status` State:**
  - [ ] Set `status: 'routed'` when a unit fails morale at <=50% strength.
  - [ ] Set `status: 'destroyed'` when the last model's `currentHp` reaches 0 (integrate check into `applyWound` or related logic).
- [ ] **Shaken Unit Handling:** Implement rules for Shaken units (must Idle/Hold to recover, auto-fail morale, can't contest objectives). Set `shaken: false` after recovery activation.
- [ ] **UI Status Indicators:** Add clear visual indicators on unit cards for `shaken`, `destroyed`, and `routed` statuses.

### IV. Campaign Integration

- [ ] **Underdog Points Calculation:** Implement the pre-game logic to read `listPoints` from each army's state and calculate underdog points.
- [ ] **Underdog Points Usage:** Add UI/logic to allow players to spend underdog points during the game (e.g., modifying dice rolls).
- [ ] **Post-Game Sequence UI:** Create UI/workflow for end-of-game steps:
  - [ ] Display casualties (using the `status` field).
  - [ ] Calculate/Display earned XP (potentially with manual input for kills initially).
  - [ ] _(Deferred/External)_ Handle applying Injuries/Talents and spending points (likely involves updating the source army list files/data).
- [ ] **`killedBy` Tracking (Deferred):** Implement manual input (e.g., dropdown) post-game to assign kills for XP purposes, as discussed.

### V. Quality of Life & UI Enhancements

- [ ] **Custom Model Naming:** Add UI/logic for players to set and display custom names for individual models (using the `models[modelId].name` state field).
- [ ] **Joined Hero Distinction:** Improve visual clarity on cards showing joined units (clearly separating hero/base unit stats and models).
- [ ] **Spell Modal Polish:** Ensure all "Cast" buttons update their enabled/disabled state correctly after a spell is cast.
- [ ] **General UI/UX:** Refine layout, add tooltips, improve feedback messages.
# OPR Army Tracker
