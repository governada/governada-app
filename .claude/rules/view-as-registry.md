# View As Registry — Source of Truth for User States

The admin "View as" persona switcher is the canonical source of truth for all user persona x state combinations that affect UX in Governada. The registry lives at `lib/admin/viewAsRegistry.ts`.

## Hard Rule

Any PR that introduces a new user state dimension or value that changes what users see in the UI MUST also:

1. **Add it to the registry** — either as a new `SegmentPreset` entry or a new value in a `CrossCuttingDimension`, or as an entirely new dimension
2. **Make it overridable** — ensure the admin View As picker can simulate the new state
3. **Wire the override** — if it's a new cross-cutting dimension, extend `DimensionOverrides` in the registry, add state to `SegmentProvider`, and make the consuming hook respect the override

## What counts as a "new user state"

- A new user segment (beyond anonymous/citizen/drep/spo/cc)
- A new sub-state within an existing segment (e.g., a new citizen delegation type)
- A new cross-cutting dimension that affects rendering (e.g., a reputation tier, feature access level, subscription tier)
- A new value within an existing dimension (e.g., a 5th engagement level)

## What does NOT count

- Transient transaction states (delegation/voting phases)
- Feature flags (managed via admin flags page)
- Per-device states (localStorage onboarding, first-visit)
- API loading/error states

## Files involved

| File                                       | Purpose                                               |
| ------------------------------------------ | ----------------------------------------------------- |
| `lib/admin/viewAsRegistry.ts`              | Registry definitions (presets, dimensions, types)     |
| `components/providers/SegmentProvider.tsx` | Override state management + context                   |
| `components/governada/GovernadaHeader.tsx` | View As menu (renders from registry)                  |
| `hooks/useEngagement.ts`                   | Applies engagement/credibility overrides to hook data |

## Adding a new dimension (checklist)

1. Define the dimension in `viewAsRegistry.ts` using `CrossCuttingDimension<T>`
2. Add the type to `DimensionOverrides` interface
3. Add it to the `CROSS_CUTTING_DIMENSIONS` array
4. Extend `SegmentState` in `SegmentProvider.tsx` with a convenience getter
5. Update `DEFAULT_STATE` in SegmentProvider
6. In the consuming hook, use `useSegment().dimensionOverrides` to patch data when override is active
7. The GovernadaHeader menu auto-renders new dimensions from `CROSS_CUTTING_DIMENSIONS` — no menu changes needed
