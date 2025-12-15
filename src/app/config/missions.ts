import { MissionManager, GenericMission } from "../../game/MissionManager";
import { MissionList } from "../../game/missions/MissionData";

/**
 * Seeds the default set of missions into a MissionManager instance.
 * Loads missions from MissionData definitions.
 */
export function seedDefaultMissions(missionMgr: MissionManager): void {
  for (const def of MissionList) {
    if (def.state !== 'locked' && def.state !== 'available') continue; // Only add base available/locked missions? Or add all?
    // Actually we should add all defined missions so manager tracks them.
    // Init state logic should probably handle unlocking.
    // For now, just add them ALL.
    missionMgr.addMission(new GenericMission(def));
  }
}
