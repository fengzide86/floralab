# FloraLab 1.3 · Render Handoff

## Goal
Keep a confirmed work the same work when it moves from Studio into visual generation.

The implementation separates three precision layers:
- **Facts**: Recipe, vessel/packaging, special objects and Mechanics.
- **Structure**: Blueprint focus, high/low, left/right, front/back, direction and silhouette.
- **Visual freedom**: petal pose, micro-folds, light, background, camera and shadows.

## Data rule
Render Spec is derived, not authoritative. It is computed at export/display time from Recipe / Mechanics / Blueprint. There is no second editable quantity field.

## UI
The 效果图 tab provides a front Render View, locked material facts and exact Recipe quantities, focus/silhouette/visual-mass/layer summaries, special-object anchors, a copyable Creative Space handoff, and post-generation self-check criteria.

## Quality rule
A render is not accepted as “strictly restored” when it visibly swaps species/colors, moves a confirmed special object, reverses the silhouette, or materially inflates/shrinks density. Branched material countability is a model limitation, not permission to alter Recipe.
