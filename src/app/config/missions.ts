import { MissionManager, ReachAltitudeMission, ReachSpeedMission, ReachSpaceMission, CircularizeOrbitMission, EnterSoIMission, StayAloftMission } from "../../game/MissionManager";

/**
 * Seeds the default set of missions into a MissionManager instance.
 * Keeping mission definitions in config centralizes setup and avoids duplication.
 */
export function seedDefaultMissions(missionMgr: MissionManager): void {
  missionMgr.addMission(new ReachAltitudeMission(
    "mission.reach.500m",
    "Reach 500 m",
    "Climb to 500 meters altitude to earn $1000 and unlock larger tanks.",
    500,
    1000,
  ));
  missionMgr.addMission(new ReachAltitudeMission(
    "mission.reach.1km",
    "Reach 1 km",
    "Climb to 1,000 meters altitude to earn $1500 and unlock advanced guidance.",
    1000,
    1500,
  ));
  missionMgr.addMission(new ReachAltitudeMission(
    "mission.reach.2km",
    "Reach 2 km",
    "Climb to 2,000 meters altitude to earn $2000.",
    2000,
    2000,
  ));
  missionMgr.addMission(new ReachSpeedMission(
    "mission.speed.100",
    "Hit 100 m/s",
    "Accelerate to a speed of 100 m/s.",
    100,
    800,
  ));
  missionMgr.addMission(new ReachSpeedMission(
    "mission.speed.200",
    "Hit 200 m/s",
    "Accelerate to a speed of 200 m/s.",
    200,
    1200,
  ));
  missionMgr.addMission(new ReachSpaceMission(
    "mission.reach.space",
    "Reach Space",
    "Leave the atmosphere (air density reaches zero).",
    2500,
  ));
  missionMgr.addMission(new CircularizeOrbitMission(
    "mission.orbit.2km",
    "Circularize ~2 km",
    "Achieve a near-circular orbit with Ap >= 2 km and Pe >= 2 km.",
    2000,
    2000,
    0.1,
  ));
  missionMgr.addMission(new EnterSoIMission(
    "mission.soi.moon",
    "Enter Moon SOI",
    "Enter the sphere of influence of the Moon.",
    "moon",
    5000,
  ));
  missionMgr.addMission(new StayAloftMission(
    "mission.stay.200m.30s",
    "Stay above 200 m for 30 s",
    "Remain above 200 meters altitude continuously for at least 30 seconds.",
    200,
    30,
    600,
  ));
}
