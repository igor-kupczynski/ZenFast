# Cancel Recent Fast Feature Plan

## Overview
This document outlines the implementation plan for a feature that allows users to cancel/undo one of their recent 10 fasts from their fasting history. The feature emphasizes safety through confirmations and provides an excellent user experience.

## Command Structure
- **Primary command**: `/undo` - Lists recent 10 fasts and allows deletion
- **Alternative names**: Could support `/delete` as alias for consistency

## User Flow Design

### 1. Initial Command (`/undo`)
When user types `/undo`:

#### Case A: Has fasting history
```
📋 Select a fast to undo:

1️⃣ 18h 30m - ended 2 hours ago
2️⃣ 14h 15m - ended yesterday  
3️⃣ 20h 0m - ended 3 days ago
...

Select which fast to undo:
[1] [2] [3] [4] [5]  (inline buttons)
[6] [7] [8] [9] [10] (if more exist)
[❌ Cancel]
```

#### Case B: No fasting history
```
📋 No fasting history to undo.
[🚀 Start Fast] button
```

### 2. Selection Confirmation
When user clicks a number button:
```
⚠️ Confirm deletion of fast:

Fast #3 from your history:
• Duration: 20h 0m
• Started: Nov 25, 2025 at 9:00 PM
• Ended: Nov 26, 2025 at 5:00 PM  
• Ended 3 days ago

This action cannot be undone. Delete this fast?

[✅ Yes, delete] [❌ No, keep it]
```

### 3. Final Result

#### If confirmed:
```
✅ Fast deleted from history.
You now have 8 fasts in your history.

[📊 View Stats] [🚀 Start Fast]
```

#### If cancelled:
```
↩️ Deletion cancelled. Your history remains unchanged.

[📊 View Stats] [🚀 Start Fast]
```

## Implementation Details

### New Files/Functions Needed

#### 1. In `commands.ts`:
- `handleUndoCommand()` - Main command handler
- Route entry for `/undo` in `routeCommand()`

#### 2. In `callbacks.ts`:
- `undo_select_N` callbacks (where N is 1-10)
- `undo_confirm_N` callback
- `undo_cancel_N` callback
- New routing in `routeCallback()` to handle pattern matching

#### 3. In `fasting.ts`:
- `deleteFastFromHistory()` - Removes a fast by index
- Validation to ensure index is valid

#### 4. In `telegram.ts`:
- Helper to create numbered button grid (2 columns x 5 rows max)

### Key Technical Decisions

#### 1. Identification Method
- Use array index (0-based internally, 1-based for display)
- Simpler than adding IDs to existing data
- Works well for "recent 10" scope

#### 2. Callback Data Format
- Selection: `undo_select_<index>` (e.g., `undo_select_0` for first fast)
- Confirmation: `undo_confirm_<index>`
- Cancellation: `undo_cancel`

#### 3. Data Integrity
- Validate index bounds before deletion
- Use defensive copying when modifying history
- Ensure atomic operations (read-modify-write in one go)

#### 4. Timeline Validation
- Check that removing a fast doesn't create overlapping fasts
- Warn if user is currently fasting (but still allow undo of past fasts)

## Testing Strategy

### 1. Unit Tests (`test/commands.test.ts`)
- Test `/undo` with 0, 1, 5, 10, 15 fasts in history
- Test authentication requirement
- Test response formatting

### 2. Callback Tests (`test/callbacks.test.ts`)
- Test selection callbacks with valid/invalid indices
- Test confirmation flow
- Test cancellation flow

### 3. Integration Tests (`test/integration.test.ts`)
- Full flow from command to deletion
- Test with concurrent operations
- Test data persistence

### 4. Edge Cases
- Deleting while actively fasting
- Deleting the only fast
- Invalid index selection
- Rapid successive deletions

## UX Enhancements

### 1. Visual Clarity
- Number emojis (1️⃣-🔟) for easy recognition
- Clear time references ("2 hours ago", "yesterday")
- Duration prominently displayed
- Warning emoji ⚠️ for confirmation

### 2. Safety Features
- Two-step confirmation process
- Clear "cannot be undone" warning
- Option to cancel at any point
- Show exact fast details before deletion

### 3. Helpful Feedback
- Show remaining fast count after deletion
- Provide quick actions (Stats/Start Fast)
- Clear success/cancellation messages

## Implementation Order

1. Add basic `/undo` command handler
2. Implement fast listing with inline keyboard
3. Add selection callback handlers  
4. Implement confirmation dialog
5. Add deletion logic in fasting.ts
6. Implement confirmation callbacks
7. Add comprehensive tests
8. Test edge cases and error handling

## Design Rationale

This design prioritizes:
- **Safety**: Two-step confirmation prevents accidental deletions
- **Clarity**: Detailed information shown before any destructive action
- **Ease of use**: Numbered buttons and clear flow reduce cognitive load
- **Consistency**: Maintains UI patterns established in existing bot commands

The feature integrates seamlessly with the existing fasting tracker while adding a crucial data management capability that users expect from a personal tracking tool.