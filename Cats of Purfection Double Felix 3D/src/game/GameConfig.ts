/**
 * Central tuning constants for Cats of Purfection Double Felix 3D.
 * All gameplay-feel numbers live here so maps/entities/weapons stay in sync.
 */
export const GameConfig = {
  player: {
    eyeHeight: 1.7,
    walkSpeed: 5.5,
    sprintSpeed: 9.0,
    jumpVelocity: 7.5,
    gravity: 20.0,
    mouseSensitivity: 0.0022,
    maxPitch: Math.PI / 2 - 0.05,
    collisionRadius: 0.45
  },
  arena: {
    size: 80,
    wallHeight: 6,
    wallThickness: 1
  },
  lives: {
    max: 9
  },
  weapon: {
    pistol: {
      fireRate: 6, // shots per second
      damage: 25,
      range: 200
    }
  }
} as const;
