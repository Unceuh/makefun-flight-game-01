// The flight itself: physics, terrain, missions, fuel, damage and score. The plane always
// flies east along one long strip of sea and islands; a sortie is three legs — fly the rings,
// drop the cargo over Pulau Komodo, land on Pulau Raja — then the next sortie starts back home,
// a little harder. The renderer and the autopilot only ever read this state, never change it.
import { DAY_SECONDS, FIELD, FUEL, ISLANDS, LIVES, MISSION, PAY, PLANE, WORLD } from './config.js';

export const EVENT_RING = 1;
export const EVENT_DROPPED = 2;
export const EVENT_LANDED = 4;
export const EVENT_MISSION = 8;
export const EVENT_SORTIE = 16;
export const EVENT_CRASH = 32;
export const EVENT_OVER = 64;

export const MISSION_RINGS = 'rings';
export const MISSION_DROP = 'drop';
export const MISSION_LAND = 'land';

/** Half the plane's height: the belly that touches ground, rings and water. */
const PLANE_RADIUS = 14;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

/** The ground's top at world x: sea, volcano slope, or an island's flat top with beach ramps. */
export function groundYAt(x) {
  if (x >= 1500 && x <= 2100) return 560 - 180 * Math.sin((Math.PI * (x - 1500)) / 600);
  if (x >= 2600 && x < 2650) return lerp(560, 520, (x - 2600) / 50);
  if (x >= 2650 && x <= 3250) return 520;
  if (x > 3250 && x <= 3300) return lerp(520, 560, (x - 3250) / 50);
  if (x >= 4000 && x < 4050) return lerp(560, 500, (x - 4000) / 50);
  if (x >= 4050 && x <= 4650) return 500;
  if (x > 4650 && x <= 4700) return lerp(500, 560, (x - 4650) / 50);
  return FIELD.seaY;
}

/** What the ground at x is: sea, volcano, island grass, or a runway strip (with its island). */
export function terrainAt(x) {
  for (const island of ISLANDS) {
    if (island.runway && x >= island.runway.x0 && x <= island.runway.x1) {
      return { y: island.runway.y, kind: 'runway', island };
    }
  }
  const y = groundYAt(x);
  if (x >= 1500 && x <= 2100) return { y, kind: 'volcano', island: ISLANDS[1] };
  for (const island of ISLANDS) {
    if (x >= island.x0 && x <= island.x1) return { y, kind: 'land', island };
  }
  return { y, kind: 'sea', island: null };
}

