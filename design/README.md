# design/ — Figma exports (visual source of truth)

Drop your Figma PNG exports here. `CLAUDE.md` and `docs/TECHNICAL_SPEC.md` point Claude Code to this folder for *look* (colors, spacing, components); they define *behavior*. When layout and spec disagree, the PNG wins; the data flow in the spec stays.

## How to export from Figma
Select each frame → right panel **Export** → **PNG @2x** → Export. (Or select the frame and `Shift+Ctrl/Cmd+E`.)

## Suggested filenames (so references stay stable)
```
00-role-selector.png
driver-01-home.png
driver-02-update-occupancy.png      # the 25/50/70/100 + −/＋ modal
driver-03-earnings.png
driver-04-profile.png
passenger-01-home.png               # "Where are you going?" + next-jeep card
passenger-02-home-waiting.png       # after "I'm waiting" → Cancel + Jeepney Details
passenger-03-jeepney-details.png
passenger-04-map.png                # routes, fare, popular destinations
passenger-05-profile.png
admin-01-dashboard.png
admin-02-live-operations.png
admin-03-passenger-demand.png
admin-04-analytics.png
admin-05-fleet-management.png        # stub
admin-06-driver-roster.png           # stub
admin-07-routes.png                  # stub
```

## Even better (optional)
If you can share the Figma **dev-mode link** or exact tokens, add a `tokens.md` here with hex colors, font family/sizes, and spacing. Otherwise Claude Code styles from these PNGs + the existing Tailwind `brand` palette (`#D32F2F` / `#F57C00` / `#388E3C` / `#1A1A2E`).
