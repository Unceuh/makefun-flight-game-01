// The screenshot scenes behind ?shot=play|drop|land|end. Each one plays the real rules forward
// from a fresh world, steered by the autopilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame. The cover (play) is the rings leg at its
// busiest: plane, rings, islands, lit instruments and the HUD in one frame.
import { EVENT_LANDED, EVENT_OVER, EVENT_SORTIE, MISSION_DROP, MISSION_LAND } from './world.js';
import { autopilot } from './pilot.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { STEP } from './config.js';

const PLAY_SECONDS = 22;
const STEP_LIMIT = 60 * 180;

/** Run the autopilot until `stop` says so, or the step cap; returns the events it saw. */
function runUntil(world, stop) {
  let events = 0;
  for (let index = 0; index < STEP_LIMIT; index += 1) {
    const move = autopilot(world.state);
    events |= world.step(STEP, move.pitch, move.throttle, move.interact, false);
    if (stop(world.state, events)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (play, drop, land or end; any other name is the title) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    runUntil(world, (state, events) => state.clock >= PLAY_SECONDS || (events & EVENT_OVER) !== 0);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'drop') {
    runUntil(world, (state, events) => state.mission.kind === MISSION_DROP || (events & EVENT_OVER) !== 0);
    // Fly on into the zone so the frame shows the drop itself, not the approach.
    runUntil(world, (state, events) => Math.abs(state.plane.x - state.mission.zone.x) < 120 || (events & EVENT_OVER) !== 0);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'land') {
    runUntil(world, (state, events) => state.mission.kind === MISSION_LAND || (events & EVENT_OVER) !== 0);
    runUntil(world, (state, events) => (events & EVENT_LANDED) !== 0 || (events & EVENT_SORTIE) !== 0 || (events & EVENT_OVER) !== 0);
    // The landing leg ended the sortie and parked the plane home; fly the next sortie's
    // approach instead, so the frame shows the runway ahead, not the title.
    if (world.state.sortie > 1 && world.state.mission.kind !== MISSION_LAND) {
      runUntil(world, (state, events) => state.mission.kind === MISSION_LAND || (events & EVENT_OVER) !== 0);
    }
    runUntil(world, (state, events) => {
      const plane = state.plane;
      return (plane.airborne && plane.x > state.mission.runway.x0 - 500) || (events & EVENT_OVER) !== 0;
    });
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    runUntil(world, (state, events) => (events & EVENT_OVER) !== 0);
    return { screen: SCREEN_OVER, best: 0 };
  }
  for (let index = 0; index < 5 / STEP; index += 1) world.step(STEP, 0, false, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
