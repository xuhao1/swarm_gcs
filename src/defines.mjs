class CommanderDefines {
}

CommanderDefines.CTRL_POS_COMMAND=0
CommanderDefines.CTRL_VEL_COMMAND=1
CommanderDefines.CTRL_ATT_COMMAND=2
CommanderDefines.CTRL_MISSION_LOAD_COMMAND=3
CommanderDefines.CTRL_MISSION_END_COMMAND=4
CommanderDefines.CTRL_TAKEOF_COMMAND=5
CommanderDefines.CTRL_LANDING_COMMAND=6
CommanderDefines.CTRL_HOVER_COMMAND=7
CommanderDefines.CTRL_ARM_COMMAND=8
CommanderDefines.CTRL_PLANING_TGT_COMMAND=10
CommanderDefines.CTRL_FORMATION_IDLE=11
// Passive hold in master's local frame
CommanderDefines.CTRL_FORMATION_HOLD_0=12
// Passive hold in master's natural frame
CommanderDefines.CTRL_FORMATION_HOLD_1=13
// Activate fly in master's local frame
CommanderDefines.CTRL_FORMATION_FLY_0=14
// Activate fly master's natural frame
CommanderDefines.CTRL_FORMATION_FLY_1=15
CommanderDefines.CTRL_SPEC_TRAJS=16
CommanderDefines.CTRL_MISSION_TRAJS=20
CommanderDefines.CTRL_TASK_EXPROLARATION=30
CommanderDefines.CTRL_END_MISSION=99


function generateCommand(command_type, source_id = -1, target_id = -1, param1 = 0, param2 = 0, param3 = 0, param4 = 0, param5 = 0, param6 = 0, param7 = 0, param8 = 0, param9 = 0, param10 = 0) {
    return {
        header: {
            stamp: {
                sec: 0,
                nsec: 0
            },
            frame_id: ''
        },
        source_id: source_id,
        target_id: target_id,
        command_type: command_type,
        param1: param1,
        param2: param2,
        param3: param3,
        param4: param4,
        param5: param5,
        param6: param6,
        param7: param7,
        param8: param8,
        param9: param9,
        param10: param10
    }
}

// exports all the constants

export {CommanderDefines, generateCommand}