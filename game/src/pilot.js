// The screenshot autopilot: the same rules a player follows, written as one function the
// screenshot scenes and the play-test harness both use. It takes off, steers at the next ring,
// the drop zone or the landing runway, holds a cruise or approach speed, drops the cargo over
// the zone, and flares for a gentle touchdown.
import { FIELD, MISSION, PLANE } from './config.js';
import { MISSION_DROP, MISSION_LAND, MISSION_RINGS } from './world.js';

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function steerPitch(plane, targetX, targetY) {
  const desired = clamp(Math.atan2(-(targetY - plane.y), Math.max(targetX - plane.x, 80)), -0.55, 0.55);
  if (plane.pitch < desired - 0.03) return 1;
  if (plane.pitch > desired + 0.03) return -1;
  return 0;
}

function steerThrottle(plane, targetSpeed) {
  if (plane.speed < targetSpeed - 15) return 1;
  if (plane.speed > targetSpeed + 15) return -1;
  return 0;
}

/** One step of flying: { pitch: -1|0|1, throttle: -1|0|1, interact: boolean }. */
export function autopilot(state) {
  const plane = state.plane;
  const mission = state.mission;
  if (!plane.rolling && !plane.airborne) return { pitch: 0, throttle: 0, interact: false };

  // On the ground: full throttle, pull up, and the world lifts the plane off at speed.
  if (plane.rolling) return { pitch: 1, throttle: 1, interact: false };

  if (mission.kind === MISSION_RINGS) {
    const ring = mission.rings[mission.ringIndex];
    if (!ring) return { pitch: 0, throttle: 0, interact: false };
    return {
      pitch: steerPitch(plane, ring.x, ring.y),
      throttle: steerThrottle(plane, 330),
      interact: false,
    };
  }

  if (mission.kind === MISSION_DROP) {
    const zone = mission.zone;
    return {
      pitch: steerPitch(plane, zone.x, 380),
      throttle: steerThrottle(plane, 320),
      interact: Math.abs(plane.x - zone.x) < 40 && plane.y < MISSION.dropCeilingY,
    };
  }

  // Landing: line up on a shallow glide, slow to approach speed, then cut the throttle and
  // flare a touch over the runway so the wheels kiss the strip instead of slamming it.
  const runway = mission.runway;
  const overRunway = plane.x >= runway.x0 && plane.x <= runway.x1;
  if (overRunway && plane.y > runway.y - 70 && plane.speed < 300) {
    return {
      pitch: plane.pitch < 0.12 ? 1 : 0,
      throttle: -1,
      interact: false,
    };
  }
  const far = plane.x < runway.x0 - 350;
  const targetX = far ? runway.x0 - 100 : (runway.x0 + runway.x1) / 2;
  const targetY = far ? runway.y - 120 : runway.y - 8;
  return {
    pitch: steerPitch(plane, targetX, targetY),
    throttle: steerThrottle(plane, far ? 320 : 210),
    interact: false,
  };
}