export function createWorld(random) {
  const state = {
    clock: 0,
    score: 0,
    missionsDone: 0,
    sortiesDone: 0,
    ringsHit: 0,
    dropsDone: 0,
    landingsDone: 0,
    lives: LIVES,
    dayLeft: DAY_SECONDS,
    sortie: 1,
    wind: 0,
    message: '',
    messageT: 0,
    plane: null,
    mission: null,
  };

  function buildMissions(sortie) {
    const radius = Math.max(MISSION.ringRadiusMin, MISSION.ringRadius - (sortie - 1) * 3);
    const rings = MISSION.ringXs.map((x, index) => {
      const [yMin, yMax] = MISSION.ringYs[index];
      return {
        x,
        y: yMin + random() * (yMax - yMin),
        r: radius,
        passed: false,
      };
    });
    return {
      kind: MISSION_RINGS,
      rings,
      ringIndex: 0,
      zone: {
        x: MISSION.dropX,
        halfWidth: Math.max(MISSION.dropHalfWidthMin, MISSION.dropHalfWidth - (sortie - 1) * 5),
      },
      runway: ISLANDS[3].runway,
      runwayName: ISLANDS[3].name,
    };
  }

  function parkPlane() {
    const home = ISLANDS[0].runway;
    state.plane = {
      x: home.x0 + 60,
      y: home.y,
      vx: 0,
      vy: 0,
      speed: 0,
      pitch: 0,
      throttle: 0,
      fuel: FUEL.max,
      damage: 0,
      cargo: true,
      airborne: false,
      rolling: true,
    };
  }

  function startSortie(sortie) {
    state.sortie = sortie;
    state.wind = (random() * 2 - 1) * Math.min(MISSION.windMax, MISSION.windBase + (sortie - 1) * MISSION.windPerSortie);
    state.mission = buildMissions(sortie);
    parkPlane();
  }

  function say(text) {
    state.message = text;
    state.messageT = 2.5;
  }

  function reset() {
    state.clock = 0;
    state.score = 0;
    state.missionsDone = 0;
    state.sortiesDone = 0;
    state.ringsHit = 0;
    state.dropsDone = 0;
    state.landingsDone = 0;
    state.lives = LIVES;
    state.dayLeft = DAY_SECONDS;
    state.message = '';
    state.messageT = 0;
    startSortie(1);
  }

  function crash(events) {
    state.lives -= 1;
    say(state.lives > 0 ? `Pesawat jatuh! ${state.lives} nyawa tersisa.` : 'Pesawat jatuh!');
    if (state.lives <= 0) return events | EVENT_CRASH | EVENT_OVER;
    startSortie(state.sortie);
    return events | EVENT_CRASH;
  }

  function advanceMission(events) {
    state.missionsDone += 1;
    if (state.mission.kind === MISSION_RINGS) {
      state.mission.kind = MISSION_DROP;
      say('Cincin selesai! Antar kargo ke Pulau Komodo.');
      return events | EVENT_MISSION;
    }
    if (state.mission.kind === MISSION_DROP) {
      state.mission.kind = MISSION_LAND;
      say('Kargo sampai! Mendarat di Pulau Raja.');
      return events | EVENT_MISSION;
    }
    // Landing leg done: the sortie is complete.
    const bonus = PAY.land + PAY.sortie;
    state.score += bonus;
    state.sortiesDone += 1;
    state.landingsDone += 1;
    say(`Sortie selesai! +${bonus} poin.`);
    startSortie(state.sortie + 1);
    return events | EVENT_MISSION | EVENT_SORTIE;
  }

  function step(dt, pitchInput, throttleInput, interact, idle) {
    state.clock += dt;
    if (state.messageT > 0) state.messageT -= dt;
    if (idle) return 0;
    state.dayLeft -= dt;
    if (state.dayLeft <= 0) {
      state.dayLeft = 0;
      return EVENT_OVER;
    }
    const plane = state.plane;
    let events = 0;

    plane.pitch = clamp(plane.pitch + pitchInput * PLANE.pitchRate * dt, -PLANE.pitchMax, PLANE.pitchMax);
    plane.throttle = clamp(plane.throttle + throttleInput * 0.9 * dt, 0, 1);
    plane.fuel -= (FUEL.idle + plane.throttle * (FUEL.fullThrottle - FUEL.idle)) * dt;
    if (plane.fuel <= 0) {
      plane.fuel = 0;
      plane.throttle = 0;
    }

    if (plane.rolling) {
      plane.speed = Math.max(0, plane.speed + (plane.throttle * PLANE.accel * 1.6 - 26) * dt);
      plane.x += plane.speed * dt;
      plane.vx = plane.speed;
      plane.vy = 0;
      plane.y = groundYAt(plane.x);
      const ground = terrainAt(plane.x);
      if (ground.kind === 'sea' || ground.kind === 'volcano') return crash(events);
      if (plane.speed >= PLANE.takeoffSpeed && plane.pitch > 0.04) {
        plane.airborne = true;
        plane.rolling = false;
        say('Lepas landas!');
      }
      return events;
    }

    const targetSpeed = plane.throttle * PLANE.maxSpeed;
    const rate = targetSpeed > plane.speed ? PLANE.accel : PLANE.decel;
    plane.speed += clamp(targetSpeed - plane.speed, -rate * dt, rate * dt);
    const sink = clamp((PLANE.stallSpeed - plane.speed) / PLANE.stallSpeed, 0, 1) * PLANE.sinkAtStall;
    plane.vx = plane.speed * Math.cos(plane.pitch) + state.wind;
    plane.vy = -plane.speed * Math.sin(plane.pitch) + sink;
    plane.x += plane.vx * dt;
    plane.y += plane.vy * dt;
    if (plane.y < 40) plane.y = 40;
    if (plane.x > WORLD.width - WORLD.edge) plane.x = WORLD.width - WORLD.edge;
    if (plane.x < WORLD.edge) plane.x = WORLD.edge;

    // Rings: fly through the next one, or fly past it and it is missed.
    if (state.mission.kind === MISSION_RINGS) {
      const ring = state.mission.rings[state.mission.ringIndex];
      if (ring) {
        const dx = plane.x - ring.x;
        const dy = plane.y - ring.y;
        if (dx * dx + dy * dy < ring.r * ring.r) {
          ring.passed = true;
          state.mission.ringIndex += 1;
          state.ringsHit += 1;
          state.score += PAY.ring;
          events |= EVENT_RING;
          say(`Cincin ${state.mission.ringIndex}/3! +${PAY.ring}`);
          if (state.mission.ringIndex >= state.mission.rings.length) events = advanceMission(events);
        } else if (plane.x > ring.x + 90) {
          state.mission.ringIndex += 1;
          say('Cincin terlewat.');
          if (state.mission.ringIndex >= state.mission.rings.length) events = advanceMission(events);
        }
      }
    }

    // Cargo drop: Space over the zone, low enough, while carrying cargo. Fly past the zone
    // without dropping and the drop is missed — the leg moves on without its points.
    if (state.mission.kind === MISSION_DROP && plane.cargo && interact) {
      const zone = state.mission.zone;
      if (Math.abs(plane.x - zone.x) <= zone.halfWidth && plane.y < MISSION.dropCeilingY) {
        plane.cargo = false;
        state.dropsDone += 1;
        state.score += PAY.drop;
        events |= EVENT_DROPPED;
        say(`Kargo dijatuhkan! +${PAY.drop}`);
        events = advanceMission(events);
      }
    }
    if (state.mission.kind === MISSION_DROP && plane.cargo && plane.x > state.mission.zone.x + 400) {
      plane.cargo = false;
      say('Kargo terlewat — lanjut ke Pulau Raja.');
      events = advanceMission(events);
    }

    // Missed approach: past the runway with nowhere to land, the plane returns to base for
    // another try at the landing leg, keeping the rings and the drop already earned.
    if (state.mission.kind === MISSION_LAND && plane.airborne && plane.x > state.mission.runway.x1 + 250) {
      say('Melewati landasan — kembali ke Pulau Garuda.');
      parkPlane();
      return events;
    }

    // Ground contact: runway, island grass, volcano slope or sea. A climbing plane is moving
    // away from the ground, so only a descent can touch down; this also keeps a fresh takeoff
    // from re-landing on its first steps while it is still at runway height.
    const ground = terrainAt(plane.x);
    if (plane.y + PLANE_RADIUS >= ground.y) {
      if (plane.vy < 0) {
        plane.y = ground.y - PLANE_RADIUS;
        return events;
      }
      plane.y = ground.y - PLANE_RADIUS;
      if (ground.kind === 'runway') {
        if (Math.abs(plane.vy) <= PLANE.safeTouchdownVy && plane.speed <= PLANE.safeTouchdownSpeed) {
          plane.airborne = false;
          plane.rolling = true;
          plane.vy = 0;
          plane.speed *= 0.55;
          events |= EVENT_LANDED;
          if (state.mission.kind === MISSION_LAND && ground.island === ISLANDS[3]) {
            say('Pendaratan mulus!');
            events = advanceMission(events);
          } else {
            say('Mendarat. Isi bahan bakar…');
            plane.fuel = FUEL.max;
            plane.damage = 0;
            if (!plane.cargo) plane.cargo = true;
          }
        } else {
          return crash(events);
        }
      } else if (ground.kind === 'land') {
        plane.damage += PLANE.roughDamage;
        plane.airborne = false;
        plane.rolling = true;
        plane.vy = 0;
        plane.speed *= 0.4;
        events |= EVENT_LANDED;
        say('Pendaratan kasar di rumput!');
        if (plane.damage >= 100) return crash(events);
      } else {
        return crash(events);
      }
    }
    return events;
  }

  reset();

  return { state, reset, step };
}
