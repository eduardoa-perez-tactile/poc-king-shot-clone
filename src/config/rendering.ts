export type RenderMode = '2d' | '3d'
export type VisualMode = 'primitive' | 'full'

// Feature flag to swap between legacy 2D and Babylon 3D rendering.
export const renderMode: RenderMode = '3d'

// Global 3D visual style toggle used by render factories.
export const VISUAL_MODE: VisualMode = 'primitive'

// Obstacle shaping defaults used during combat map preprocessing.
export const OBSTACLE_FOOTPRINT_SHRINK = 0.85
export const OBSTACLE_DENSITY_MULTIPLIER_DEFAULT = 1.2
export const OBSTACLE_WALL_CORRIDOR_MARGIN = 44
