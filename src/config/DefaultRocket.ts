import { PartIds, SlotIds } from "../game/GameIds";

export const DefaultRocketLayout = {
    templateId: "template.basic",
    slots: {
        //[SlotIds.BASIC.NOSE.CPU]: PartIds.CPU_BASIC,
        //[SlotIds.BASIC.NOSE.ANTENNA]: PartIds.ANTENNA_SMALL,
        // [SlotIds.BASIC.NOSE.RW]: PartIds.RW_SMALL,
        [SlotIds.BASIC.BODY.TANK]: PartIds.FUEL_SMALL,
        //[SlotIds.BASIC.BODY.BATTERY]: PartIds.BATTERY_SMALL,
        [SlotIds.BASIC.TAIL.ENGINE]: PartIds.ENGINE_SMALL,
        //[SlotIds.BASIC.NOSE.SENSOR]: PartIds.SENSOR_NAV_BASIC
    }
};
